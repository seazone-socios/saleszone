import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { CampanhasData, CampanhasSquadSummary, CampanhasEmpSummary, MetaAdRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    let snapshotDate = dateParam;

    if (!snapshotDate) {
      // Buscar a data mais recente disponível
      const { data: latest } = await supabase
        .from("squad_meta_ads")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);

      if (!latest || latest.length === 0) {
        return NextResponse.json({
          snapshotDate: new Date().toISOString().split("T")[0],
          summary: { totalAds: 0, totalSpend: 0, totalLeads: 0, avgCpl: 0, criticos: 0, alertas: 0 },
          squads: [],
          top10: [],
        } satisfies CampanhasData);
      }
      snapshotDate = latest[0].snapshot_date;
    }

    const { data: rows, error } = await supabase
      .from("squad_meta_ads")
      .select("*")
      .eq("snapshot_date", snapshotDate)
      .order("spend", { ascending: false });

    if (error) throw new Error(`Supabase error: ${error.message}`);

    const ads = rows || [];

    // Summary
    const totalAds = ads.length;
    const totalSpend = ads.reduce((s, r) => s + Number(r.spend), 0);
    const totalLeads = ads.reduce((s, r) => s + (r.leads || 0), 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const criticos = ads.filter((r) => r.severidade === "CRITICO").length;
    const alertas = ads.filter((r) => r.severidade === "ALERTA").length;

    // Per squad
    const squads: CampanhasSquadSummary[] = SQUADS.map((sq) => {
      const sqAds = ads.filter((r) => r.squad_id === sq.id);
      const empMap = new Map<string, typeof sqAds>();
      for (const ad of sqAds) {
        const key = ad.empreendimento;
        if (!empMap.has(key)) empMap.set(key, []);
        empMap.get(key)!.push(ad);
      }

      const empreendimentos: CampanhasEmpSummary[] = sq.empreendimentos.map((emp) => {
        const empAds = empMap.get(emp) || [];
        const spend = empAds.reduce((s, r) => s + Number(r.spend), 0);
        const leads = empAds.reduce((s, r) => s + (r.leads || 0), 0);
        return {
          emp,
          ads: empAds.length,
          spend: Math.round(spend * 100) / 100,
          leads,
          cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
          criticos: empAds.filter((r) => r.severidade === "CRITICO").length,
          alertas: empAds.filter((r) => r.severidade === "ALERTA").length,
        };
      });

      const sqSpend = sqAds.reduce((s, r) => s + Number(r.spend), 0);
      const sqLeads = sqAds.reduce((s, r) => s + (r.leads || 0), 0);

      return {
        id: sq.id,
        name: sq.name,
        empreendimentos,
        totalSpend: Math.round(sqSpend * 100) / 100,
        totalLeads: sqLeads,
        avgCpl: sqLeads > 0 ? Math.round((sqSpend / sqLeads) * 100) / 100 : 0,
        criticos: sqAds.filter((r) => r.severidade === "CRITICO").length,
        alertas: sqAds.filter((r) => r.severidade === "ALERTA").length,
      };
    });

    // Top 10 problemas (CRITICO primeiro, depois ALERTA, por gasto desc)
    const problemAds = ads
      .filter((r) => r.severidade !== "OK")
      .sort((a, b) => {
        const sevOrder = { CRITICO: 2, ALERTA: 1, OK: 0 };
        const diff = (sevOrder[b.severidade as keyof typeof sevOrder] || 0) - (sevOrder[a.severidade as keyof typeof sevOrder] || 0);
        if (diff !== 0) return diff;
        return Number(b.spend) - Number(a.spend);
      })
      .slice(0, 10);

    const top10: MetaAdRow[] = problemAds.map((r) => ({
      ad_id: r.ad_id,
      campaign_name: r.campaign_name || "",
      adset_name: r.adset_name || "",
      ad_name: r.ad_name || "",
      empreendimento: r.empreendimento,
      squad_id: r.squad_id,
      impressions: r.impressions || 0,
      clicks: r.clicks || 0,
      spend: Number(r.spend),
      leads: r.leads || 0,
      cpl: Number(r.cpl),
      ctr: Number(r.ctr),
      cpm: Number(r.cpm),
      frequency: Number(r.frequency),
      cpc: Number(r.cpc),
      severidade: r.severidade as "CRITICO" | "ALERTA" | "OK",
      diagnostico: r.diagnostico || null,
    }));

    const result: CampanhasData = {
      snapshotDate: snapshotDate!,
      summary: {
        totalAds,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalLeads,
        avgCpl: Math.round(avgCpl * 100) / 100,
        criticos,
        alertas,
      },
      squads,
      top10,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Campanhas error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
