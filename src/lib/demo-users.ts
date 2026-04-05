// Hardcoded demo users for development (Pokemon characters).
// This file is plain TypeScript (no Prisma imports) so it can run in Edge Middleware.

export interface DemoTeam {
  id: string;
  name: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: string;
  teamId: string;
  spriteId: string;      // Maps to a TrainerSprite component
  accentColor: string;   // Hex color for trainer-specific accents
}

// ── Teams ──────────────────────────────────────────────────

export const DEMO_TEAMS: DemoTeam[] = [
  { id: "a1b2c3d4-0001-4000-8000-000000000001", name: "Product" },
  { id: "a1b2c3d4-0002-4000-8000-000000000002", name: "Field Testing" },
  { id: "a1b2c3d4-0003-4000-8000-000000000003", name: "Hardware" },
  { id: "a1b2c3d4-0004-4000-8000-000000000004", name: "Design" },
  { id: "a1b2c3d4-0005-4000-8000-000000000005", name: "Firmware" },
  { id: "a1b2c3d4-0006-4000-8000-000000000006", name: "Team Rocket QA" },
];

// ── Users ──────────────────────────────────────────────────

export const DEMO_USERS: DemoUser[] = [
  {
    id: "b1c2d3e4-0001-4000-8000-000000000001",
    name: "Ash Ketchum",
    email: "ash@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[0].id, // Product
    spriteId: "ash",
    accentColor: "#DC2626",
  },
  {
    id: "b1c2d3e4-0002-4000-8000-000000000002",
    name: "Misty Waterflower",
    email: "misty@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[1].id, // Field Testing
    spriteId: "misty",
    accentColor: "#3B82F6",
  },
  {
    id: "b1c2d3e4-0003-4000-8000-000000000003",
    name: "Brock Harrison",
    email: "brock@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[2].id, // Hardware
    spriteId: "brock",
    accentColor: "#78350F", // Darkened for WCAG AA contrast on parchment
  },
  {
    id: "b1c2d3e4-0004-4000-8000-000000000004",
    name: "Gary Oak",
    email: "gary@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[3].id, // Design
    spriteId: "gary",
    accentColor: "#7C3AED",
  },
  {
    id: "b1c2d3e4-0005-4000-8000-000000000005",
    name: "Professor Oak",
    email: "prof.oak@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[4].id, // Firmware
    spriteId: "oak",
    accentColor: "#15803D", // Darkened for WCAG AA contrast on parchment
  },
  {
    id: "b1c2d3e4-0006-4000-8000-000000000006",
    name: "Jessie Rocket",
    email: "jessie@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[5].id, // Team Rocket QA
    spriteId: "jessie",
    accentColor: "#DB2777",
  },
  {
    id: "b1c2d3e4-0007-4000-8000-000000000007",
    name: "James Rocket",
    email: "james@example.com",
    role: "engineer",
    teamId: DEMO_TEAMS[5].id, // Team Rocket QA
    spriteId: "james",
    accentColor: "#7C3AED",
  },
];

// ── Lookup ─────────────────────────────────────────────────

const usersById = new Map(DEMO_USERS.map((u) => [u.id, u]));

export function getUserById(id: string): DemoUser | undefined {
  return usersById.get(id);
}
