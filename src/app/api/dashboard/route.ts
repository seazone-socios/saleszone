import { NextRequest, NextResponse } from "next/server";
import { fetchAcompanhamento, fetchAlinhamento, fetchMetas } from "@/lib/pipedrive";
import type { TabKey, DashboardResponse, AcompanhamentoData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const tab = (req.nextUrl.searchParams.get("tab") as TabKey) || "mql";

  try {
    // Fetch all data in parallel
    const [acomp, alinhamento, metas] = await Promise.all([
      fetchAcompanhamento(tab),
      fetchAlinhamento(),
      fetchMetas(),
    ]);

    // Apply metas to acompanhamento squads
    const acompWithMetas: AcompanhamentoData = {
      ...acomp,
      squads: acomp.squads.map((sq) => {
        const sqMeta = metas.squads.find((m) => m.id === sq.id);
        return { ...sq, metaToDate: sqMeta?.metas[tab] || 0 };
      }),
      grand: {
        ...acomp.grand,
        metaToDate: metas.squads.reduce((sum, m) => sum + (m.metas[tab] || 0), 0),
      },
    };

    const response: DashboardResponse = {
      acompanhamento: { [tab]: acompWithMetas } as Record<TabKey, AcompanhamentoData>,
      alinhamento,
      metas,
      syncedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
