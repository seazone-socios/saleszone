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
