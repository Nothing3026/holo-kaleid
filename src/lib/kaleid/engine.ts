import { hueFor } from "./types";
import { useKaleidStore } from "./store";

type Vec = { x: number; y: number };

const BG = "#0b1018";
const MAX_TRAIL_PX = 2048;

export class KaleidEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trail: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  private dpr = 1;
  private tdpr = 1;
  private w = 0;
  private h = 0;
  private cx = 0;
  private cy = 0;
  private field = 0;
  private fx = 0;
  private fy = 0;
  private raf = 0;
  private lastT = 0;
  private idleT = 0;
  private lastInput = 0;
  private usingPointer = false;
  private pointer: Vec = { x: 0, y: 0 };
  private lastDraw: Vec | null = null;
  private auto: Vec = { x: 0, y: 0 };
  private travel = 0;
  private spin = 0;
  private destroyed = false;
  private reduced = false;
  private seeded = false;
  private burstSeen = 0;
  private clearSeen = 0;
  private exportSeen = 0;
  private unsub: (() => void) | null = null;
  private ro: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;

    this.trail = document.createElement("canvas");
    const tctx = this.trail.getContext("2d", { alpha: true });
    if (!tctx) throw new Error("Offscreen canvas is not available");
    this.tctx = tctx;

    this.reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.bindPointer();
    this.unsub = useKaleidStore.subscribe((s) => {
      if (s.burstId !== this.burstSeen) {
        this.burstSeen = s.burstId;
        this.burst();
      }
      if (s.clearId !== this.clearSeen) {
        this.clearSeen = s.clearId;
        this.clearTrail();
      }
      if (s.exportId !== this.exportSeen) {
        this.exportSeen = s.exportId;
        this.exportPng();
      }
    });
  }

  start() {
    const boot = () => {
      if (this.destroyed) return;
      this.resize();
      if (this.w < 64 || this.h < 64) {
        this.raf = requestAnimationFrame(boot);
        return;
      }
      if (!this.seeded) {
        this.seedPattern();
        this.seeded = true;
        this.ro = new ResizeObserver(() => this.resize());
        const target = this.canvas.parentElement ?? this.canvas;
        this.ro.observe(target);
      }
      this.lastT = performance.now();
      this.lastInput = 0;
      this.raf = requestAnimationFrame(this.tick);
    };
    boot();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.unsub?.();
    this.unbindPointer();
  }

  exportPng() {
    const name = `holo-kaleid-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19)}.png`;
    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  private resize() {
    const parent = this.canvas.parentElement ?? this.canvas;
    const rect = parent.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = cssW;
    this.h = cssH;
    this.cx = cssW / 2;
    this.cy = cssH / 2;

    const prevTdpr = this.tdpr || 1;
    const prevCss = this.trail.width > 0 ? this.trail.width / prevTdpr : 0;

    const field = Math.ceil(Math.hypot(cssW, cssH) + 16);
    this.field = field;
    this.fx = field / 2;
    this.fy = field / 2;
    this.tdpr = Math.min(this.dpr, MAX_TRAIL_PX / field);

    const bw = Math.floor(cssW * this.dpr);
    const bh = Math.floor(cssH * this.dpr);
    const tw = Math.max(1, Math.floor(field * this.tdpr));

    const prev = document.createElement("canvas");
    prev.width = this.trail.width;
    prev.height = this.trail.height;
    const pctx = prev.getContext("2d");
    if (pctx && this.trail.width > 0) {
      pctx.drawImage(this.trail, 0, 0);
    }

    this.canvas.width = bw;
    this.canvas.height = bh;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.trail.width = tw;
    this.trail.height = tw;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.tctx.setTransform(this.tdpr, 0, 0, this.tdpr, 0, 0);

    if (pctx && prev.width > 0 && prevCss > 0) {
      this.tctx.drawImage(
        prev,
        this.fx - prevCss / 2,
        this.fy - prevCss / 2,
        prevCss,
        prevCss,
      );
    }

    this.auto = { x: this.fx, y: this.fy - field * 0.12 };
    if (!this.lastDraw) this.lastDraw = { ...this.auto };
  }

  private seedPattern() {
    if (this.reduced) {
      this.burst();
      this.composite();
      return;
    }
    const dt = 1 / 60;
    this.idleT = Math.random() * 12;
    this.lastDraw = null;
    for (let i = 0; i < 160; i++) {
      this.idleT += dt;
      this.stepAuto(dt);
      this.strokeTo(this.auto.x, this.auto.y, dt, false);
      this.fadeTrail(dt);
    }
    this.burst();
    this.composite();
  }

  private tick = (now: number) => {
    if (this.destroyed) return;
    const raw = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = Math.min(raw, 0.1);
    const { frozen } = useKaleidStore.getState();

    if (!frozen) {
      this.idleT += dt;
      if (!this.reduced) {
        this.spin += dt * 0.2;
      }
      const idleFor = now - this.lastInput;
      if (this.usingPointer) {
        const p = this.toTrail(this.pointer.x, this.pointer.y);
        this.strokeTo(p.x, p.y, dt, true);
      } else if (!this.reduced && (this.lastInput === 0 || idleFor > 700)) {
        this.stepAuto(dt);
        this.strokeTo(this.auto.x, this.auto.y, dt, false);
      }
      this.fadeTrail(dt);
    }

    this.composite();
    this.raf = requestAnimationFrame(this.tick);
  };

  private toTrail(x: number, y: number): Vec {
    const ox = x + (this.field - this.w) / 2;
    const oy = y + (this.field - this.h) / 2;
    const dx = ox - this.fx;
    const dy = oy - this.fy;
    const c = Math.cos(-this.spin);
    const s = Math.sin(-this.spin);
    return {
      x: this.fx + dx * c - dy * s,
      y: this.fy + dx * s + dy * c,
    };
  }

  private stepAuto(_dt: number) {
    const t = this.idleT;
    const R = this.field * 0.42;
    const k = 3;
    const rose = 0.38 + 0.62 * (0.5 + 0.5 * Math.cos(k * t * 0.62));
    const wobble = 0.06 * Math.sin(t * 1.3);
    this.auto.x = this.fx + R * rose * Math.cos(t * 0.62) * (1 + wobble);
    this.auto.y = this.fy + R * rose * Math.sin(t * 0.62) * (1 + wobble * 0.4);
  }

  private strokeTo(x: number, y: number, dt: number, fromPointer: boolean) {
    const prev = this.lastDraw ?? { x, y };
    const dx = x - prev.x;
    const dy = y - prev.y;
    const dist = Math.hypot(dx, dy);
    const speed = dist / Math.max(dt, 0.0001);

    const steps = Math.max(1, Math.min(14, Math.ceil(dist / 7)));
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      this.paintDot(prev.x + dx * p, prev.y + dy * p, speed, fromPointer);
    }
    this.lastDraw = { x, y };
    this.travel += dist * 0.01;
  }

  private paintDot(x: number, y: number, speed: number, fromPointer: boolean) {
    const { mode, brush, segments } = useKaleidStore.getState();
    const lx = x - this.fx;
    const ly = y - this.fy;
    const radial = Math.hypot(lx, ly) / Math.max(this.field * 0.5, 1);
    const angle = Math.atan2(ly, lx);
    const { h, s, l } = hueFor(mode, radial, angle, this.idleT, this.travel);
    const speedNorm = Math.min(1, speed / 1400);
    const size =
      (fromPointer ? 8 : 7) *
      (0.65 + brush * 1.25) *
      (1.15 - speedNorm * 0.35);
    const n = Math.max(2, segments);
    const slice = (Math.PI * 2) / n;

    this.tctx.save();
    this.tctx.globalCompositeOperation = "lighter";
    this.tctx.translate(this.fx, this.fy);
    for (let i = 0; i < n; i++) {
      this.tctx.save();
      this.tctx.rotate(i * slice);
      this.stampBlob(lx, ly, size, h, s, l);
      this.stampBlob(lx, -ly, size, h, s, l);
      this.tctx.restore();
    }
    this.tctx.restore();
  }

  private stampBlob(
    x: number,
    y: number,
    size: number,
    h: number,
    s: number,
    l: number,
  ) {
    this.blob(x, y, size * 2.8, h, s, l, 0.18);
    this.blob(x + 0.9, y, size * 1.3, h + 28, s, l + 6, 0.22);
    this.blob(x - 0.7, y, size * 1.25, h - 24, s, l + 3, 0.2);
    this.blob(x, y, size * 0.45, h, Math.max(16, s - 22), 96, 0.62);
  }

  private blob(
    x: number,
    y: number,
    r: number,
    h: number,
    s: number,
    l: number,
    a: number,
  ) {
    const g = this.tctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, ${a})`);
    g.addColorStop(0.45, `hsla(${h}, ${s}%, ${l}%, ${a * 0.28})`);
    g.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
    this.tctx.fillStyle = g;
    this.tctx.beginPath();
    this.tctx.arc(x, y, r, 0, Math.PI * 2);
    this.tctx.fill();
  }

  private fadeTrail(dt: number) {
    const { persistence } = useKaleidStore.getState();
    const rate = (0.16 - persistence * 0.13) * dt * 60;
    const alpha = Math.max(0.006, Math.min(0.14, rate * 0.014));
    this.tctx.save();
    this.tctx.globalCompositeOperation = "destination-out";
    this.tctx.fillStyle = `rgba(0,0,0,${alpha})`;
    this.tctx.fillRect(0, 0, this.field, this.field);
    this.tctx.restore();
  }

  private breath(): number {
    if (this.reduced) return 0.55;
    const raw = 0.5 + 0.5 * Math.sin(this.idleT * 1.08);
    return raw * raw * (3 - 2 * raw);
  }

  private composite() {
    const ctx = this.ctx;
    const ease = this.breath();
    const half = this.field / 2;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.spin);
    ctx.drawImage(this.trail, -half, -half, this.field, this.field);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.22 + 0.5 * ease;
    ctx.drawImage(this.trail, -half, -half, this.field, this.field);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const r = Math.hypot(this.cx, this.cy);
    const core = ctx.createRadialGradient(
      this.cx,
      this.cy,
      r * 0.02,
      this.cx,
      this.cy,
      r * (0.55 + ease * 0.12),
    );
    core.addColorStop(0, `rgba(236, 244, 248, ${0.05 + ease * 0.16})`);
    core.addColorStop(0.32, `rgba(126, 200, 212, ${0.035 + ease * 0.08})`);
    core.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();

    this.drawVignette(ctx);
  }

  private drawVignette(ctx: CanvasRenderingContext2D) {
    const reach = Math.hypot(this.cx, this.cy);
    const g = ctx.createRadialGradient(
      this.cx,
      this.cy,
      reach * 0.28,
      this.cx,
      this.cy,
      reach,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.82, "rgba(0,0,0,0.04)");
    g.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  private burst() {
    const count = 36;
    const R = this.field * 0.46;
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const ang = t * Math.PI * 6;
      const rad = R * (0.22 + 0.78 * t);
      this.paintDot(
        this.fx + Math.cos(ang) * rad,
        this.fy + Math.sin(ang) * rad,
        180,
        false,
      );
    }
    this.travel += 3;
  }

  private clearTrail() {
    this.tctx.setTransform(this.tdpr, 0, 0, this.tdpr, 0, 0);
    this.tctx.clearRect(0, 0, this.field, this.field);
    this.lastDraw = null;
    this.travel = 0;
  }

  private onPointer = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
    this.lastInput = performance.now();
    if (e.type === "pointerdown") {
      this.usingPointer = true;
      this.lastDraw = this.toTrail(this.pointer.x, this.pointer.y);
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (e.type === "pointermove" && e.buttons === 0 && e.pointerType === "mouse") {
      this.usingPointer = true;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") this.usingPointer = false;
    this.lastInput = performance.now();
  };

  private onPointerLeave = () => {
    this.usingPointer = false;
    this.lastDraw = null;
    this.lastInput = performance.now();
  };

  private bindPointer() {
    this.canvas.addEventListener("pointerdown", this.onPointer);
    this.canvas.addEventListener("pointermove", this.onPointer);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  private unbindPointer() {
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    this.canvas.removeEventListener("pointermove", this.onPointer);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
  }
}
