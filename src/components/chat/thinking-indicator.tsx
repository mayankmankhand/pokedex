// Thinking/loading indicator shown while the AI is generating a response.
// Cycles through Pokemon-themed phrases on a 2.5-second interval (Issue #7).
// Phrases are Fisher-Yates shuffled on mount so the order feels random each time.
// Each phrase swap uses a React `key` change to retrigger a CSS slide-up animation.

"use client";

import { useState, useEffect, memo } from "react";

// Pokemon battle/world phrases displayed while the user waits.
// No trailing "..." here - the animated dots handle that visually.
const PHRASES = [
  "PIKACHU used SEARCH",
  "Checking the Pokedex",
  "Consulting Professor Oak",
  "Scanning wild data",
  "It's super effective",
  "A wild result appeared",
  "Training the neural network",
  "Evolving the response",
  "Catching insights",
  "Using ANALYZE",
  "Surfing through records",
  "Digging through the database",
  "Preparing the battle report",
  "Loading the Pokeball",
];

/**
 * Fisher-Yates shuffle - produces a random permutation of the input array.
 * Returns a new array (does not mutate the original).
 */
function shuffle(arr: string[]): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ThinkingIndicatorBase() {
  // Shuffle phrases once on mount so the cycle order is unique per render.
  const [shuffled] = useState(() => shuffle(PHRASES));
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cycle to the next phrase every 2.5 seconds.
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % shuffled.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [shuffled.length]);

  const currentPhrase = shuffled[currentIndex];

  return (
    <div className="max-w-3xl min-h-[24px]" role="status" aria-label="AI is thinking">
      {/* aria-hidden on the visual content so screen readers only hear the
          outer aria-label ("AI is thinking") once, not every 2.5s phrase change. */}
      <div className="flex items-center gap-2 text-[14px] text-text italic" aria-hidden="true">
        {/* Pokeball spinner - CSS-only, respects prefers-reduced-motion */}
        <span className="pokeball-spinner" />
        {/* key={currentIndex} forces React to remount the span on each phrase change,
            retriggering the thinking-text CSS animation (slide-up-and-fade-in). */}
        <span key={currentIndex} className="thinking-text">
          {currentPhrase}
        </span>
        {/* Three bouncing mini Pokeballs (Phase 3 - replaces streaming-dots). */}
        <span className="streaming-pokeballs">
          <span /><span /><span />
        </span>
      </div>
    </div>
  );
}

// Memoized to avoid unnecessary re-renders (matches MessageBubble pattern).
const ThinkingIndicator = memo(ThinkingIndicatorBase);
ThinkingIndicator.displayName = "ThinkingIndicator";

export { ThinkingIndicator };
