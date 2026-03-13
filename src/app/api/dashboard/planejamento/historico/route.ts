import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { HistoricoAdRow, HistoricoCampanhasData } from "@/lib/types";

export const dynamic = "force-dynamic";

const META_ACCOUNT_ID = "act_205286032338340";
const META_API_VERSION = "v21.0";
const LEAD_ACTION_TYPE = "onsite_conversion.lead_grouped";

interface MetaInsight {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  cpc: string;
  cpm: string;
  ctr: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
}

function extractLeads(insight: MetaInsight): number {
  for (const a of insight.actions || []) {
    if (a.action_type === LEAD_ACTION_TYPE) return parseInt(a.value, 10) || 0;
  }
  return 0;
}

async function fetchAllInsights(
  token: string,
  since: string,
  until: string,
  statuses: string[],
): Promise<MetaInsight[]> {
  const fields =
    "ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,actions,cost_per_action_type";
  const timeRange = JSON.stringify({ since, until });
  const filtering = JSON.stringify([
    {
      field: "ad.effective_status",
      operator: "IN",
      value: statuses,
    },
  ]);

  let url: string | null =
    `https://graph.facebook.com/${META_API_VERSION}/${META_ACCOUNT_ID}/insights?fields=${fields}&time_range=${encodeURIComponent(timeRange)}&filtering=${encodeURIComponent(filtering)}&level=ad&limit=500&access_token=${token}`;

  const allData: MetaInsight[] = [];
  let pages = 0;

  while (url && pages < 20) {
    const response = await fetch(url);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Meta API error ${response.status}: ${errText}`);
    }
    const body = (await response.json()) as { data?: MetaInsight[]; paging?: { next?: string } };
    if (body.data) allData.push(...body.data);
    url = body.paging?.next || null;
    pages++;
  }

  return allData;
}

async function getMetaToken(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data, error } = await adminClient.rpc("vault_read_secret", {
    secret_name: "META_ACCESS_TOKEN",
  });
  if (error) throw new Error(`Vault read error: ${error.message}`);
  if (!data) throw new Error("META_ACCESS_TOKEN not found in vault");
  return data;
}

export async function GET() {
  try {
    const token = await getMetaToken();

    const until = new Date().toISOString().split("T")[0];
    // Lifetime: since the beginning of the account
    const since = "2020-01-01";

    // Fetch ACTIVE and PAUSED ads in parallel
    const [activeInsights, pausedInsights] = await Promise.all([
      fetchAllInsights(token, since, until, ["ACTIVE"]),
      fetchAllInsights(token, since, until, [
        "PAUSED",
        "CAMPAIGN_PAUSED",
        "ADSET_PAUSED",
      ]),
    ]);

    // Combine: for ads appearing in both, active takes priority
    const adMap = new Map<string, MetaInsight>();
    for (const ins of pausedInsights) adMap.set(ins.ad_id, ins);
    for (const ins of activeInsights) adMap.set(ins.ad_id, ins);

    const ads: HistoricoAdRow[] = [];
    for (const r of adMap.values()) {
      const spend = parseFloat(r.spend) || 0;
      const impressions = parseInt(r.impressions, 10) || 0;
      const clicks = parseInt(r.clicks, 10) || 0;
      const leads = extractLeads(r);

      ads.push({
        adId: r.ad_id,
        adName: r.ad_name || "",
        adsetName: r.adset_name || "",
        campaignName: r.campaign_name || "",
        empreendimento: "",
        effectiveStatus: "ACTIVE",
        spend,
        leads,
        mql: 0,
        sql: 0,
        opp: 0,
        won: 0,
        impressions,
        clicks,
        cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
        cmql: 0,
        csql: 0,
        copp: 0,
        cpw: 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
        lastSeenDate: until,
      });
    }

    // Enrich with funnel data from Supabase (for matched ads)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, anonKey);

    const { data: funnelData } = await supabase.rpc("get_ad_funnel_counts", {
      start_date: "2020-01-01",
    });

    const adFunnel = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const row of funnelData || []) {
      adFunnel.set(row.ad_id, {
        mql: Number(row.mql) || 0,
        sql: Number(row.sql_count) || 0,
        opp: Number(row.opp) || 0,
        won: Number(row.won) || 0,
      });
    }

    // Also get empreendimento mapping from squad_meta_ads (latest snapshot per ad)
    const { data: metaRows } = await supabase
      .from("squad_meta_ads")
      .select("ad_id, empreendimento, effective_status")
      .range(0, 49999);

    const adEmpMap = new Map<string, { empreendimento: string; effectiveStatus: string }>();
    for (const row of metaRows || []) {
      adEmpMap.set(row.ad_id, {
        empreendimento: row.empreendimento || "",
        effectiveStatus: row.effective_status || "PAUSED",
      });
    }

    // Enrich ads
    for (const ad of ads) {
      const funnel = adFunnel.get(ad.adId);
      if (funnel) {
        ad.mql = funnel.mql;
        ad.sql = funnel.sql;
        ad.opp = funnel.opp;
        ad.won = funnel.won;
        ad.cmql = funnel.mql > 0 ? Math.round((ad.spend / funnel.mql) * 100) / 100 : 0;
        ad.csql = funnel.sql > 0 ? Math.round((ad.spend / funnel.sql) * 100) / 100 : 0;
        ad.copp = funnel.opp > 0 ? Math.round((ad.spend / funnel.opp) * 100) / 100 : 0;
        ad.cpw = funnel.won > 0 ? Math.round((ad.spend / funnel.won) * 100) / 100 : 0;
      }
      const empInfo = adEmpMap.get(ad.adId);
      if (empInfo) {
        ad.empreendimento = empInfo.empreendimento;
        ad.effectiveStatus = empInfo.effectiveStatus;
      }
    }

    const result: HistoricoCampanhasData = { ads };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Historico campanhas error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
