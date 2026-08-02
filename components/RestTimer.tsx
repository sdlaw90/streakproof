"use client";

import { useEffect, useRef, useState } from "react";

const PRESETS = [60, 90, 120, 180];

export default function RestTimer() {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

  function start(seconds: number) {
    if (tick.current) clearInterval(tick.current);
    setRemaining(seconds);
    setOpen(false);
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          if (tick.current) clearInterval(tick.current);
          buzz();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function stop() {
    if (tick.current) clearInterval(tick.current);
    setRemaining(null);
  }

  function buzz() {
    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch {}
    try {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } catch {}
  }

  const label =
    remaining === null
      ? "Rest timer"
      : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="fixed bottom-16 right-3 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="flex gap-2 rounded-2xl border border-line bg-panel p-2 shadow-xl">
          {PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="rounded-lg bg-panel2 px-3 py-2 text-sm font-semibold text-ink"
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => (remaining !== null ? stop() : setOpen((o) => !o))}
        className={
          "rounded-full border px-4 py-2.5 text-sm font-bold shadow-lg transition " +
          (remaining !== null && remaining > 0
            ? "border-accent2 bg-accent2/15 text-accent2 tabular-nums"
            : remaining === 0
            ? "border-accent bg-accent/15 text-accent"
            : "border-line bg-panel text-muted")
        }
      >
        {remaining === 0 ? "✓ done — tap to reset" : `⏱ ${label}`}
      </button>
    </div>
  );
}
