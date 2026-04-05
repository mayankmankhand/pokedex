// Renders Mermaid diagrams in the context panel.
// Uses next/dynamic with ssr: false to avoid SSR crashes
// (Mermaid uses DOM APIs that don't exist on the server).
// SVG output is sanitized with DOMPurify before injection.
// Falls back to raw syntax if rendering fails.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { DiagramPayload } from "@/types/panel";

interface DiagramViewProps {
  payload: DiagramPayload;
}

// Mermaid is loaded lazily on the client only.
// We wrap the rendering logic in a component loaded via next/dynamic.
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

function MermaidRenderer({ syntax }: { syntax: string }) {
  const [error, setError] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Ref to the scrollable container (for measuring available width)
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref to the div wrapping the injected SVG (for querying the SVG element)
  const svgWrapperRef = useRef<HTMLDivElement>(null);

  // Clean up copy timer on unmount (R8)
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  // Fit diagram to container width by calculating the ratio of
  // available space to the SVG's intrinsic (natural) width.
  // Uses a ref for zoom so the callback doesn't recreate on every zoom change.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const fitToView = useCallback(() => {
    const container = containerRef.current;
    const svgWrapper = svgWrapperRef.current;
    if (!container || !svgWrapper) return;
    const svgEl = svgWrapper.querySelector("svg");
    if (!svgEl) return;
    // Get SVG's intrinsic width (before any CSS transform).
    // Mermaid v11 SVGs typically have a width attribute; viewBox is the fallback.
    // getBoundingClientRect returns the transformed size, so divide by current zoom.
    const widthAttr = svgEl.getAttribute("width");
    const intrinsicWidth = widthAttr
      ? parseFloat(widthAttr)
      : svgEl.viewBox?.baseVal?.width || svgEl.getBoundingClientRect().width / zoomRef.current;
    if (intrinsicWidth <= 0) return;
    // Available width = container width minus padding (16px each side from p-4)
    const availableWidth = container.clientWidth - 32;
    const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, availableWidth / intrinsicWidth));
    setZoom(fitZoom);
  }, []);

  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(syntax);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [syntax]);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        // Dynamic imports so mermaid and DOMPurify are never bundled server-side
        const mermaid = (await import("mermaid")).default;
        const DOMPurify = (await import("dompurify")).default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
        });

        // Use crypto.randomUUID() for stable unique IDs (safe in StrictMode)
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${crypto.randomUUID()}`,
          syntax,
        );

        // Sanitize SVG to prevent XSS from LLM-generated mermaid syntax.
        // DOMPurify strips event handlers and scripts from the SVG output.
        // Mermaid uses <foreignObject> with HTML elements for text labels,
        // plus <style> for theme colors - these must be allowed through.
        const cleanSvg = DOMPurify.sanitize(renderedSvg, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ["foreignObject", "style"],
          ADD_ATTR: ["xmlns"],
        });

        if (!cancelled) {
          setSvg(cleanSvg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to render diagram",
          );
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [syntax]);

  // Error fallback: show raw syntax
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-warning font-medium">
          Could not render diagram. Showing raw syntax:
        </p>
        <pre className="text-xs bg-surface-elevated border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-text-muted">
          {syntax}
        </pre>
      </div>
    );
  }

  // Rendered SVG (sanitized by DOMPurify)
  if (svg) {
    return (
      <div className="space-y-2">
        {/* Controls toolbar */}
        <div className="flex items-center gap-1.5 p-2 bg-surface border-2 border-border rounded-lg mb-2">
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-elevated border-2 border-border text-sm font-semibold font-mono text-text hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Zoom out"
          >
            -
          </button>
          <span className="text-[11px] font-mono text-text-muted w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-surface-elevated border-2 border-border text-sm font-semibold font-mono text-text hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={fitToView}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border-2 border-border text-[11px] font-semibold text-text-muted hover:bg-surface-hover hover:text-text transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Fit diagram to panel width"
          >
            Fit
          </button>
          <div className="flex-1" />
          <button
            onClick={copySource}
            aria-label="Copy diagram source to clipboard"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border-2 border-border text-[11px] font-medium text-text-muted hover:bg-surface-hover hover:text-text transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copied ? "Copied!" : "Copy source"}
          </button>
        </div>

        {/* Diagram with dot-grid background */}
        <div
          ref={containerRef}
          className="overflow-auto max-h-[60vh] rounded-lg bg-surface-elevated border-2 border-border p-4 bg-[radial-gradient(circle,#D6D3D1_1px,transparent_1px)] bg-[length:16px_16px]"
        >
          <div
            ref={svgWrapperRef}
            className="origin-top-left transition-transform duration-150"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    );
  }

  // Loading state
  return <DiagramSpinner />;
}

// Shared loading state using the Pokeball spinner for consistency
function DiagramSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <span className="pokeball-spinner" />
    </div>
  );
}

// Wrap in next/dynamic to prevent SSR
const DynamicMermaid = dynamic(() => Promise.resolve(MermaidRenderer), {
  ssr: false,
  loading: () => <DiagramSpinner />,
});

export function DiagramView({ payload }: DiagramViewProps) {
  return <DynamicMermaid syntax={payload.mermaidSyntax} />;
}
