// Fan-inspired original designs. Not affiliated with or endorsed by
// Nintendo, Game Freak, or The Pokemon Company.

import React from "react";

interface TrainerSpriteProps {
  spriteId: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// SVG wrapper with shared defaults
function SpriteIcon({
  size,
  className,
  style,
  children,
}: {
  size: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {children}
    </svg>
  );
}

// Trainer cap side profile
function AshSprite() {
  return (
    <path d="M4 14c0-1 .5-2 1.5-2.5L8 10l4-6h4l2 3 2 1v2c0 1-.5 2-1.5 2.5L16 14H4zm3 1h10v2c0 1-1 2-2 2H9c-1 0-2-1-2-2v-2z" />
  );
}

// Water droplet
function MistySprite() {
  return (
    <path d="M12 2C12 2 6 10 6 15a6 6 0 0 0 12 0c0-5-6-13-6-13z" />
  );
}

// Rock/boulder shape
function BrockSprite() {
  return (
    <path d="M12 3L4 10l2 8h12l2-8L12 3zm0 3l5 5-1 5H8l-1-5 5-5z" />
  );
}

// Star badge
function GarySprite() {
  return (
    <path d="M12 2l2.9 6.3L22 9.2l-5 4.6L18.2 21 12 17.3 5.8 21 7 13.8l-5-4.6 7.1-.9L12 2z" />
  );
}

// Leaf shape
function OakSprite() {
  return (
    <path d="M17 2c-3 0-6 2-8 5C7 10 6 14 6 17c0 2 1 4 3 5l1-1c-1-1-2-2-2-4 0-3 1-6 3-9 1-2 3-4 6-4 1 0 2 .5 2 1.5S18 7 17 8c-2 2-3 4-3 7h2c0-2 1-4 3-6 1-1 2-3 2-4.5S19 2 17 2z" />
  );
}

// "R" letter (Team Rocket)
function JessieSprite() {
  return (
    <path d="M7 3h8c2 0 3 1.5 3 3.5S17 10 15 10l4 11h-3l-4-11H10v11H7V3zm3 3v4h5c1 0 1.5-.8 1.5-2S16 6 15 6h-5z" />
  );
}

// Rose silhouette
function JamesSprite() {
  return (
    <path d="M12 2c-2 0-4 2-4 4 0 1.5.8 2.8 2 3.5C8.8 10.2 8 11.5 8 13c0 2 2 4 4 4s4-2 4-4c0-1.5-.8-2.8-2-3.5 1.2-.7 2-2 2-3.5 0-2-2-4-4-4zm0 16c0 0-1 0-1 1v3h2v-3c0-1-1-1-1-1z" />
  );
}

// Generic trainer fallback (simple person outline)
function FallbackSprite() {
  return (
    <path d="M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z" />
  );
}

const SPRITE_MAP: Record<string, React.FC> = {
  ash: AshSprite,
  misty: MistySprite,
  brock: BrockSprite,
  gary: GarySprite,
  oak: OakSprite,
  jessie: JessieSprite,
  james: JamesSprite,
};

export function TrainerSprite({
  spriteId,
  size = 24,
  className,
  style,
}: TrainerSpriteProps) {
  const SpriteComponent = SPRITE_MAP[spriteId] || FallbackSprite;

  return (
    <SpriteIcon size={size} className={className} style={style}>
      <SpriteComponent />
    </SpriteIcon>
  );
}
