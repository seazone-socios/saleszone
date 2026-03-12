import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { PlanejamentoData, PlanejamentoEmpRow, PlanejamentoMetrics } from "@/lib/types";

export const dynamic = "force-dynamic";

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
}

function cost(spend: number, den: number): number {
  return den > 0 ? Math.round((spend / den) * 100) / 100 : 0;
}

function buildMetrics(leads: number, mql: number, sql: number, opp: number, won: number, spend: number): PlanejamentoMetrics {
  return {
    leads, mql, sql, opp, won, spend: Math.round(spend * 100) / 100,
    cpl: cost(spend, leads),
    cmql: cost(spend, mql),
    copp: cost(spend, opp),
    cpw: cost(spend, won),
    mqlToSql: rate(sql, mql),
    sqlToOpp: rate(opp, sql),
    oppToWon: rate(won, opp),
  };
}

function sumMetrics(rows: PlanejamentoMetrics[]): PlanejamentoMetrics {
  const leads = rows.reduce((s, r) => s + r.leads, 0);
  const mql = rows.reduce((s, r) => s + r.mql, 0);
  const sql = rows.reduce((s, r) => s + r.sql, 0);
  const opp = rows.reduce((s, r) => s + r.opp, 0);
  const won = rows.reduce((s, r) => s + r.won, 0);
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return buildMetrics(leads, mql, sql, opp, won, spend);
}

// Map empreendimento → squad id
const EMP_TO_SQUAD = new Map<string, number>();
for (const sq of SQUADS) {
  for (const emp of sq.empreendimentos) {
    EMP_TO_SQUAD.set(emp, sq.id);
  }
}

