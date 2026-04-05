// Shared Pokeball icon component - pure CSS, no images (Issue #7).
// Used in the header, send button, and anywhere a static Pokeball is needed.
// For the spinning variant, use the .pokeball-spinner CSS class in globals.css.

import type { CSSProperties } from "react";

interface PokeballIconProps {
  /** Diameter in pixels. Center dot scales proportionally. */
  size?: number;
  /** Optional CSS class for the outer element. */
  className?: string;
  /** Show a small upward arrow overlay in the center (for send button). */
  showArrow?: boolean;
}

export function PokeballIcon({ size = 18, className = "" }: PokeballIconProps) {
  // Center dot is ~30% of the ball diameter, clamped to reasonable sizes
  const dotSize = Math.max(3, Math.round(size * 0.3));
  const dotBorder = size >= 24 ? 1.5 : 1;

  const ballStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    background: `linear-gradient(to bottom, var(--color-primary) 0%, var(--color-primary) 42%, var(--color-border) 42%, var(--color-border) 58%, #fff 58%, #fff 100%)`,
    border: `${size >= 24 ? 2 : 1.5}px solid var(--color-border)`,
    display: "inline-block",
    position: "relative",
    flexShrink: 0,
  };

  const dotStyle: CSSProperties = {
    width: dotSize,
    height: dotSize,
    borderRadius: "50%",
    background: "var(--color-surface-elevated)",
    border: `${dotBorder}px solid var(--color-border)`,
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  return (
    <span style={ballStyle} className={className} aria-hidden="true">
      <span style={dotStyle} />
    </span>
  );
}
