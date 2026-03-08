import { NextRequest, NextResponse } from "next/server";
import { fetchAcompanhamento, fetchMetas } from "@/lib/pipedrive";
import type { TabKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const tab = (req.nextUrl.searchParams.get("tab") as TabKey) || "mql";

  try {
    const [acomp, metas] = await Promise.all([fetchAcompanhamento(tab), fetchMetas()]);

    // Apply metas
    const squads = acomp.squads.map((sq) => {
      const sqMeta = metas.squads.find((m) => m.id === sq.id);
      return { ...sq, metaToDate: sqMeta?.metas[tab] || 0 };
    });

    return NextResponse.json({
      ...acomp,
      squads,
      grand: {
        ...acomp.grand,
        metaToDate: metas.squads.reduce((sum, m) => sum + (m.metas[tab] || 0), 0),
      },
    });
  } catch (error) {
    console.error("Acompanhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
