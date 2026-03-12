"use client";

import { T, SQUAD_COLORS } from "@/lib/constants";
import type { PlanejamentoData, PlanejamentoEmpRow, PlanejamentoMetrics } from "@/lib/types";
import { TH, cellStyle, cellRightStyle, Tag } from "./ui";

interface PlanejamentoViewProps {
  data: PlanejamentoData | null;
  loading: boolean;
}

function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

function fmtMoney(n: number): string {
  if (n === 0) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number): string {
  if (n === 0) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function Arrow({ current, historical }: { current: number; historical: number }) {
  if (historical === 0 || current === 0) return <span style={{ color: T.cinza400, fontSize: "10px" }}>—</span>;
  const diff = current - historical;
  if (Math.abs(diff / historical) < 0.05) return <span style={{ color: T.cinza400, fontSize: "10px" }}>→</span>;
  if (diff > 0) return <span style={{ color: T.verde600, fontSize: "10px", fontWeight: 600 }}>↑</span>;
  return <span style={{ color: T.destructive, fontSize: "10px", fontWeight: 600 }}>↓</span>;
}

function ArrowInverse({ current, historical }: { current: number; historical: number }) {
  if (historical === 0 || current === 0) return <span style={{ color: T.cinza400, fontSize: "10px" }}>—</span>;
  const diff = current - historical;
  if (Math.abs(diff / historical) < 0.05) return <span style={{ color: T.cinza400, fontSize: "10px" }}>→</span>;
  if (diff < 0) return <span style={{ color: T.verde600, fontSize: "10px", fontWeight: 600 }}>↑</span>;
  return <span style={{ color: T.destructive, fontSize: "10px", fontWeight: 600 }}>↓</span>;
}

function EfficiencyTag({ efficiency }: { efficiency: "high" | "medium" | "low" }) {
  const labels = { high: "Alta", medium: "Média", low: "Baixa" };
  const colors = { high: T.verde600, medium: T.laranja500, low: T.destructive };
  return <Tag color={colors[efficiency]}>{labels[efficiency]}</Tag>;
}

function RecommendationTag({ row }: { row: PlanejamentoEmpRow }) {
  if (row.efficiency === "high" && row.current.won > 0) {
    return <Tag color={T.verde600}>Aumentar Budget</Tag>;
  }
  if (row.efficiency === "low") {
    return <Tag color={T.destructive}>Revisar</Tag>;
  }
  return <Tag color={T.cinza600}>Manter</Tag>;
}

function SummaryCard({ label, currentValue, histValue, format }: {
  label: string;
  currentValue: number;
  histValue: number;
  format: "number" | "money" | "pct";
}) {
  const fmtFn = format === "money" ? fmtMoney : format === "pct" ? fmtPct : fmt;
  return (
    <div
      style={{
        backgroundColor: "#FFF",
        border: `1px solid ${T.border}`,
        borderRadius: "12px",
        padding: "14px 18px",
        flex: "1 1 160px",
        minWidth: "160px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontSize: "10px", fontWeight: 500, color: T.cinza600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontSize: "22px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
          {fmtFn(currentValue)}
        </span>
        {format === "money" ? (
          <ArrowInverse current={currentValue} historical={histValue} />
        ) : (
          <Arrow current={currentValue} historical={histValue} />
        )}
      </div>
      <div style={{ fontSize: "10px", color: T.cinza400, marginTop: "2px" }}>
        Média mensal: {fmtFn(histValue)}
      </div>
    </div>
  );
}

function HistEmpRow({ row }: { row: PlanejamentoEmpRow }) {
  const h = row.historical;
  const color = SQUAD_COLORS[row.squadId] || T.azul600;

  return (
    <tr>
      <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 500 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "3px", height: "16px", borderRadius: "2px", backgroundColor: color }} />
          {row.emp.replace(" Spot", "").replace(" II", " II").replace(" III", " III")}
        </div>
      </td>
      <td style={cellRightStyle}>{fmt(h.mql)}</td>
      <td style={cellRightStyle}>{fmt(h.sql)}</td>
      <td style={cellRightStyle}>{fmt(h.opp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(h.won)}</td>
      <td style={cellRightStyle}>{fmtMoney(h.spend)}</td>
      <td style={cellRightStyle}>{fmtMoney(h.cpw)}</td>
      <td style={cellRightStyle}>{fmtPct(h.mqlToSql)}</td>
      <td style={cellRightStyle}>{fmtPct(h.sqlToOpp)}</td>
      <td style={cellRightStyle}>{fmtPct(h.oppToWon)}</td>
      <td style={{ ...cellRightStyle, textAlign: "center" }}>
        <EfficiencyTag efficiency={row.efficiency} />
      </td>
      <td style={{ ...cellRightStyle, textAlign: "center" }}>
        <RecommendationTag row={row} />
      </td>
    </tr>
  );
}

function HistTotalsRow({ label, m }: { label: string; m: PlanejamentoMetrics }) {
  return (
    <tr style={{ backgroundColor: T.cinza50 }}>
      <td style={{ ...cellStyle, fontSize: "12px", fontWeight: 700 }}>{label}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.mql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.sql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmt(m.opp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700, color: T.verde600 }}>{fmt(m.won)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(m.spend)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtMoney(m.cpw)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(m.mqlToSql)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(m.sqlToOpp)}</td>
      <td style={{ ...cellRightStyle, fontWeight: 700 }}>{fmtPct(m.oppToWon)}</td>
      <td style={cellRightStyle} />
      <td style={cellRightStyle} />
    </tr>
  );
}

export function PlanejamentoView({ data, loading }: PlanejamentoViewProps) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Carregando planejamento...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: T.mutedFg }}>
        <p style={{ fontSize: "14px" }}>Nenhum dado disponível</p>
      </div>
    );
  }

  const tc = data.totals.current;
  const th = data.totals.historical;

  // Ranking by historical efficiency
  const ranked = [...data.empreendimentos].sort((a, b) => {
    const scoreA = (a.efficiency === "high" ? 3 : a.efficiency === "medium" ? 2 : 1);
    const scoreB = (b.efficiency === "high" ? 3 : b.efficiency === "medium" ? 2 : 1);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return (a.historical.cpw || Infinity) - (b.historical.cpw || Infinity);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Summary cards — mês atual vs histórico */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <SummaryCard label="Investimento Total" currentValue={tc.spend} histValue={th.spend} format="money" />
        <SummaryCard label="WON Total" currentValue={tc.won} histValue={th.won} format="number" />
        <SummaryCard label="CPW Médio" currentValue={tc.cpw} histValue={th.cpw} format="money" />
        <SummaryCard label="MQL→SQL" currentValue={tc.mqlToSql} histValue={th.mqlToSql} format="pct" />
        <SummaryCard label="SQL→OPP" currentValue={tc.sqlToOpp} histValue={th.sqlToOpp} format="pct" />
        <SummaryCard label="OPP→WON" currentValue={tc.oppToWon} histValue={th.oppToWon} format="pct" />
      </div>

      {/* Tabela — somente conversão histórica (média mensal) */}
      <div
        style={{
          backgroundColor: "#FFF",
          border: `1px solid ${T.border}`,
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: 0 }}>
            Conversão Histórica por Empreendimento
          </h3>
          <span style={{ fontSize: "10px", color: T.cinza400 }}>
            Média mensal (últimos 12 meses)
          </span>
        </div>
        <div style={{ overflowX: "auto", marginTop: "10px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH>Empreendimento</TH>
                <TH right>MQL</TH>
                <TH right>SQL</TH>
                <TH right>OPP</TH>
                <TH right>WON</TH>
                <TH right>Invest.</TH>
                <TH right>CPW</TH>
                <TH right>MQL→SQL</TH>
                <TH right>SQL→OPP</TH>
                <TH right>OPP→WON</TH>
                <TH extraStyle={{ textAlign: "center" }}>Eficiência</TH>
                <TH extraStyle={{ textAlign: "center" }}>Ação</TH>
              </tr>
            </thead>
            <tbody>
              {data.empreendimentos.map((row) => (
                <HistEmpRow key={row.emp} row={row} />
              ))}
              <HistTotalsRow label="Total" m={th} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking de eficiência */}
      <div
        style={{
          backgroundColor: "#FFF",
          border: `1px solid ${T.border}`,
          borderRadius: "12px",
          padding: "16px 20px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: T.fg, margin: "0 0 12px 0" }}>
          Ranking de Eficiência
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {ranked.map((row, i) => {
            const color = SQUAD_COLORS[row.squadId] || T.azul600;
            const effColors = { high: T.verde600, medium: T.laranja500, low: T.destructive };
            const maxOppToWon = Math.max(...data.empreendimentos.map(r => r.historical.oppToWon || 0.01));
            const barWidth = row.historical.oppToWon > 0
              ? Math.min((row.historical.oppToWon / maxOppToWon) * 100, 100)
              : 0;

            return (
              <div key={row.emp} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, width: "16px", textAlign: "right" }}>
                  {i + 1}
                </span>
                <div style={{ width: "3px", height: "20px", borderRadius: "2px", backgroundColor: color }} />
                <span style={{ fontSize: "12px", fontWeight: 500, color: T.fg, width: "180px" }}>
                  {row.emp.replace(" Spot", "")}
                </span>
                <div style={{ flex: 1, height: "18px", backgroundColor: T.cinza50, borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(barWidth, 1)}%`,
                      height: "100%",
                      backgroundColor: effColors[row.efficiency],
                      borderRadius: "4px",
                      opacity: 0.7,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "11px", fontWeight: 500, color: T.cinza600, width: "50px", textAlign: "right" }}>
                  {fmtPct(row.historical.oppToWon)}
                </span>
                <div style={{ width: "80px" }}>
                  <RecommendationTag row={row} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
