/**
 * Seed script for PLM database.
 *
 * Creates demo teams, users, and a Pokedex hardware product lifecycle dataset
 * with realistic volume and status variety for demo purposes.
 * Uses Pokemon characters as the 7 demo engineers.
 *
 * Dataset: 10 PRs, 21 SRs, 18 TPs, 19 TPVs, 20 TCs, 6 attachments, ~155 audit entries
 *
 * Run with: npx tsx prisma/seed.ts
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { DEMO_TEAMS, DEMO_USERS } from "../src/lib/demo-users";

const prisma = new PrismaClient();

// ── User aliases ────────────────────────────────────────────

const ASH = DEMO_USERS[0].id;       // Product
const MISTY = DEMO_USERS[1].id;     // Field Testing
const BROCK = DEMO_USERS[2].id;     // Hardware
const GARY = DEMO_USERS[3].id;      // Design
const PROF_OAK = DEMO_USERS[4].id;  // Firmware
const JESSIE = DEMO_USERS[5].id;    // Team Rocket QA
const JAMES = DEMO_USERS[6].id;     // Team Rocket QA

// ── Team aliases ────────────────────────────────────────────

const TEAM_PRODUCT = DEMO_TEAMS[0].id;
const TEAM_FIELD_TESTING = DEMO_TEAMS[1].id;
const TEAM_HARDWARE = DEMO_TEAMS[2].id;
const TEAM_DESIGN = DEMO_TEAMS[3].id;
const TEAM_FIRMWARE = DEMO_TEAMS[4].id;
const TEAM_ROCKET_QA = DEMO_TEAMS[5].id;

// ── Deterministic IDs for seed entities ─────────────────────

// Product Requirements (10)
const PR1 = "c0000000-0001-4000-8000-000000000001"; // Pokemon Scanner Module
const PR2 = "c0000000-0002-4000-8000-000000000002"; // Species Database System
const PR3 = "c0000000-0003-4000-8000-000000000003"; // Audio System (Cry Playback)
const PR4 = "c0000000-0004-4000-8000-000000000004"; // Casing and Industrial Design
const PR5 = "c0000000-0005-4000-8000-000000000005"; // Wireless Communication (CANCELED)
const PR6 = "c0000000-0006-4000-8000-000000000006"; // Habitat Map Display
const PR7 = "c0000000-0007-4000-8000-000000000007"; // Trainer ID and Auth (DRAFT)
const PR8 = "c0000000-0008-4000-8000-000000000008"; // Power System
const PR9 = "c0000000-0009-4000-8000-000000000009"; // Display and Touch Input
const PR10 = "c0000000-0010-4000-8000-000000000010"; // Firmware Update System

// Sub-Requirements (21)
const SR1_1 = "d0000000-0001-4000-8000-000000000001"; // Camera Hardware
const SR1_2 = "d0000000-0002-4000-8000-000000000002"; // Visual Recognition Algorithm
const SR2_1 = "d0000000-0003-4000-8000-000000000003"; // Species Data Storage
const SR2_2 = "d0000000-0004-4000-8000-000000000004"; // Search and Filter
const SR3_1 = "d0000000-0005-4000-8000-000000000005"; // Speaker Hardware
const SR3_2 = "d0000000-0006-4000-8000-000000000006"; // Audio Codec and Playback
const SR4_1 = "d0000000-0007-4000-8000-000000000007"; // Clamshell Enclosure
const SR4_2 = "d0000000-0008-4000-8000-000000000008"; // Drop Resistance
const SR5_1 = "d0000000-0009-4000-8000-000000000009"; // Bluetooth Data Sync (CANCELED)
const SR6_1 = "d0000000-0010-4000-8000-000000000010"; // Map Renderer
const SR6_2 = "d0000000-0011-4000-8000-000000000011"; // Area Data Overlay
const SR7_1 = "d0000000-0012-4000-8000-000000000012"; // RFID Chip (DRAFT)
const SR7_2 = "d0000000-0013-4000-8000-000000000013"; // League Registration Protocol (DRAFT)
const SR8_1 = "d0000000-0014-4000-8000-000000000014"; // Battery Cell
const SR8_2 = "d0000000-0015-4000-8000-000000000015"; // Power Management IC
const SR9_1 = "d0000000-0016-4000-8000-000000000016"; // LCD Panel
const SR9_2 = "d0000000-0017-4000-8000-000000000017"; // Touchscreen Digitizer
const SR9_3 = "d0000000-0018-4000-8000-000000000018"; // Button Input Controls
const SR10_1 = "d0000000-0019-4000-8000-000000000019"; // Service Port Update Path
const SR10_2 = "d0000000-0020-4000-8000-000000000020"; // Firmware Rollback Mechanism
const SR10_3 = "d0000000-0021-4000-8000-000000000021"; // Wireless Update Protocol (DRAFT, coverage gap)

// Test Procedures (18) - no TPs for SR7_1, SR7_2 (DRAFT PR), SR10_3 (coverage gap)
const TP1 = "e0000000-0001-4000-8000-000000000001";  // Camera Sensor Validation
const TP2 = "e0000000-0002-4000-8000-000000000002";  // Recognition Algorithm Accuracy
const TP3 = "e0000000-0003-4000-8000-000000000003";  // Database Load and Query
const TP4 = "e0000000-0004-4000-8000-000000000004";  // Search Filter Verification
const TP5 = "e0000000-0005-4000-8000-000000000005";  // Speaker Output Test
const TP6 = "e0000000-0006-4000-8000-000000000006";  // Audio Codec Validation
const TP7 = "e0000000-0007-4000-8000-000000000007";  // Enclosure Seal Test
const TP8 = "e0000000-0008-4000-8000-000000000008";  // Drop Impact Test
const TP9 = "e0000000-0009-4000-8000-000000000009";  // Bluetooth Sync Test (CANCELED)
const TP10 = "e0000000-0010-4000-8000-000000000010"; // Map Rendering Test
const TP11 = "e0000000-0011-4000-8000-000000000011"; // Area Overlay Accuracy Test
const TP12 = "e0000000-0012-4000-8000-000000000012"; // Battery Endurance Test
const TP13 = "e0000000-0013-4000-8000-000000000013"; // Power Management Validation
const TP14 = "e0000000-0014-4000-8000-000000000014"; // LCD Brightness and Contrast
const TP15 = "e0000000-0015-4000-8000-000000000015"; // Touch Accuracy Test
const TP16 = "e0000000-0016-4000-8000-000000000016"; // Button Response Test
const TP17 = "e0000000-0017-4000-8000-000000000017"; // Service Port Update Test
const TP18 = "e0000000-0018-4000-8000-000000000018"; // Rollback Verification Test

// Test Procedure Versions (19) - TP1 has v1 (APPROVED) + v2 (DRAFT)
const TPV1 = "f0000000-0001-4000-8000-000000000001";  // TP1 v1
const TPV2 = "f0000000-0002-4000-8000-000000000002";  // TP2 v1
const TPV3 = "f0000000-0003-4000-8000-000000000003";  // TP3 v1
const TPV4 = "f0000000-0004-4000-8000-000000000004";  // TP4 v1
const TPV5 = "f0000000-0005-4000-8000-000000000005";  // TP5 v1
const TPV6 = "f0000000-0006-4000-8000-000000000006";  // TP6 v1
const TPV7 = "f0000000-0007-4000-8000-000000000007";  // TP7 v1
const TPV8 = "f0000000-0008-4000-8000-000000000008";  // TP8 v1
const TPV9 = "f0000000-0009-4000-8000-000000000009";  // TP9 v1
const TPV10 = "f0000000-0010-4000-8000-000000000010"; // TP10 v1
const TPV11 = "f0000000-0011-4000-8000-000000000011"; // TP11 v1
const TPV12 = "f0000000-0012-4000-8000-000000000012"; // TP12 v1
const TPV13 = "f0000000-0013-4000-8000-000000000013"; // TP13 v1
const TPV14 = "f0000000-0014-4000-8000-000000000014"; // TP14 v1
const TPV15 = "f0000000-0015-4000-8000-000000000015"; // TP15 v1
const TPV16 = "f0000000-0016-4000-8000-000000000016"; // TP16 v1
const TPV17 = "f0000000-0017-4000-8000-000000000017"; // TP17 v1
const TPV18 = "f0000000-0018-4000-8000-000000000018"; // TP18 v1 (DRAFT)
const TPV1B = "f0000000-0019-4000-8000-000000000019"; // TP1 v2 (DRAFT, multi-version)

// Test Cases (20)
const TC1 = "11000000-0001-4000-8000-000000000001";  // Camera focus [PASSED]
const TC2 = "11000000-0002-4000-8000-000000000002";  // Recognition accuracy [PASSED]
const TC3 = "11000000-0003-4000-8000-000000000003";  // Database load [PASSED]
const TC4 = "11000000-0004-4000-8000-000000000004";  // Search results [PENDING]
const TC5 = "11000000-0005-4000-8000-000000000005";  // Speaker distortion [FAILED]
const TC6 = "11000000-0006-4000-8000-000000000006";  // Audio codec [PASSED]
const TC7 = "11000000-0007-4000-8000-000000000007";  // Enclosure seal [PASSED]
const TC8 = "11000000-0008-4000-8000-000000000008";  // Drop impact [PENDING]
const TC9 = "11000000-0009-4000-8000-000000000009";  // Bluetooth sync [SKIPPED]
const TC10 = "11000000-0010-4000-8000-000000000010"; // Map rendering [PASSED]
const TC11 = "11000000-0011-4000-8000-000000000011"; // Area overlay [PENDING]
const TC12 = "11000000-0012-4000-8000-000000000012"; // Battery endurance [PASSED]
const TC13 = "11000000-0013-4000-8000-000000000013"; // Power management [BLOCKED]
const TC14 = "11000000-0014-4000-8000-000000000014"; // LCD brightness [PASSED]
const TC15 = "11000000-0015-4000-8000-000000000015"; // Touch accuracy [FAILED]
const TC16 = "11000000-0016-4000-8000-000000000016"; // Button response [PENDING]
const TC17 = "11000000-0017-4000-8000-000000000017"; // Service port update [PASSED]
const TC18 = "11000000-0018-4000-8000-000000000018"; // Rollback test [PENDING]
const TC19 = "11000000-0019-4000-8000-000000000019"; // Camera cold start [PENDING]
const TC20 = "11000000-0020-4000-8000-000000000020"; // Speaker frequency sweep [PENDING]

// Attachments (6)
const ATT1 = "22000000-0001-4000-8000-000000000001";
const ATT2 = "22000000-0002-4000-8000-000000000002";
const ATT3 = "22000000-0003-4000-8000-000000000003";
const ATT4 = "22000000-0004-4000-8000-000000000004";
const ATT5 = "22000000-0005-4000-8000-000000000005";
const ATT6 = "22000000-0006-4000-8000-000000000006";

// ── Cleanup arrays ──────────────────────────────────────────

const ALL_PR_IDS = [PR1, PR2, PR3, PR4, PR5, PR6, PR7, PR8, PR9, PR10];
const ALL_SR_IDS = [
  SR1_1, SR1_2, SR2_1, SR2_2, SR3_1, SR3_2, SR4_1, SR4_2, SR5_1,
  SR6_1, SR6_2, SR7_1, SR7_2, SR8_1, SR8_2, SR9_1, SR9_2, SR9_3,
  SR10_1, SR10_2, SR10_3,
];
const ALL_TP_IDS = [
  TP1, TP2, TP3, TP4, TP5, TP6, TP7, TP8, TP9,
  TP10, TP11, TP12, TP13, TP14, TP15, TP16, TP17, TP18,
];
const ALL_TPV_IDS = [
  TPV1, TPV2, TPV3, TPV4, TPV5, TPV6, TPV7, TPV8, TPV9,
  TPV10, TPV11, TPV12, TPV13, TPV14, TPV15, TPV16, TPV17, TPV18, TPV1B,
];
const ALL_TC_IDS = [
  TC1, TC2, TC3, TC4, TC5, TC6, TC7, TC8, TC9, TC10,
  TC11, TC12, TC13, TC14, TC15, TC16, TC17, TC18, TC19, TC20,
];
const ALL_ATT_IDS = [ATT1, ATT2, ATT3, ATT4, ATT5, ATT6];

// ── Anchor date with offset helper ──────────────────────────

const ANCHOR = new Date("2026-02-01T09:00:00Z");

/** Returns a Date offset from the anchor by days and hours. */
function at(dayOffset: number, hourOffset = 0): Date {
  const d = new Date(ANCHOR);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(d.getUTCHours() + hourOffset);
  return d;
}

