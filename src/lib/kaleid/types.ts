export type ColorMode =
  | "prism"
  | "aurora"
  | "neon"
  | "ember"
  | "glacier"
  | "spectrum";

export type KaleidSettings = {
  segments: number;
  mode: ColorMode;
  persistence: number;
  brush: number;
  frozen: boolean;
};

export const COLOR_MODES: readonly {
  id: ColorMode;
  label: string;
  hint: string;
}[] = [
  { id: "prism", label: "プリズム", hint: "虹色の分光" },
  { id: "aurora", label: "オーロラ", hint: "極光" },
  { id: "neon", label: "ネオン", hint: "高彩度" },
  { id: "ember", label: "残火", hint: "琥珀" },
  { id: "glacier", label: "氷河", hint: "氷晶" },
  { id: "spectrum", label: "分光", hint: "距離で色相" },
] as const;

export const SEGMENT_MIN = 4;
export const SEGMENT_MAX = 20;
export const SEGMENT_DEFAULT = 8;

export function clampSegments(n: number): number {
  return Math.max(SEGMENT_MIN, Math.min(SEGMENT_MAX, Math.round(n)));
}

export function hueFor(
  mode: ColorMode,
  dist: number,
  angle: number,
  time: number,
  travel: number,
): { h: number; s: number; l: number } {
  const wrap = (h: number) => ((h % 360) + 360) % 360;
  switch (mode) {
    case "prism":
      return {
        h: wrap(angle * (180 / Math.PI) + time * 22 + travel * 40 + dist * 70),
        s: 88,
        l: 62,
      };
    case "aurora":
      return {
        h: wrap(
          160 +
            Math.sin(time * 0.35 + dist * 5) * 55 +
            Math.cos(angle * 2.2) * 50,
        ),
        s: 78,
        l: 60,
      };
    case "neon": {
      const stops = [186, 198, 48, 92, 312];
      const idx = Math.floor((travel * 0.35 + time * 0.15) % stops.length);
      return { h: stops[idx] ?? 186, s: 96, l: 58 };
    }
    case "ember":
      return {
        h: wrap(18 + dist * 28 + Math.sin(time * 0.6 + travel) * 10),
        s: 92,
        l: 56,
      };
    case "glacier":
      return {
        h: wrap(196 + Math.sin(angle * 3) * 18 + dist * 12),
        s: 62,
        l: 72,
      };
    case "spectrum":
      return {
        h: wrap(dist * 320 + time * 16 + travel * 24),
        s: 86,
        l: 60,
      };
  }
}
