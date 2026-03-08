// Pipedrive config
export const PIPEDRIVE_DOMAIN = "seazone-fd92b9.pipedrive.com";
export const PIPELINE_ID = 28;

// Pipedrive custom field keys
export const FIELD_CANAL = "93b3ada8b94bd1fc4898a25754d6bcac2713f835";
export const FIELD_EMPREENDIMENTO = "6d565fd4fce66c16da078f520a685fa2fa038272";
export const FIELD_QUALIFICACAO = "bc74bcc4326527cbeb331d1697d4c8812d68506e";
export const FIELD_REUNIAO = "bfafc352c5c6f2edbaa41bf6d1c6daa825fc9c16";
export const CANAL_MARKETING_ID = "12";

// Filter field IDs for Pipedrive API
export const FILTER_FIELD_IDS = {
  mql: 12462, // add_time
  sql: 12550, // Data de Qualificação
  opp: 12608, // Data da reunião
  won: 12467, // won_time
} as const;

// Empreendimento enum IDs → names
export const EMPREENDIMENTO_MAP: Record<string, string> = {
  "4109": "Ponta das Canas Spot II",
  "3467": "Itacaré Spot",
  "2935": "Marista 144 Spot",
  "4495": "Natal Spot",
  "4655": "Novo Campeche Spot II",
  "3416": "Caraguá Spot",
  "3451": "Bonito Spot II",
  "3333": "Jurerê Spot II",
  "4586": "Jurerê Spot III",
  "3478": "Barra Grande Spot",
  "637": "Vistas de Anitá II",
};

// Reverse map: name → enum ID
export const EMPREENDIMENTO_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(EMPREENDIMENTO_MAP).map(([k, v]) => [v, k])
);

// Squad definitions
export const SQUADS = [
  {
    id: 1,
    name: "Squad 1",
    marketing: "Mari",
    preVenda: "Luciana Patrício",
    venda: "Laura",
    empreendimentos: ["Ponta das Canas Spot II", "Itacaré Spot", "Marista 144 Spot"],
  },
  {
    id: 2,
    name: "Squad 2",
    marketing: "Jean",
    preVenda: "Natália Saramago",
    venda: "Camila Santos",
    empreendimentos: ["Natal Spot", "Novo Campeche Spot II", "Caraguá Spot", "Bonito Spot II"],
  },
  {
    id: 3,
    name: "Squad 3",
    marketing: "Jean",
    preVenda: "Hellen Dias",
    venda: "Luana Schaikoski",
    empreendimentos: ["Jurerê Spot II", "Jurerê Spot III", "Barra Grande Spot", "Vistas de Anitá II"],
  },
] as const;

// All empreendimento names in order
export const ALL_EMPREENDIMENTOS = SQUADS.flatMap((s) => s.empreendimentos);

// Pre-venda and Venda people for alignment view
export const PV_COLS = ["Luciana Patrício", "Natália Saramago", "Hellen Dias"];
export const V_COLS = ["Laura", "Camila Santos", "Filipe Padoveze", "Luana Schaikoski", "Priscila Pestana", "Perrone"];

// UI Tokens
export const T = {
  primary: "#0055FF",
  primaryFg: "#FFFFFF",
  bg: "#FFFFFF",
  fg: "#080E32",
  card: "#FFFFFF",
  cardFg: "#141A3C",
  muted: "#E6E7EA",
  mutedFg: "#6B6E84",
  destructive: "#E7000B",
  border: "#E6E7EA",
  elevSm: "0 1px 2px rgba(0,0,0,0.2), 0 0.1px 0.3px rgba(0,0,0,0.1)",
  azul50: "#F0F2FA",
  azul600: "#0055FF",
  cinza50: "#F3F3F5",
  cinza100: "#E6E7EA",
  cinza200: "#CECFD6",
  cinza300: "#B5B7C1",
  cinza400: "#9C9FAD",
  cinza600: "#6B6E84",
  cinza700: "#525670",
  cinza800: "#393E5B",
  verde50: "#F0FDF4",
  verde600: "#5EA500",
  verde700: "#15803D",
  vermelho50: "#FEE2E2",
  vermelho100: "#FECACA",
  laranja500: "#FF6900",
  roxo600: "#9810FA",
  teal600: "#0D9488",
  font: "'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
} as const;

export const SQUAD_COLORS: Record<number, string> = { 1: T.azul600, 2: T.roxo600, 3: T.teal600 };
export const TAB_COLORS: Record<string, string> = {
  mql: T.azul600,
  sql: T.roxo600,
  opp: T.laranja500,
  won: T.verde600,
};
export const TABS = [
  { key: "mql", label: "MQL" },
  { key: "sql", label: "SQL" },
  { key: "opp", label: "OPP" },
  { key: "won", label: "WON" },
] as const;

// Date helpers
export const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const WEEKDAYS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const NUM_DAYS = 28;