// ── Audit log helper ────────────────────────────────────────

type AuditEntry = {
  actorId: string;
  action: "CREATE" | "UPDATE" | "APPROVE" | "CANCEL" | "SKIP" | "ADD_ATTACHMENT" | "REMOVE_ATTACHMENT" | "CREATE_VERSION" | "RECORD_RESULT";
  entityType: string;
  entityId: string;
  changes: Prisma.InputJsonObject;
  createdAt: Date;
};

function audit(
  actorId: string,
  action: AuditEntry["action"],
  entityType: string,
  entityId: string,
  changes: Prisma.InputJsonObject,
  day: number,
  hour: number,
): AuditEntry {
  return { actorId, action, entityType, entityId, changes, createdAt: at(day, hour) };
}

// ── Main seed function ──────────────────────────────────────

async function main() {
  console.log("Seeding PLM database...\n");

  // ── 1. Clean up existing seed data (reverse dependency order) ──

  console.log("Cleaning up old seed data...");

  const allEntityIds = [
    ...ALL_PR_IDS, ...ALL_SR_IDS, ...ALL_TP_IDS,
    ...ALL_TPV_IDS, ...ALL_TC_IDS, ...ALL_ATT_IDS,
  ];

  await prisma.auditLog.deleteMany({
    where: { entityId: { in: allEntityIds } },
  });

  await prisma.attachment.deleteMany({
    where: { id: { in: ALL_ATT_IDS } },
  });

  await prisma.testCase.deleteMany({
    where: { id: { in: ALL_TC_IDS } },
  });

  await prisma.testProcedureVersion.deleteMany({
    where: { id: { in: ALL_TPV_IDS } },
  });

  await prisma.testProcedure.deleteMany({
    where: { id: { in: ALL_TP_IDS } },
  });

  await prisma.subRequirement.deleteMany({
    where: { id: { in: ALL_SR_IDS } },
  });

  await prisma.productRequirement.deleteMany({
    where: { id: { in: ALL_PR_IDS } },
  });

  console.log("  Done.\n");

  // ── 2. Teams (upsert) ────────────────────────────────────

  console.log("Seeding teams...");

  for (const team of DEMO_TEAMS) {
    const t = await prisma.team.upsert({
      where: { id: team.id },
      update: { name: team.name },
      create: { id: team.id, name: team.name },
    });
    console.log(`  Team: ${t.name}`);
  }
  console.log();

  // ── 3. Users (upsert) ────────────────────────────────────

  console.log("Seeding users...");

  for (const user of DEMO_USERS) {
    const u = await prisma.user.upsert({
      where: { id: user.id },
      update: { name: user.name, email: user.email, role: user.role, teamId: user.teamId },
      create: { id: user.id, name: user.name, email: user.email, role: user.role, teamId: user.teamId },
    });
    console.log(`  User: ${u.name} (${u.role})`);
  }
  console.log();

  // ── 4. Product Requirements (10) ──────────────────────────
  //
  // Status mix: 8 APPROVED, 1 CANCELED, 1 DRAFT
  //
  // Narrative: Ash leads requirements for the Pokedex device.
  // Domain owners create PRs in their area. PR5 (Wireless Comms)
  // gets canceled mid-project. PR7 (Trainer ID) is still in draft.

  console.log("Seeding product requirements...");

  const prData = [
    {
      id: PR1,
      title: "Pokemon Scanner Module",
      description:
        "The Pokedex shall identify Pokemon species using a built-in camera and visual recognition system. " +
        "When pointed at a Pokemon, the device shall display species data within 2 seconds.",
      status: "APPROVED" as const,
      createdBy: ASH,
    },
    {
      id: PR2,
      title: "Species Database System",
      description:
        "The Pokedex shall store an internal database of all known Pokemon species with the ability " +
        "to search, sort, and filter entries by name, type, region, and National Dex number.",
      status: "APPROVED" as const,
      createdBy: ASH,
    },
    {
      id: PR3,
      title: "Audio System (Cry Playback)",
      description:
        "The Pokedex shall play back the recorded cry of any identified Pokemon species " +
        "through a built-in speaker at adjustable volume levels.",
      status: "APPROVED" as const,
      createdBy: ASH,
    },
    {
      id: PR4,
      title: "Casing and Industrial Design",
      description:
        "The Pokedex shall use a clamshell form factor with a durable ABS plastic enclosure " +
        "rated for field use in rain, dust, and drops from up to 1.5 meters.",
      status: "APPROVED" as const,
      createdBy: BROCK,
    },
    {
      id: PR5,
      title: "Wireless Communication Module",
      description:
        "The Pokedex shall support Bluetooth data synchronization with Pokemon Center terminals " +
        "for uploading encounter data and downloading database updates.",
      status: "CANCELED" as const,
      createdBy: PROF_OAK,
    },
    {
      id: PR6,
      title: "Habitat Map Display",
      description:
        "The Pokedex shall display a regional map showing known Pokemon habitats, " +
        "encounter zones, and the trainer's approximate location via landmark triangulation.",
      status: "APPROVED" as const,
      createdBy: ASH,
    },
    {
      id: PR7,
      title: "Trainer ID and Authentication",
      description:
        "The Pokedex shall function as an official Pokemon League trainer identification card " +
        "with RFID-based authentication at gyms and Pokemon Centers. Requires League review.",
      status: "DRAFT" as const,
      createdBy: ASH,
    },
    {
      id: PR8,
      title: "Power System",
      description:
        "The Pokedex shall operate for at least 72 hours of typical field use on a single charge, " +
        "including periodic scanning, database lookups, and map display.",
      status: "APPROVED" as const,
      createdBy: BROCK,
    },
    {
      id: PR9,
      title: "Display and Touch Input",
      description:
        "The Pokedex shall feature a backlit LCD display with resistive touchscreen input " +
        "and physical D-pad and A/B buttons for navigation in all lighting conditions.",
      status: "APPROVED" as const,
      createdBy: GARY,
    },
    {
      id: PR10,
      title: "Firmware Update System",
      description:
        "The Pokedex shall support firmware updates via a service port connection at Pokemon Centers " +
        "to receive species database patches and system improvements.",
      status: "APPROVED" as const,
      createdBy: PROF_OAK,
    },
  ];

  for (const pr of prData) {
    const created = await prisma.productRequirement.create({ data: pr });
    console.log(`  PR: ${created.title} [${created.status}]`);
  }
  console.log();

  // ── 5. Sub-Requirements (21) ──────────────────────────────
  //
  // Status mix: 17 APPROVED, 1 CANCELED, 3 DRAFT
  // Coverage gap: SR10_3 (Wireless Update Protocol) is DRAFT with no test procedure.
  // Trainer ID sub-reqs (SR7_1, SR7_2) are DRAFT under a DRAFT PR.

  console.log("Seeding sub-requirements...");

  const srData = [
    // PR1: Pokemon Scanner (2 SRs)
    {
      id: SR1_1,
      title: "Camera Sensor Hardware",
      description:
        "Integrate a 5MP camera module with autofocus capable of capturing Pokemon at 1-10 meter range.",
      status: "APPROVED" as const,
      productRequirementId: PR1,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR1_2,
      title: "Visual Recognition Algorithm",
      description:
        "Implement species identification firmware that matches camera input against the internal database " +
        "with at least 95% accuracy across all lighting conditions.",
      status: "APPROVED" as const,
      productRequirementId: PR1,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },

    // PR2: Species Database (2 SRs)
    {
      id: SR2_1,
      title: "Species Data Storage Engine",
      description:
        "Store species records for all 151 Kanto region Pokemon including name, type, height, weight, " +
        "habitat, and flavor text in onboard flash memory.",
      status: "APPROVED" as const,
      productRequirementId: PR2,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },
    {
      id: SR2_2,
      title: "Search and Filter Interface",
      description:
        "Provide search by name, filter by type, sort by Dex number, weight, or height, " +
        "and distinguish between seen and caught entries.",
      status: "APPROVED" as const,
      productRequirementId: PR2,
      teamId: TEAM_DESIGN,
      createdBy: GARY,
    },

    // PR3: Audio System (2 SRs)
    {
      id: SR3_1,
      title: "Speaker Hardware",
      description:
        "Include a 1W piezo speaker capable of reproducing Pokemon cries at frequencies between 200Hz and 8kHz.",
      status: "APPROVED" as const,
      productRequirementId: PR3,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR3_2,
      title: "Audio Codec and Playback Engine",
      description:
        "Decode compressed cry audio files and play them back with less than 1% total harmonic distortion at 80dB.",
      status: "APPROVED" as const,
      productRequirementId: PR3,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },

    // PR4: Casing (2 SRs)
    {
      id: SR4_1,
      title: "Clamshell Enclosure Design",
      description:
        "Design a hinged clamshell body with IP54 dust and splash protection " +
        "that fits comfortably in one hand when open.",
      status: "APPROVED" as const,
      productRequirementId: PR4,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR4_2,
      title: "Drop Resistance Certification",
      description:
        "Pass MIL-STD-810G drop testing from 1.5 meters onto concrete on all faces and corners.",
      status: "APPROVED" as const,
      productRequirementId: PR4,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },

    // PR5: Wireless Communication - CANCELED (1 SR)
    {
      id: SR5_1,
      title: "Bluetooth Data Synchronization",
      description:
        "Implement Bluetooth 5.0 LE for syncing encounter logs and database updates " +
        "with Pokemon Center terminals within 10 meter range.",
      status: "CANCELED" as const,
      productRequirementId: PR5,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },

    // PR6: Habitat Map (2 SRs)
    {
      id: SR6_1,
      title: "Map Rendering Engine",
      description:
        "Render a scrollable tile-based map of the Kanto region on the LCD display " +
        "with zoom levels from route-level to region-level.",
      status: "APPROVED" as const,
      productRequirementId: PR6,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },
    {
      id: SR6_2,
      title: "Pokemon Area Data Overlay",
      description:
        "Overlay habitat icons on the map showing which Pokemon species are found in each route or area, " +
        "updated as the trainer encounters new species.",
      status: "APPROVED" as const,
      productRequirementId: PR6,
      teamId: TEAM_DESIGN,
      createdBy: GARY,
    },

    // PR7: Trainer ID - DRAFT (2 SRs, both DRAFT)
    {
      id: SR7_1,
      title: "RFID Authentication Chip",
      description:
        "Embed a passive RFID tag for trainer identity verification at gym badge readers and Pokemon Center kiosks.",
      status: "DRAFT" as const,
      productRequirementId: PR7,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR7_2,
      title: "League Registration Protocol",
      description:
        "Implement the Pokemon League registration handshake protocol for initial trainer enrollment.",
      status: "DRAFT" as const,
      productRequirementId: PR7,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },

    // PR8: Power System (2 SRs)
    {
      id: SR8_1,
      title: "Battery Cell Selection",
      description:
        "Select a lithium-polymer cell providing at least 3000mAh capacity within the clamshell form factor constraints.",
      status: "APPROVED" as const,
      productRequirementId: PR8,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR8_2,
      title: "Power Management IC",
      description:
        "Implement adaptive power management that throttles display brightness and scanner polling " +
        "based on usage state to extend field life.",
      status: "APPROVED" as const,
      productRequirementId: PR8,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },

    // PR9: Display and Input (3 SRs)
    {
      id: SR9_1,
      title: "LCD Panel Integration",
      description:
        "Integrate a 3.5-inch backlit LCD panel with 320x240 resolution and 500 nit brightness " +
        "for outdoor readability.",
      status: "APPROVED" as const,
      productRequirementId: PR9,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR9_2,
      title: "Touchscreen Digitizer",
      description:
        "Overlay a resistive touchscreen digitizer with stylus and finger input support " +
        "for database browsing and map interaction.",
      status: "APPROVED" as const,
      productRequirementId: PR9,
      teamId: TEAM_HARDWARE,
      createdBy: BROCK,
    },
    {
      id: SR9_3,
      title: "Physical Button Controls",
      description:
        "Include a D-pad, A/B action buttons, and a dedicated Scan button on the lower shell " +
        "for glove-friendly operation in the field.",
      status: "APPROVED" as const,
      productRequirementId: PR9,
      teamId: TEAM_DESIGN,
      createdBy: GARY,
    },

    // PR10: Firmware Update (3 SRs)
    {
      id: SR10_1,
      title: "Service Port Update Path",
      description:
        "Support firmware flashing via USB-C service port at authorized Pokemon Center repair stations.",
      status: "APPROVED" as const,
      productRequirementId: PR10,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },
    {
      id: SR10_2,
      title: "Firmware Rollback Mechanism",
      description:
        "Maintain a backup firmware partition allowing rollback to the previous version " +
        "if an update fails or causes instability.",
      status: "APPROVED" as const,
      productRequirementId: PR10,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },
    {
      id: SR10_3,
      title: "Wireless Update Protocol",
      description:
        "Define an over-the-air update protocol for future wireless firmware delivery. " +
        "Depends on wireless communication module (currently on hold).",
      status: "DRAFT" as const,
      productRequirementId: PR10,
      teamId: TEAM_FIRMWARE,
      createdBy: PROF_OAK,
    },
  ];

  for (const sr of srData) {
    const created = await prisma.subRequirement.create({ data: sr });
    console.log(`  SR: ${created.title} [${created.status}]`);
  }
  console.log();

  // ── 6. Test Procedures (18) ───────────────────────────────
  //
  // Status mix: 17 ACTIVE, 1 CANCELED (TP9 - parent PR canceled)
  // No TPs for: SR7_1, SR7_2 (Trainer ID DRAFT), SR10_3 (coverage gap)
  // Jessie and James (Team Rocket QA) create most TPs; domain owners create a few.

  console.log("Seeding test procedures...");

  const tpData = [
    { id: TP1, title: "Camera Sensor Validation", subRequirementId: SR1_1, createdBy: JAMES },
    { id: TP2, title: "Recognition Algorithm Accuracy", subRequirementId: SR1_2, createdBy: JESSIE },
    { id: TP3, title: "Database Load and Query Performance", subRequirementId: SR2_1, createdBy: JAMES },
    { id: TP4, title: "Search Filter Verification", subRequirementId: SR2_2, createdBy: JAMES },
    { id: TP5, title: "Speaker Output Quality Test", subRequirementId: SR3_1, createdBy: BROCK },
    { id: TP6, title: "Audio Codec Fidelity Validation", subRequirementId: SR3_2, createdBy: PROF_OAK },
    { id: TP7, title: "Enclosure Seal Integrity Test", subRequirementId: SR4_1, createdBy: BROCK },
    { id: TP8, title: "Drop Impact Survival Test", subRequirementId: SR4_2, createdBy: BROCK },
    { id: TP9, title: "Bluetooth Synchronization Test", subRequirementId: SR5_1, createdBy: JESSIE },
    { id: TP10, title: "Map Rendering Performance Test", subRequirementId: SR6_1, createdBy: JESSIE },
    { id: TP11, title: "Area Overlay Accuracy Test", subRequirementId: SR6_2, createdBy: GARY },
    { id: TP12, title: "Battery Endurance Test", subRequirementId: SR8_1, createdBy: JAMES },
    { id: TP13, title: "Power Management Efficiency Test", subRequirementId: SR8_2, createdBy: PROF_OAK },
    { id: TP14, title: "LCD Brightness and Contrast Test", subRequirementId: SR9_1, createdBy: JESSIE },
    { id: TP15, title: "Touch Input Accuracy Test", subRequirementId: SR9_2, createdBy: JESSIE },
    { id: TP16, title: "Button Response Time Test", subRequirementId: SR9_3, createdBy: JAMES },
    { id: TP17, title: "Service Port Firmware Update Test", subRequirementId: SR10_1, createdBy: PROF_OAK },
    { id: TP18, title: "Firmware Rollback Verification Test", subRequirementId: SR10_2, createdBy: PROF_OAK },
  ];

  // TP9 is CANCELED (its parent PR5 was canceled); all others ACTIVE
  for (const tp of tpData) {
    const status = tp.id === TP9 ? ("CANCELED" as const) : ("ACTIVE" as const);
    const created = await prisma.testProcedure.create({
      data: { id: tp.id, title: tp.title, status, subRequirementId: tp.subRequirementId, createdBy: tp.createdBy },
    });
    console.log(`  TP: ${created.title} [${created.status}]`);
  }
  console.log();

  // ── 7. Test Procedure Versions (19) ───────────────────────
  //
  // TP1 has two versions: v1 APPROVED, v2 DRAFT (multi-version demo)
  // TPV18 is DRAFT (rollback test, procedure not yet finalized)
  // Status mix: 17 APPROVED, 2 DRAFT

  console.log("Seeding test procedure versions...");

  const tpvData = [
    {
      id: TPV1, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP1, createdBy: JAMES,
      description: "Verify the camera module captures clear images for species identification.",
      steps:
        "1. Power on Pokedex and open the scanner.\n" +
        "2. Position a test target (printed Pikachu silhouette) at 3 meters.\n" +
        "3. Trigger autofocus and capture image.\n" +
        "4. Verify image resolution is at least 2MP.\n" +
        "5. Verify focus sharpness meets the MTF50 threshold.",
    },
    {
      id: TPV2, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP2, createdBy: JESSIE,
      description: "Verify species recognition accuracy across lighting conditions.",
      steps:
        "1. Load 50 test images covering 25 different species.\n" +
        "2. Run recognition algorithm on each image.\n" +
        "3. Record correct identifications vs misidentifications.\n" +
        "4. Repeat under low-light (50 lux) and bright (80,000 lux) conditions.\n" +
        "5. Verify overall accuracy is at least 95%.",
    },
    {
      id: TPV3, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP3, createdBy: JAMES,
      description: "Verify database loads within acceptable time and queries return correct results.",
      steps:
        "1. Cold-boot the Pokedex.\n" +
        "2. Measure time from power-on to database ready.\n" +
        "3. Query for Bulbasaur by Dex number (#001).\n" +
        "4. Query for all Water-type Pokemon.\n" +
        "5. Verify all queries return correct results within 500ms.",
    },
    {
      id: TPV4, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP4, createdBy: JAMES,
      description: "Verify search and filter return correct, sorted results.",
      steps:
        "1. Search for 'Char' and verify Charmander, Charmeleon, Charizard appear.\n" +
        "2. Filter by Fire type and verify all results are Fire-type.\n" +
        "3. Sort by weight (heaviest first) and verify order.\n" +
        "4. Filter by 'seen but not caught' and verify only seen entries appear.\n" +
        "5. Combine type filter with sort and verify both apply correctly.",
    },
    {
      id: TPV5, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP5, createdBy: BROCK,
      description: "Verify speaker reproduces Pokemon cries without distortion.",
      steps:
        "1. Connect audio analyzer to speaker output.\n" +
        "2. Play Pikachu cry at 50% volume.\n" +
        "3. Measure total harmonic distortion (THD).\n" +
        "4. Increase to 100% volume and re-measure.\n" +
        "5. Verify THD stays below 1% at 80dB and below 3% at maximum volume.",
    },
    {
      id: TPV6, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP6, createdBy: PROF_OAK,
      description: "Verify audio codec decodes all cry formats with correct playback.",
      steps:
        "1. Load cry files for 10 species covering different frequency profiles.\n" +
        "2. Decode each file and measure decode latency.\n" +
        "3. Verify decode completes within 100ms per file.\n" +
        "4. Compare decoded output to reference waveform.\n" +
        "5. Verify waveform correlation is above 0.99 for all samples.",
    },
    {
      id: TPV7, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP7, createdBy: BROCK,
      description: "Verify clamshell enclosure seals against dust and water splash.",
      steps:
        "1. Place Pokedex in IP54 test chamber.\n" +
        "2. Apply dust exposure for 8 hours per IP5X standard.\n" +
        "3. Apply water splash from all angles per IPX4 standard.\n" +
        "4. Open clamshell and inspect internals for ingress.\n" +
        "5. Power on and verify all functions operate normally.",
    },
    {
      id: TPV8, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP8, createdBy: BROCK,
      description: "Verify device survives 1.5m drop onto concrete on all faces.",
      steps:
        "1. Mount Pokedex on MIL-STD-810G drop test rig.\n" +
        "2. Drop from 1.5m onto concrete, clamshell closed, face down.\n" +
        "3. Drop from 1.5m onto concrete, clamshell closed, hinge side.\n" +
        "4. Drop from 1.5m onto concrete, corner impact.\n" +
        "5. Inspect for cracks, verify hinge mechanism, and confirm power-on.",
    },
    {
      id: TPV9, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP9, createdBy: JESSIE,
      description: "Verify Bluetooth syncs encounter data with Pokemon Center terminal.",
      steps:
        "1. Pair Pokedex with test terminal via Bluetooth 5.0 LE.\n" +
        "2. Upload 50 encounter log entries.\n" +
        "3. Measure transfer time and verify completion within 30 seconds.\n" +
        "4. Download a 500KB database patch from terminal.\n" +
        "5. Verify data integrity via checksum comparison.",
    },
    {
      id: TPV10, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP10, createdBy: JESSIE,
      description: "Verify map renders smoothly when scrolling and zooming.",
      steps:
        "1. Open habitat map on the Pokedex.\n" +
        "2. Scroll across the full Kanto region map.\n" +
        "3. Measure frame rate during scroll (target: 15fps minimum).\n" +
        "4. Zoom from region view to route view.\n" +
        "5. Verify tile loading completes within 2 seconds at each zoom level.",
    },
    {
      id: TPV11, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP11, createdBy: GARY,
      description: "Verify habitat overlay icons match actual encounter data.",
      steps:
        "1. Load test encounter dataset with known species per route.\n" +
        "2. Open habitat map and navigate to Route 1.\n" +
        "3. Verify overlay shows Pidgey and Rattata icons.\n" +
        "4. Navigate to Viridian Forest and verify Bug-type overlays.\n" +
        "5. Mark a new encounter and verify overlay updates within 5 seconds.",
    },
    {
      id: TPV12, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP12, createdBy: JAMES,
      description: "Validate battery duration under typical field usage profile.",
      steps:
        "1. Fully charge the Pokedex.\n" +
        "2. Run automated field usage cycle: 10 scans/hour, 5 database lookups/hour, map open 20% of time.\n" +
        "3. Leave display at 50% brightness.\n" +
        "4. Record total runtime until battery reaches 5%.\n" +
        "5. Verify runtime exceeds 72 hours.",
    },
    {
      id: TPV13, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP13, createdBy: PROF_OAK,
      description: "Validate power management reduces draw during idle periods.",
      steps:
        "1. Instrument Pokedex with current measurement probe.\n" +
        "2. Measure baseline current draw during active scanning.\n" +
        "3. Close clamshell and leave device idle for 30 minutes.\n" +
        "4. Verify current draw drops by at least 60% in sleep state.\n" +
        "5. Open clamshell and verify scanner wakes within 3 seconds.",
    },
    {
      id: TPV14, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP14, createdBy: JESSIE,
      description: "Verify LCD meets brightness and contrast targets across conditions.",
      steps:
        "1. Place Pokedex in light-controlled chamber.\n" +
        "2. Set display to maximum brightness and measure with luminance meter.\n" +
        "3. Verify at least 500 nits peak brightness.\n" +
        "4. Display black and white test pattern, measure contrast ratio.\n" +
        "5. Verify contrast ratio exceeds 500:1.",
    },
    {
      id: TPV15, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP15, createdBy: JESSIE,
      description: "Verify touchscreen registers taps accurately across the display.",
      steps:
        "1. Display a 5x5 grid of touch targets on screen.\n" +
        "2. Tap each target with a stylus and record registered coordinates.\n" +
        "3. Repeat with finger input.\n" +
        "4. Calculate positional error for each tap.\n" +
        "5. Verify average error is below 2mm and no tap exceeds 4mm error.",
    },
    {
      id: TPV16, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP16, createdBy: JAMES,
      description: "Verify physical buttons register presses within response time target.",
      steps:
        "1. Connect button test jig to Pokedex GPIO monitor.\n" +
        "2. Press each button (D-pad up/down/left/right, A, B, Scan) 100 times.\n" +
        "3. Measure debounce time and response latency.\n" +
        "4. Verify all presses register (0% miss rate).\n" +
        "5. Verify response latency is under 50ms for all buttons.",
    },
    {
      id: TPV17, versionNumber: 1, status: "APPROVED" as const, testProcedureId: TP17, createdBy: PROF_OAK,
      description: "Verify firmware can be updated via USB-C service port.",
      steps:
        "1. Connect Pokedex to service terminal via USB-C.\n" +
        "2. Initiate firmware update with test build v1.1.0.\n" +
        "3. Verify update completes within 5 minutes.\n" +
        "4. Reboot device and verify new version number displays.\n" +
        "5. Run basic self-test to confirm scanner, database, and display function.",
    },
    {
      id: TPV18, versionNumber: 1, status: "DRAFT" as const, testProcedureId: TP18, createdBy: PROF_OAK,
      description: "Verify firmware rollback restores previous version after failed update.",
      steps:
        "1. Flash a deliberately corrupted firmware build via service port.\n" +
        "2. Verify device detects corruption during boot integrity check.\n" +
        "3. Confirm automatic rollback to backup partition.\n" +
        "4. Verify previous firmware version loads successfully.\n" +
        "5. Run self-test to confirm all subsystems are operational.",
    },
    // Multi-version: TP1 v2 (DRAFT) adds a cold-start focus test
    {
      id: TPV1B, versionNumber: 2, status: "DRAFT" as const, testProcedureId: TP1, createdBy: JESSIE,
      description: "Updated camera test adding cold-start autofocus validation (v2).",
      steps:
        "1. Power on Pokedex from fully off state.\n" +
        "2. Immediately open scanner and trigger capture.\n" +
        "3. Measure time from power-on to first focused image.\n" +
        "4. Verify cold-start focus completes within 5 seconds.\n" +
        "5. Capture 10 consecutive images and verify consistent focus quality.\n" +
        "6. Compare cold-start image quality to warm-state baseline.",
    },
  ];

  for (const tpv of tpvData) {
    const created = await prisma.testProcedureVersion.create({ data: tpv });
    console.log(`  TPV: v${created.versionNumber} for TP ${tpv.testProcedureId.slice(-4)} [${created.status}]`);
  }
  console.log();

  // ── 8. Test Cases (20) ────────────────────────────────────
  //
  // Status mix: 9 PASSED, 2 FAILED, 7 PENDING, 1 BLOCKED, 1 SKIPPED
  //
  // Interesting scenarios:
  // - TC5: Speaker FAILED (distortion above 3% at max volume - Jessie was NOT gentle)
  // - TC9: SKIPPED (parent PR canceled)
  // - TC13: BLOCKED (waiting on power management IC samples from supplier)
  // - TC15: FAILED (Ditto disguised as Pikachu caused false positive)
  // - TC19: PENDING on v2 DRAFT version (multi-version)
  // - TC20: Second test case on same version as TC5

  console.log("Seeding test cases...");

  const tcData = [
    {
      id: TC1, title: "Camera autofocus locks on target at 3m",
      description: "Verify camera module achieves sharp focus on a Pokemon-sized target at standard scanning distance.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Autofocus locked in 0.8 seconds at 3m. MTF50 measured at 42 lp/mm, exceeds 30 lp/mm threshold.",
      testProcedureVersionId: TPV1, executedBy: MISTY, executedAt: at(14, 2), createdBy: JAMES,
    },
    {
      id: TC2, title: "Species recognition accuracy meets 95% target",
      description: "Verify the recognition algorithm correctly identifies species across lighting conditions.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Normal light: 98% (49/50). Low light: 96% (48/50). Bright light: 96% (48/50). Overall 96.7%.",
      testProcedureVersionId: TPV2, executedBy: JESSIE, executedAt: at(14, 4), createdBy: JESSIE,
    },
    {
      id: TC3, title: "Database loads and queries within 500ms",
      description: "Verify species database is queryable within performance targets after cold boot.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Cold boot to DB ready: 2.1 seconds. Dex lookup: 12ms. Type filter (Water): 89ms. Well within 500ms.",
      testProcedureVersionId: TPV3, executedBy: MISTY, executedAt: at(15, 1), createdBy: JAMES,
    },
    {
      id: TC4, title: "Search and filter results are correct and sorted",
      description: "Verify search by name, type filter, and sort produce correct results.",
      status: "PENDING" as const,
      testProcedureVersionId: TPV4, createdBy: JAMES,
    },
    {
      id: TC5, title: "Speaker THD within limits at all volume levels",
      description: "Verify cry playback distortion stays below thresholds at normal and maximum volume.",
      status: "FAILED" as const, result: "FAIL" as const,
      notes: "THD at 80dB: 0.8% (PASS). THD at max volume: 4.7% (FAIL, limit is 3%). Pikachu cry clips badly above 90dB. Speaker resonance at 6.2kHz causes rattle. Needs damping or lower max volume cap.",
      testProcedureVersionId: TPV5, executedBy: JESSIE, executedAt: at(16, 6), createdBy: BROCK,
    },
    {
      id: TC6, title: "Audio codec decodes all cry formats correctly",
      description: "Verify codec decodes cry files with correct waveform output.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "All 10 species decoded in under 45ms each. Waveform correlation 0.997 average. Onix's low-frequency cry tested edge case at 200Hz - passed.",
      testProcedureVersionId: TPV6, executedBy: PROF_OAK, executedAt: at(15, 5), createdBy: PROF_OAK,
    },
    {
      id: TC7, title: "Enclosure passes IP54 dust and splash test",
      description: "Verify clamshell seals hold up to IP54 environmental exposure.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "No dust ingress after 8 hours. No water ingress from splash test. Hinge seal held. All functions normal post-test.",
      testProcedureVersionId: TPV7, executedBy: BROCK, executedAt: at(16, 2), createdBy: BROCK,
    },
    {
      id: TC8, title: "Device survives 1.5m drop on all faces",
      description: "Verify Pokedex passes MIL-STD-810G drop test from field height.",
      status: "PENDING" as const,
      testProcedureVersionId: TPV8, createdBy: BROCK,
    },
    {
      id: TC9, title: "Bluetooth sync completes within 30 seconds",
      description: "Verify encounter data uploads to Pokemon Center terminal via Bluetooth.",
      status: "SKIPPED" as const, result: "SKIPPED" as const,
      notes: "Parent requirement PR5 (Wireless Communication Module) was canceled. Test skipped.",
      testProcedureVersionId: TPV9, executedBy: JESSIE, executedAt: at(19, 3), createdBy: JESSIE,
    },
    {
      id: TC10, title: "Map scrolls at 15fps across Kanto region",
      description: "Verify map rendering performance meets minimum frame rate during navigation.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Average 22fps during scroll. Minimum 16fps during zoom transition. Tile load time: 1.4s average. Meets all targets.",
      testProcedureVersionId: TPV10, executedBy: MISTY, executedAt: at(17, 3), createdBy: JESSIE,
    },
    {
      id: TC11, title: "Habitat overlay matches encounter data",
      description: "Verify Pokemon habitat icons display correctly on the map.",
      status: "PENDING" as const,
      testProcedureVersionId: TPV11, createdBy: GARY,
    },
    {
      id: TC12, title: "Battery lasts 72 hours under field usage profile",
      description: "Verify battery endurance meets the 72-hour field life target.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Runtime: 78.5 hours. Scanner usage consumed 31% total. Display at 50% brightness consumed 44%. 6.5 hour margin above target.",
      testProcedureVersionId: TPV12, executedBy: JAMES, executedAt: at(17, 5), createdBy: JAMES,
    },
    {
      id: TC13, title: "Power management reduces idle draw by 60%",
      description: "Verify adaptive power management throttles current in sleep state.",
      status: "BLOCKED" as const, result: "BLOCKED" as const,
      notes: "Blocked: waiting on revised power management IC samples from Silph Co. supplier. Current samples have a silicon bug in sleep mode. New samples expected by March 15.",
      testProcedureVersionId: TPV13, executedBy: PROF_OAK, executedAt: at(17, 7), createdBy: PROF_OAK,
    },
    {
      id: TC14, title: "LCD brightness exceeds 500 nits",
      description: "Verify display brightness and contrast meet outdoor readability targets.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Peak brightness: 540 nits. Contrast ratio: 620:1. Both exceed targets. Readable in direct sunlight.",
      testProcedureVersionId: TPV14, executedBy: JESSIE, executedAt: at(16, 4), createdBy: JESSIE,
    },
    {
      id: TC15, title: "Touch input accuracy within 2mm average",
      description: "Verify touchscreen registers taps accurately for both stylus and finger.",
      status: "FAILED" as const, result: "FAIL" as const,
      notes: "Stylus: 1.1mm average error (PASS). Finger: 3.8mm average error (FAIL, limit is 2mm). Bottom-right quadrant worst at 5.2mm - likely a digitizer calibration issue. Also, Ditto disguised as a touch target caused 3 phantom taps during the finger test. Recalibration needed.",
      testProcedureVersionId: TPV15, executedBy: JESSIE, executedAt: at(18, 2), createdBy: JESSIE,
    },
    {
      id: TC16, title: "All buttons respond within 50ms",
      description: "Verify physical button response time and reliability.",
      status: "PENDING" as const,
      testProcedureVersionId: TPV16, createdBy: JAMES,
    },
    {
      id: TC17, title: "Firmware update via service port succeeds",
      description: "Verify firmware can be flashed and verified via USB-C service connection.",
      status: "PASSED" as const, result: "PASS" as const,
      notes: "Update to v1.1.0 completed in 3 minutes 12 seconds. Version string verified. Self-test passed on all subsystems.",
      testProcedureVersionId: TPV17, executedBy: PROF_OAK, executedAt: at(17, 1), createdBy: PROF_OAK,
    },
    {
      id: TC18, title: "Firmware rollback restores previous version",
      description: "Verify automatic rollback activates when a corrupt firmware is detected.",
      status: "PENDING" as const,
      testProcedureVersionId: TPV18, createdBy: PROF_OAK,
    },
    {
      id: TC19, title: "Camera cold-start focus within 5 seconds",
      description: "Verify camera achieves focus within target time from a full power-off state (v2 procedure).",
      status: "PENDING" as const,
      testProcedureVersionId: TPV1B, createdBy: JESSIE,
    },
    {
      id: TC20, title: "Speaker frequency response across cry range",
      description: "Measure speaker frequency response from 200Hz to 8kHz to investigate distortion failure.",
      status: "PENDING" as const,
      testProcedureVersionId: TPV5, createdBy: BROCK,
    },
  ];

  for (const tc of tcData) {
    const created = await prisma.testCase.create({ data: tc });
    console.log(`  TC: ${created.title} [${created.status}]`);
  }
  console.log();

  // ── 9. Attachments (6) ────────────────────────────────────

  console.log("Seeding attachments...");

  const attData = [
    {
      id: ATT1, fileName: "scanner-calibration-data.xlsx", fileUrl: "/files/scanner-calibration-data.xlsx",
      fileType: "SPREADSHEET" as const, fileSizeBytes: 178_000,
      productRequirementId: PR1, uploadedBy: PROF_OAK,
    },
    {
      id: ATT2, fileName: "casing-drop-test-report.pdf", fileUrl: "/files/casing-drop-test-report.pdf",
      fileType: "DOCUMENT" as const, fileSizeBytes: 1_350_000,
      testCaseId: TC7, uploadedBy: BROCK,
    },
    {
      id: ATT3, fileName: "speaker-frequency-response.png", fileUrl: "/files/speaker-frequency-response.png",
      fileType: "IMAGE" as const, fileSizeBytes: 245_000,
      testCaseId: TC5, uploadedBy: JESSIE,
    },
    {
      id: ATT4, fileName: "clamshell-hinge-diagram.png", fileUrl: "/files/clamshell-hinge-diagram.png",
      fileType: "IMAGE" as const, fileSizeBytes: 530_000,
      subRequirementId: SR4_1, uploadedBy: BROCK,
    },
    {
      id: ATT5, fileName: "pokemon-silhouette-test-set.pdf", fileUrl: "/files/pokemon-silhouette-test-set.pdf",
      fileType: "DOCUMENT" as const, fileSizeBytes: 420_000,
      testProcedureId: TP2, uploadedBy: PROF_OAK,
    },
    {
      id: ATT6, fileName: "battery-discharge-curve.xlsx", fileUrl: "/files/battery-discharge-curve.xlsx",
      fileType: "SPREADSHEET" as const, fileSizeBytes: 67_000,
      testCaseId: TC12, uploadedBy: JAMES,
    },
  ];

  for (const att of attData) {
    await prisma.attachment.create({ data: att });
    console.log(`  Attachment: ${att.fileName} (${att.fileType})`);
  }
  console.log();

  // ── 10. Audit Logs ────────────────────────────────────────
  //
  // Timeline narrative (anchor: 2026-02-01):
  //   Days 0-2:  PR creation and approval
  //   Days 3-6:  SR creation and approval
  //   Days 7-10: TP/TPV creation and approval
  //   Days 11-13: TC creation
  //   Days 14-18: Test execution, results, attachments
  //   Day 19:    PR5 canceled, TP9 canceled, SR5_1 canceled, TC9 skipped
  //   Day 20:    TPV1B (v2) created for TP1

  console.log("Seeding audit logs...");

  const auditEntries: AuditEntry[] = [
    // ── Days 0-2: Product Requirements ──────────────────────

    // PR1: Pokemon Scanner
    audit(ASH, "CREATE", "ProductRequirement", PR1, { title: "Pokemon Scanner Module", status: "DRAFT" }, 0, 0),
    audit(ASH, "APPROVE", "ProductRequirement", PR1, { status: { from: "DRAFT", to: "APPROVED" } }, 0, 1),

    // PR2: Species Database
    audit(ASH, "CREATE", "ProductRequirement", PR2, { title: "Species Database System", status: "DRAFT" }, 0, 2),
    audit(ASH, "APPROVE", "ProductRequirement", PR2, { status: { from: "DRAFT", to: "APPROVED" } }, 0, 3),

    // PR3: Audio
    audit(ASH, "CREATE", "ProductRequirement", PR3, { title: "Audio System (Cry Playback)", status: "DRAFT" }, 0, 4),
    audit(ASH, "APPROVE", "ProductRequirement", PR3, { status: { from: "DRAFT", to: "APPROVED" } }, 0, 5),

    // PR4: Casing
    audit(BROCK, "CREATE", "ProductRequirement", PR4, { title: "Casing and Industrial Design", status: "DRAFT" }, 1, 0),
    audit(ASH, "APPROVE", "ProductRequirement", PR4, { status: { from: "DRAFT", to: "APPROVED" } }, 1, 1),

    // PR5: Wireless (will be canceled later)
    audit(PROF_OAK, "CREATE", "ProductRequirement", PR5, { title: "Wireless Communication Module", status: "DRAFT" }, 1, 2),
    audit(ASH, "APPROVE", "ProductRequirement", PR5, { status: { from: "DRAFT", to: "APPROVED" } }, 1, 3),

    // PR6: Habitat Map
    audit(ASH, "CREATE", "ProductRequirement", PR6, { title: "Habitat Map Display", status: "DRAFT" }, 1, 4),
    audit(ASH, "APPROVE", "ProductRequirement", PR6, { status: { from: "DRAFT", to: "APPROVED" } }, 1, 5),

    // PR7: Trainer ID (stays DRAFT)
    audit(ASH, "CREATE", "ProductRequirement", PR7, { title: "Trainer ID and Authentication", status: "DRAFT" }, 2, 0),

    // PR8: Power System
    audit(BROCK, "CREATE", "ProductRequirement", PR8, { title: "Power System", status: "DRAFT" }, 2, 1),
    audit(ASH, "APPROVE", "ProductRequirement", PR8, { status: { from: "DRAFT", to: "APPROVED" } }, 2, 2),

    // PR9: Display
    audit(GARY, "CREATE", "ProductRequirement", PR9, { title: "Display and Touch Input", status: "DRAFT" }, 2, 3),
    audit(ASH, "APPROVE", "ProductRequirement", PR9, { status: { from: "DRAFT", to: "APPROVED" } }, 2, 4),

    // PR10: Firmware Update
    audit(PROF_OAK, "CREATE", "ProductRequirement", PR10, { title: "Firmware Update System", status: "DRAFT" }, 2, 5),
    audit(ASH, "APPROVE", "ProductRequirement", PR10, { status: { from: "DRAFT", to: "APPROVED" } }, 2, 6),

    // ── Days 3-6: Sub-Requirements ──────────────────────────

    // PR1 SRs
    audit(BROCK, "CREATE", "SubRequirement", SR1_1, { title: "Camera Sensor Hardware", status: "DRAFT" }, 3, 0),
    audit(ASH, "APPROVE", "SubRequirement", SR1_1, { status: { from: "DRAFT", to: "APPROVED" } }, 3, 1),
    audit(PROF_OAK, "CREATE", "SubRequirement", SR1_2, { title: "Visual Recognition Algorithm", status: "DRAFT" }, 3, 2),
    audit(ASH, "APPROVE", "SubRequirement", SR1_2, { status: { from: "DRAFT", to: "APPROVED" } }, 3, 3),

    // PR2 SRs
    audit(PROF_OAK, "CREATE", "SubRequirement", SR2_1, { title: "Species Data Storage Engine", status: "DRAFT" }, 3, 4),
    audit(ASH, "APPROVE", "SubRequirement", SR2_1, { status: { from: "DRAFT", to: "APPROVED" } }, 3, 5),
    audit(GARY, "CREATE", "SubRequirement", SR2_2, { title: "Search and Filter Interface", status: "DRAFT" }, 3, 6),
    audit(ASH, "APPROVE", "SubRequirement", SR2_2, { status: { from: "DRAFT", to: "APPROVED" } }, 3, 7),

    // PR3 SRs
    audit(BROCK, "CREATE", "SubRequirement", SR3_1, { title: "Speaker Hardware", status: "DRAFT" }, 4, 0),
    audit(ASH, "APPROVE", "SubRequirement", SR3_1, { status: { from: "DRAFT", to: "APPROVED" } }, 4, 1),
    audit(PROF_OAK, "CREATE", "SubRequirement", SR3_2, { title: "Audio Codec and Playback Engine", status: "DRAFT" }, 4, 2),
    audit(ASH, "APPROVE", "SubRequirement", SR3_2, { status: { from: "DRAFT", to: "APPROVED" } }, 4, 3),

    // PR4 SRs
    audit(BROCK, "CREATE", "SubRequirement", SR4_1, { title: "Clamshell Enclosure Design", status: "DRAFT" }, 4, 4),
    audit(ASH, "APPROVE", "SubRequirement", SR4_1, { status: { from: "DRAFT", to: "APPROVED" } }, 4, 5),
    audit(BROCK, "CREATE", "SubRequirement", SR4_2, { title: "Drop Resistance Certification", status: "DRAFT" }, 4, 6),
    audit(ASH, "APPROVE", "SubRequirement", SR4_2, { status: { from: "DRAFT", to: "APPROVED" } }, 4, 7),

    // PR5 SR
    audit(PROF_OAK, "CREATE", "SubRequirement", SR5_1, { title: "Bluetooth Data Synchronization", status: "DRAFT" }, 5, 0),
    audit(ASH, "APPROVE", "SubRequirement", SR5_1, { status: { from: "DRAFT", to: "APPROVED" } }, 5, 1),

    // PR6 SRs
    audit(PROF_OAK, "CREATE", "SubRequirement", SR6_1, { title: "Map Rendering Engine", status: "DRAFT" }, 5, 2),
    audit(ASH, "APPROVE", "SubRequirement", SR6_1, { status: { from: "DRAFT", to: "APPROVED" } }, 5, 3),
    audit(GARY, "CREATE", "SubRequirement", SR6_2, { title: "Pokemon Area Data Overlay", status: "DRAFT" }, 5, 4),
    audit(ASH, "APPROVE", "SubRequirement", SR6_2, { status: { from: "DRAFT", to: "APPROVED" } }, 5, 5),

    // PR7 SRs (DRAFT)
    audit(BROCK, "CREATE", "SubRequirement", SR7_1, { title: "RFID Authentication Chip", status: "DRAFT" }, 5, 6),
    audit(PROF_OAK, "CREATE", "SubRequirement", SR7_2, { title: "League Registration Protocol", status: "DRAFT" }, 5, 7),

    // PR8 SRs
    audit(BROCK, "CREATE", "SubRequirement", SR8_1, { title: "Battery Cell Selection", status: "DRAFT" }, 6, 0),
    audit(ASH, "APPROVE", "SubRequirement", SR8_1, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 1),
    audit(PROF_OAK, "CREATE", "SubRequirement", SR8_2, { title: "Power Management IC", status: "DRAFT" }, 6, 2),
    audit(ASH, "APPROVE", "SubRequirement", SR8_2, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 3),

    // PR9 SRs
    audit(BROCK, "CREATE", "SubRequirement", SR9_1, { title: "LCD Panel Integration", status: "DRAFT" }, 6, 4),
    audit(ASH, "APPROVE", "SubRequirement", SR9_1, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 5),
    audit(BROCK, "CREATE", "SubRequirement", SR9_2, { title: "Touchscreen Digitizer", status: "DRAFT" }, 6, 6),
    audit(ASH, "APPROVE", "SubRequirement", SR9_2, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 7),
    audit(GARY, "CREATE", "SubRequirement", SR9_3, { title: "Physical Button Controls", status: "DRAFT" }, 6, 8),
    audit(ASH, "APPROVE", "SubRequirement", SR9_3, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 9),

    // PR10 SRs
    audit(PROF_OAK, "CREATE", "SubRequirement", SR10_1, { title: "Service Port Update Path", status: "DRAFT" }, 6, 10),
    audit(ASH, "APPROVE", "SubRequirement", SR10_1, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 11),
    audit(PROF_OAK, "CREATE", "SubRequirement", SR10_2, { title: "Firmware Rollback Mechanism", status: "DRAFT" }, 6, 12),
    audit(ASH, "APPROVE", "SubRequirement", SR10_2, { status: { from: "DRAFT", to: "APPROVED" } }, 6, 13),
    audit(PROF_OAK, "CREATE", "SubRequirement", SR10_3, { title: "Wireless Update Protocol", status: "DRAFT" }, 6, 14),
    // SR10_3 stays DRAFT (coverage gap - no TP)

    // ── Days 7-10: Test Procedures and Versions ─────────────

    // TP1 + TPV1
    audit(JAMES, "CREATE", "TestProcedure", TP1, { title: "Camera Sensor Validation" }, 7, 0),
    audit(JAMES, "CREATE_VERSION", "TestProcedureVersion", TPV1, { versionNumber: 1, status: "DRAFT" }, 7, 1),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV1, { status: { from: "DRAFT", to: "APPROVED" } }, 7, 2),

    // TP2 + TPV2
    audit(JESSIE, "CREATE", "TestProcedure", TP2, { title: "Recognition Algorithm Accuracy" }, 7, 3),
    audit(JESSIE, "CREATE_VERSION", "TestProcedureVersion", TPV2, { versionNumber: 1, status: "DRAFT" }, 7, 4),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV2, { status: { from: "DRAFT", to: "APPROVED" } }, 7, 5),

    // TP3 + TPV3
    audit(JAMES, "CREATE", "TestProcedure", TP3, { title: "Database Load and Query Performance" }, 7, 6),
    audit(JAMES, "CREATE_VERSION", "TestProcedureVersion", TPV3, { versionNumber: 1, status: "DRAFT" }, 7, 7),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV3, { status: { from: "DRAFT", to: "APPROVED" } }, 7, 8),

    // TP4 + TPV4
    audit(JAMES, "CREATE", "TestProcedure", TP4, { title: "Search Filter Verification" }, 8, 0),
    audit(JAMES, "CREATE_VERSION", "TestProcedureVersion", TPV4, { versionNumber: 1, status: "DRAFT" }, 8, 1),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV4, { status: { from: "DRAFT", to: "APPROVED" } }, 8, 2),

    // TP5 + TPV5
    audit(BROCK, "CREATE", "TestProcedure", TP5, { title: "Speaker Output Quality Test" }, 8, 3),
    audit(BROCK, "CREATE_VERSION", "TestProcedureVersion", TPV5, { versionNumber: 1, status: "DRAFT" }, 8, 4),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV5, { status: { from: "DRAFT", to: "APPROVED" } }, 8, 5),

    // TP6 + TPV6
    audit(PROF_OAK, "CREATE", "TestProcedure", TP6, { title: "Audio Codec Fidelity Validation" }, 8, 6),
    audit(PROF_OAK, "CREATE_VERSION", "TestProcedureVersion", TPV6, { versionNumber: 1, status: "DRAFT" }, 8, 7),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV6, { status: { from: "DRAFT", to: "APPROVED" } }, 8, 8),

    // TP7 + TPV7
    audit(BROCK, "CREATE", "TestProcedure", TP7, { title: "Enclosure Seal Integrity Test" }, 9, 0),
    audit(BROCK, "CREATE_VERSION", "TestProcedureVersion", TPV7, { versionNumber: 1, status: "DRAFT" }, 9, 1),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV7, { status: { from: "DRAFT", to: "APPROVED" } }, 9, 2),

    // TP8 + TPV8
    audit(BROCK, "CREATE", "TestProcedure", TP8, { title: "Drop Impact Survival Test" }, 9, 3),
    audit(BROCK, "CREATE_VERSION", "TestProcedureVersion", TPV8, { versionNumber: 1, status: "DRAFT" }, 9, 4),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV8, { status: { from: "DRAFT", to: "APPROVED" } }, 9, 5),

    // TP9 + TPV9 (will be canceled later)
    audit(JESSIE, "CREATE", "TestProcedure", TP9, { title: "Bluetooth Synchronization Test" }, 9, 6),
    audit(JESSIE, "CREATE_VERSION", "TestProcedureVersion", TPV9, { versionNumber: 1, status: "DRAFT" }, 9, 7),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV9, { status: { from: "DRAFT", to: "APPROVED" } }, 9, 8),

    // TP10 + TPV10
    audit(JESSIE, "CREATE", "TestProcedure", TP10, { title: "Map Rendering Performance Test" }, 10, 0),
    audit(JESSIE, "CREATE_VERSION", "TestProcedureVersion", TPV10, { versionNumber: 1, status: "DRAFT" }, 10, 1),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV10, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 2),

    // TP11 + TPV11
    audit(GARY, "CREATE", "TestProcedure", TP11, { title: "Area Overlay Accuracy Test" }, 10, 3),
    audit(GARY, "CREATE_VERSION", "TestProcedureVersion", TPV11, { versionNumber: 1, status: "DRAFT" }, 10, 4),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV11, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 5),

    // TP12 + TPV12
    audit(JAMES, "CREATE", "TestProcedure", TP12, { title: "Battery Endurance Test" }, 10, 6),
    audit(JAMES, "CREATE_VERSION", "TestProcedureVersion", TPV12, { versionNumber: 1, status: "DRAFT" }, 10, 7),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV12, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 8),

    // TP13 + TPV13
    audit(PROF_OAK, "CREATE", "TestProcedure", TP13, { title: "Power Management Efficiency Test" }, 10, 9),
    audit(PROF_OAK, "CREATE_VERSION", "TestProcedureVersion", TPV13, { versionNumber: 1, status: "DRAFT" }, 10, 10),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV13, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 11),

    // TP14 + TPV14
    audit(JESSIE, "CREATE", "TestProcedure", TP14, { title: "LCD Brightness and Contrast Test" }, 10, 12),
    audit(JESSIE, "CREATE_VERSION", "TestProcedureVersion", TPV14, { versionNumber: 1, status: "DRAFT" }, 10, 13),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV14, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 14),

    // TP15 + TPV15
    audit(JESSIE, "CREATE", "TestProcedure", TP15, { title: "Touch Input Accuracy Test" }, 10, 15),
    audit(JESSIE, "CREATE_VERSION", "TestProcedureVersion", TPV15, { versionNumber: 1, status: "DRAFT" }, 10, 16),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV15, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 17),

    // TP16 + TPV16
    audit(JAMES, "CREATE", "TestProcedure", TP16, { title: "Button Response Time Test" }, 10, 18),
    audit(JAMES, "CREATE_VERSION", "TestProcedureVersion", TPV16, { versionNumber: 1, status: "DRAFT" }, 10, 19),
    audit(JESSIE, "APPROVE", "TestProcedureVersion", TPV16, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 20),

    // TP17 + TPV17
    audit(PROF_OAK, "CREATE", "TestProcedure", TP17, { title: "Service Port Firmware Update Test" }, 10, 21),
    audit(PROF_OAK, "CREATE_VERSION", "TestProcedureVersion", TPV17, { versionNumber: 1, status: "DRAFT" }, 10, 22),
    audit(JAMES, "APPROVE", "TestProcedureVersion", TPV17, { status: { from: "DRAFT", to: "APPROVED" } }, 10, 23),

    // TP18 + TPV18 (stays DRAFT)
    audit(PROF_OAK, "CREATE", "TestProcedure", TP18, { title: "Firmware Rollback Verification Test" }, 10, 24),
    audit(PROF_OAK, "CREATE_VERSION", "TestProcedureVersion", TPV18, { versionNumber: 1, status: "DRAFT" }, 10, 25),

    // ── Days 11-13: Test Case Creation ──────────────────────

    audit(JAMES, "CREATE", "TestCase", TC1, { title: "Camera autofocus locks on target at 3m" }, 11, 0),
    audit(JESSIE, "CREATE", "TestCase", TC2, { title: "Species recognition accuracy meets 95% target" }, 11, 1),
    audit(JAMES, "CREATE", "TestCase", TC3, { title: "Database loads and queries within 500ms" }, 11, 2),
    audit(JAMES, "CREATE", "TestCase", TC4, { title: "Search and filter results are correct and sorted" }, 11, 3),
    audit(BROCK, "CREATE", "TestCase", TC5, { title: "Speaker THD within limits at all volume levels" }, 11, 4),
    audit(PROF_OAK, "CREATE", "TestCase", TC6, { title: "Audio codec decodes all cry formats correctly" }, 11, 5),
    audit(BROCK, "CREATE", "TestCase", TC7, { title: "Enclosure passes IP54 dust and splash test" }, 12, 0),
    audit(BROCK, "CREATE", "TestCase", TC8, { title: "Device survives 1.5m drop on all faces" }, 12, 1),
    audit(JESSIE, "CREATE", "TestCase", TC9, { title: "Bluetooth sync completes within 30 seconds" }, 12, 2),
    audit(JESSIE, "CREATE", "TestCase", TC10, { title: "Map scrolls at 15fps across Kanto region" }, 12, 3),
    audit(GARY, "CREATE", "TestCase", TC11, { title: "Habitat overlay matches encounter data" }, 12, 4),
    audit(JAMES, "CREATE", "TestCase", TC12, { title: "Battery lasts 72 hours under field usage profile" }, 12, 5),
    audit(PROF_OAK, "CREATE", "TestCase", TC13, { title: "Power management reduces idle draw by 60%" }, 12, 6),
    audit(JESSIE, "CREATE", "TestCase", TC14, { title: "LCD brightness exceeds 500 nits" }, 13, 0),
    audit(JESSIE, "CREATE", "TestCase", TC15, { title: "Touch input accuracy within 2mm average" }, 13, 1),
    audit(JAMES, "CREATE", "TestCase", TC16, { title: "All buttons respond within 50ms" }, 13, 2),
    audit(PROF_OAK, "CREATE", "TestCase", TC17, { title: "Firmware update via service port succeeds" }, 13, 3),
    audit(PROF_OAK, "CREATE", "TestCase", TC18, { title: "Firmware rollback restores previous version" }, 13, 4),

    // ── Days 14-18: Test Execution ──────────────────────────

    // Day 14: Scanner tests pass
    audit(MISTY, "RECORD_RESULT", "TestCase", TC1, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 14, 2),
    audit(JESSIE, "RECORD_RESULT", "TestCase", TC2, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 14, 4),

    // Day 15: Database and audio codec tests
    audit(MISTY, "RECORD_RESULT", "TestCase", TC3, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 15, 1),
    audit(PROF_OAK, "RECORD_RESULT", "TestCase", TC6, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 15, 5),

    // Day 16: Enclosure, LCD, and speaker tests
    audit(BROCK, "RECORD_RESULT", "TestCase", TC7, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 16, 2),
    audit(JESSIE, "RECORD_RESULT", "TestCase", TC14, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 16, 4),
    audit(JESSIE, "RECORD_RESULT", "TestCase", TC5, { status: { from: "PENDING", to: "FAILED" }, result: "FAIL" }, 16, 6),

    // Day 17: Map, battery, firmware, and power tests
    audit(PROF_OAK, "RECORD_RESULT", "TestCase", TC17, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 17, 1),
    audit(MISTY, "RECORD_RESULT", "TestCase", TC10, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 17, 3),
    audit(JAMES, "RECORD_RESULT", "TestCase", TC12, { status: { from: "PENDING", to: "PASSED" }, result: "PASS" }, 17, 5),
    audit(PROF_OAK, "RECORD_RESULT", "TestCase", TC13, { status: { from: "PENDING", to: "BLOCKED" }, result: "BLOCKED" }, 17, 7),

    // Day 18: Touch accuracy failure
    audit(JESSIE, "RECORD_RESULT", "TestCase", TC15, { status: { from: "PENDING", to: "FAILED" }, result: "FAIL" }, 18, 2),

    // ── Day 19: Cancellation cascade ────────────────────────
    // Ash cancels PR5 -> SR5_1 canceled -> TP9 canceled -> TC9 skipped

    audit(ASH, "CANCEL", "ProductRequirement", PR5, { status: { from: "APPROVED", to: "CANCELED" } }, 19, 0),
    audit(ASH, "CANCEL", "SubRequirement", SR5_1, { status: { from: "APPROVED", to: "CANCELED" } }, 19, 1),
    audit(JESSIE, "CANCEL", "TestProcedure", TP9, { status: { from: "ACTIVE", to: "CANCELED" } }, 19, 2),
    audit(JESSIE, "SKIP", "TestCase", TC9, { status: { from: "PENDING", to: "SKIPPED" }, result: "SKIPPED" }, 19, 3),

    // ── Day 20: Multi-version and follow-up ─────────────────
    // Jessie creates v2 of TP1 (adds cold-start focus test after TC1 passed)
    // Brock adds TC20 to investigate speaker distortion failure

    audit(JESSIE, "CREATE_VERSION", "TestProcedureVersion", TPV1B, { versionNumber: 2, status: "DRAFT" }, 20, 0),
    audit(JESSIE, "CREATE", "TestCase", TC19, { title: "Camera cold-start focus within 5 seconds" }, 20, 1),
    audit(BROCK, "CREATE", "TestCase", TC20, { title: "Speaker frequency response across cry range" }, 20, 2),

    // ── Attachment uploads (scattered across timeline) ──────

    audit(PROF_OAK, "ADD_ATTACHMENT", "Attachment", ATT1, { fileName: "scanner-calibration-data.xlsx" }, 3, 1),
    audit(BROCK, "ADD_ATTACHMENT", "Attachment", ATT2, { fileName: "casing-drop-test-report.pdf" }, 16, 3),
    audit(JESSIE, "ADD_ATTACHMENT", "Attachment", ATT3, { fileName: "speaker-frequency-response.png" }, 16, 7),
    audit(BROCK, "ADD_ATTACHMENT", "Attachment", ATT4, { fileName: "clamshell-hinge-diagram.png" }, 4, 7),
    audit(PROF_OAK, "ADD_ATTACHMENT", "Attachment", ATT5, { fileName: "pokemon-silhouette-test-set.pdf" }, 7, 4),
    audit(JAMES, "ADD_ATTACHMENT", "Attachment", ATT6, { fileName: "battery-discharge-curve.xlsx" }, 17, 6),

    // ── Day 16: Ash updates PR3 description after speaker test failure ──

    audit(ASH, "UPDATE", "ProductRequirement", PR3, {
      description: {
        from: "The Pokedex shall play back the recorded cry of any identified Pokemon species through a built-in speaker.",
        to: "The Pokedex shall play back the recorded cry of any identified Pokemon species through a built-in speaker at adjustable volume levels.",
      },
    }, 16, 8),
  ];

  // Sort by createdAt to ensure chronological insertion
  auditEntries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const entry of auditEntries) {
    await prisma.auditLog.create({ data: entry });
  }
  console.log(`  Created ${auditEntries.length} audit log entries.\n`);

  // ── Done ──────────────────────────────────────────────────

  console.log("Seed complete!");
  console.log("  6 teams, 7 users (Pokemon cast)");
  console.log("  10 product requirements (8 APPROVED, 1 CANCELED, 1 DRAFT)");
  console.log("  21 sub-requirements (17 APPROVED, 1 CANCELED, 3 DRAFT)");
  console.log("  18 test procedures (17 ACTIVE, 1 CANCELED)");
  console.log("  19 procedure versions (17 APPROVED, 2 DRAFT)");
  console.log("  20 test cases (9 PASSED, 2 FAILED, 7 PENDING, 1 BLOCKED, 1 SKIPPED)");
  console.log("  6 attachments");
  console.log(`  ${auditEntries.length} audit log entries`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
