import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { PresalesData, PresellerSummary, PresalesDealRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function findSquadId(name: string): number | null {
  for (const sq of SQUADS) {
    if (sq.preVenda === name) return sq.id;
  }
  return null;
}

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from("squad_presales_response")
      .select("deal_id, deal_title, preseller_name, transbordo_at, first_action_at, response_time_minutes, action_type")
      .order("transbordo_at", { ascending: false });

    if (error) throw new Error(`Supabase error: ${error.message}`);

    const deals = rows || [];

    // Agrupar por pré-vendedor
    const byPreseller = new Map<string, typeof deals>();
    for (const d of deals) {
      const key = d.preseller_name;
      if (!byPreseller.has(key)) byPreseller.set(key, []);
      byPreseller.get(key)!.push(d);
    }

    const presellers: PresellerSummary[] = [];
    for (const [name, pDeals] of byPreseller) {
      const comAcao = pDeals.filter((d) => d.first_action_at != null);
      const tempos = comAcao
        .map((d) => d.response_time_minutes as number)
        .filter((m) => m != null && m >= 0);

      presellers.push({
        name,
        squadId: findSquadId(name),
        totalDeals: pDeals.length,
        dealsComAcao: comAcao.length,
        dealsPendentes: pDeals.length - comAcao.length,
        avgMinutes: tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0,
        medianMinutes: Math.round(median(tempos)),
        pctSub30: tempos.length > 0 ? Math.round((tempos.filter((m) => m <= 30).length / tempos.length) * 100) : 0,
        pctSub60: tempos.length > 0 ? Math.round((tempos.filter((m) => m <= 60).length / tempos.length) * 100) : 0,
      });
    }

    // Ordenar: pré-vendedores dos squads primeiro, depois por volume
    presellers.sort((a, b) => {
      if (a.squadId != null && b.squadId == null) return -1;
      if (a.squadId == null && b.squadId != null) return 1;
      return b.totalDeals - a.totalDeals;
    });

    // Deals recentes (últimos 50)
    const recentDeals: PresalesDealRow[] = deals.slice(0, 50).map((d) => ({
      deal_id: d.deal_id,
      deal_title: d.deal_title || "",
      preseller_name: d.preseller_name,
      transbordo_at: d.transbordo_at,
      first_action_at: d.first_action_at,
      response_time_minutes: d.response_time_minutes,
      action_type: d.action_type,
    }));

    // Totais globais
    const allTempos = deals
      .map((d) => d.response_time_minutes as number)
      .filter((m) => m != null && m >= 0);

    const result: PresalesData = {
      presellers,
      recentDeals,
      totals: {
        totalDeals: deals.length,
        dealsComAcao: deals.filter((d) => d.first_action_at != null).length,
        avgMinutes: allTempos.length > 0 ? Math.round(allTempos.reduce((a, b) => a + b, 0) / allTempos.length) : 0,
        medianMinutes: Math.round(median(allTempos)),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Presales error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
