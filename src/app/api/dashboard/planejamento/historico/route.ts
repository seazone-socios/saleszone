import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { HistoricoAdRow, HistoricoCampanhasData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, anonKey);

    // Buscar dados de ads + funil por empreendimento (lifetime, sem filtro de data)
    const [historicoRes, funnelRes] = await Promise.all([
      supabase.rpc("get_historico_campanhas"),
      supabase.rpc("get_planejamento_counts", { months_back: 0, days_back: -1 }),
    ]);

    if (historicoRes.error) throw new Error(`RPC error: ${historicoRes.error.message}`);
    if (funnelRes.error) console.warn(`Funnel RPC error (non-fatal): ${funnelRes.error.message}`);

    // Agregar funil por empreendimento (somar todos os meses)
    const empFunnel = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const row of funnelRes.data || []) {
      const emp = row.empreendimento;
      const cur = empFunnel.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      cur.mql += Number(row.mql) || 0;
      cur.sql += Number(row.sql) || 0;
      cur.opp += Number(row.opp) || 0;
      cur.won += Number(row.won) || 0;
      empFunnel.set(emp, cur);
    }

    // Calcular spend total por empreendimento (para distribuição proporcional)
    const empSpend = new Map<string, number>();
    for (const row of historicoRes.data || []) {
      const emp = row.empreendimento || "";
      const spend = Number(row.spend) || 0;
      empSpend.set(emp, (empSpend.get(emp) || 0) + spend);
    }

    const ads: HistoricoAdRow[] = [];
    for (const row of historicoRes.data || []) {
      const spend = Number(row.spend) || 0;
      const leads = Number(row.leads) || 0;
      const impressions = Number(row.impressions) || 0;
      const clicks = Number(row.clicks) || 0;
      const emp = row.empreendimento || "";

      // Atribuir funil proporcionalmente pelo share de spend dentro do empreendimento
      const funnel = empFunnel.get(emp);
      const totalEmpSpend = empSpend.get(emp) || 0;
      const spendShare = totalEmpSpend > 0 ? spend / totalEmpSpend : 0;
      const mql = funnel ? Math.round(funnel.mql * spendShare) : 0;
      const sql = funnel ? Math.round(funnel.sql * spendShare) : 0;
      const opp = funnel ? Math.round(funnel.opp * spendShare) : 0;
      const won = funnel ? Math.round(funnel.won * spendShare) : 0;

      ads.push({
        adId: row.ad_id,
        adName: row.ad_name || "",
        adsetName: row.adset_name || "",
        campaignName: row.campaign_name || "",
        empreendimento: emp,
        effectiveStatus: row.effective_status || "PAUSED",
        spend,
        leads,
        mql,
        sql,
        opp,
        won,
        impressions,
        clicks,
        cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
        cmql: mql > 0 ? Math.round((spend / mql) * 100) / 100 : 0,
        csql: sql > 0 ? Math.round((spend / sql) * 100) / 100 : 0,
        copp: opp > 0 ? Math.round((spend / opp) * 100) / 100 : 0,
        cpw: won > 0 ? Math.round((spend / won) * 100) / 100 : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
        lastSeenDate: row.last_seen_date || "",
      });
    }

    const result: HistoricoCampanhasData = { ads };
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Historico campanhas error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
