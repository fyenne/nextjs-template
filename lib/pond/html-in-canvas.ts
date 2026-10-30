/**
 * Minimal typings and feature detection for the WICG html-in-canvas proposal
 * (https://github.com/WICG/html-in-canvas). Chromium ships it behind
 * chrome://flags/#canvas-draw-element.
 */
export interface HtmlInCanvasCanvas extends HTMLCanvasElement {
  onpaint: ((event: Event & { changedElements?: Element[] }) => void) | null;
  requestPaint(): void;
  updateElementGeometry(element: Element, options?: { canvasTransform?: DOMMatrix }): void;
  /** Absent in some Chromium builds. */
  getElementImageDefaultSize?(element: Element): { width: number; height: number };
}

export interface HtmlInCanvasGL extends WebGL2RenderingContext {
  texElementSubImage2D?(
    target: number,
    level: number,
    xoffset: number,
    yoffset: number,
    element: Element,
  ): void;
  texElementImage2D(
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    element: Element,
  ): void;
}

export function supportsHtmlInCanvas(): boolean {
  if (typeof window === "undefined") return false;
  const canvasProto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const glProto = WebGL2RenderingContext.prototype as unknown as Record<string, unknown>;
  return (
    typeof canvasProto.requestPaint === "function" &&
    typeof canvasProto.updateElementGeometry === "function" &&
    (typeof glProto.texElementSubImage2D === "function" || typeof glProto.texElementImage2D === "function")
  );
}
