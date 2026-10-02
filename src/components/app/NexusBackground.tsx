"use client";

import { useEffect, useRef } from "react";

type Node = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
};

export function NexusBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let nodes: Node[] = [];
    let last = performance.now();

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(34, Math.min(66, Math.round((width * height) / 26000)));
      nodes = Array.from({ length: count }, (_, index) => ({
        x: ((index * 83) % 997) / 997 * width,
        y: ((index * 151 + 71) % 991) / 991 * height,
        vx: (((index * 37) % 17) - 8) * 0.004,
        vy: (((index * 53) % 19) - 9) * 0.004,
        phase: index * 0.73,
        size: index % 9 === 0 ? 1.9 : index % 4 === 0 ? 1.35 : 0.9,
      }));
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    function frame(now: number) {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const maxLink = Math.min(150, Math.max(90, width * 0.11));

      for (const node of nodes) {
        if (!reduced) {
          node.x += node.vx * dt;
          node.y += node.vy * dt;
          node.phase += 0.018 * dt;

          node.vx += (cx - node.x) * 0.00000022 * dt;
          node.vy += (cy - node.y) * 0.00000022 * dt;

          if (node.x < -20) node.x = width + 20;
          if (node.x > width + 20) node.x = -20;
          if (node.y < -20) node.y = height + 20;
          if (node.y > height + 20) node.y = -20;
        }
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          if (dist > maxLink) continue;

          const alpha = Math.pow(1 - dist / maxLink, 2) * 0.2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(156,255,0,${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          if ((i + j) % 13 === 0) {
            const t = reduced ? 0.5 : (Math.sin(now * 0.00055 + i * 0.7 + j) + 1) / 2;
            const px = a.x + dx * t;
            const py = a.y + dy * t;
            ctx.beginPath();
            ctx.arc(px, py, 1.15, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(191,255,210,0.72)";
            ctx.shadowColor = "#9cff00";
            ctx.shadowBlur = 7;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      for (const node of nodes) {
        const pulse = reduced ? 1 : 0.76 + Math.sin(node.phase) * 0.22;
        const radius = node.size * pulse;
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 6);
        glow.addColorStop(0, "rgba(191,255,210,0.48)");
        glow.addColorStop(0.28, "rgba(156,255,0,0.22)");
        glow.addColorStop(1, "rgba(156,255,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(220,255,230,0.78)";
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    }

    frame(performance.now());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
