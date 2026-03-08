"use client";

import { useState, useCallback, useEffect } from "react";
import { T } from "@/lib/constants";
import type { TabKey, AcompanhamentoData, AlinhamentoData } from "@/lib/types";
import { Header } from "@/components/dashboard/header";
import { AcompanhamentoView } from "@/components/dashboard/acompanhamento-view";
import { AlinhamentoView } from "@/components/dashboard/alinhamento-view";

export default function Dashboard() {
  const [mainView, setMainView] = useState("acompanhamento");
  const [activeTab, setActiveTab] = useState<TabKey>("mql");
  const [loading, setLoading] = useState(false);
  const [acompData, setAcompData] = useState<Record<string, AcompanhamentoData>>({});
  const [alinhData, setAlinhData] = useState<AlinhamentoData | null>(null);

  const fetchAcomp = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?tab=${tab}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAcompData((prev) => ({ ...prev, [tab]: data }));
    } catch (err) {
      console.error("Fetch acomp error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlinh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/alinhamento");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAlinhData(await res.json());
    } catch (err) {
      console.error("Fetch alinh error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainView === "acompanhamento" && !acompData[activeTab]) {
      fetchAcomp(activeTab);
    } else if (mainView === "alinhamento" && !alinhData) {
      fetchAlinh();
    }
  }, [activeTab, mainView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (mainView === "acompanhamento") fetchAcomp(activeTab);
    else fetchAlinh();
  };

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", letterSpacing: "0.02em" }}>
      <Header mainView={mainView} setMainView={setMainView} onRefresh={handleRefresh} loading={loading} />
      <div style={{ padding: "16px 20px", maxWidth: "2200px", margin: "0 auto" }}>
        {mainView === "acompanhamento" && (
          <AcompanhamentoView
            data={acompData[activeTab] || null}
            activeTab={activeTab}
            setActiveTab={(tab: TabKey) => setActiveTab(tab)}
            loading={loading}
          />
        )}
        {mainView === "alinhamento" && <AlinhamentoView data={alinhData} loading={loading} />}
        {mainView === "ociosidade" && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: T.cinza600 }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>⏳</div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Ociosidade</h3>
            <p style={{ fontSize: "14px", margin: 0 }}>Em breve — análise de ociosidade dos closers via Google Calendar</p>
          </div>
        )}
        {mainView === "campanhas" && (
          <div style={{ textAlign: "center", padding: "80px 20px", color: T.cinza600 }}>
            <div style={{ fontSize: "40px", marginBottom: "16px" }}>📢</div>
            <h3 style={{ fontSize: "18px", fontWeight: 600, color: T.fg, margin: "0 0 8px" }}>Campanhas</h3>
            <p style={{ fontSize: "14px", margin: 0 }}>Em breve — acompanhamento de campanhas de marketing</p>
          </div>
        )}
      </div>
    </div>
  );
}
