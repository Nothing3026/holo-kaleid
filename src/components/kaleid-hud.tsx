import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AuthSlot } from "@/components/auth-slot";
import { getAmbient } from "@/lib/kaleid/ambient";
import {
  COLOR_MODES,
  SEGMENT_MAX,
  SEGMENT_MIN,
} from "@/lib/kaleid/types";
import { MEDITATE_MINS, useKaleidStore } from "@/lib/kaleid/store";
import { cn } from "@/lib/utils";

export function KaleidHud() {
  const segments = useKaleidStore((s) => s.segments);
  const mode = useKaleidStore((s) => s.mode);
  const persistence = useKaleidStore((s) => s.persistence);
  const brush = useKaleidStore((s) => s.brush);
  const volume = useKaleidStore((s) => s.volume);
  const frozen = useKaleidStore((s) => s.frozen);
  const meditate = useKaleidStore((s) => s.meditate);
  const setMeditate = useKaleidStore((s) => s.setMeditate);
  const meditateMins = useKaleidStore((s) => s.meditateMins);
  const setMeditateMins = useKaleidStore((s) => s.setMeditateMins);
  const hudOpen = useKaleidStore((s) => s.hudOpen);
  const setSegments = useKaleidStore((s) => s.setSegments);
  const setMode = useKaleidStore((s) => s.setMode);
  const setPersistence = useKaleidStore((s) => s.setPersistence);
  const setBrush = useKaleidStore((s) => s.setBrush);
  const setVolume = useKaleidStore((s) => s.setVolume);
  const toggleFrozen = useKaleidStore((s) => s.toggleFrozen);
  const toggleHud = useKaleidStore((s) => s.toggleHud);
  const setHudOpen = useKaleidStore((s) => s.setHudOpen);
  const randomize = useKaleidStore((s) => s.randomize);
  const requestClear = useKaleidStore((s) => s.requestClear);
  const requestExport = useKaleidStore((s) => s.requestExport);
  const [hint, setHint] = useState(true);
  const [playing, setPlaying] = useState(false);
  const lastAudible = useRef(volume > 0.01 ? volume : 0.34);

  const toggleAmbient = () => {
    const ambient = getAmbient();
    if (playing) {
      void ambient.stop();
      return;
    }
    if (volume < 0.01) setVolume(lastAudible.current);
    void ambient.start();
  };

  const enterMeditation = () => {
    setMeditate(true);
    setHudOpen(false);
    setHint(false);
    if (!playing) {
      if (volume < 0.01) setVolume(lastAudible.current);
      void getAmbient().start();
    }
  };

  const exitMeditation = () => {
    setMeditate(false);
    const ambient = getAmbient();
    // Undo any timer fade so the next session starts at full volume.
    ambient.setVolume(useKaleidStore.getState().volume);
    if (playing) void ambient.stop();
  };

  const [remain, setRemain] = useState<number | null>(null);

  useEffect(() => {
    if (!meditate || meditateMins <= 0) {
      setRemain(null);
      return;
    }
    const deadline = Date.now() + meditateMins * 60_000;
    const update = () =>
      setRemain(Math.max(0, (deadline - Date.now()) / 1000));
    update();
    const id = window.setInterval(update, 500);
    return () => window.clearInterval(id);
  }, [meditate, meditateMins]);

  useEffect(() => {
    if (remain === null) return;
    if (remain <= 60) {
      // Final minute: fade the music out with the remaining time.
      getAmbient().setVolume(volume * Math.max(0, remain / 60));
    }
    if (remain <= 0) exitMeditation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remain]);

  useEffect(() => {
    if (volume > 0.01) lastAudible.current = volume;
  }, [volume]);

  useEffect(() => {
    const ambient = getAmbient();
    ambient.setVolume(useKaleidStore.getState().volume);
    let last = useKaleidStore.getState().volume;
    const unsubStore = useKaleidStore.subscribe((s) => {
      if (s.volume !== last) {
        last = s.volume;
        ambient.setVolume(s.volume);
      }
    });
    const unsubPlay = ambient.subscribe(setPlaying);
    return () => {
      unsubStore();
      unsubPlay();
    };
  }, []);

  useEffect(() => {
    const hide = () => setHint(false);
    window.addEventListener("pointerdown", hide, { once: true });
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => {
      window.removeEventListener("pointerdown", hide);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        toggleFrozen();
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        toggleHud();
      } else if (e.key === "Escape") {
        if (meditate) exitMeditation();
        else setHudOpen(false);
      } else if (e.key === "m" || e.key === "M") {
        setVolume(volume < 0.01 ? lastAudible.current : 0);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        toggleAmbient();
      } else if (e.key === "r" || e.key === "R") {
        randomize();
      } else if (e.key === "e" || e.key === "E") {
        requestExport();
        toast.success("画像を書き出しました");
      } else if (e.key === "c" || e.key === "C") {
        requestClear();
      } else if (e.key === "[" || e.key === "-") {
        setSegments(segments - 1);
      } else if (e.key === "]" || e.key === "=") {
        setSegments(segments + 1);
      } else if (e.key >= "1" && e.key <= "6") {
        const next = COLOR_MODES[Number(e.key) - 1];
        if (next) setMode(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    toggleFrozen,
    toggleHud,
    setHudOpen,
    toggleAmbient,
    meditate,
    exitMeditation,
    volume,
    playing,
    setVolume,
    randomize,
    requestExport,
    requestClear,
    setSegments,
    setMode,
    segments,
  ]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      {!meditate && (
        <header className="pointer-events-auto flex items-start justify-between gap-3">
          <div className="rounded-xl bg-bg/80 px-3 py-2 shadow-panel">
            <p className="font-display text-sm font-semibold tracking-tight text-fg">
              Holo Kaleid
            </p>
            <p className="text-xs text-muted">ホログラム万華鏡</p>
          </div>
          <div className="rounded-xl bg-bg/80 px-2 py-1 shadow-panel">
            <AuthSlot />
          </div>
        </header>
      )}

      {meditate && remain !== null && remain <= 60 && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-black"
          style={{ opacity: Math.min(1, Math.max(0, 1 - remain / 60)) }}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "pointer-events-none mx-auto mb-3 max-w-sm text-center text-sm text-fg/80 transition-opacity duration-500",
          hint && hudOpen && !meditate ? "opacity-100" : "opacity-0",
        )}
      >
        ポインターを動かして描く
      </div>

      <div className="relative z-[2] mx-auto w-full max-w-2xl">
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            hudOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <section
              id="kaleid-controls"
              className="pointer-events-auto mb-2 rounded-xl bg-bg/85 p-3 shadow-panel sm:p-4"
              inert={!hudOpen || undefined}
              aria-hidden={!hudOpen}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:gap-4">
                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                    セグメント
                    <span className="tabular-nums text-fg">{segments}</span>
                  </span>
                  <input
                    type="range"
                    className="holo-range"
                    min={SEGMENT_MIN}
                    max={SEGMENT_MAX}
                    step={1}
                    value={segments}
                    onChange={(e) => setSegments(Number(e.target.value))}
                    aria-label="セグメント数"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                      残像
                      <span className="tabular-nums text-fg">
                        {Math.round(persistence * 100)}
                      </span>
                    </span>
                    <input
                      type="range"
                      className="holo-range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={persistence}
                      onChange={(e) => setPersistence(Number(e.target.value))}
                      aria-label="残像"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                      ブラシ
                      <span className="tabular-nums text-fg">
                        {Math.round(brush * 100)}
                      </span>
                    </span>
                    <input
                      type="range"
                      className="holo-range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={brush}
                      onChange={(e) => setBrush(Number(e.target.value))}
                      aria-label="ブラシ"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]"
                  aria-label={volume < 0.01 ? "ミュート解除" : "ミュート"}
                  onClick={() => {
                    setVolume(volume < 0.01 ? lastAudible.current : 0);
                  }}
                >
                  {volume < 0.01 ? (
                    <VolumeX className="size-3.5" strokeWidth={2} aria-hidden />
                  ) : (
                    <Volume2 className="size-3.5" strokeWidth={2} aria-hidden />
                  )}
                </button>
                <label className="min-w-0 flex-1">
                  <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                    音量
                    <span className="tabular-nums text-fg">
                      {Math.round(volume * 100)}
                    </span>
                  </span>
                  <input
                    type="range"
                    className="holo-range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    aria-label="音量"
                  />
                </label>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="shrink-0 text-xs font-medium text-muted">
                  瞑想タイマー
                </span>
                <div className="flex gap-1">
                  {MEDITATE_MINS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setMeditateMins(mins)}
                      aria-pressed={meditateMins === mins}
                      className={cn(
                        "h-9 shrink-0 rounded-md px-2.5 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                        meditateMins === mins
                          ? "bg-accent text-accent-fg"
                          : "bg-surface-2 text-muted hover:text-fg",
                      )}
                    >
                      {mins === 0 ? "なし" : `${mins}分`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
                {COLOR_MODES.map((m) => {
                  const active = m.id === mode;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={m.hint}
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "h-11 shrink-0 rounded-md px-3 text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                        active
                          ? "bg-accent text-accent-fg"
                          : "bg-surface-2 text-muted hover:text-fg",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <HudButton
                  onClick={toggleFrozen}
                  icon={frozen ? Play : Pause}
                  label={frozen ? "解除" : "フリーズ"}
                  pressed={frozen}
                />
                <HudButton onClick={randomize} icon={Shuffle} label="ランダム" />
                <HudButton
                  onClick={() => {
                    requestExport();
                    toast.success("画像を書き出しました");
                  }}
                  icon={Download}
                  label="書き出し"
                />
                <HudButton onClick={requestClear} icon={RotateCcw} label="クリア" />
              </div>
            </section>
          </div>
        </div>

        {meditate ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="pointer-events-auto flex h-11 items-center justify-center gap-1.5 rounded-xl bg-bg/60 px-4 text-xs font-medium text-fg opacity-60 shadow-panel transition-opacity duration-300 ease-out hover:opacity-100"
              aria-label="瞑想モードを終了"
              onClick={exitMeditation}
            >
              <Moon className="size-3.5" strokeWidth={2} aria-hidden />
              {remain !== null
                ? `瞑想中 ${Math.floor(remain / 60)}:${String(
                    Math.floor(remain % 60),
                  ).padStart(2, "0")}（タップで終了）`
                : "瞑想中（タップで終了）"}
            </button>
          </div>
        ) : (
          <div className="flex justify-center gap-1.5">
            <button
              type="button"
              className={cn(
                "pointer-events-auto flex h-11 min-w-24 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-medium shadow-panel transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                playing ? "bg-accent text-accent-fg" : "bg-bg/85 text-fg",
              )}
              aria-pressed={playing}
              aria-label={playing ? "音楽を停止" : "音楽を再生"}
              onClick={toggleAmbient}
            >
              {playing ? (
                <Pause className="size-3.5" strokeWidth={2} aria-hidden />
              ) : (
                <Play className="size-3.5" strokeWidth={2} aria-hidden />
              )}
              {playing ? "停止" : "再生"}
            </button>
            <button
              type="button"
              className="pointer-events-auto flex h-11 min-w-24 items-center justify-center gap-1.5 rounded-xl bg-bg/85 px-4 text-xs font-medium text-fg shadow-panel transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]"
              aria-label="瞑想モードを開始"
              onClick={enterMeditation}
            >
              <Moon className="size-3.5" strokeWidth={2} aria-hidden />
              瞑想
            </button>
            <button
              type="button"
              className="pointer-events-auto flex h-11 min-w-28 items-center justify-center gap-1.5 rounded-xl bg-bg/85 px-4 text-xs font-medium text-fg shadow-panel transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]"
              aria-expanded={hudOpen}
              aria-controls="kaleid-controls"
              onClick={toggleHud}
            >
              {hudOpen ? (
                <ChevronDown className="size-3.5" strokeWidth={2} aria-hidden />
              ) : (
                <SlidersHorizontal className="size-3.5" strokeWidth={2} aria-hidden />
              )}
              {hudOpen ? "隠す" : "操作"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function HudButton({
  onClick,
  icon: Icon,
  label,
  pressed,
}: {
  onClick: () => void;
  icon: typeof Pause;
  label: string;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
        pressed
          ? "bg-accent text-accent-fg"
          : "bg-surface-2 text-fg hover:bg-border-strong",
      )}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
      {label}
    </button>
  );
}
