import {
  PIPEDRIVE_DOMAIN,
  PIPELINE_ID,
  FIELD_CANAL,
  FIELD_EMPREENDIMENTO,
  FIELD_QUALIFICACAO,
  FIELD_REUNIAO,
  CANAL_MARKETING_ID,
  EMPREENDIMENTO_MAP,
  FILTER_FIELD_IDS,
  SQUADS,
  NUM_DAYS,
  PV_COLS,
  V_COLS,
} from "./constants";
import type { TabKey, AcompanhamentoData, AlinhamentoData, MetasData, DateColumn, SquadData } from "./types";
import { generateDates } from "./dates";

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN!;
const BASE = `https://${PIPEDRIVE_DOMAIN}/api/v1`;

// --- Pipedrive API helpers ---

interface PipedriveDeal {
  id: number;
  pipeline_id: number;
  status: string;
  add_time: string;
  won_time: string | null;
  user_id: { id: number; name: string };
  [key: string]: unknown;
}

async function pipedriveGet(path: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", API_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Pipedrive ${path}: ${res.status}`);
  return res.json();
}

async function pipedrivePost(path: string, body: unknown): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", API_TOKEN);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pipedrive POST ${path}: ${res.status}`);
  return res.json();
}

async function pipedriveDelete(path: string): Promise<void> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", API_TOKEN);
  await fetch(url.toString(), { method: "DELETE" });
}

async function createFilter(name: string, fieldId: number, startDate: string, endDate: string): Promise<number> {
  const body = {
    name,
    type: "deals",
    conditions: {
      glue: "and",
      conditions: [
        {
          glue: "and",
          conditions: [
            { object: "deal", field_id: fieldId, operator: ">=", value: startDate },
            { object: "deal", field_id: fieldId, operator: "<=", value: endDate },
          ],
        },
      ],
    },
  };
  const res = (await pipedrivePost("/filters", body)) as { data: { id: number } };
  return res.data.id;
}

async function fetchAllDeals(params: Record<string, string>): Promise<PipedriveDeal[]> {
  const deals: PipedriveDeal[] = [];
  let start = 0;
  let hasMore = true;
  while (hasMore) {
    const res = (await pipedriveGet("/deals", { ...params, limit: "500", start: String(start) })) as {
      data: PipedriveDeal[] | null;
      additional_data?: { pagination?: { more_items_in_collection: boolean } };
    };
    if (res.data) deals.push(...res.data);
    hasMore = res.additional_data?.pagination?.more_items_in_collection ?? false;
    start += 500;
  }
  return deals;
}

// --- Data fetching ---

function getDateField(deal: PipedriveDeal, tab: TabKey): string | null {
  switch (tab) {
    case "mql":
      return deal.add_time || null;
    case "sql":
      return (deal[FIELD_QUALIFICACAO] as string) || null;
    case "opp":
      return (deal[FIELD_REUNIAO] as string) || null;
    case "won":
      return deal.won_time || null;
  }
}

function isMarketingDeal(deal: PipedriveDeal): boolean {
  return String(deal[FIELD_CANAL]) === CANAL_MARKETING_ID;
}

function getEmpreendimento(deal: PipedriveDeal): string | null {
  const enumId = String(deal[FIELD_EMPREENDIMENTO] || "");
  return EMPREENDIMENTO_MAP[enumId] || null;
}

export async function fetchAcompanhamento(tab: TabKey): Promise<AcompanhamentoData> {
  const dates = generateDates();
  const startDate = dates[dates.length - 1].date;
  const endDate = dates[0].date;
  const fieldId = FILTER_FIELD_IDS[tab];

  // Create temp filter
  const filterId = await createFilter(`temp_dashboard_${tab}`, fieldId, startDate, endDate);

  try {
    const deals = await fetchAllDeals({ filter_id: String(filterId), status: "all_not_deleted" });

    // Filter: pipeline 28 + canal Marketing
    const filtered = deals.filter((d) => d.pipeline_id === PIPELINE_ID && isMarketingDeal(d));

    // Build daily counts per empreendimento
    const dateIndex = new Map(dates.map((d, i) => [d.date, i]));
    const empCounts = new Map<string, number[]>();

    for (const deal of filtered) {
      const dateStr = getDateField(deal, tab);
      if (!dateStr) continue;
      const day = dateStr.substring(0, 10); // YYYY-MM-DD
      const idx = dateIndex.get(day);
      if (idx === undefined) continue;

      const emp = getEmpreendimento(deal);
      if (!emp) continue;

      if (!empCounts.has(emp)) empCounts.set(emp, new Array(NUM_DAYS).fill(0));
      empCounts.get(emp)![idx]++;
    }

    // Map to squads
    const squads: SquadData[] = SQUADS.map((sq) => {
      const rows = sq.empreendimentos.map((emp) => {
        const daily = empCounts.get(emp) || new Array(NUM_DAYS).fill(0);
        return { emp, daily, totalMes: daily.reduce((a, b) => a + b, 0) };
      });
      return {
        id: sq.id,
        name: sq.name,
        marketing: sq.marketing,
        preVenda: sq.preVenda,
        venda: sq.venda,
        rows,
        metaToDate: 0, // filled by metas endpoint
      };
    });

    // Grand totals
    const grandDaily = new Array(NUM_DAYS).fill(0);
    let grandTotal = 0;
    squads.forEach((sq) =>
      sq.rows.forEach((r) => {
        grandTotal += r.totalMes;
        r.daily.forEach((v, i) => (grandDaily[i] += v));
      })
    );

    return {
      squads,
      dates,
      grand: { totalMes: grandTotal, metaToDate: 0, daily: grandDaily },
    };
  } finally {
    await pipedriveDelete(`/filters/${filterId}`);
  }
}

