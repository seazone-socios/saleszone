import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FUNCTION_MAP: Record<string, { name: string; body?: Record<string, unknown> }> = {
  "meta-ads": { name: "sync-squad-meta-ads" },
  dashboard: { name: "sync-squad-dashboard", body: { mode: "all" } },
  calendar: { name: "sync-squad-calendar" },
};

interface SyncRequest {
  functions: string[];
}

interface FunctionResult {
  function: string;
  status: "success" | "error";
  error?: string;
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured" },
      { status: 500 },
    );
  }

  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.functions) || body.functions.length === 0) {
    return NextResponse.json(
      { error: "Missing or empty 'functions' array" },
      { status: 400 },
    );
  }

  const invalid = body.functions.filter((f) => !(f in FUNCTION_MAP));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown functions: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const results: FunctionResult[] = await Promise.all(
    body.functions.map(async (fn): Promise<FunctionResult> => {
      const mapping = FUNCTION_MAP[fn];
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/${mapping.name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: mapping.body ? JSON.stringify(mapping.body) : undefined,
          },
        );

        if (!response.ok) {
          const text = await response.text();
          return { function: fn, status: "error", error: `${response.status}: ${text}` };
        }

        return { function: fn, status: "success" };
      } catch (err) {
        return {
          function: fn,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }),
  );

  const hasErrors = results.some((r) => r.status === "error");
  return NextResponse.json({ results }, { status: hasErrors ? 207 : 200 });
}
