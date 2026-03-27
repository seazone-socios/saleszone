// SZS (Serviços) module — Mensal
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS = ["mql", "sql", "opp", "won"] as const;

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const monthsParam = req.nextUrl.searchParams.get("months");
    const numMonths = Math.min(Math.max(Number(monthsParam) || 6, 1), 24);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const now = new Date();
    const months: { key: string; label: string; start: string; end: string }[] = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${year}`;
      const start = `${key}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${key}-${String(lastDay).padStart(2, "0")}`;
      months.push({ key, label, start, end });
    }

    const globalStart = months[0].start;
    const globalEnd = months[months.length - 1].end;

    // Fetch all daily counts from szs_daily_counts
    const countsPromises = TABS.map((tab) =>
      paginateQuery((offset, ps) =>
        supabase
          .from("szs_daily_counts")
          .select("date, count")
          .eq("tab", tab)
          .gte("date", globalStart)
          .lte("date", globalEnd)
          .range(offset, offset + ps - 1),
      ),
    );

    const results = await Promise.all(countsPromises);

    const mqlRows = results[0] as { date: string; count: number }[];
    const sqlRows = results[1] as { date: string; count: number }[];
    const oppRows = results[2] as { date: string; count: number }[];
    const wonRows = results[3] as { date: string; count: number }[];

    function sumByMonth(rows: { date: string; count: number }[]): Map<string, number> {
      const map = new Map<string, number>();
      for (const row of rows) {
        const monthKey = row.date.substring(0, 7);
        map.set(monthKey, (map.get(monthKey) || 0) + (row.count || 0));
      }
      return map;
    }

    const mqlByMonth = sumByMonth(mqlRows);
    const sqlByMonth = sumByMonth(sqlRows);
    const oppByMonth = sumByMonth(oppRows);
    const wonByMonth = sumByMonth(wonRows);

    const result = months.map((m) => {
      const mql = mqlByMonth.get(m.key) || 0;
      const sql = sqlByMonth.get(m.key) || 0;
      const opp = oppByMonth.get(m.key) || 0;
      const won = wonByMonth.get(m.key) || 0;

      return {
        month: m.key,
        monthLabel: m.label,
        mql,
        sql,
        opp,
        won,
        meta: 0,
        pctMeta: 0,
        conversions: {
          mqlToSql: pct(sql, mql),
          sqlToOpp: pct(opp, sql),
          oppToWon: pct(won, opp),
        },
      };
    });

    return NextResponse.json({
      months: result,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("SZS Mensal API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery(buildQuery: (offset: number, ps: number) => any): Promise<any[]> {
  const rows: unknown[] = [];
  let offset = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await buildQuery(offset, PS);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PS) break;
    offset += PS;
  }
  return rows;
}
