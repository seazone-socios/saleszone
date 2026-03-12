"use client";

import { T, SQUAD_COLORS, PV_COLS, V_COLS, SQUAD_V_MAP } from "@/lib/constants";
import type { AlinhamentoData, MisalignedDealsData } from "@/lib/types";
import { StatPill, tdStyle, thBaseStyle } from "./ui";
import { ExternalLink } from "lucide-react";

interface Props {
  data: AlinhamentoData | null;
  misalignedDeals: MisalignedDealsData | null;
  loading: boolean;
}

export function AlinhamentoView({ data, misalignedDeals, loading }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de alinhamento...
      </div>
    );
  }

  const rows = data?.rows || [];
  const stats = data?.stats || { total: 0, ok: 0, mis: 0 };
  const personDeals = misalignedDeals?.byPerson || [];

  return (
    <>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <StatPill label="Negócios Abertos" value={stats.total} />
        <StatPill label="Alinhados" value={stats.ok} color={T.verde600} />
        <StatPill label="Desalinhados" value={stats.mis} color={T.destructive} />
        <div style={{ marginLeft: "auto", display: "flex", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "20px",
                height: "14px",
                border: `3px solid ${T.primary}`,
                borderRadius: "3px",
                backgroundColor: T.azul50,
              }}
            />
            <span style={{ fontSize: "11px", color: T.cinza600 }}>Zona correta (pessoa designada)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "20px",
                height: "14px",
                borderRadius: "3px",
                backgroundColor: T.vermelho50,
                border: `1px solid ${T.destructive}44`,
              }}
            />
            <span style={{ fontSize: "11px", color: T.cinza600 }}>Desalinhado (pessoa errada)</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: T.card,
          borderRadius: "12px",
          border: `1px solid ${T.border}`,
          boxShadow: T.elevSm,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
            <thead>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <th style={{ ...thBaseStyle, borderBottom: "none" }} />
                <th style={{ ...thBaseStyle, borderBottom: "none" }} />
                <th
                  colSpan={PV_COLS.length}
                  style={{
                    ...thBaseStyle,
                    textAlign: "center",
                    borderBottom: "none",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: T.cinza800,
                    borderLeft: `1px solid ${T.cinza200}`,
                  }}
                >
                  Pré Venda
                </th>
                <th
                  colSpan={V_COLS.length}
                  style={{
                    ...thBaseStyle,
                    textAlign: "center",
                    borderBottom: "none",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: T.cinza800,
                    borderLeft: `2px solid ${T.cinza300}`,
                  }}
                >
                  Venda
                </th>
              </tr>
              <tr style={{ backgroundColor: T.cinza50 }}>
                <th style={{ ...thBaseStyle, textAlign: "left", minWidth: 50 }}>Squad</th>
                <th style={{ ...thBaseStyle, textAlign: "left", minWidth: 180 }}>Empreendimento</th>
                {PV_COLS.map((p, i) => (
                  <th
                    key={`pv-${i}`}
                    style={{
                      ...thBaseStyle,
                      textAlign: "right",
                      width: `${100 / (PV_COLS.length + V_COLS.length + 2)}%`,
                      borderLeft: i === 0 ? `1px solid ${T.cinza200}` : undefined,
                    }}
                  >
                    {p}
                  </th>
                ))}
                {V_COLS.map((p, i) => (
                  <th
                    key={`v-${i}`}
                    style={{
                      ...thBaseStyle,
                      textAlign: "right",
                      width: `${100 / (PV_COLS.length + V_COLS.length + 2)}%`,
                      borderLeft: i === 0 ? `2px solid ${T.cinza300}` : undefined,
                    }}
                  >
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const clr = SQUAD_COLORS[row.sqId] || T.azul600;
                const isFirst = ri === 0 || rows[ri - 1].sqId !== row.sqId;
                const isLast = ri === rows.length - 1 || rows[ri + 1]?.sqId !== row.sqId;
                const sqPVIdx = PV_COLS.indexOf(row.correctPV);
                const sqVIndices = SQUAD_V_MAP[row.sqId] || [];

                return (
                  <tr
                    key={ri}
                    style={{ borderTop: isFirst ? `2px solid ${clr}44` : undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                  >
                    <td style={{ ...tdStyle, color: T.cinza600, fontWeight: 500 }}>{row.sqId}</td>
                    <td style={{ ...tdStyle, color: T.cinza800 }}>{row.emp}</td>
                    {PV_COLS.map((p, pi) => {
                      const val = row.cells.pv[p] || 0;
                      const isZone = pi === sqPVIdx;
                      const isMis = val > 0 && !isZone;
                      return (
                        <td
                          key={`pv-${pi}`}
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            borderLeft: pi === 0 ? `1px solid ${T.cinza200}` : `1px solid ${T.border}`,
                            ...(isZone
                              ? {
                                  backgroundColor: T.azul50,
                                  borderLeft: `3px solid ${T.primary}`,
                                  borderRight: `3px solid ${T.primary}`,
                                  borderTop: isFirst ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                  borderBottom: isLast ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                }
                              : {}),
                            ...(isMis ? { backgroundColor: T.vermelho50, color: T.destructive, fontWeight: 700 } : {}),
                            color: val === 0 ? T.cinza300 : isMis ? T.destructive : isZone ? T.primary : T.cardFg,
                            fontWeight: isZone && val > 0 ? 600 : isMis ? 700 : 400,
                          }}
                        >
                          {val}
                        </td>
                      );
                    })}
                    {V_COLS.map((p, vi) => {
                      const val = row.cells.v[p] || 0;
                      const isZone = sqVIndices.includes(vi);
                      const isZoneFirst = isZone && vi === sqVIndices[0];
                      const isZoneLast = isZone && vi === sqVIndices[sqVIndices.length - 1];
                      const isMis = val > 0 && !isZone;
                      return (
                        <td
                          key={`v-${vi}`}
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            borderLeft: vi === 0 ? `2px solid ${T.cinza300}` : `1px solid ${T.border}`,
                            ...(isZone
                              ? {
                                  backgroundColor: T.azul50,
                                  borderLeft: isZoneFirst ? `3px solid ${T.primary}` : `1px solid ${T.primary}22`,
                                  borderRight: isZoneLast ? `3px solid ${T.primary}` : `1px solid ${T.primary}22`,
                                  borderTop: isFirst ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                  borderBottom: isLast ? `3px solid ${T.primary}` : `1px solid ${T.primary}33`,
                                }
                              : {}),
                            ...(isMis ? { backgroundColor: T.vermelho50, color: T.destructive, fontWeight: 700 } : {}),
                            color: val === 0 ? T.cinza300 : isMis ? T.destructive : isZone ? T.primary : T.cardFg,
                            fontWeight: isZone && val > 0 ? 600 : isMis ? 700 : 400,
                          }}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: "10px", textAlign: "right" }}>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>
          Pipedrive · Negócios em aberto · {new Date().toLocaleDateString("pt-BR")}
        </span>
      </div>

      {/* Misaligned deals by person */}
      {personDeals.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: T.fg, marginBottom: "12px" }}>
            Deals Desalinhados por Pessoa
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {personDeals.map((pd) => (
              <details
                key={pd.person}
                style={{
                  backgroundColor: T.card,
                  borderRadius: "8px",
                  border: `1px solid ${T.destructive}33`,
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    padding: "10px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: T.fg,
                    backgroundColor: T.vermelho50,
                  }}
                >
                  <span style={{ color: T.destructive, fontWeight: 700 }}>{pd.deals.length}</span>
                  <span>{pd.person}</span>
                  <span style={{ fontSize: "11px", color: T.cinza400 }}>
                    ({pd.role === "pv" ? "Pré-Venda" : "Venda"})
                  </span>
                </summary>
                <div style={{ padding: "8px 16px 12px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: T.cinza600, fontWeight: 600 }}>
                          Empreendimento
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: T.cinza600, fontWeight: 600 }}>
                          Deal
                        </th>
                        <th style={{ textAlign: "center", padding: "4px 8px", color: T.cinza600, fontWeight: 600, width: "40px" }}>
                          Link
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pd.deals.map((d) => (
                        <tr
                          key={d.deal_id}
                          style={{ borderBottom: `1px solid ${T.border}` }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                        >
                          <td style={{ padding: "4px 8px", color: T.cinza700 }}>{d.empreendimento}</td>
                          <td style={{ padding: "4px 8px", color: T.cardFg }}>{d.title}</td>
                          <td style={{ padding: "4px 8px", textAlign: "center" }}>
                            <a
                              href={d.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: T.primary, display: "inline-flex" }}
                            >
                              <ExternalLink size={13} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
