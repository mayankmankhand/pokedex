# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.0.0] - 2026-03-31

### Added
- **Session-based demo limits** (#15): 25 messages per session via HMAC-SHA256 signed httpOnly cookie, server-enforced before model invocation, configurable via env vars, warning at message 20, graceful cutoff with recovery info
- **OG meta tags and social preview** (#13): Dynamic OG image via Next.js ImageResponse API (Pokeball + title), OpenGraph and Twitter card metadata for LinkedIn sharing
- **MIT license** and repository metadata in package.json
- **Pokemon Indigo League theme** (Phase 1, #7): Warm parchment palette, Pokemon Red/Blue accents, solid opaque surfaces replacing frosted glass
  - New `PokeballIcon` shared component (`src/components/pokeball-icon.tsx`) - pure CSS, no images
  - CSS `.pokeball-spinner` and `.pokeball-spinner-sm` classes for loading states
  - Status badges remapped to Pokemon type colors (Draft=Normal, Approved=Grass, Active=Water, Failed=Fire, Blocked=Poison, Canceled=Rock, Skipped=Rock, Pending=Ground)
  - Header shows "POKEDEX" with Pokeball icon, send button is a Pokeball with arrow overlay
  - Thinking indicator cycles Pokemon battle phrases ("PIKACHU used SEARCH", "Consulting Professor Oak")
  - Empty state: "A wild POKEMON appeared!" with battle-menu-styled suggestion chips
  - Standalone `design-concept.html` prototype with 3 palette variants for visual comparison
- **Phase 2 and 3 issues created**: Panel restyling (#9), Animations and branding (#10)

### Changed
- **Documentation polish** (#12): Removed personal info from README, generalized design spec audience, added v1.0.0 changelog section
- **Seed data theme**: Replaced smartwatch PLM dataset with Pokedex hardware PLM theme (#6)
  - 7 Pokemon characters (Ash, Misty, Brock, Gary, Prof. Oak, Jessie, James) replace 6 Friends characters
  - 6 teams: Product, Field Testing, Hardware, Design, Firmware, Team Rocket QA
  - 10 product requirements based on real Pokedex features: scanner, species database, cry playback, casing, habitat map, display, power, firmware updates, trainer ID
  - All lifecycle patterns preserved: cancellation cascade, coverage gaps, multi-version test procedures, failed/blocked/skipped test cases
  - 155 audit log entries with full timeline narrative
- **User picker refactor**: Imports from `demo-users.ts` instead of duplicating the user list (single source of truth)
- **Project rename**: Package renamed from `plm` to `pokedex`
- **Documentation cleanup**: Replaced all smartwatch-era references with Pokedex hardware equivalents (#5)
  - Updated README.md, USER-GUIDE.md, design spec, HTML prototype, explore command examples
  - Deleted 9 old-project artifacts (3 QA docs, 4 archive files, 2 orphaned plans)
  - Updated 3 test files (diagram-templates, scenarios, showTable-aggregations) with Pokedex domain terms
  - Fixed suggestion chip from "GPS traceability diagram" to "Scanner traceability diagram"
  - Updated Vercel URL to pokedex-plm.vercel.app
  - Created issue #8 preserving QA test scenarios from deleted docs
