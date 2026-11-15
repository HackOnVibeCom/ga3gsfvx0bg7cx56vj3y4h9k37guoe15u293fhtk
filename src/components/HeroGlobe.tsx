"use client";

import { useEffect, useRef } from "react";

interface SpherePoint {
  x: number;
  y: number;
  z: number;
  isLand: boolean;
}

interface FlightArc {
  start: [number, number, number];
  ctrl: [number, number, number];
  end: [number, number, number];
  color: string;
  phase: number;
}

// Simplified elliptical continent boxes [latRad, lonRad, radLat, radLon]
const LANDMASSES: [number, number, number, number][] = [
  [0.75, -1.75, 0.42, 0.58], // North America
  [0.32, -1.5, 0.18, 0.25],  // Central America
  [-0.25, -1.05, 0.45, 0.3], // South America
  [0.88, 0.25, 0.22, 0.42],  // Europe
  [0.12, 0.36, 0.48, 0.36],  // Africa
  [0.82, 1.55, 0.4, 0.88],   // Asia
  [0.35, 1.85, 0.25, 0.45],  // SE Asia / India
  [-0.45, 2.35, 0.24, 0.32], // Australia
];

const ARC_CITIES: [number, number][] = [
  [0.71, -1.29], // New York
  [0.65, -2.13], // San Francisco
  [0.9, -0.01],  // London
  [0.91, 0.23],  // Berlin
  [0.62, 2.44],  // Tokyo
  [0.02, 1.81],  // Singapore
  [-0.11, 1.86], // Jakarta
  [-0.59, 2.64], // Sydney
  [-0.41, -0.81],// Sao Paulo
  [0.44, 0.96],  // Dubai
  [0.49, 1.34],  // Bengaluru
];

const COMET_COLORS = [
  "86, 97, 255",  // Electric Blue #5661FF
  "177, 75, 255", // Purple #B14BFF
  "255, 0, 109",  // Magenta #FF006D
];

function isPointLand(lat: number, lon: number): boolean {
  for (const [cLat, cLon, rLat, rLon] of LANDMASSES) {
    const dLat = (lat - cLat) / rLat;
    const dLon = (lon - cLon) / rLon;
    if (dLat * dLat + dLon * dLon <= 1) return true;
  }
  return false;
}

function latLonToVec(lat: number, lon: number): [number, number, number] {
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  ];
}

