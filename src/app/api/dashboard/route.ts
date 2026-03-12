import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS, NUM_DAYS } from "@/lib/constants";
import { generateDates } from "@/lib/dates";
import type { TabKey, AcompanhamentoData, SquadData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tab = (req.nextUrl.searchParams.get("tab") as TabKey) || "mql";
  const filterParam = req.nextUrl.searchParams.get("filter");
  const paidOnly = filterParam === "paid";

  try {
    const dates = generateDates();
    const startDate = dates[dates.length - 1].date;
    const endDate = dates[0].date;

    // Fetch daily counts from Supabase
    const countsPromise = supabase
      .from("squad_daily_counts")
      .select("date, empreendimento, count")
      .eq("tab", tab)
      .gte("date", startDate)
      .lte("date", endDate);

    // Se paidOnly, buscar também MQL counts + Meta Ads leads para calcular ratio
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const mqlPromise = paidOnly && tab !== "mql"
      ? supabase
          .from("squad_daily_counts")
          .select("date, empreendimento, count")
          .eq("tab", "mql")
          .gte("date", monthStart)
          .lte("date", endDate)
      : null;

    const metaPromise = paidOnly
      ? supabase
          .from("squad_meta_ads")
          .select("ad_id, empreendimento, leads_month")
          .gte("snapshot_date", monthStart)
      : null;

    const [countsRes, mqlRes, metaRes] = await Promise.all([
      countsPromise,
      mqlPromise,
      metaPromise,
    ]);

    if (countsRes.error) throw new Error(`Supabase error: ${countsRes.error.message}`);
    const rows = countsRes.data || [];

    // Calcular ratios paid por empreendimento
    let paidRatios: Map<string, number> | null = null;
    if (paidOnly) {
      // Meta Ads leads por empreendimento (max leads_month por ad em todos os snapshots do mês)
      const adMaxLeads = new Map<string, { empreendimento: string; leads: number }>();
      if (metaRes?.data) {
        for (const row of metaRes.data) {
          const cur = adMaxLeads.get(row.ad_id);
          const leads = row.leads_month || 0;
          if (!cur || leads > cur.leads) {
            adMaxLeads.set(row.ad_id, { empreendimento: row.empreendimento, leads });
          }
        }
      }
      const metaLeads = new Map<string, number>();
      for (const ad of adMaxLeads.values()) {
        const cur = metaLeads.get(ad.empreendimento) || 0;
        metaLeads.set(ad.empreendimento, cur + ad.leads);
      }
      // MQL totais do mês por empreendimento
      const mqlTotals = new Map<string, number>();
      if (tab === "mql") {
        // Para MQL, usar os próprios counts do mês
        for (const row of rows) {
          if (row.date >= monthStart) {
            const cur = mqlTotals.get(row.empreendimento) || 0;
            mqlTotals.set(row.empreendimento, cur + (row.count || 0));
          }
        }
      } else if (mqlRes?.data) {
        for (const row of mqlRes.data) {
          const cur = mqlTotals.get(row.empreendimento) || 0;
          mqlTotals.set(row.empreendimento, cur + (row.count || 0));
        }
      }

      // ratio = min(mql, metaLeads) / mql — mesma lógica de funil/campanhas
      paidRatios = new Map();
      const allEmps = new Set([...mqlTotals.keys(), ...metaLeads.keys()]);
      for (const emp of allEmps) {
        const mql = mqlTotals.get(emp) || 0;
        const meta = metaLeads.get(emp) || 0;
        if (mql > 0) {
          paidRatios.set(emp, Math.min(meta, mql) / mql);
        } else {
          paidRatios.set(emp, meta > 0 ? 1 : 0);
        }
      }
    }

    // Build date index
    const dateIndex = new Map(dates.map((d, i) => [d.date, i]));

    // Build counts per empreendimento
    const empCounts = new Map<string, number[]>();
    for (const row of rows) {
      const idx = dateIndex.get(row.date);
      if (idx === undefined) continue;
      if (!empCounts.has(row.empreendimento)) {
        empCounts.set(row.empreendimento, new Array(NUM_DAYS).fill(0));
      }
      empCounts.get(row.empreendimento)![idx] += row.count;
    }

    // Map to squads
    const squads: SquadData[] = SQUADS.map((sq) => {
      const sqRows = sq.empreendimentos.map((emp) => {
        let daily = empCounts.get(emp) || new Array(NUM_DAYS).fill(0);

        // Aplicar ratio paid se necessário
        if (paidRatios) {
          const ratio = paidRatios.get(emp) ?? 0;
          daily = daily.map((v) => Math.round(v * ratio));
        }

        // totalMes = sum of days in current month only
        let totalMes = 0;
        daily.forEach((v, i) => {
          if (dates[i] && dates[i].date >= monthStart) totalMes += v;
        });
        return { emp, daily, totalMes };
      });
      return {
        id: sq.id,
        name: sq.name,
        marketing: sq.marketing,
        preVenda: sq.preVenda,
        venda: sq.venda,
        rows: sqRows,
        metaToDate: 0,
      };
    });

    // Fetch metas for current month
    const monthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: metaRows } = await supabase
      .from("squad_metas")
      .select("squad_id, meta")
      .eq("month", monthDate)
      .eq("tab", tab);

    if (metaRows) {
      for (const m of metaRows) {
        const sq = squads.find((s) => s.id === m.squad_id);
        if (sq) sq.metaToDate = m.meta;
      }
    }

    // Grand totals
    const grandDaily = new Array(NUM_DAYS).fill(0);
    let grandTotal = 0;
    let grandMeta = 0;
    squads.forEach((sq) => {
      grandMeta += sq.metaToDate;
      sq.rows.forEach((r) => {
        grandTotal += r.totalMes;
        r.daily.forEach((v, i) => (grandDaily[i] += v));
      });
    });

    const result: AcompanhamentoData = {
      squads,
      dates,
      grand: { totalMes: grandTotal, metaToDate: grandMeta, daily: grandDaily },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
