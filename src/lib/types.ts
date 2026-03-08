export type TabKey = "mql" | "sql" | "opp" | "won";

export interface DateColumn {
  date: string; // YYYY-MM-DD
  label: string; // "7 mar"
  weekday: string; // "sex"
  isWeekend: boolean;
  isSunday: boolean;
}

export interface EmpreendimentoRow {
  emp: string;
  daily: number[]; // counts per day (index 0 = most recent)
  totalMes: number;
}

export interface SquadData {
  id: number;
  name: string;
  marketing: string;
  preVenda: string;
  venda: string;
  rows: EmpreendimentoRow[];
  metaToDate: number;
}

export interface AcompanhamentoData {
  squads: SquadData[];
  dates: DateColumn[];
  grand: { totalMes: number; metaToDate: number; daily: number[] };
}

export interface AlinhamentoCell {
  pv: Record<string, number>;
  v: Record<string, number>;
}

export interface AlinhamentoData {
  rows: Array<{
    sqId: number;
    sqName: string;
    emp: string;
    correctPV: string;
    correctV: string;
    cells: AlinhamentoCell;
  }>;
  stats: { total: number; ok: number; mis: number };
}

export interface MetasData {
  squads: Array<{
    id: number;
    name: string;
    metas: Record<TabKey, number>;
  }>;
  ratios: Record<string, number>;
  counts90d: Record<TabKey, number>;
}

export interface DashboardResponse {
  acompanhamento: Record<TabKey, AcompanhamentoData>;
  alinhamento: AlinhamentoData;
  metas: MetasData;
  syncedAt: string;
}

// Campanhas Meta Ads
export interface MetaAdRow {
  ad_id: string;
  campaign_name: string;
  adset_name: string;
  ad_name: string;
  empreendimento: string;
  squad_id: number;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  cpm: number;
  frequency: number;
  cpc: number;
  severidade: "OK" | "ALERTA" | "CRITICO";
  diagnostico: string | null;
}

export interface CampanhasEmpSummary {
  emp: string;
  ads: number;
  spend: number;
  leads: number;
  cpl: number;
  criticos: number;
  alertas: number;
}

export interface CampanhasSquadSummary {
  id: number;
  name: string;
  empreendimentos: CampanhasEmpSummary[];
  totalSpend: number;
  totalLeads: number;
  avgCpl: number;
  criticos: number;
  alertas: number;
}

export interface CampanhasSummary {
  totalAds: number;
  totalSpend: number;
  totalLeads: number;
  avgCpl: number;
  criticos: number;
  alertas: number;
}

export interface CampanhasData {
  snapshotDate: string;
  summary: CampanhasSummary;
  squads: CampanhasSquadSummary[];
  top10: MetaAdRow[];
}