export async function fetchAlinhamento(): Promise<AlinhamentoData> {
  // Fetch open deals in pipeline 28
  const deals = await fetchAllDeals({ status: "open", pipeline_id: String(PIPELINE_ID) });

  // Build counts: empreendimento × owner
  const ownerCounts = new Map<string, Map<string, number>>();

  // Get all users first
  const usersRes = (await pipedriveGet("/users")) as { data: Array<{ id: number; name: string }> };
  const userMap = new Map(usersRes.data.map((u) => [u.id, u.name]));

  for (const deal of deals) {
    if (deal.pipeline_id !== PIPELINE_ID) continue;
    const emp = getEmpreendimento(deal);
    if (!emp) continue;
    const ownerId = deal.user_id?.id;
    if (!ownerId) continue;
    const ownerName = userMap.get(ownerId) || String(ownerId);

    if (!ownerCounts.has(emp)) ownerCounts.set(emp, new Map());
    const m = ownerCounts.get(emp)!;
    m.set(ownerName, (m.get(ownerName) || 0) + 1);
  }

  // Match PV/V columns to owner names (case-insensitive partial match)
  function matchOwner(colName: string, ownerName: string): boolean {
    return ownerName.toLowerCase().includes(colName.toLowerCase());
  }

  // Build flat rows
  const rows = SQUADS.flatMap((sq) =>
    sq.empreendimentos.map((emp) => {
      const counts = ownerCounts.get(emp) || new Map<string, number>();
      const pv: Record<string, number> = {};
      const v: Record<string, number> = {};

      PV_COLS.forEach((col) => {
        let total = 0;
        for (const [owner, count] of counts) {
          if (matchOwner(col, owner)) total += count;
        }
        pv[col] = total;
      });

      V_COLS.forEach((col) => {
        let total = 0;
        for (const [owner, count] of counts) {
          if (matchOwner(col, owner)) total += count;
        }
        v[col] = total;
      });

      return {
        sqId: sq.id,
        sqName: sq.name,
        emp,
        correctPV: sq.preVenda,
        correctV: sq.venda,
        cells: { pv, v },
      };
    })
  );

  // Stats
  let total = 0,
    mis = 0;
  rows.forEach((row) => {
    PV_COLS.forEach((p) => {
      const val = row.cells.pv[p] || 0;
      total += val;
      if (val > 0 && p !== row.correctPV) mis += val;
    });
    V_COLS.forEach((p) => {
      const val = row.cells.v[p] || 0;
      total += val;
      if (val > 0 && p !== row.correctV) mis += val;
    });
  });

  return { rows, stats: { total, ok: total - mis, mis } };
}

export async function fetchMetas(): Promise<MetasData> {
  const now = new Date();
  const end = now.toISOString().substring(0, 10);
  const start90 = new Date(now);
  start90.setDate(start90.getDate() - 90);
  const startDate = start90.toISOString().substring(0, 10);

  const tabs: TabKey[] = ["mql", "sql", "opp", "won"];
  const filterIds: number[] = [];
  const counts90d: Record<TabKey, number> = { mql: 0, sql: 0, opp: 0, won: 0 };

  try {
    // Create filters and fetch counts for each tab
    for (const tab of tabs) {
      const fid = await createFilter(`temp_meta_${tab}`, FILTER_FIELD_IDS[tab], startDate, end);
      filterIds.push(fid);

      const deals = await fetchAllDeals({ filter_id: String(fid), status: "all_not_deleted" });
      counts90d[tab] = deals.filter((d) => d.pipeline_id === PIPELINE_ID && isMarketingDeal(d)).length;
    }

    // Calculate WON meta: sum of won_szi_meta_pago + won_szi_meta_direto for current month WON deals
    // Since these fields don't exist in the Supabase mirror, use deal value as proxy
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const wonFid = await createFilter("temp_meta_won_month", FILTER_FIELD_IDS.won, monthStart, end);
    filterIds.push(wonFid);
    const wonDeals = await fetchAllDeals({ filter_id: String(wonFid), status: "all_not_deleted" });
    const wonFiltered = wonDeals.filter((d) => d.pipeline_id === PIPELINE_ID && isMarketingDeal(d));
    const totalWonValue = wonFiltered.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

    // Calculate ratios
    const ratioOppWon = counts90d.won > 0 ? counts90d.opp / counts90d.won : 0;
    const ratioSqlOpp = counts90d.opp > 0 ? counts90d.sql / counts90d.opp : 0;
    const ratioMqlSql = counts90d.sql > 0 ? counts90d.mql / counts90d.sql : 0;

    // Calculate metas per squad (divide WON equally among 3 squads for now)
    const numClosers = SQUADS.length;
    const wonMetaPerSquad = Math.round(totalWonValue / numClosers);

    const squadMetas = SQUADS.map((sq) => ({
      id: sq.id,
      name: sq.name,
      metas: {
        won: wonMetaPerSquad,
        opp: Math.round(ratioOppWon * wonMetaPerSquad),
        sql: Math.round(ratioSqlOpp * Math.round(ratioOppWon * wonMetaPerSquad)),
        mql: Math.round(ratioMqlSql * Math.round(ratioSqlOpp * Math.round(ratioOppWon * wonMetaPerSquad))),
      },
    }));

    return {
      squads: squadMetas,
      ratios: { opp_won: ratioOppWon, sql_opp: ratioSqlOpp, mql_sql: ratioMqlSql },
      counts90d,
    };
  } finally {
    for (const fid of filterIds) {
      await pipedriveDelete(`/filters/${fid}`).catch(() => {});
    }
  }
}
