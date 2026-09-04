"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Biz = { id: string; name: string; domain: string | null; description: string | null };
type Ctx = {
  bizs: Biz[];
  selected: string;
  setSelected: (id: string) => void;
  refresh: () => void;
};

const C = createContext<Ctx>({ bizs: [], selected: "", setSelected: () => {}, refresh: () => {} });

export function BizProvider({ children }: { children: React.ReactNode }) {
  const [bizs, setBizs] = useState<Biz[]>([]);
  const [selected, setSelectedState] = useState("");

  const setSelected = (id: string) => {
    setSelectedState(id);
    try { localStorage.setItem("repllyer_biz", id); } catch {}
  };

  const refresh = async () => {
    const r = await fetch("/api/businesses");
    if (r.ok) {
      const j = await r.json();
      setBizs(j.businesses || []);
      const stored = (() => { try { return localStorage.getItem("repllyer_biz"); } catch { return null; } })();
      if (stored && j.businesses?.find((b: Biz) => b.id === stored)) setSelectedState(stored);
      else if (j.businesses?.[0] && !selected) setSelectedState(j.businesses[0].id);
    }
  };

  useEffect(() => { refresh(); }, []);

  return <C.Provider value={{ bizs, selected, setSelected, refresh }}>{children}</C.Provider>;
}

export const useBiz = () => useContext(C);
