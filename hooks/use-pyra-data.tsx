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
import { loadArtifacts, DEMO_BASE, type ArtifactBundle, type AnalysisCap } from "@/lib/artifacts";

export interface DatasetRef {
  id: string;
  base: string;
  label: string;
}

const DEMO: DatasetRef = { id: "demo", base: DEMO_BASE, label: "EnerParc Plant A · demo" };
const DATASETS_KEY = "pyra:datasets";
const ACTIVE_KEY = "pyra:active-dataset";
const OK: AnalysisCap = { status: "ok", reason: "" };

interface PyraDataValue {
  data: ArtifactBundle | null;
  loading: boolean;
  error: string | null;
  selectedInverter: string | null;
  selectInverter: (id: string) => void;
  setSelectedInverter: (id: string | null) => void;
  // datasets
  activeDataset: DatasetRef;
  datasets: DatasetRef[];
  switchDataset: (id: string) => void;
  registerDataset: (d: DatasetRef) => void;
  /** Capability of an analysis for the active dataset ("ok" when no manifest). */
  capabilityOf: (name: string) => AnalysisCap;
}

const PyraDataContext = createContext<PyraDataValue | null>(null);

export function usePyraData(): PyraDataValue {
  const ctx = useContext(PyraDataContext);
  if (!ctx) throw new Error("usePyraData must be used within PyraDataProvider");
  return ctx;
}

function loadDatasetList(): DatasetRef[] {
  try {
    const raw = localStorage.getItem(DATASETS_KEY);
    const extra = raw ? (JSON.parse(raw) as DatasetRef[]) : [];
    return [DEMO, ...extra.filter((d) => d.id !== "demo")];
  } catch {
    return [DEMO];
  }
}

export function PyraDataProvider({ children }: { children: React.ReactNode }) {
  const { openWindow, focusWindow } = useWindowManager();
  const [data, setData] = useState<ArtifactBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInverter, setSelectedInverter] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetRef[]>([DEMO]);
  const [activeDataset, setActiveDataset] = useState<DatasetRef>(DEMO);

  // hydrate the saved dataset list + last-active dataset (client only)
  useEffect(() => {
    const list = loadDatasetList();
    setDatasets(list);
    try {
      const activeId = localStorage.getItem(ACTIVE_KEY);
      const found = activeId && list.find((d) => d.id === activeId);
      if (found) setActiveDataset(found);
    } catch {}
  }, []);

  // (re)load artifacts whenever the active dataset changes
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadArtifacts(activeDataset.base)
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
  }, [activeDataset]);

  const selectInverter = useCallback(
    (id: string) => {
      setSelectedInverter(id);
      openWindow("inspector", { inverterId: id });
      focusWindow("inspector");
    },
    [openWindow, focusWindow]
  );

  const registerDataset = useCallback((d: DatasetRef) => {
    setDatasets((prev) => {
      const next = [DEMO, ...prev.filter((x) => x.id !== "demo" && x.id !== d.id), d];
      try {
        localStorage.setItem(DATASETS_KEY, JSON.stringify(next.filter((x) => x.id !== "demo")));
      } catch {}
      return next;
    });
    setActiveDataset(d);
    try {
      localStorage.setItem(ACTIVE_KEY, d.id);
    } catch {}
  }, []);

  const switchDataset = useCallback(
    (id: string) => {
      setActiveDataset((cur) => {
        const next = datasets.find((d) => d.id === id) ?? cur;
        try {
          localStorage.setItem(ACTIVE_KEY, next.id);
        } catch {}
        return next;
      });
    },
    [datasets]
  );

  const capabilityOf = useCallback(
    (name: string): AnalysisCap => data?.capabilities?.analyses?.[name] ?? OK,
    [data]
  );

  const value = useMemo(
    () => ({
      data, loading, error, selectedInverter, selectInverter, setSelectedInverter,
      activeDataset, datasets, switchDataset, registerDataset, capabilityOf,
    }),
    [data, loading, error, selectedInverter, selectInverter, activeDataset, datasets,
     switchDataset, registerDataset, capabilityOf]
  );

  return <PyraDataContext value={value}>{children}</PyraDataContext>;
}
