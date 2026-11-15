"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
}

const COLORS = [
  { threshold: 0.66, rgb: "255, 255, 255", alpha: 0.55 },
  { threshold: 0.83, rgb: "168, 143, 255", alpha: 0.65 },
  { threshold: 0.95, rgb: "86, 97, 255", alpha: 0.72 },
  { threshold: 1.0, rgb: "255, 0, 109", alpha: 0.72 },
];

function pickParticleColor(): string {
  const roll = Math.random();
  const match = COLORS.find((c) => roll <= c.threshold) ?? COLORS[0];
  const a = (match.alpha * (0.55 + Math.random() * 0.45)).toFixed(2);
  return `rgba(${match.rgb}, ${a})`;
}

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles: Particle[] = [];
    let rafId = 0;

    const mouse = { x: -9999, y: -9999 };

    function initParticles() {
      const count = Math.round(
        Math.min(115, Math.max(48, (width * height) / 14500))
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        r: 0.9 + Math.random() * 1.4,
        color: pickParticleColor(),
      }));
    }

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }

    function drawFrame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          const dxMouse = p.x - mouse.x;
          const dyMouse = p.y - mouse.y;
          const mouseDistSq = dxMouse * dxMouse + dyMouse * dyMouse;

          if (mouseDistSq > 1 && mouseDistSq < 15000) {
            const dist = Math.sqrt(mouseDistSq);
            const force = ((122 - dist) / 122) * 0.35;
            p.x += (dxMouse / dist) * force;
            p.y += (dyMouse / dist) * force;
          }

          p.x += p.vx;
          p.y += p.vy;

          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          if (p.y > height + 10) p.y = -10;
        }

        // Proximity constellation lines (< 110px -> distSq < 12100)
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 12100) {
            const opacity = 0.12 * (1 - distSq / 12100);
            ctx.strokeStyle = `rgba(134, 120, 255, ${opacity.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(drawFrame);
      }
    }

    function handleMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function handleMouseLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    resize();
    drawFrame();

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Layer 1: Static dual radial glow from dsquaredmedia.net */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% 50%, rgba(86, 97, 255, 0.14) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 75% 30%, rgba(255, 0, 109, 0.08) 0%, transparent 55%)",
        }}
      />

      {/* Layer 2: Floating atmospheric blurred orbs */}
      <div className="hero-orb hero-orb--1" />
      <div className="hero-orb hero-orb--2" />
      <div className="hero-orb hero-orb--3" />

      {/* Layer 3: Constellation Particle Network */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
