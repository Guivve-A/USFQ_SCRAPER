"use client";

import { Compass } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const MIN_DISPLAY_MS = 500;
const MAX_DISPLAY_MS = 9000;
const FADE_MS = 600;

type Phase = "loading" | "fading" | "done";

export function AssetPreloader() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const mountedAt = useRef<number>(0);
  const finalizedRef = useRef(false);

  useEffect(() => {
    mountedAt.current = performance.now();
    const manager = THREE.DefaultLoadingManager;

    const finalize = () => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const elapsed = performance.now() - mountedAt.current;
      const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
      window.setTimeout(() => {
        setProgress(100);
        setPhase("fading");
        window.setTimeout(() => setPhase("done"), FADE_MS);
      }, wait);
    };

    const prevOnProgress = manager.onProgress;
    const prevOnLoad = manager.onLoad;
    const prevOnError = manager.onError;

    manager.onProgress = (url, loaded, total) => {
      prevOnProgress?.(url, loaded, total);
      if (total > 0) {
        const pct = Math.min(95, Math.round((loaded / total) * 95));
        setProgress((p) => (pct > p ? pct : p));
      }
    };

    manager.onLoad = () => {
      prevOnLoad?.();
      finalize();
    };

    manager.onError = (url) => {
      prevOnError?.(url);
      console.warn("[AssetPreloader] failed to load", url);
    };

    const safety = window.setTimeout(finalize, MAX_DISPLAY_MS);

    return () => {
      manager.onProgress = prevOnProgress;
      manager.onLoad = prevOnLoad;
      manager.onError = prevOnError;
      window.clearTimeout(safety);
    };
  }, []);

  if (phase === "done") return null;

  const isFading = phase === "fading";

  return (
    <div
      aria-hidden={isFading}
      role="status"
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-[opacity,backdrop-filter] duration-[600ms] ease-out ${
        isFading ? "pointer-events-none opacity-0 backdrop-blur-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(30,27,75,0.55),rgba(2,6,23,0.95)_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(59,130,246,0.14),transparent_55%),radial-gradient(circle_at_78%_82%,rgba(139,92,246,0.14),transparent_55%)] backdrop-blur-2xl backdrop-saturate-150"
      />

      <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-7 px-6 text-center">
        <div className="relative flex size-20 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-white/10"
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-t border-cyan-200/70 motion-safe:animate-[spin_1.4s_linear_infinite]"
          />
          <span
            aria-hidden
            className="absolute inset-1.5 rounded-full border-b border-violet-300/50 motion-safe:animate-[spin_2.4s_linear_infinite_reverse]"
          />
          <span className="relative flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Compass className="size-4" />
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="font-heading text-[18px] font-[460] tracking-[-0.02em] text-slate-100/95">
            HackFinder
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-300/55">
            Calibrando órbita
          </span>
        </div>

        <div className="w-full">
          <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-300/80 via-sky-300/80 to-violet-300/80 shadow-[0_0_10px_rgba(34,211,238,0.45)] transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-medium tracking-[0.18em] text-slate-300/45">
            <span>LOADING</span>
            <span className="tabular-nums text-slate-200/70">
              {progress.toString().padStart(2, "0")}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
