"use client";

import { T, SQUAD_COLORS } from "@/lib/constants";
import type { CampanhasData } from "@/lib/types";
import { StatPill } from "./ui";

interface Props {
  data: CampanhasData | null;
  loading: boolean;
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CampanhasView({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de campanhas...
      </div>
    );
  }

  if (!data || data.summary.totalAds === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Nenhum dado de campanhas disponível. Execute o sync primeiro.
      </div>
    );
  }

  const { summary, squads, top10, snapshotDate } = data;

  return (
    <>
      {/* Summary cards — mês atual */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <BrlPill label="Investimento" value={summary.totalSpend} />
        <StatPill label="Leads" value={summary.totalLeads} color={T.verde600} />
        <BrlPill label="CPL" value={summary.avgCpl} />
        <StatPill label="MQL" value={summary.totalMql} />
        <StatPill label="WON" value={summary.totalWon} color={T.verde600} />
        <BrlPill label="CPW" value={summary.cpw} />
        <span style={{ fontSize: "11px", color: T.cinza400, marginLeft: "auto" }}>
          {monthLabel(snapshotDate)} · {summary.totalAds} ads · atualizado {new Date(snapshotDate + "T12:00:00").toLocaleDateString("pt-BR")}
        </span>
      </div>

      {/* Per squad */}
      {squads.map((sq) => {
        const clr = SQUAD_COLORS[sq.id] || T.azul600;
        const hasData = sq.empreendimentos.some((e) => e.ads > 0 || e.mql > 0 || e.sql > 0 || e.opp > 0 || e.won > 0);

        return (
          <div
            key={sq.id}
            style={{
              backgroundColor: T.card,
              borderRadius: "12px",
              border: `1px solid ${T.border}`,
              boxShadow: T.elevSm,
              marginBottom: "16px",
              overflow: "hidden",
            }}
          >
            {/* Squad header */}
            <div
              style={{
                padding: "10px 16px",
                backgroundColor: clr,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#FFF", fontWeight: 600, fontSize: "14px" }}>{sq.name}</span>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  Gasto: {formatBRL(sq.totalSpend)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  Leads: {sq.totalLeads}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  WON: {sq.totalWon}
                </span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  CPW: {sq.cpw > 0 ? formatBRL(sq.cpw) : "-"}
                </span>
              </div>
            </div>

            {hasData ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: T.cinza50 }}>
                    <th style={{ ...thStyle, textAlign: "left", minWidth: 180 }}>Empreendimento</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Gasto</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Leads</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CPL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>MQL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>SQL</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>OPP</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>WON</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>CPW</th>
                  </tr>
                </thead>
                <tbody>
                  {sq.empreendimentos.map((emp) => (
                    <tr
                      key={emp.emp}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                    >
                      <td style={{ ...tdStyle, color: T.cinza800 }}>{emp.emp}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{emp.spend > 0 ? formatBRL(emp.spend) : "-"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.leads > 0 ? 600 : 400 }}>
                        {emp.leads > 0 ? emp.leads : "-"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {emp.cpl > 0 ? formatBRL(emp.cpl) : "-"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.mql > 0 ? 600 : 400 }}>
                        {emp.mql > 0 ? emp.mql : "-"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {emp.sql > 0 ? emp.sql : "-"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {emp.opp > 0 ? emp.opp : "-"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: emp.won > 0 ? 700 : 400,
                          color: emp.won > 0 ? T.verde700 : T.cinza300,
                        }}
                      >
                        {emp.won > 0 ? emp.won : "-"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: emp.cpw > 0 ? 600 : 400 }}>
                        {emp.cpw > 0 ? formatBRL(emp.cpw) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: T.cinza400, fontSize: "13px" }}>
                Sem ads ativos neste squad
              </div>
            )}
          </div>
        );
      })}

      {/* Top 10 */}
      {top10.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          <h3
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: T.fg,
              marginBottom: "12px",
            }}
          >
            Top 10 — Ação Imediata
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {top10.map((ad, i) => {
              const isCritico = ad.severidade === "CRITICO";
              const bgColor = isCritico ? T.vermelho50 : "#FEF3C7";
              const borderColor = isCritico ? T.destructive : T.laranja500;
              const sqName = squads.find((s) => s.id === ad.squad_id)?.name || `Squad ${ad.squad_id}`;
              const diagnosticos = ad.diagnostico?.split(" | ").filter(Boolean) || [];

              return (
                <div
                  key={ad.ad_id}
                  style={{
                    backgroundColor: bgColor,
                    borderLeft: `4px solid ${borderColor}`,
                    borderRadius: "10px",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", color: T.cinza600 }}>
                      #{i + 1} · {sqName} · {ad.empreendimento} · {ad.severidade}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: T.fg, marginBottom: "8px" }}>
                    {ad.ad_name}
                  </div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: diagnosticos.length > 0 ? "8px" : 0 }}>
                    <MetricChip label="Gasto" value={formatBRL(ad.spend)} />
                    <MetricChip label="Leads" value={String(ad.leads)} />
                    <MetricChip label="CPL" value={ad.cpl > 0 ? formatBRL(ad.cpl) : "-"} />
                    <MetricChip label="CTR" value={`${ad.ctr.toFixed(2)}%`} />
                    <MetricChip label="Freq" value={ad.frequency.toFixed(1)} />
                  </div>
                  {diagnosticos.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: T.cinza700 }}>
                      {diagnosticos.map((d, di) => (
                        <li key={di} style={{ marginBottom: "2px" }}>
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: "10px", textAlign: "right" }}>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>
          Meta Ads · Conta SZI · {monthLabel(snapshotDate)}
        </span>
      </div>
    </>
  );
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

function BrlPill({ label, value }: { label: string; value: number }) {
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
      <span style={{ fontSize: "20px", fontWeight: 700, color: T.fg, fontVariantNumeric: "tabular-nums" }}>
        {formatBRL(value)}
      </span>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        backgroundColor: "rgba(0,0,0,0.06)",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        color: T.cinza700,
      }}
    >
      {label}: {value}
    </span>
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
