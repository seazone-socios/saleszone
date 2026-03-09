"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { T } from "@/lib/constants";
import type { TabKey, AcompanhamentoData, AlinhamentoData, CampanhasData, RegrasMqlData, OciosidadeData, PresalesData } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/dashboard/header";
import { AcompanhamentoView } from "@/components/dashboard/acompanhamento-view";
import { AlinhamentoView } from "@/components/dashboard/alinhamento-view";
import { BalanceamentoView } from "@/components/dashboard/balanceamento-view";
import { CampanhasView } from "@/components/dashboard/campanhas-view";
import { DiagnosticoMktView } from "@/components/dashboard/diagnostico-mkt-view";
import { OciosidadeView } from "@/components/dashboard/ociosidade-view";
import { PresalesView } from "@/components/dashboard/presales-view";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string } | undefined>();
  const [mainView, setMainView] = useState("campanhas");
  const [activeTab, setActiveTab] = useState<TabKey>("mql");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [acompData, setAcompData] = useState<Record<string, AcompanhamentoData>>({});
  const [alinhData, setAlinhData] = useState<AlinhamentoData | null>(null);
  const [campData, setCampData] = useState<CampanhasData | null>(null);
  const [balancData, setBalancData] = useState<RegrasMqlData | null>(null);
  const [ocioData, setOcioData] = useState<OciosidadeData | null>(null);
  const [presalesData, setPresalesData] = useState<PresalesData | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser({
          email: u.email || "",
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || "",
        });
      }
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

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

  const fetchCamp = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/campanhas");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCampData(await res.json());
    } catch (err) {
      console.error("Fetch camp error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOcio = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/ociosidade");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOcioData(await res.json());
    } catch (err) {
      console.error("Fetch ocio error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalanc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/regras-mql");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBalancData(await res.json());
    } catch (err) {
      console.error("Fetch balanc error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPresales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/presales");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPresalesData(await res.json());
    } catch (err) {
      console.error("Fetch presales error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainView === "acompanhamento" && !acompData[activeTab]) {
      fetchAcomp(activeTab);
    } else if (mainView === "alinhamento" && !alinhData) {
      fetchAlinh();
    } else if (mainView === "ociosidade" && !ocioData) {
      fetchOcio();
    } else if (mainView === "balanceamento") {
      if (!balancData) fetchBalanc();
      if (!ocioData) fetchOcio();
    } else if (mainView === "campanhas" && !campData) {
      fetchCamp();
    } else if (mainView === "diagnostico-mkt" && !campData) {
      fetchCamp();
    } else if (mainView === "presales" && !presalesData) {
      fetchPresales();
    }
  }, [activeTab, mainView]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSyncFunctions = (view: string): string[] => {
    if (view === "campanhas" || view === "diagnostico-mkt") return ["meta-ads"];
    if (view === "ociosidade") return ["calendar"];
    return ["dashboard"];
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ functions: getSyncFunctions(mainView) }),
      });
      if (mainView === "acompanhamento") await fetchAcomp(activeTab);
      else if (mainView === "alinhamento") await fetchAlinh();
      else if (mainView === "ociosidade") await fetchOcio();
      else if (mainView === "balanceamento") await fetchBalanc();
      else if (mainView === "campanhas") await fetchCamp();
      else if (mainView === "diagnostico-mkt") await fetchCamp();
      else if (mainView === "presales") await fetchPresales();
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: T.font, backgroundColor: T.cinza50, minHeight: "100vh", letterSpacing: "0.02em" }}>
      <Header mainView={mainView} setMainView={setMainView} onRefresh={handleRefresh} loading={loading} lastUpdated={lastUpdated} user={user} onLogout={handleLogout} />
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
        {mainView === "ociosidade" && <OciosidadeView data={ocioData} loading={loading} />}
        {mainView === "balanceamento" && <BalanceamentoView data={balancData} ocioData={ocioData} loading={loading} />}
        {mainView === "campanhas" && <CampanhasView data={campData} loading={loading} />}
        {mainView === "presales" && <PresalesView data={presalesData} loading={loading} />}
        {mainView === "diagnostico-mkt" && <DiagnosticoMktView data={campData} loading={loading} />}
        {mainView === "venda" && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <p style={{ fontSize: "16px" }}>Aba Venda — em construção</p>
          </div>
        )}
      </div>
    </div>
  );
}
