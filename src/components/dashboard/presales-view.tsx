"use client";

import { T, SQUAD_COLORS } from "@/lib/constants";
import type { PresalesData } from "@/lib/types";
import { StatPill } from "./ui";

interface Props {
  data: PresalesData | null;
  loading: boolean;
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}min` : `${h}h`;
}

function responseColor(minutes: number | null): string {
  if (minutes == null) return T.cinza400;
  if (minutes <= 30) return T.verde600;
  if (minutes <= 60) return T.laranja500;
  return T.destructive;
}

function responseBg(minutes: number | null): string {
  if (minutes == null) return T.cinza50;
  if (minutes <= 30) return T.verde50;
  if (minutes <= 60) return "#FEF3C7";
  return T.vermelho50;
}

function responseLabel(minutes: number | null): string {
  if (minutes == null) return "Pendente";
  if (minutes <= 30) return "Rápido";
  if (minutes <= 60) return "Aceitável";
  return "Lento";
}

export function PresalesView({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de pré-venda...
      </div>
    );
  }

  if (!data || data.totals.totalDeals === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado de pré-venda disponível.
      </div>
    );
  }

  const { presellers, recentDeals, totals } = data;

  return (
    <>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <StatPill label="Deals Transbordo" value={totals.totalDeals} />
        <StatPill label="Com Ação" value={totals.dealsComAcao} color={T.verde600} />
        <TimePill label="Tempo Médio" minutes={totals.avgMinutes} />
        <TimePill label="Mediana" minutes={totals.medianMinutes} />
        <span style={{ fontSize: "11px", color: T.cinza400, marginLeft: "auto" }}>
          Últimos 30 dias · Pipeline 28
        </span>
      </div>

      {/* Cards por pré-vendedor */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>
        Tempo de Resposta por Pré-Vendedor
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {presellers.map((ps) => {
          const clr = ps.squadId ? SQUAD_COLORS[ps.squadId] || T.azul600 : T.cinza600;
          return (
            <div
              key={ps.name}
              style={{
                backgroundColor: T.card,
                borderRadius: "12px",
                border: `1px solid ${T.border}`,
                boxShadow: T.elevSm,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  backgroundColor: clr,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ color: "#FFF", fontWeight: 600, fontSize: "14px" }}>{ps.name}</span>
                {ps.squadId && (
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "11px" }}>Squad {ps.squadId}</span>
                )}
              </div>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <MetricBox label="Mediana" value={formatMinutes(ps.medianMinutes)} color={responseColor(ps.medianMinutes)} />
                  <MetricBox label="Média" value={formatMinutes(ps.avgMinutes)} color={responseColor(ps.avgMinutes)} />
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                  <MiniChip label="Total" value={ps.totalDeals} />
                  <MiniChip label="Com ação" value={ps.dealsComAcao} color={T.verde600} />
                  <MiniChip label="Pendentes" value={ps.dealsPendentes} color={ps.dealsPendentes > 0 ? T.laranja500 : T.cinza400} />
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <BarIndicator label="≤30min" pct={ps.pctSub30} color={T.verde600} />
                  <BarIndicator label="≤60min" pct={ps.pctSub60} color={T.laranja500} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela de deals recentes */}
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>
        Deals Recentes
      </h3>
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ backgroundColor: T.cinza50 }}>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Deal</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 140 }}>Pré-Vendedor</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 140 }}>Transbordo</th>
              <th style={{ ...thStyle, textAlign: "left", minWidth: 140 }}>1ª Ação</th>
              <th style={{ ...thStyle, textAlign: "right", minWidth: 100 }}>Tempo</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 80 }}>Tipo</th>
              <th style={{ ...thStyle, textAlign: "center", minWidth: 80 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentDeals.map((d) => (
              <tr
                key={d.deal_id}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
              >
                <td style={{ ...tdStyle, color: T.cinza800, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.deal_title}
                </td>
                <td style={tdStyle}>{d.preseller_name}</td>
                <td style={{ ...tdStyle, fontSize: "12px" }}>{formatDate(d.transbordo_at)}</td>
                <td style={{ ...tdStyle, fontSize: "12px" }}>
                  {d.first_action_at ? formatDate(d.first_action_at) : "-"}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: 600,
                    color: responseColor(d.response_time_minutes),
                  }}
                >
                  {d.response_time_minutes != null ? formatMinutes(d.response_time_minutes) : "-"}
                </td>
                <td style={{ ...tdStyle, textAlign: "center", fontSize: "11px" }}>
                  {d.action_type || "-"}
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "10px",
                      fontWeight: 600,
                      backgroundColor: responseBg(d.response_time_minutes),
                      color: responseColor(d.response_time_minutes),
                    }}
                  >
                    {responseLabel(d.response_time_minutes)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimePill({ label, minutes }: { label: string; minutes: number }) {
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: "1px solid #E6E7EA",
        borderRadius: "12px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ fontSize: "10px", fontWeight: 500, color: "#6B6E84", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "20px",
          fontWeight: 700,
          color: responseColor(minutes),
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatMinutes(minutes)}
      </span>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "8px",
        backgroundColor: T.cinza50,
        borderRadius: "8px",
      }}
    >
      <div style={{ fontSize: "10px", color: T.cinza600, textTransform: "uppercase", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MiniChip({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span style={{ fontSize: "11px", color: color || T.cinza700 }}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

function BarIndicator({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
        <span style={{ fontSize: "10px", color: T.cinza600 }}>{label}</span>
        <span style={{ fontSize: "10px", fontWeight: 600, color }}>{pct}%</span>
      </div>
      <div style={{ height: "4px", backgroundColor: T.cinza100, borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: "2px" }} />
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#6B6E84",
  borderBottom: "1px solid #E6E7EA",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  backgroundColor: "#F3F3F5",
};

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderBottom: "1px solid #E6E7EA",
  fontSize: "13px",
  fontWeight: 400,
  color: "#141A3C",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};