export function HeroGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // 58 lat x 116 lon grid points matching dsquaredmedia.net dot-matrix globe
    const points: SpherePoint[] = [];
    const latSteps = 58;
    const lonSteps = 116;
    for (let i = 1; i < latSteps; i++) {
      const lat = -Math.PI / 2 + (i / latSteps) * Math.PI;
      const lonCount = Math.max(12, Math.round(lonSteps * Math.cos(lat)));
      for (let j = 0; j < lonCount; j++) {
        const lon = -Math.PI + (j / lonCount) * Math.PI * 2;
        const [x, y, z] = latLonToVec(lat, lon);
        points.push({ x, y, z, isLand: isPointLand(lat, lon) });
      }
    }

    // 11 elevated flight arcs connecting global freelance hubs
    const arcs: FlightArc[] = ARC_CITIES.map((city, idx) => {
      const next = ARC_CITIES[(idx + 3) % ARC_CITIES.length];
      const start = latLonToVec(city[0], city[1]);
      const end = latLonToVec(next[0], next[1]);
      const mx = (start[0] + end[0]) / 2;
      const my = (start[1] + end[1]) / 2;
      const mz = (start[2] + end[2]) / 2;
      const len = Math.hypot(mx, my, mz) || 1;
      const peak = 1.38;
      const ctrl: [number, number, number] = [
        (mx / len) * peak,
        (my / len) * peak,
        (mz / len) * peak,
      ];
      return {
        start,
        ctrl,
        end,
        color: COMET_COLORS[idx % COMET_COLORS.length],
        phase: idx / ARC_CITIES.length,
      };
    });

    let size = 540;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rotation = 0.6;
    let rafId = 0;

    function resize() {
      if (!canvas || !ctx) return;
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 540;
      size = Math.min(960, Math.max(320, w));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(
      x: number,
      y: number,
      z: number,
      rotY: number,
      cx: number,
      cy: number,
      radius: number
    ) {
      const tiltX = 0.24;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const rx = x * cosY - z * sinY;
      const rz = x * sinY + z * cosY;

      const cosT = Math.cos(tiltX);
      const sinT = Math.sin(tiltX);
      const ry = y * cosT - rz * sinT;
      const rz2 = y * sinT + rz * cosT;

      return {
        sx: cx + rx * radius,
        sy: cy - ry * radius,
        z: rz2,
      };
    }

    function render(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.38;

      if (!prefersReducedMotion) {
        rotation += 0.0015;
      }

      // 3 orbital rings
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
      ctx.lineWidth = 1;
      for (const tilt of [-0.35, 0.15, 0.58]) {
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          radius * 1.18,
          radius * 0.34,
          tilt,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();

      // Sphere dots
      for (const pt of points) {
        const p = project(pt.x, pt.y, pt.z, rotation, cx, cy, radius);
        if (p.z < -0.15) continue;
        const depth = Math.max(0, Math.min(1, (p.z + 0.15) / 1.15));

        if (pt.isLand) {
          const alpha = 0.07 + 0.25 * depth;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 0.8 + 0.9 * depth, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const alpha = 0.015 + 0.032 * depth;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 0.5 + 0.35 * depth, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Comet arcs & glowing heads (4200ms period)
      const period = 4200;
      const baseT = (now % period) / period;

      for (const arc of arcs) {
        const steps = 22;
        ctx.beginPath();
        let hasStart = false;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const inv = 1 - t;
          const ax =
            inv * inv * arc.start[0] +
            2 * inv * t * arc.ctrl[0] +
            t * t * arc.end[0];
          const ay =
            inv * inv * arc.start[1] +
            2 * inv * t * arc.ctrl[1] +
            t * t * arc.end[1];
          const az =
            inv * inv * arc.start[2] +
            2 * inv * t * arc.ctrl[2] +
            t * t * arc.end[2];
          const p = project(ax, ay, az, rotation, cx, cy, radius);
          if (!hasStart) {
            ctx.moveTo(p.sx, p.sy);
            hasStart = true;
          } else {
            ctx.lineTo(p.sx, p.sy);
          }
        }
        ctx.strokeStyle = `rgba(${arc.color}, 0.14)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Comet head + 5-step trail
        const headT = (baseT + arc.phase) % 1;
        for (let trail = 4; trail >= 0; trail--) {
          const tt = Math.max(0, headT - trail * 0.025);
          const inv = 1 - tt;
          const hx =
            inv * inv * arc.start[0] +
            2 * inv * tt * arc.ctrl[0] +
            tt * tt * arc.end[0];
          const hy =
            inv * inv * arc.start[1] +
            2 * inv * tt * arc.ctrl[1] +
            tt * tt * arc.end[1];
          const hz =
            inv * inv * arc.start[2] +
            2 * inv * tt * arc.ctrl[2] +
            tt * tt * arc.end[2];
          const hp = project(hx, hy, hz, rotation, cx, cy, radius);
          if (hp.z < -0.1) continue;

          if (trail === 0) {
            const grad = ctx.createRadialGradient(
              hp.sx,
              hp.sy,
              0,
              hp.sx,
              hp.sy,
              13
            );
            grad.addColorStop(0, `rgba(${arc.color}, 0.95)`);
            grad.addColorStop(0.4, `rgba(${arc.color}, 0.35)`);
            grad.addColorStop(1, `rgba(${arc.color}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(hp.sx, hp.sy, 13, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(hp.sx, hp.sy, 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const alpha = (5 - trail) * 0.14;
            ctx.fillStyle = `rgba(${arc.color}, ${alpha.toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(hp.sx, hp.sy, 1.4 - trail * 0.18, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(render);
      }
    }

    resize();
    rafId = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] sm:w-[540px] sm:h-[540px] md:w-[700px] md:h-[700px] lg:w-[860px] lg:h-[860px] flex items-center justify-center opacity-85 select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