export async function GET() {
  try {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${curMonth}-01`;

    // Parallel queries — all Pipedrive counts from squad_monthly_counts (stage-based)
    const [allCountsRes, curMetaRes, histMetaRes] = await Promise.all([
      // ALL months from squad_monthly_counts (including current — populated by monthly-rollup)
      supabase
        .from("squad_monthly_counts")
        .select("month, empreendimento, tab, count")
        .in("tab", ["mql", "sql", "opp", "won"]),
      // Current month Meta Ads (max spend_month/leads_month per ad)
      supabase
        .from("squad_meta_ads")
        .select("ad_id, empreendimento, leads_month, spend_month")
        .gte("snapshot_date", startDate),
      // Historical Meta Ads: all months before current
      supabase
        .from("squad_meta_ads")
        .select("ad_id, empreendimento, leads_month, spend_month, snapshot_date")
        .lt("snapshot_date", startDate),
    ]);

    if (allCountsRes.error) throw new Error(`Monthly counts: ${allCountsRes.error.message}`);
    if (curMetaRes.error) throw new Error(`Current Meta Ads: ${curMetaRes.error.message}`);
    if (histMetaRes.error) throw new Error(`Historical Meta Ads: ${histMetaRes.error.message}`);

    // Split into current month vs historical
    const curCounts = new Map<string, Record<string, number>>();
    const histByEmpMonth = new Map<string, Map<string, Record<string, number>>>();
    for (const row of allCountsRes.data || []) {
      if (row.month === curMonth) {
        // Current month
        if (!curCounts.has(row.empreendimento)) curCounts.set(row.empreendimento, { mql: 0, sql: 0, opp: 0, won: 0 });
        const cur = curCounts.get(row.empreendimento)!;
        cur[row.tab] = (cur[row.tab] || 0) + (row.count || 0);
      } else {
        // Historical
        if (!histByEmpMonth.has(row.empreendimento)) histByEmpMonth.set(row.empreendimento, new Map());
        const empMap = histByEmpMonth.get(row.empreendimento)!;
        if (!empMap.has(row.month)) empMap.set(row.month, { mql: 0, sql: 0, opp: 0, won: 0 });
        const counts = empMap.get(row.month)!;
        counts[row.tab] = (counts[row.tab] || 0) + (row.count || 0);
      }
    }
    // Average across months with data
    const histCounts = new Map<string, Record<string, number>>();
    for (const [emp, monthMap] of histByEmpMonth) {
      const numMonths = monthMap.size || 1;
      const avg: Record<string, number> = { mql: 0, sql: 0, opp: 0, won: 0 };
      for (const counts of monthMap.values()) {
        for (const tab of ["mql", "sql", "opp", "won"]) avg[tab] += counts[tab] || 0;
      }
      for (const tab of ["mql", "sql", "opp", "won"]) avg[tab] = Math.round(avg[tab] / numMonths);
      histCounts.set(emp, avg);
    }

    // Aggregate current Meta Ads: max spend_month/leads_month per ad
    const curAdMax = new Map<string, { empreendimento: string; leads_month: number; spend_month: number }>();
    for (const row of curMetaRes.data || []) {
      const cur = curAdMax.get(row.ad_id);
      if (!cur || (Number(row.spend_month) || 0) > cur.spend_month) {
        curAdMax.set(row.ad_id, {
          empreendimento: row.empreendimento,
          leads_month: row.leads_month || 0,
          spend_month: Number(row.spend_month) || 0,
        });
      }
    }
    const curMeta = new Map<string, { leads: number; spend: number }>();
    for (const ad of curAdMax.values()) {
      const cur = curMeta.get(ad.empreendimento) || { leads: 0, spend: 0 };
      cur.leads += ad.leads_month;
      cur.spend += ad.spend_month;
      curMeta.set(ad.empreendimento, cur);
    }

    // Aggregate historical Meta Ads per empreendimento (average per month)
    // Group by month first, then average
    const histAdByMonth = new Map<string, Map<string, { leads: number; spend: number }>>();
    for (const row of histMetaRes.data || []) {
      const month = (row.snapshot_date as string).substring(0, 7);
      if (!histAdByMonth.has(month)) histAdByMonth.set(month, new Map());
      const monthAds = histAdByMonth.get(month)!;
      // Max per ad within the month
      const adKey = `${row.ad_id}`;
      const cur = monthAds.get(adKey);
      if (!cur || (Number(row.spend_month) || 0) > cur.spend) {
        monthAds.set(adKey, {
          leads: row.leads_month || 0,
          spend: Number(row.spend_month) || 0,
        });
      }
    }
    // Sum per empreendimento per month, then average
    const histMetaByEmpMonth = new Map<string, Map<string, { leads: number; spend: number }>>();
    for (const [month, adMap] of histAdByMonth) {
      for (const ad of adMap.values()) {
        // We need empreendimento - find from raw data
      }
    }
    // Simpler approach: aggregate by ad_id+month, then by empreendimento
    const histMetaEmpMonth = new Map<string, Map<string, { leads: number; spend: number }>>();
    for (const row of histMetaRes.data || []) {
      const month = (row.snapshot_date as string).substring(0, 7);
      const emp = row.empreendimento;
      const adMonthKey = `${row.ad_id}|${month}`;

      // First pass: max per ad per month (track in temp map)
      if (!histMetaEmpMonth.has(adMonthKey)) {
        histMetaEmpMonth.set(adMonthKey, new Map([[emp, { leads: row.leads_month || 0, spend: Number(row.spend_month) || 0 }]]));
      } else {
        const existing = histMetaEmpMonth.get(adMonthKey)!.get(emp);
        if (!existing || (Number(row.spend_month) || 0) > existing.spend) {
          histMetaEmpMonth.get(adMonthKey)!.set(emp, { leads: row.leads_month || 0, spend: Number(row.spend_month) || 0 });
        }
      }
    }
    // Now aggregate by emp and month
    const histMetaByEmp = new Map<string, { leads: number; spend: number; monthCount: number }>();
    const empMonthSeen = new Map<string, Set<string>>();
    for (const [adMonthKey, empMap] of histMetaEmpMonth) {
      const month = adMonthKey.split("|")[1];
      for (const [emp, vals] of empMap) {
        if (!histMetaByEmp.has(emp)) {
          histMetaByEmp.set(emp, { leads: 0, spend: 0, monthCount: 0 });
          empMonthSeen.set(emp, new Set());
        }
        const agg = histMetaByEmp.get(emp)!;
        agg.leads += vals.leads;
        agg.spend += vals.spend;
        empMonthSeen.get(emp)!.add(month);
      }
    }
    // Average per month
    const histMeta = new Map<string, { leads: number; spend: number }>();
    for (const [emp, agg] of histMetaByEmp) {
      const numMonths = empMonthSeen.get(emp)?.size || 1;
      histMeta.set(emp, {
        leads: Math.round(agg.leads / numMonths),
        spend: Math.round((agg.spend / numMonths) * 100) / 100,
      });
    }

    // Build rows per empreendimento
    const allEmps = new Set<string>();
    for (const sq of SQUADS) for (const emp of sq.empreendimentos) allEmps.add(emp);

    const empRows: PlanejamentoEmpRow[] = [];
    for (const emp of allEmps) {
      const squadId = EMP_TO_SQUAD.get(emp) || 0;
      const cc = curCounts.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      const cm = curMeta.get(emp) || { leads: 0, spend: 0 };
      const hc = histCounts.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      const hm = histMeta.get(emp) || { leads: 0, spend: 0 };

      const current = buildMetrics(cm.leads, cc.mql, cc.sql, cc.opp, cc.won, cm.spend);
      const historical = buildMetrics(hm.leads, hc.mql, hc.sql, hc.opp, hc.won, hm.spend);

      // Efficiency: compare conversion and cost vs medians
      // Simple heuristic: high if CPW < historical and oppToWon >= historical
      let efficiency: "high" | "medium" | "low" = "medium";
      if (current.won > 0 && current.cpw > 0) {
        const cpwBetter = historical.cpw > 0 && current.cpw <= historical.cpw;
        const convBetter = historical.oppToWon > 0 && current.oppToWon >= historical.oppToWon;
        if (cpwBetter && convBetter) efficiency = "high";
        else if (!cpwBetter && !convBetter) efficiency = "low";
      } else if (current.opp > 0) {
        efficiency = "medium";
      } else if (current.mql > 0 && current.sql === 0) {
        efficiency = "low";
      }

      empRows.push({ emp, squadId, current, historical, efficiency });
    }

    // Sort by squad, then by emp name
    empRows.sort((a, b) => a.squadId - b.squadId || a.emp.localeCompare(b.emp));

    const result: PlanejamentoData = {
      month: curMonth,
      empreendimentos: empRows,
      totals: {
        current: sumMetrics(empRows.map((r) => r.current)),
        historical: sumMetrics(empRows.map((r) => r.historical)),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Planejamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
