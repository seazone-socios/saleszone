import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { CampanhasData, CampanhasSquadSummary, CampanhasEmpSummary, MetaAdRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const dateParam = req.nextUrl.searchParams.get("date");
    const filterParam = req.nextUrl.searchParams.get("filter"); // "paid" or null
    const paidOnly = filterParam === "paid";
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
          summary: { totalAds: 0, totalSpend: 0, totalLeads: 0, avgCpl: 0, criticos: 0, alertas: 0, totalMql: 0, totalSql: 0, totalOpp: 0, totalWon: 0, cmql: 0, copp: 0, cpw: 0, totalSpendMonth: 0, totalLeadsMonth: 0 },
          squads: [],
          top10: [],
        } satisfies CampanhasData);
      }
      snapshotDate = latest[0].snapshot_date;
    }

    const monthPrefix = snapshotDate!.substring(0, 7);
    const startDate = `${monthPrefix}-01`;

    // Queries paralelas: Meta Ads (último snapshot + todos do mês para max spend) + Funil + Contagens + WON
    const [metaRes, metaAllRes, funnelRes, countsRes, crossWonRes] = await Promise.all([
      supabase
        .from("squad_meta_ads")
        .select("*")
        .eq("snapshot_date", snapshotDate)
        .order("spend", { ascending: false }),
      // Todos os snapshots do mês para calcular max spend_month/leads_month por ad
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month, leads_month")
        .gte("snapshot_date", startDate),
      supabase.rpc("get_ad_funnel_counts", { start_date: startDate }),
      supabase.rpc("get_emp_counts_summary", { p_start_date: startDate }),
      supabase.rpc("get_ad_won_cross_emp"),
    ]);

    if (metaRes.error) throw new Error(`Supabase error: ${metaRes.error.message}`);
    if (metaAllRes.error) console.warn(`Meta all-month query error (non-fatal): ${metaAllRes.error.message}`);
    if (funnelRes.error) console.warn(`Funnel query error (non-fatal): ${funnelRes.error.message}`);
    if (countsRes.error) console.warn(`Counts RPC error (non-fatal): ${countsRes.error.message}`);
    if (crossWonRes.error) console.warn(`Cross-emp WON query error (non-fatal): ${crossWonRes.error.message}`);

    // Max spend_month/leads_month por ad em todos os snapshots do mês
    const adMaxSpend = new Map<string, { spend: number; leads: number }>();
    for (const row of metaAllRes.data || []) {
      const cur = adMaxSpend.get(row.ad_id);
      const spend = Number(row.spend_month) || 0;
      const leads = row.leads_month || 0;
      if (!cur || spend > cur.spend) {
        adMaxSpend.set(row.ad_id, { spend, leads: Math.max(leads, cur?.leads || 0) });
      } else if (cur) {
        cur.leads = Math.max(cur.leads, leads);
      }
    }

    // Aplicar max spend/leads nos ads do snapshot mais recente
    const ads = (metaRes.data || []).map((ad) => {
      const maxData = adMaxSpend.get(ad.ad_id);
      return {
        ...ad,
        spend_month: maxData ? maxData.spend : (Number(ad.spend_month) || 0),
        leads_month: maxData ? maxData.leads : (ad.leads_month || 0),
      };
    });

    // Ads que existem em snapshots anteriores mas NÃO no último (foram removidos)
    // → adicionar com dados mínimos para preservar o gasto do mês
    const latestAdIds = new Set(ads.map((a) => a.ad_id));
    for (const [adId, maxData] of adMaxSpend) {
      if (!latestAdIds.has(adId) && maxData.spend > 0) {
        // Buscar dados completos do ad no snapshot mais recente onde ele apareceu
        // Não temos aqui, mas o spend é preservado no total via funil route
        // Para campanhas, esses ads "desaparecidos" contribuem apenas no total
      }
    }

    // Maps pré-agregados pela RPC (lifetime + mês)
    const countsMapAll = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    const countsMapMonth = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const row of countsRes.data || []) {
      countsMapAll.set(row.empreendimento, {
        mql: Number(row.mql_life) || 0,
        sql: Number(row.sql_life) || 0,
        opp: Number(row.opp_life) || 0,
        won: Number(row.won_life) || 0,
      });
      countsMapMonth.set(row.empreendimento, {
        mql: Number(row.mql_month) || 0,
        sql: Number(row.sql_month) || 0,
        opp: Number(row.opp_month) || 0,
        won: Number(row.won_month) || 0,
      });
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

    // Map<ad_id, won_other> — WONs de ads que foram ganhos em outro empreendimento
    const crossWonMap = new Map<string, number>();
    for (const row of crossWonRes.data || []) {
      crossWonMap.set(row.ad_id, Number(row.won_other) || 0);
    }

    // Summary global — usar dados do mês (inclui gasto de ads removidos do último snapshot)
    const totalAds = ads.length;
    let totalSpend = ads.reduce((s, r) => s + Number(r.spend_month || 0), 0);
    let totalMetaLeads = ads.reduce((s, r) => s + (r.leads_month || 0), 0);
    // Somar gasto de ads que desapareceram do último snapshot
    for (const [adId, maxData] of adMaxSpend) {
      if (!latestAdIds.has(adId) && maxData.spend > 0) {
        totalSpend += maxData.spend;
        totalMetaLeads += maxData.leads;
      }
    }
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
        const spend = empAds.reduce((s, r) => s + Number(r.spend_month || 0), 0);
        const impressions = empAds.reduce((s, r) => s + (r.impressions || 0), 0);
        const clicks = empAds.reduce((s, r) => s + (r.clicks || 0), 0);
        const metaLeads = empAds.reduce((s, r) => s + (r.leads_month || 0), 0);

        // Funil empreendimento: dados do mês (com filtro paid se aplicável)
        const counts = countsMapMonth.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
        let empMql = counts.mql, empSql = counts.sql, empOpp = counts.opp, empWon = counts.won;
        if (paidOnly) {
          empMql = Math.min(counts.mql, metaLeads);
          const ratio = counts.mql > 0 ? empMql / counts.mql : 0;
          empSql = Math.round(counts.sql * ratio);
          empOpp = Math.round(counts.opp * ratio);
          empWon = Math.round(counts.won * ratio);
        }

        // Leads = mesma lógica da aba Resultados: Meta Ads + MQLs de outros canais
        const nonPaidMql = paidOnly ? 0 : Math.max(counts.mql - metaLeads, 0);
        const leads = metaLeads + nonPaidMql;

        // Ads detail com funil por ad
        const adsDetail: MetaAdRow[] = empAds
          .map((r) => {
            const funnel = adFunnel.get(r.ad_id) || { mql: 0, sql: 0, opp: 0, won: 0 };
            const sp = Number(r.spend_month || 0);
            const ld = r.leads_month || 0;
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
              leads: ld,
              cpl: ld > 0 ? Math.round((sp / ld) * 100) / 100 : 0,
              ctr: Number(r.ctr),
              cpm: Number(r.cpm),
              frequency: Number(r.frequency),
              cpc: Number(r.cpc),
              severidade: r.severidade as "CRITICO" | "ALERTA" | "OK" | "OPORTUNIDADE",
              diagnostico: r.diagnostico || null,
              effective_status: (r.effective_status || "ACTIVE") as "ACTIVE" | "PAUSED",
              mql: funnel.mql,
              sql: funnel.sql,
              opp: funnel.opp,
              won: funnel.won,
              wonOutro: crossWonMap.get(r.ad_id) || 0,
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
          cpl: metaLeads > 0 ? Math.round((spend / metaLeads) * 100) / 100 : 0,
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
          wonOutro: adsDetail.reduce((s, a) => s + a.wonOutro, 0),
          cpw: empWon > 0 ? Math.round((spend / empWon) * 100) / 100 : 0,
          adsDetail,
        };
      });

      const sqSpend = sqAds.reduce((s, r) => s + Number(r.spend_month || 0), 0);
      const sqMetaLeads = sqAds.reduce((s, r) => s + (r.leads_month || 0), 0);
      const sqLeads = empreendimentos.reduce((s, e) => s + e.leads, 0); // all channels (matches Resultados)
      const sqSpendMonth = sqSpend;
      const sqLeadsMonth = sqLeads;

      // Totais MÊS — usar os valores já filtrados dos empreendimentos
      let sqMqlMonth = 0, sqSqlMonth = 0, sqOppMonth = 0, sqWonMonth = 0;
      for (const e of empreendimentos) {
        sqMqlMonth += e.mql;
        sqSqlMonth += e.sql;
        sqOppMonth += e.opp;
        sqWonMonth += e.won;
      }

      return {
        id: sq.id,
        name: sq.name,
        empreendimentos,
        totalSpend: Math.round(sqSpend * 100) / 100,
        totalLeads: sqLeads,
        avgCpl: sqMetaLeads > 0 ? Math.round((sqSpend / sqMetaLeads) * 100) / 100 : 0,
        criticos: sqAds.filter((r) => r.severidade === "CRITICO").length,
        alertas: sqAds.filter((r) => r.severidade === "ALERTA").length,
        totalMql: sqMqlMonth,
        totalSql: sqSqlMonth,
        totalOpp: sqOppMonth,
        totalWon: sqWonMonth,
        cpw: sqWonMonth > 0 ? Math.round((sqSpend / sqWonMonth) * 100) / 100 : 0,
        totalSpendMonth: Math.round(sqSpendMonth * 100) / 100,
        totalLeadsMonth: sqLeadsMonth,
        spendAlert: false, // calculado abaixo
      };
    });

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
      const sp = Number(r.spend_month || 0);
      const ld = r.leads_month || 0;
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
        leads: ld,
        cpl: ld > 0 ? Math.round((sp / ld) * 100) / 100 : 0,
        ctr: Number(r.ctr),
        cpm: Number(r.cpm),
        frequency: Number(r.frequency),
        cpc: Number(r.cpc),
        severidade: r.severidade as "CRITICO" | "ALERTA" | "OK" | "OPORTUNIDADE",
        diagnostico: r.diagnostico || null,
        effective_status: (r.effective_status || "ACTIVE") as "ACTIVE" | "PAUSED",
        mql: funnel.mql,
        sql: funnel.sql,
        opp: funnel.opp,
        won: funnel.won,
        wonOutro: crossWonMap.get(r.ad_id) || 0,
        cmql: funnel.mql > 0 ? Math.round((sp / funnel.mql) * 100) / 100 : 0,
        csql: funnel.sql > 0 ? Math.round((sp / funnel.sql) * 100) / 100 : 0,
        copp: funnel.opp > 0 ? Math.round((sp / funnel.opp) * 100) / 100 : 0,
        cpw: funnel.won > 0 ? Math.round((sp / funnel.won) * 100) / 100 : 0,
      };
    });

    // Totais do mês (calculados após squads para incluir leads de todos os canais)
    const grandMqlMonth = squads.reduce((s, sq) => s + sq.totalMql, 0);
    const grandSqlMonth = squads.reduce((s, sq) => s + sq.totalSql, 0);
    const grandOppMonth = squads.reduce((s, sq) => s + sq.totalOpp, 0);
    const grandWonMonth = squads.reduce((s, sq) => s + sq.totalWon, 0);
    const totalLeads = squads.reduce((s, sq) => s + sq.totalLeads, 0); // all channels (matches Resultados)
    const avgCpl = totalMetaLeads > 0 ? totalSpend / totalMetaLeads : 0; // CPL usa só Meta Ads leads
    const totalSpendMonth = totalSpend;
    const totalLeadsMonth = totalLeads;

    // Alerta de gasto por squad: se gasto >5% ou <5% do target (total/3)
    const targetPerSquad = totalSpendMonth / 3;
    if (targetPerSquad > 0) {
      for (const sq of squads) {
        const deviation = Math.abs(sq.totalSpendMonth - targetPerSquad) / targetPerSquad;
        sq.spendAlert = deviation > 0.05;
      }
    }

    const result: CampanhasData = {
      snapshotDate: snapshotDate!,
      summary: {
        totalAds,
        totalSpend: Math.round(totalSpend * 100) / 100,
        totalLeads,
        avgCpl: Math.round(avgCpl * 100) / 100,
        criticos,
        alertas,
        totalMql: grandMqlMonth,
        totalSql: grandSqlMonth,
        totalOpp: grandOppMonth,
        totalWon: grandWonMonth,
        cmql: grandMqlMonth > 0 ? Math.round((totalSpend / grandMqlMonth) * 100) / 100 : 0,
        copp: grandOppMonth > 0 ? Math.round((totalSpend / grandOppMonth) * 100) / 100 : 0,
        cpw: grandWonMonth > 0 ? Math.round((totalSpend / grandWonMonth) * 100) / 100 : 0,
        totalSpendMonth: Math.round(totalSpendMonth * 100) / 100,
        totalLeadsMonth,
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
