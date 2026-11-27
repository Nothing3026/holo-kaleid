import { useEffect, useRef } from "react";
import { KaleidEngine } from "@/lib/kaleid/engine";
import { hydrateKaleidStore } from "@/lib/kaleid/store";

export function KaleidCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    hydrateKaleidStore();
    const canvas = ref.current;
    if (!canvas) return;
    const engine = new KaleidEngine(canvas);
    engine.start();
    return () => engine.destroy();
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      aria-label="ホログラム万華鏡"
    />
  );
}
