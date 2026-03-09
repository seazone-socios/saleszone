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
      const { data: latest } = await supabase
        .from("squad_meta_ads")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1);

      if (!latest || latest.length === 0) {
        return NextResponse.json({
          snapshotDate: new Date().toISOString().split("T")[0],
          summary: { totalAds: 0, totalSpend: 0, totalLeads: 0, avgCpl: 0, criticos: 0, alertas: 0, totalMql: 0, totalSql: 0, totalOpp: 0, totalWon: 0, cpw: 0, totalSpendMonth: 0 },
          squads: [],
          top10: [],
        } satisfies CampanhasData);
      }
      snapshotDate = latest[0].snapshot_date;
    }

    const monthPrefix = snapshotDate!.substring(0, 7);
    const startDate = `${monthPrefix}-01`;

    // Queries paralelas: Meta Ads + Funil por ad (lifetime) + Contagens diárias (funil empreendimento)
    const [metaRes, funnelRes, countsRes] = await Promise.all([
      supabase
        .from("squad_meta_ads")
        .select("*")
        .eq("snapshot_date", snapshotDate)
        .order("spend", { ascending: false }),
      supabase.rpc("get_ad_funnel_counts", { start_date: startDate }),
      supabase
        .from("squad_daily_counts")
        .select("tab, empreendimento, count, date")
        .gte("date", startDate)
        .lte("date", snapshotDate),
    ]);

    if (metaRes.error) throw new Error(`Supabase error: ${metaRes.error.message}`);
    if (funnelRes.error) console.warn(`Funnel query error (non-fatal): ${funnelRes.error.message}`);
    if (countsRes.error) console.warn(`Counts query error (non-fatal): ${countsRes.error.message}`);

    const ads = metaRes.data || [];

    // Map<empreendimento, {mql, sql, opp, won}> do squad_daily_counts (filtrado pelo mês)
    const countsMap = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const row of countsRes.data || []) {
      const emp = row.empreendimento;
      const tab = row.tab?.toLowerCase();
      if (!countsMap.has(emp)) countsMap.set(emp, { mql: 0, sql: 0, opp: 0, won: 0 });
      const entry = countsMap.get(emp)!;
      const c = Number(row.count) || 0;
      if (tab === "mql") entry.mql += c;
      else if (tab === "sql") entry.sql += c;
      else if (tab === "opp") entry.opp += c;
      else if (tab === "won") entry.won += c;
    }

    // Map<ad_id, {mql, sql, opp, won}> do funil rastreado (lifetime)
    const adFunnel = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const row of funnelRes.data || []) {
      adFunnel.set(row.ad_id, {
        mql: Number(row.mql),
        sql: Number(row.sql_count),
        opp: Number(row.opp),
        won: Number(row.won),
      });
    }

    // Summary global
    const totalAds = ads.length;
    const totalSpend = ads.reduce((s, r) => s + Number(r.spend), 0);
    const totalLeads = ads.reduce((s, r) => s + (r.leads || 0), 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const criticos = ads.filter((r) => r.severidade === "CRITICO").length;
    const alertas = ads.filter((r) => r.severidade === "ALERTA").length;

    // Totais mensais (das novas colunas)
    const totalSpendMonth = ads.reduce((s, r) => s + Number(r.spend_month || 0), 0);
    const totalLeadsMonth = ads.reduce((s, r) => s + (r.leads_month || 0), 0);

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
        const impressions = empAds.reduce((s, r) => s + (r.impressions || 0), 0);
        const clicks = empAds.reduce((s, r) => s + (r.clicks || 0), 0);
        const leads = empAds.reduce((s, r) => s + (r.leads || 0), 0);

        // Funil empreendimento: usar squad_daily_counts (mais completo que adFunnel)
        const counts = countsMap.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
        const empMql = counts.mql, empSql = counts.sql, empOpp = counts.opp, empWon = counts.won;

        // Ads detail com funil por ad
        const adsDetail: MetaAdRow[] = empAds
          .map((r) => {
            const funnel = adFunnel.get(r.ad_id) || { mql: 0, sql: 0, opp: 0, won: 0 };
            const sp = Number(r.spend);
            return {
              ad_id: r.ad_id,
              campaign_name: r.campaign_name || "",
              adset_name: r.adset_name || "",
              ad_name: r.ad_name || "",
              empreendimento: r.empreendimento,
              squad_id: r.squad_id,
              impressions: r.impressions || 0,
              clicks: r.clicks || 0,
              spend: sp,
              leads: r.leads || 0,
              cpl: Number(r.cpl),
              ctr: Number(r.ctr),
              cpm: Number(r.cpm),
              frequency: Number(r.frequency),
              cpc: Number(r.cpc),
              severidade: r.severidade as "CRITICO" | "ALERTA" | "OK",
              diagnostico: r.diagnostico || null,
              mql: funnel.mql,
              sql: funnel.sql,
              opp: funnel.opp,
              won: funnel.won,
              cmql: funnel.mql > 0 ? Math.round((sp / funnel.mql) * 100) / 100 : 0,
              csql: funnel.sql > 0 ? Math.round((sp / funnel.sql) * 100) / 100 : 0,
              copp: funnel.opp > 0 ? Math.round((sp / funnel.opp) * 100) / 100 : 0,
              cpw: funnel.won > 0 ? Math.round((sp / funnel.won) * 100) / 100 : 0,
            };
          })
          .sort((a, b) => {
            if (a.spend === 0 && b.spend > 0) return 1;
            if (b.spend === 0 && a.spend > 0) return -1;
            if (a.leads > 0 && b.leads > 0) return a.cpl - b.cpl;
            if (a.leads > 0 && b.leads === 0) return -1;
            if (b.leads > 0 && a.leads === 0) return 1;
            if (a.clicks > 0 && b.clicks > 0) return a.cpc - b.cpc;
            if (a.clicks > 0 && b.clicks === 0) return -1;
            if (b.clicks > 0 && a.clicks === 0) return 1;
            return b.spend - a.spend;
          });

        return {
          emp,
          ads: empAds.length,
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          leads,
          cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          cmql: empMql > 0 ? Math.round((spend / empMql) * 100) / 100 : 0,
          csql: empSql > 0 ? Math.round((spend / empSql) * 100) / 100 : 0,
          copp: empOpp > 0 ? Math.round((spend / empOpp) * 100) / 100 : 0,
          criticos: empAds.filter((r) => r.severidade === "CRITICO").length,
          alertas: empAds.filter((r) => r.severidade === "ALERTA").length,
          mql: empMql,
          sql: empSql,
          opp: empOpp,
          won: empWon,
          cpw: empWon > 0 ? Math.round((spend / empWon) * 100) / 100 : 0,
          adsDetail,
        };
      });

      const sqSpend = sqAds.reduce((s, r) => s + Number(r.spend), 0);
      const sqLeads = sqAds.reduce((s, r) => s + (r.leads || 0), 0);
      const sqMql = empreendimentos.reduce((s, e) => s + e.mql, 0);
      const sqSql = empreendimentos.reduce((s, e) => s + e.sql, 0);
      const sqOpp = empreendimentos.reduce((s, e) => s + e.opp, 0);
      const sqWon = empreendimentos.reduce((s, e) => s + e.won, 0);
      const sqSpendMonth = sqAds.reduce((s, r) => s + Number(r.spend_month || 0), 0);
      const sqLeadsMonth = sqAds.reduce((s, r) => s + (r.leads_month || 0), 0);

      return {
        id: sq.id,
        name: sq.name,
        empreendimentos,
        totalSpend: Math.round(sqSpend * 100) / 100,
        totalLeads: sqLeads,
        avgCpl: sqLeads > 0 ? Math.round((sqSpend / sqLeads) * 100) / 100 : 0,
        criticos: sqAds.filter((r) => r.severidade === "CRITICO").length,
        alertas: sqAds.filter((r) => r.severidade === "ALERTA").length,
        totalMql: sqMql,
        totalSql: sqSql,
        totalOpp: sqOpp,
        totalWon: sqWon,
        cpw: sqWon > 0 ? Math.round((sqSpend / sqWon) * 100) / 100 : 0,
        totalSpendMonth: Math.round(sqSpendMonth * 100) / 100,
        totalLeadsMonth: sqLeadsMonth,
        spendAlert: false, // calculado abaixo
      };
    });

    // Alerta de gasto por squad: se gasto >5% ou <5% do target (total/3)
    const targetPerSquad = totalSpendMonth / 3;
    if (targetPerSquad > 0) {
      for (const sq of squads) {
        const deviation = Math.abs(sq.totalSpendMonth - targetPerSquad) / targetPerSquad;
        sq.spendAlert = deviation > 0.05;
      }
    }

    // Top 10 problemas
    const problemAds = ads
      .filter((r) => r.severidade !== "OK")
      .sort((a, b) => {
        const sevOrder = { CRITICO: 2, ALERTA: 1, OK: 0 };
        const diff = (sevOrder[b.severidade as keyof typeof sevOrder] || 0) - (sevOrder[a.severidade as keyof typeof sevOrder] || 0);
        if (diff !== 0) return diff;
        return Number(b.spend) - Number(a.spend);
      })
      .slice(0, 12);

    const top10: MetaAdRow[] = problemAds.map((r) => {
      const funnel = adFunnel.get(r.ad_id) || { mql: 0, sql: 0, opp: 0, won: 0 };
      const sp = Number(r.spend);
      return {
        ad_id: r.ad_id,
        campaign_name: r.campaign_name || "",
        adset_name: r.adset_name || "",
        ad_name: r.ad_name || "",
        empreendimento: r.empreendimento,
        squad_id: r.squad_id,
        impressions: r.impressions || 0,
        clicks: r.clicks || 0,
        spend: sp,
        leads: r.leads || 0,
        cpl: Number(r.cpl),
        ctr: Number(r.ctr),
        cpm: Number(r.cpm),
        frequency: Number(r.frequency),
        cpc: Number(r.cpc),
        severidade: r.severidade as "CRITICO" | "ALERTA" | "OK",
        diagnostico: r.diagnostico || null,
        mql: funnel.mql,
        sql: funnel.sql,
        opp: funnel.opp,
        won: funnel.won,
        cmql: funnel.mql > 0 ? Math.round((sp / funnel.mql) * 100) / 100 : 0,
        csql: funnel.sql > 0 ? Math.round((sp / funnel.sql) * 100) / 100 : 0,
        copp: funnel.opp > 0 ? Math.round((sp / funnel.opp) * 100) / 100 : 0,
        cpw: funnel.won > 0 ? Math.round((sp / funnel.won) * 100) / 100 : 0,
      };
    });

    const grandMql = squads.reduce((s, sq) => s + sq.totalMql, 0);
    const grandWon = squads.reduce((s, sq) => s + sq.totalWon, 0);

    const result: CampanhasData = {
      snapshotDate: snapshotDate!,
      summary: {
        totalAds,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalLeads: totalLeadsMonth,
        avgCpl: totalLeadsMonth > 0 ? Math.round((totalSpendMonth / totalLeadsMonth) * 100) / 100 : 0,
        criticos,
        alertas,
        totalMql: grandMql,
        totalSql: squads.reduce((s, sq) => s + sq.totalSql, 0),
        totalOpp: squads.reduce((s, sq) => s + sq.totalOpp, 0),
        totalWon: grandWon,
        cpw: grandWon > 0 ? Math.round((totalSpend / grandWon) * 100) / 100 : 0,
        totalSpendMonth: Math.round(totalSpendMonth * 100) / 100,
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
