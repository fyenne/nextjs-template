"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PondScene } from "@/lib/pond/scene";
import { PondRenderer } from "@/lib/pond/renderer";
import { supportsHtmlInCanvas, type HtmlInCanvasCanvas } from "@/lib/pond/html-in-canvas";

type Mode = "pending" | "native" | "fallback";

// Whether texElementSubImage2D output needs a vertical flip in the shader.
const CARD_FLIP = false;
const MAX_DPR = 1.5;

const now = () => performance.now() / 1000;

export default function WishingPond() {
  const [mode, setMode] = useState<Mode>("pending");
  const [wish, setWish] = useState("");
  const [status, setStatus] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const engine = useRef<{ renderer: PondRenderer; scene: PondScene } | null>(null);
  const lastMove = useRef({ x: -999, y: -999 });

  useEffect(() => {
    setMode(supportsHtmlInCanvas() ? "native" : "fallback");
  }, []);

  useEffect(() => {
    if (mode === "pending") return;
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current as HtmlInCanvasCanvas | null;
    const card = cardRef.current;
    if (!wrapper || !canvas || !card) return;

    let scene: PondScene;
    let renderer: PondRenderer;
    try {
      scene = new PondScene();
      renderer = new PondRenderer(canvas, scene, CARD_FLIP);
    } catch (error) {
      console.error("Pond renderer unavailable", error);
      return;
    }
    engine.current = { renderer, scene };

    let disposed = false;
    let raf = 0;
    let rainAt = 0;
    let cardUploaded = false;
    let geometryKey = "";

    const layout = () => {
      const cssW = wrapper.clientWidth;
      const cssH = wrapper.clientHeight;
      renderer.cssW = cssW;
      renderer.cssH = cssH;
      scene.resize(cssW, cssH, Math.min(window.devicePixelRatio || 1, MAX_DPR));
    };

    const syncCard = () => {
      const w = card.offsetWidth;
      const h = card.offsetHeight;
      const x = Math.round((renderer.cssW - w) / 2);
      const y = Math.round((renderer.cssH - h) / 2);
      renderer.setCardRect([x, y, w, h]);
      if (mode === "native") {
        const key = `${x},${y},${w},${h}`;
        if (key !== geometryKey) {
          geometryKey = key;
          if (typeof canvas.getElementImageDefaultSize === "function") {
            canvas.updateElementGeometry(card, { canvasTransform: new DOMMatrix([1, 0, 0, 1, x, y]) });
          } else {
            // Older Chromium builds hit-test from the element's CSS transform;
            // updateElementGeometry just registers it with the canvas.
            card.style.transform = `translate(${x}px, ${y}px)`;
            canvas.updateElementGeometry(card);
          }
        }
      }
    };

    const frame = () => {
      const t = now();
      if (t > rainAt) {
        rainAt = t + 2 + Math.random() * 3;
        renderer.addRipple(Math.random() * renderer.cssW, Math.random() * renderer.cssH, 0.3, t);
      }
      syncCard();
      renderer.render(t);
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      const box = entry.devicePixelContentBoxSize?.[0];
      const dpr = window.devicePixelRatio || 1;
      canvas.width = box ? box.inlineSize : Math.round(entry.contentRect.width * dpr);
      canvas.height = box ? box.blockSize : Math.round(entry.contentRect.height * dpr);
      layout();
    });

    if (mode === "native") {
      canvas.onpaint = (event) => {
        if (disposed) return;
        const changed = event.changedElements;
        if (!cardUploaded || !changed || Array.from(changed).includes(card)) {
          try {
            renderer.updateCardTexture(card);
            cardUploaded = true;
          } catch (error) {
            if (!cardUploaded) {
              console.warn("html-in-canvas texture upload failed, using fallback", error);
              canvas.onpaint = null;
              setMode("fallback");
              return;
            }
          }
        }
        frame();
        canvas.requestPaint();
      };
      resizeObserver.observe(canvas, { box: "device-pixel-content-box" });
      canvas.requestPaint();
    } else {
      const loop = () => {
        if (disposed) return;
        frame();
        raf = requestAnimationFrame(loop);
      };
      resizeObserver.observe(canvas);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      canvas.onpaint = null;
      engine.current = null;
    };
  }, [mode]);

  const pointerPos = (e: React.PointerEvent) => {
    const rect = wrapperRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onCard = (e: React.PointerEvent) => !!cardRef.current?.contains(e.target as Node);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!engine.current || onCard(e)) return;
    const { x, y } = pointerPos(e);
    const t = now();
    engine.current.renderer.addRipple(x, y, 1, t);
    engine.current.scene.feed(x, y, t);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!engine.current || onCard(e)) return;
    const { x, y } = pointerPos(e);
    if (Math.hypot(x - lastMove.current.x, y - lastMove.current.y) < 28) return;
    lastMove.current = { x, y };
    engine.current.renderer.addRipple(x, y, 0.22, now());
  };

  const tossCoin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = wish.trim();
      setStatus(text ? `Your wish "${text}" sinks into the pond…` : "A silent wish. Sometimes those are the best.");
      setWish("");
      const eng = engine.current;
      if (!eng) return;
      const { renderer } = eng;
      const reach = Math.min(renderer.cssW, renderer.cssH) * 0.3 + 90;
      const angle = Math.random() * Math.PI * 2;
      const x = renderer.cssW / 2 + Math.cos(angle) * reach * 1.4;
      const y = renderer.cssH / 2 + Math.sin(angle) * reach;
      const t = now();
      renderer.addRipple(x, y, 1.7, t);
      renderer.addRipple(x, y, 0.9, t + 0.22);
      eng.scene.feed(x, y, t);
    },
    [wish],
  );

  const native = mode === "native";

  const cardEl = (
    <div
      ref={cardRef}
      {...(native ? { drawable: "" } : {})}
      className={
        "w-[340px] max-w-[calc(100vw-2rem)] rounded-[20px] bg-white/95 p-5 text-slate-800 " +
        (native ? "" : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl")
      }
    >
      <form onSubmit={tossCoin} className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold italic text-teal-900">Wishing pond</h1>
        <p className="text-sm leading-snug text-slate-600">
          Type a wish and toss a coin in. Watch the koi come, and the water carry it away.
        </p>
        <input
          value={wish}
          onChange={(e) => setWish(e.target.value)}
          maxLength={60}
          placeholder="I wish for…"
          aria-label="Your wish"
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Toss a coin
        </button>
        <p className="min-h-[2.5rem] text-xs leading-snug text-teal-800">{status}</p>
      </form>
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className="fixed inset-0 overflow-hidden bg-[#071d1c]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        {...(native ? ({ content: "drawable", layoutsubtree: "" } as Record<string, string>) : {})}
      >
        {native && cardEl}
      </canvas>
      {mode === "fallback" && cardEl}
      <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs text-white/80">
        {mode === "pending"
          ? "Loading…"
          : native
            ? "html-in-canvas: on, the card is rendered through the water shader"
            : "html-in-canvas: off, using a DOM overlay. Enable chrome://flags/#canvas-draw-element"}
      </div>
    </div>
  );
}
