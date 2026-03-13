import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — sync sequencial de 6+ Edge Functions leva ~41s+

// Each step runs as a separate Edge Function call to stay within 150MB memory limit.
// Order matters: daily-open replaces counts, won/lost merge into existing.
const FUNCTION_MAP: Record<string, Array<{ name: string; body?: Record<string, unknown> }>> = {
  "meta-ads": [{ name: "sync-squad-meta-ads" }],
  // Full dashboard sync (used by pg_cron)
  dashboard: [
    { name: "sync-squad-dashboard", body: { mode: "daily-open" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-won" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-lost" } },
    { name: "sync-squad-dashboard", body: { mode: "alignment" } },
    { name: "sync-squad-dashboard", body: { mode: "metas" } },
    { name: "sync-squad-dashboard", body: { mode: "monthly-rollup" } },
  ],
  // Light dashboard: skip daily-lost (58k+ deals, estoura memória). Cron cuida do lost a cada 2h.
  "dashboard-light": [
    { name: "sync-squad-dashboard", body: { mode: "daily-open" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-won" } },
    { name: "sync-squad-dashboard", body: { mode: "alignment" } },
    { name: "sync-squad-dashboard", body: { mode: "metas" } },
    { name: "sync-squad-dashboard", body: { mode: "monthly-rollup" } },
  ],
  calendar: [{ name: "sync-squad-calendar" }],
  presales: [{ name: "sync-squad-presales" }],
  baserow: [{ name: "sync-baserow-forms" }],
  // Full deals sync (used by pg_cron)
  deals: [
    { name: "sync-squad-deals", body: { mode: "deals-open" } },
    { name: "sync-squad-deals", body: { mode: "deals-won" } },
    { name: "sync-squad-deals", body: { mode: "deals-lost" } },
    { name: "sync-squad-deals", body: { mode: "deals-flow" } },
  ],
  // Light deals: skip deals-lost (pesado, batched 5000) e deals-flow (500/batch, timeout). Cron cuida.
  "deals-light": [
    { name: "sync-squad-deals", body: { mode: "deals-open" } },
    { name: "sync-squad-deals", body: { mode: "deals-won" } },
  ],
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

  // Separate Pipedrive-dependent functions from others so we can interleave
  const PIPEDRIVE_FUNCTIONS = new Set(["dashboard", "deals", "presales"]);

  const pipedriveSteps: Array<{ label: string; step: { name: string; body?: Record<string, unknown> } }> = [];
  const otherSteps: Array<{ label: string; step: { name: string; body?: Record<string, unknown> } }> = [];

  for (const fn of body.functions) {
    const steps = FUNCTION_MAP[fn];
    for (const step of steps) {
      const label = `${fn}:${step.body?.mode || step.name}`;
      if (PIPEDRIVE_FUNCTIONS.has(fn)) {
        pipedriveSteps.push({ label, step });
      } else {
        otherSteps.push({ label, step });
      }
    }
  }

  // Interleave: run non-Pipedrive steps between Pipedrive steps to spread out API calls.
  // Pattern: pipedrive, pipedrive, other, pipedrive, pipedrive, other, ...
  const ordered: Array<{ label: string; step: { name: string; body?: Record<string, unknown> } }> = [];
  let pi = 0, oi = 0;
  while (pi < pipedriveSteps.length || oi < otherSteps.length) {
    // Run up to 2 Pipedrive steps, then 1 other step as a breather
    if (pi < pipedriveSteps.length) ordered.push(pipedriveSteps[pi++]);
    if (pi < pipedriveSteps.length) ordered.push(pipedriveSteps[pi++]);
    if (oi < otherSteps.length) ordered.push(otherSteps[oi++]);
  }

  const results: FunctionResult[] = [];
  let lastWasPipedrive = false;

  for (const { label, step } of ordered) {
    const isPipedrive = PIPEDRIVE_FUNCTIONS.has(label.split(":")[0]);

    // Add a small delay between consecutive Pipedrive calls to avoid 429
    if (isPipedrive && lastWasPipedrive) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${step.name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: step.body ? JSON.stringify(step.body) : undefined,
      });
      if (!response.ok) {
        const text = await response.text();
        results.push({ function: label, status: "error", error: `${response.status}: ${text}` });
      } else {
        results.push({ function: label, status: "success" });
      }
    } catch (err) {
      results.push({
        function: label,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    lastWasPipedrive = isPipedrive;
  }

  const hasErrors = results.some((r) => r.status === "error");
  return NextResponse.json({ results }, { status: hasErrors ? 207 : 200 });
}
