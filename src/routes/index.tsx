import { createFileRoute } from "@tanstack/react-router";
import { KaleidCanvas } from "@/components/kaleid-canvas";
import { KaleidHud } from "@/components/kaleid-hud";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="relative h-dvh overflow-hidden bg-bg text-fg">
      <KaleidCanvas />
      <div className="holo-scan pointer-events-none absolute inset-0 z-[1] opacity-10" aria-hidden />
      <KaleidHud />
    </main>
  );
}
