"use client";

import { useState } from "react";
import { T, SQUAD_COLORS } from "@/lib/constants";
import type { CampanhasData, MetaAdRow } from "@/lib/types";
import { StatPill } from "./ui";

interface Props {
  data: CampanhasData | null;
  loading: boolean;
}

function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CampanhasView({ data, loading }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const { summary, squads, snapshotDate } = data;

  const toggleExpand = (sqId: number, emp: string) => {
    const key = `${sqId}:${emp}`;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      {/* Summary cards */}
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
                    <ThInfo label="CPL" tip="Custo por Lead (Gasto / Leads)" />
                    <th style={{ ...thStyle, textAlign: "right" }}>MQL</th>
                    <ThInfo label="CMQL" tip="Custo por MQL (Gasto / MQLs)" />
                    <th style={{ ...thStyle, textAlign: "right" }}>SQL</th>
                    <ThInfo label="CSQL" tip="Custo por SQL (Gasto / SQLs)" />
                    <th style={{ ...thStyle, textAlign: "right" }}>OPP</th>
                    <ThInfo label="COPP" tip="Custo por Oportunidade (Gasto / OPPs)" />
                    <th style={{ ...thStyle, textAlign: "right" }}>WON</th>
                    <ThInfo label="CPW" tip="Custo por Ganho (Gasto / WONs)" />
                  </tr>
                </thead>
                <tbody>
                  {sq.empreendimentos.map((emp) => {
                    const key = `${sq.id}:${emp.emp}`;
                    const isOpen = !!expanded[key];
                    const hasAds = emp.adsDetail && emp.adsDetail.length > 0;

                    return (
                      <>
                        <tr
                          key={emp.emp}
                          onClick={() => hasAds && toggleExpand(sq.id, emp.emp)}
                          style={{ cursor: hasAds ? "pointer" : "default" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.cinza50)}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "")}
                        >
                          <td style={{ ...tdStyle, color: T.cinza800 }}>
                            {hasAds && (
                              <span style={{ display: "inline-block", width: "16px", fontSize: "10px", color: T.cinza400 }}>
                                {isOpen ? "▼" : "▶"}
                              </span>
                            )}
                            {!hasAds && <span style={{ display: "inline-block", width: "16px" }} />}
                            {emp.emp}
                          </td>
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
                            {emp.cmql > 0 ? formatBRL(emp.cmql) : "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {emp.sql > 0 ? emp.sql : "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {emp.csql > 0 ? formatBRL(emp.csql) : "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {emp.opp > 0 ? emp.opp : "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {emp.copp > 0 ? formatBRL(emp.copp) : "-"}
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
                        {isOpen && hasAds && <AdRows ads={emp.adsDetail} />}
                      </>
                    );
                  })}
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

      <div style={{ marginTop: "10px", textAlign: "right" }}>
        <span style={{ fontSize: "11px", color: T.cinza400 }}>
          Meta Ads · Conta SZI · {monthLabel(snapshotDate)}
        </span>
      </div>
    </>
  );
}

function AdRows({ ads }: { ads: MetaAdRow[] }) {
  return (
    <>
      {/* Sub-header */}
      <tr style={{ backgroundColor: "#F8F8FA" }}>
        <td style={{ ...subThStyle, paddingLeft: "32px" }}>Ad Name</td>
        <td style={subThStyle}>Gasto</td>
        <td style={subThStyle}>Impressões</td>
        <td style={subThStyle}>Clicks</td>
        <td style={subThStyle}>Leads</td>
        <td style={subThStyle}>CPL</td>
        <td style={subThStyle}>CPC</td>
        <td style={subThStyle}>CTR</td>
        <td colSpan={4} style={subThStyle}>Severidade</td>
      </tr>
      {ads.map((ad) => {
        const sevColor =
          ad.severidade === "CRITICO" ? T.destructive : ad.severidade === "ALERTA" ? T.laranja500 : T.verde600;
        return (
          <tr
            key={ad.ad_id}
            style={{ backgroundColor: "#FAFBFC" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F1F4")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FAFBFC")}
          >
            <td
              style={{
                ...tdStyle,
                paddingLeft: "32px",
                fontSize: "12px",
                color: T.cinza700,
                maxWidth: "260px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={ad.ad_name}
            >
              {ad.ad_name}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>
              {ad.spend > 0 ? formatBRL(ad.spend) : "-"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>
              {ad.impressions > 0 ? ad.impressions.toLocaleString("pt-BR") : "-"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>
              {ad.clicks > 0 ? ad.clicks.toLocaleString("pt-BR") : "-"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px", fontWeight: ad.leads > 0 ? 600 : 400 }}>
              {ad.leads > 0 ? ad.leads : "-"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>
              {ad.cpl > 0 ? formatBRL(ad.cpl) : "-"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>
              {ad.cpc > 0 ? formatBRL(ad.cpc) : "-"}
            </td>
            <td style={{ ...tdStyle, textAlign: "right", fontSize: "12px" }}>
              {ad.ctr > 0 ? `${ad.ctr.toFixed(2)}%` : "-"}
            </td>
            <td
              colSpan={4}
              style={{
                ...tdStyle,
                textAlign: "right",
                fontSize: "11px",
                fontWeight: 600,
                color: sevColor,
              }}
            >
              {ad.severidade}
            </td>
          </tr>
        );
      })}
    </>
  );
}

function ThInfo({ label, tip }: { label: string; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <th style={{ ...thStyle, textAlign: "right", position: "relative" }}>
      {label}
      <span
        onClick={(e) => { e.stopPropagation(); setShow((v) => !v); }}
        style={{
          display: "inline-block",
          marginLeft: "3px",
          width: "13px",
          height: "13px",
          borderRadius: "50%",
          backgroundColor: "#D1D3DB",
          color: "#FFF",
          fontSize: "9px",
          fontWeight: 700,
          lineHeight: "13px",
          textAlign: "center",
          cursor: "pointer",
          verticalAlign: "middle",
        }}
        title={tip}
      >
        i
      </span>
      {show && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "100%",
            marginTop: "4px",
            backgroundColor: "#1F2937",
            color: "#FFF",
            fontSize: "11px",
            fontWeight: 400,
            padding: "6px 10px",
            borderRadius: "6px",
            whiteSpace: "nowrap",
            zIndex: 20,
            textTransform: "none",
            letterSpacing: "0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {tip}
        </div>
      )}
    </th>
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

const subThStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "9px",
  fontWeight: 500,
  color: "#9B9DB0",
  borderBottom: "1px solid #EDEDF0",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  textAlign: "right",
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
