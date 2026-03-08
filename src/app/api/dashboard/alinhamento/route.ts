import { NextResponse } from "next/server";
import { fetchAlinhamento } from "@/lib/pipedrive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const data = await fetchAlinhamento();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Alinhamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
