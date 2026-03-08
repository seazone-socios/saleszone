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

  const fetchData = useCallback(
    async (tab?: TabKey) => {
      const currentTab = tab || activeTab;
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard?tab=${currentTab}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.acompanhamento?.[currentTab]) {
          setAcompData((prev) => ({ ...prev, [currentTab]: data.acompanhamento[currentTab] }));
        }
        if (data.alinhamento) {
          setAlinhData(data.alinhamento);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [activeTab]
  );

  // Auto-fetch on mount and tab change
  useEffect(() => {
    if (!acompData[activeTab]) {
      fetchData(activeTab);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
  };

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", letterSpacing: "0.02em" }}>
      <Header mainView={mainView} setMainView={setMainView} onRefresh={() => fetchData()} loading={loading} />

      <div style={{ padding: "16px 20px", maxWidth: "2200px", margin: "0 auto" }}>
        {mainView === "acompanhamento" ? (
          <AcompanhamentoView
            data={acompData[activeTab] || null}
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            loading={loading}
          />
        ) : (
          <AlinhamentoView data={alinhData} loading={loading} />
        )}
      </div>
    </div>
  );
}
