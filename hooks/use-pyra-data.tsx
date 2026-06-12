"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useWindowManager } from "@/hooks/use-window-manager";
import { loadArtifacts, type ArtifactBundle } from "@/lib/artifacts";

interface PyraDataValue {
  data: ArtifactBundle | null;
  loading: boolean;
  error: string | null;
  selectedInverter: string | null;
  /** Select an inverter and open/focus the Inspector on it. */
  selectInverter: (id: string) => void;
  setSelectedInverter: (id: string | null) => void;
}

const PyraDataContext = createContext<PyraDataValue | null>(null);

export function usePyraData(): PyraDataValue {
  const ctx = useContext(PyraDataContext);
  if (!ctx) throw new Error("usePyraData must be used within PyraDataProvider");
  return ctx;
}

export function PyraDataProvider({ children }: { children: React.ReactNode }) {
  const { openWindow, focusWindow } = useWindowManager();
  const [data, setData] = useState<ArtifactBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInverter, setSelectedInverter] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadArtifacts()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setSelectedInverter(d.ledger[0]?.inverterId ?? null);
      })
      .catch((e) => alive && setError(String(e?.message ?? e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const selectInverter = useCallback(
    (id: string) => {
      setSelectedInverter(id);
      openWindow("inspector", { inverterId: id });
      focusWindow("inspector");
    },
    [openWindow, focusWindow]
  );

  const value = useMemo(
    () => ({ data, loading, error, selectedInverter, selectInverter, setSelectedInverter }),
    [data, loading, error, selectedInverter, selectInverter]
  );

  return <PyraDataContext value={value}>{children}</PyraDataContext>;
}
