import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { OrcamentoData, OrcamentoSquadBreakdown, OrcamentoEmpBreakdown } from "@/lib/types";

export const dynamic = "force-dynamic";

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const curMonth = `${year}-${String(month).padStart(2, "0")}`;
    const diasNoMes = getDaysInMonth(year, month);
    const diasPassados = now.getDate();
    const startDate = `${curMonth}-01`;

    // Último snapshot date
    const { data: latestSnap } = await supabase
      .from("squad_meta_ads")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1);

    const snapshotDate = latestSnap?.[0]?.snapshot_date || now.toISOString().split("T")[0];

    // Queries paralelas
    const [orcRes, metaAllRes, metaLatestRes] = await Promise.all([
      supabase.from("squad_orcamento").select("*").eq("mes", curMonth).maybeSingle(),
      // Todos snapshots do mês para max spend_month por ad
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month, squad_id, empreendimento")
        .gte("snapshot_date", startDate),
      // Último snapshot para campaign_name + effective_status (contagem de campanhas ativas)
      supabase
        .from("squad_meta_ads")
        .select("ad_id, campaign_name, effective_status, squad_id, empreendimento")
        .eq("snapshot_date", snapshotDate),
    ]);

    if (orcRes.error) console.warn("Orcamento query error:", orcRes.error.message);
    if (metaAllRes.error) console.warn("Meta all query error:", metaAllRes.error.message);
    if (metaLatestRes.error) console.warn("Meta latest query error:", metaLatestRes.error.message);

    const orcamentoTotal = Number(orcRes.data?.orcamento_total) || 0;

    // Max spend_month por ad_id em todos os snapshots do mês
    const adMaxSpend = new Map<string, { spend: number; squadId: number; emp: string }>();
    for (const row of metaAllRes.data || []) {
      const spend = Number(row.spend_month) || 0;
      const cur = adMaxSpend.get(row.ad_id);
      if (!cur || spend > cur.spend) {
        adMaxSpend.set(row.ad_id, { spend, squadId: row.squad_id, emp: row.empreendimento });
      }
    }

    // Gasto por empreendimento e squad
    const empSpend = new Map<string, number>(); // emp -> spend
    let gastoAtual = 0;
    for (const [, data] of adMaxSpend) {
      gastoAtual += data.spend;
      const key = `${data.squadId}:${data.emp}`;
      empSpend.set(key, (empSpend.get(key) || 0) + data.spend);
    }
    gastoAtual = Math.round(gastoAtual * 100) / 100;

    // Campanhas ativas por empreendimento (dedupadas por campaign_name)
    const empCampaigns = new Map<string, Set<string>>(); // "sqId:emp" -> Set<campaign_name>
    for (const row of metaLatestRes.data || []) {
      if (row.effective_status !== "ACTIVE") continue;
      const key = `${row.squad_id}:${row.empreendimento}`;
      if (!empCampaigns.has(key)) empCampaigns.set(key, new Set());
      empCampaigns.get(key)!.add(row.campaign_name);
    }

    // Gasto diário = gasto atual / dias passados (campanhas ativas)
    // Calcular gasto de campanhas ativas apenas
    let gastoAtivo = 0;
    const activeCampaigns = new Set<string>();
    for (const row of metaLatestRes.data || []) {
      if (row.effective_status === "ACTIVE") activeCampaigns.add(row.ad_id);
    }
    for (const [adId, data] of adMaxSpend) {
      if (activeCampaigns.has(adId)) gastoAtivo += data.spend;
    }
    const gastoDiario = diasPassados > 0
      ? Math.round((gastoAtivo / diasPassados) * 100) / 100
      : 0;

    // Projeção
    const projecaoMes = diasPassados >= 3
      ? Math.round((gastoAtual / diasPassados) * diasNoMes * 100) / 100
      : Math.round(gastoDiario * diasNoMes * 100) / 100;

    const ritmoIdeal = orcamentoTotal > 0
      ? Math.round((orcamentoTotal / diasNoMes) * diasPassados * 100) / 100
      : 0;

    // Status
    let status: "ok" | "alerta" | "critico" = "ok";
    if (orcamentoTotal > 0) {
      const ratio = projecaoMes / orcamentoTotal;
      if (ratio > 1.15) status = "critico";
      else if (ratio > 1.05) status = "alerta";
    }

    // Breakdown por squad com empreendimentos
    const squadsBreakdown: OrcamentoSquadBreakdown[] = SQUADS.map((sq) => {
      const empreendimentos: OrcamentoEmpBreakdown[] = sq.empreendimentos.map((emp) => {
        const key = `${sq.id}:${emp}`;
        const empGasto = Math.round((empSpend.get(key) || 0) * 100) / 100;
        const empCampCount = empCampaigns.get(key)?.size || 0;
        return {
          emp,
          gastoAtual: empGasto,
          gastoDiario: diasPassados > 0 ? Math.round((empGasto / diasPassados) * 100) / 100 : 0,
          campaignsActive: empCampCount,
        };
      });

      const sqGasto = empreendimentos.reduce((s, e) => s + e.gastoAtual, 0);
      const sqCampaigns = empreendimentos.reduce((s, e) => s + e.campaignsActive, 0);

      return {
        id: sq.id,
        name: sq.name,
        gastoAtual: Math.round(sqGasto * 100) / 100,
        gastoDiario: diasPassados > 0 ? Math.round((sqGasto / diasPassados) * 100) / 100 : 0,
        campaignsActive: sqCampaigns,
        empreendimentos,
      };
    });

    const result: OrcamentoData = {
      mes: curMonth,
      orcamentoTotal,
      gastoAtual,
      gastoDiario,
      diasNoMes,
      diasPassados,
      projecaoMes,
      ritmoIdeal,
      status,
      squads: squadsBreakdown,
      snapshotDate,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Orcamento GET error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mes, orcamentoTotal } = body as { mes: string; orcamentoTotal: number };

    if (!mes || typeof orcamentoTotal !== "number") {
      return NextResponse.json({ error: "mes e orcamentoTotal são obrigatórios" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("squad_orcamento")
      .upsert({ mes, orcamento_total: orcamentoTotal, updated_at: new Date().toISOString() }, { onConflict: "mes" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Orcamento POST error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
