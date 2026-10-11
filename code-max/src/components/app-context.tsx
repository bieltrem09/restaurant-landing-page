"use client";

import { createContext, useContext } from "react";
import type { Mode } from "@/lib/ordeliry/context";

export type OrdeliryOpen = { leadId?: string | null; mode?: Mode; prefill?: string; leadNome?: string };

export type AppCtx = {
  openLead: (id: string) => void;
  openOrdeliry: (o?: OrdeliryOpen) => void;
  profile: { nome: string; estudio: string; whatsapp: string };
};

export const AppContext = createContext<AppCtx>({
  openLead: () => {},
  openOrdeliry: () => {},
  profile: { nome: "", estudio: "", whatsapp: "" },
});

export const useApp = () => useContext(AppContext);
