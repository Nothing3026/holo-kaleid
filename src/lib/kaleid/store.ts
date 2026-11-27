import { create } from "zustand";
import {
  COLOR_MODES,
  SEGMENT_DEFAULT,
  clampSegments,
  type ColorMode,
} from "./types";

const STORAGE_KEY = "holo-kaleid.settings.v1";

export const MEDITATE_MINS: readonly number[] = [0, 10, 20, 30, 60];

type KaleidState = {
  segments: number;
  mode: ColorMode;
  persistence: number;
  brush: number;
  volume: number;
  frozen: boolean;
  meditate: boolean;
  meditateMins: number;
  hudOpen: boolean;
  burstId: number;
  clearId: number;
  exportId: number;
  setSegments: (n: number) => void;
  setMode: (mode: ColorMode) => void;
  setPersistence: (n: number) => void;
  setBrush: (n: number) => void;
  setVolume: (n: number) => void;
  setHudOpen: (open: boolean) => void;
  toggleHud: () => void;
  toggleFrozen: () => void;
  setFrozen: (frozen: boolean) => void;
  setMeditate: (meditate: boolean) => void;
  toggleMeditate: () => void;
  setMeditateMins: (n: number) => void;
  randomize: () => void;
  requestClear: () => void;
  requestBurst: () => void;
  requestExport: () => void;
};

function load(): Partial<KaleidState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<KaleidState>;
    return {
      segments: clampSegments(Number(parsed.segments) || SEGMENT_DEFAULT),
      mode: COLOR_MODES.some((m) => m.id === parsed.mode)
        ? (parsed.mode as ColorMode)
        : "prism",
      persistence: clamp01(Number(parsed.persistence) ?? 0.72),
      brush: clamp01(Number(parsed.brush) ?? 0.55),
      volume:
        parsed.volume == null || Number.isNaN(Number(parsed.volume))
          ? 0.34
          : clamp01(Number(parsed.volume)),
      meditateMins: MEDITATE_MINS.includes(Number(parsed.meditateMins))
        ? Number(parsed.meditateMins)
        : 0,
      hudOpen: parsed.hudOpen !== false,
    };
  } catch {
    return {};
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function persist(state: KaleidState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        segments: state.segments,
        mode: state.mode,
        persistence: state.persistence,
        brush: state.brush,
        volume: state.volume,
        meditateMins: state.meditateMins,
        hudOpen: state.hudOpen,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export const useKaleidStore = create<KaleidState>((set, get) => ({
  segments: SEGMENT_DEFAULT,
  mode: "prism",
  persistence: 0.8,
  brush: 0.55,
  volume: 0.34,
  frozen: false,
  meditate: false,
  meditateMins: 0,
  hudOpen: true,
  burstId: 0,
  clearId: 0,
  exportId: 0,
  setSegments: (n) => {
    set({ segments: clampSegments(n) });
    persist(get());
  },
  setMode: (mode) => {
    set({ mode });
    persist(get());
  },
  setPersistence: (n) => {
    set({ persistence: clamp01(n) });
    persist(get());
  },
  setBrush: (n) => {
    set({ brush: clamp01(n) });
    persist(get());
  },
  setVolume: (n) => {
    set({ volume: clamp01(n) });
    persist(get());
  },
  setHudOpen: (hudOpen) => {
    set({ hudOpen });
    persist(get());
  },
  toggleHud: () => {
    set({ hudOpen: !get().hudOpen });
    persist(get());
  },
  toggleFrozen: () => set({ frozen: !get().frozen }),
  setFrozen: (frozen) => set({ frozen }),
  setMeditate: (meditate) => set({ meditate }),
  toggleMeditate: () => set({ meditate: !get().meditate }),
  setMeditateMins: (n) => {
    set({
      meditateMins: MEDITATE_MINS.includes(n) ? n : 0,
    });
    persist(get());
  },
  randomize: () => {
    const evenSegs = [6, 8, 10, 12, 14, 16];
    const mode = COLOR_MODES[Math.floor(Math.random() * COLOR_MODES.length)];
    set({
      segments: evenSegs[Math.floor(Math.random() * evenSegs.length)] ?? 8,
      mode: mode?.id ?? "prism",
      persistence: 0.45 + Math.random() * 0.45,
      brush: 0.28 + Math.random() * 0.6,
      frozen: false,
      burstId: get().burstId + 1,
    });
    persist(get());
  },
  requestClear: () => set({ clearId: get().clearId + 1, frozen: false }),
  requestBurst: () => set({ burstId: get().burstId + 1 }),
  requestExport: () => set({ exportId: get().exportId + 1 }),
}));

export function hydrateKaleidStore() {
  const saved = load();
  if (Object.keys(saved).length === 0) return;
  useKaleidStore.setState(saved);
}
