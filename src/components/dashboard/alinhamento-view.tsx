"use client";

import { T, SQUAD_COLORS, PV_COLS, V_COLS } from "@/lib/constants";
import type { AlinhamentoData } from "@/lib/types";
import { StatPill, tdStyle, thBaseStyle } from "./ui";

interface Props {
  data: AlinhamentoData | null;
  loading: boolean;
}

export function AlinhamentoView({ data, loading }: Props) {
  if (loading && !data) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: T.cinza600 }}>
        Carregando dados de alinhamento...
      </div>
    );
  }

  const rows = data?.rows || [];
  const stats = data?.stats || { total: 0, ok: 0, mis: 0 };

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
                      minWidth: 110,
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
                      minWidth: 100,
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
                const sqVIdx = V_COLS.indexOf(row.correctV);

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
                      const isZone = vi === sqVIdx;
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
    </>
  );
}
