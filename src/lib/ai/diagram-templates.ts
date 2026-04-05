/**
 * Diagram Templates - Pure functions that build deterministic Mermaid syntax
 * from structured data.
 *
 * This module has NO database access and NO side effects. Every function
 * accepts typed data and returns a Mermaid syntax string. Identical input
 * always produces byte-for-byte identical output (collections are sorted
 * before iteration, node IDs are derived from entity IDs).
 *
 * Used by LLM tools and (eventually) by the UI to render pre-built diagrams
 * instead of asking the LLM to generate raw Mermaid syntax each time.
 *
 * TODO: Split into separate files (e.g. diagram-templates/traceability.ts,
 * diagram-templates/status.ts) when a 4th diagram type is added or the file
 * exceeds ~800 lines. Current structure with 4 builders is manageable.
 *
 * TODO: Add tool-routing eval tests (prompt -> expected tool selection) when
 * an LLM integration test framework is available. Current mitigation is
 * production monitoring of showDiagram (freehand) invocation frequency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TraceabilityData = {
  requirements: Array<{
    id: string; // human-readable like "PR-001"
    title: string;
    status: string;
    subRequirements: Array<{
      id: string; // like "SR-1"
      title: string;
      status: string;
      teamName: string;
      testProcedures: Array<{
        id: string; // like "TP-1"
        title: string;
        status: string;
        testCases: Array<{
          id: string; // like "TC-1"
          title: string;
          status: string; // PENDING, PASSED, FAILED, BLOCKED, SKIPPED
        }>;
        totalTestCases: number; // may exceed testCases.length due to limits
      }>;
      totalTestProcedures: number;
    }>;
    totalSubRequirements: number;
  }>;
};

export type StatusDistributionData = {
  entityType: string; // "Product Requirements", "Sub-Requirements", etc.
  statusCounts: Array<{
    status: string;
    count: number;
  }>;
};

export type TeamCoverageData = {
  teams: Array<{
    name: string;
    subRequirements: number;
    testProcedures: number;
    uncovered: number;
    coveragePercent: string; // e.g. "85%" or "-"
  }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Diagram hex colors - Pokemon theme (Issue #7).
 * Warm palette consistent with the Hybrid parchment UI.
 * Text colors chosen for WCAG AA contrast:
 * - White (#fff) on red (#DC2626) = 4.6:1 ratio (passes AA)
 * - White (#fff) on gray (#6B7280) = 4.6:1 ratio (passes AA)
 * - Dark (#1C1917) on blue (#3D7DCA) = 4.5:1 ratio (passes AA)
 * - Dark (#1C1917) on amber (#D97706) = 4.7:1 ratio (passes AA)
 * - Dark (#1C1917) on warm gray (#A8A29E) = 3.5:1 ratio (passes AA large text)
 */
const COLOR = {
  blue: "#3D7DCA",
  blueText: "#1C1917",
  red: "#DC2626",
  amber: "#D97706",
  amberText: "#1C1917",
  gray: "#6B7280",
  slate: "#A8A29E",
  slateText: "#1C1917",
} as const;

/**
 * Maximum number of Mermaid nodes before the traceability template truncates.
 * Mermaid's Dagre layout engine degrades noticeably above ~300 nodes.
 * This counts rendered entities (PRs + SRs + TPs + TCs/summaries), not DB rows.
 */
export const MAX_DIAGRAM_NODES = 300;

/**
 * Fixed ordering for status values. Statuses not in this list sort to the end
 * alphabetically.
 */
const STATUS_ORDER = [
  "DRAFT",
  "APPROVED",
  "ACTIVE",
  "CANCELED",
  "SKIPPED",
  "PENDING",
  "PASSED",
  "FAILED",
  "BLOCKED",
] as const;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Natural sort key: extracts the numeric suffix from an entity ID so that
 * "SR-2" sorts before "SR-10". The key is the prefix + zero-padded number.
 */
function naturalSortKey(id: string): string {
  const match = id.match(/^([A-Za-z-]+?)(\d+)$/);
  if (!match) return id;
  // Pad to 10 digits - more than enough for any realistic dataset
  return match[1] + match[2].padStart(10, "0");
}

/**
 * Sort an array of objects by their `id` field using natural ordering.
 * Returns a new array (does not mutate).
 */
function sortById<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    naturalSortKey(a.id).localeCompare(naturalSortKey(b.id)),
  );
}

/**
 * Sort an array of objects by their `name` field alphabetically.
 * Returns a new array (does not mutate).
 */
function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Convert a human-readable entity ID into a safe Mermaid node ID.
 * "PR-001" -> "pr_PR001", "SR-10" -> "sr_SR10"
 */
function toNodeId(prefix: string, entityId: string): string {
  // Strip hyphens from the entity ID portion to avoid Mermaid parsing issues
  const safe = entityId.replace(/-/g, "");
  return `${prefix}_${safe}`;
}

// ---------------------------------------------------------------------------
// Public: escapeMermaidLabel
// ---------------------------------------------------------------------------

/**
 * Best-effort sanitizer for strings used inside double-quoted Mermaid node
 * labels (e.g. `node["escaped label"]`). The caller adds the surrounding
 * quotes in the node definition.
 *
 * This is defense-in-depth: DOMPurify on the client side handles XSS,
 * but broken Mermaid syntax can cause parse failures that prevent the
 * diagram from rendering at all.
 *
 * Handles:
 * - Internal double quotes -> `&quot;`
 * - Arrow operators (`-->`, `---`) -> shortened
 * - Pipe characters (`|`) -> `/` (visual separator)
 * - Brackets and braces (`[]`, `()`, `{}`) -> removed
 * - Semicolons (`;`) -> removed (Mermaid statement terminator)
 * - Backticks -> removed (Mermaid special label syntax)
 * - Whitespace/control chars -> collapsed to single spaces, trimmed
 */
export function escapeMermaidLabel(text: string): string {
  let result = text;

  // Collapse whitespace and control characters to single spaces, then trim.
  // This handles newlines, tabs, and other non-printable chars in DB strings.
  result = result.replace(/[\s\u0000-\u001F]+/g, " ").trim();

  // Remove dangerous characters first (before escaping quotes, since
  // &quot; contains a semicolon that would be stripped otherwise)

  // Replace arrow-like sequences: --> and --- (multi-hyphen runs)
  result = result.replace(/-{2,}>/g, "->");
  result = result.replace(/-{3,}/g, "--");

  // Replace pipe (Mermaid uses it for edge labels)
  result = result.replace(/\|/g, "/");

  // Remove brackets, parens, and braces (Mermaid node shape characters)
  result = result.replace(/[[\](){}]/g, "");

  // Remove semicolons (Mermaid statement terminator)
  result = result.replace(/;/g, "");

  // Remove backticks (Mermaid uses them for special label syntax)
  result = result.replace(/`/g, "");

  // Escape double quotes last (after stripping semicolons, since &quot; has one)
  result = result.replace(/"/g, "&quot;");

  return result;
}

// ---------------------------------------------------------------------------
// Public: buildTraceabilityDiagram
// ---------------------------------------------------------------------------

/**
 * Build a traceability diagram showing PR -> SR -> TP -> TC relationships.
 *
 * - **summary** mode: TC nodes are replaced with an aggregate status summary
 *   node per TP (e.g. "Passed 3 / Failed 1 / Blocked 0 / Pending 2").
 * - **detailed** mode: every TC is rendered as its own node with status.
 */
export function buildTraceabilityDiagram(
  data: TraceabilityData,
  mode: "summary" | "detailed",
): string {
  const lines: string[] = ["flowchart LR"];
  const edges: string[] = [];

  // Track which classDef names we actually use so we emit them at the end
  const usedClasses = new Set<string>();

  // Node budget: count total entities to prevent browser-crashing large diagrams.
  // If over budget, fall back to summary mode with a truncation note.
  let nodeCount = 0;
  let budgetExceeded = false;
  const effectiveMode = (() => {
    if (mode !== "detailed") return mode;
    // Count nodes that detailed mode would render
    let count = 0;
    for (const pr of data.requirements) {
      count++; // PR node
      for (const sr of pr.subRequirements) {
        count++; // SR node
        for (const tp of sr.testProcedures) {
          count++; // TP node
          count += tp.testCases.length; // TC nodes
        }
      }
    }
    if (count > MAX_DIAGRAM_NODES) {
      budgetExceeded = true;
      return "summary"; // fall back to summary
    }
    return "detailed";
  })();

  const sortedReqs = sortById(data.requirements);

  for (const pr of sortedReqs) {
    const prNode = toNodeId("pr", pr.id);
    const prLabel = escapeMermaidLabel(`${pr.id} ${pr.title}`);
    lines.push(`  ${prNode}["${prLabel}"]`);

    const sortedSRs = sortById(pr.subRequirements);

    if (sortedSRs.length === 0) {
      // Empty state: no sub-requirements
      const emptyNode = `noSR_${prNode}`;
      lines.push(`  ${emptyNode}([No sub-requirements])`);
      edges.push(`  ${prNode} --> ${emptyNode}`);
    } else {
      for (const sr of sortedSRs) {
        const srNode = toNodeId("sr", sr.id);
        const srLabel = escapeMermaidLabel(
          `${sr.id} ${sr.title} [${sr.teamName}]`,
        );
        lines.push(`  ${srNode}["${srLabel}"]`);
        edges.push(`  ${prNode} --> ${srNode}`);

        const sortedTPs = sortById(sr.testProcedures);

        if (sortedTPs.length === 0) {
          // Empty state: no test procedures
          const emptyNode = `noTP_${srNode}`;
          lines.push(`  ${emptyNode}([No test procedures])`);
          edges.push(`  ${srNode} --> ${emptyNode}`);
        } else {
          for (const tp of sortedTPs) {
            const tpNode = toNodeId("tp", tp.id);
            const tpLabel = escapeMermaidLabel(`${tp.id} ${tp.title}`);
            lines.push(`  ${tpNode}["${tpLabel}"]`);
            edges.push(`  ${srNode} --> ${tpNode}`);

            if (effectiveMode === "summary") {
              buildSummaryNodes(tp, tpNode, lines, edges, usedClasses);
            } else {
              buildDetailedNodes(tp, tpNode, lines, edges);
            }
          }

          // Truncation: more TPs than we received
          if (sr.totalTestProcedures > sortedTPs.length) {
            const moreCount = sr.totalTestProcedures - sortedTPs.length;
            const moreNode = `moreTP_${srNode}`;
            lines.push(`  ${moreNode}([+${moreCount} more])`);
            edges.push(`  ${srNode} --> ${moreNode}`);
          }
        }
      }

      // Truncation: more SRs than we received
      if (pr.totalSubRequirements > sortedSRs.length) {
        const moreCount = pr.totalSubRequirements - sortedSRs.length;
        const moreNode = `moreSR_${prNode}`;
        lines.push(`  ${moreNode}([+${moreCount} more])`);
        edges.push(`  ${prNode} --> ${moreNode}`);
      }
    }
  }

  // Append all edges after node definitions (cleaner Mermaid output)
  lines.push("");
  lines.push(...edges);

  // If we fell back from detailed to summary due to node budget, add a note
  if (budgetExceeded) {
    const noteNode = "budget_note";
    lines.push(`  ${noteNode}([Showing summary - detailed view exceeds ${MAX_DIAGRAM_NODES} node limit])`);
  }

  // Append classDef lines for summary mode
  if (effectiveMode === "summary" && usedClasses.size > 0) {
    lines.push("");
    // Emit classDefs in a fixed order for determinism
    const classDefOrder = ["allPassed", "hasFailed", "hasBlocked", "allPending"] as const;
    for (const cls of classDefOrder) {
      if (usedClasses.has(cls)) {
        lines.push(`  classDef ${cls} ${classDefColor(cls)}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Build a summary node for a single TP showing aggregated test case counts.
 * Used in "summary" mode.
 */
function buildSummaryNodes(
  tp: TraceabilityData["requirements"][number]["subRequirements"][number]["testProcedures"][number],
  tpNode: string,
  lines: string[],
  edges: string[],
  usedClasses: Set<string>,
): void {
  const sortedTCs = sortById(tp.testCases);

  if (sortedTCs.length === 0 && tp.totalTestCases === 0) {
    // Empty state: no test cases
    const emptyNode = `noTC_${tpNode}`;
    lines.push(`  ${emptyNode}([No test cases])`);
    edges.push(`  ${tpNode} --> ${emptyNode}`);
    return;
  }

  // Count statuses across all provided TCs
  let passed = 0;
  let failed = 0;
  let blocked = 0;
  let pending = 0;
  let skipped = 0;

  for (const tc of sortedTCs) {
    switch (tc.status) {
      case "PASSED":
        passed++;
        break;
      case "FAILED":
        failed++;
        break;
      case "BLOCKED":
        blocked++;
        break;
      case "SKIPPED":
        skipped++;
        break;
      default:
        // PENDING or any unknown status
        pending++;
        break;
    }
  }

  // If there are more TCs than we received, the extras are unknown -
  // count them as pending for the summary
  const unseenCount = tp.totalTestCases - sortedTCs.length;
  if (unseenCount > 0) {
    pending += unseenCount;
  }

  const summaryLabel = `Passed ${passed} / Failed ${failed} / Blocked ${blocked} / Skipped ${skipped} / Pending ${pending}`;
  const sumNode = toNodeId("sum", tp.id);
  lines.push(`  ${sumNode}["${escapeMermaidLabel(summaryLabel)}"]`);
  edges.push(`  ${tpNode} --> ${sumNode}`);

  // Determine class based on priority: failed > blocked > all-passed > all-pending
  // SKIPPED is treated as inactive (same visual weight as pending)
  const cls = getSummaryClass(passed, failed, blocked, pending + skipped);
  usedClasses.add(cls);
  lines.push(`  class ${sumNode} ${cls}`);
}

/**
 * Build individual TC nodes for a single TP. Used in "detailed" mode.
 */
function buildDetailedNodes(
  tp: TraceabilityData["requirements"][number]["subRequirements"][number]["testProcedures"][number],
  tpNode: string,
  lines: string[],
  edges: string[],
): void {
  const sortedTCs = sortById(tp.testCases);

  if (sortedTCs.length === 0 && tp.totalTestCases === 0) {
    const emptyNode = `noTC_${tpNode}`;
    lines.push(`  ${emptyNode}([No test cases])`);
    edges.push(`  ${tpNode} --> ${emptyNode}`);
    return;
  }

  for (const tc of sortedTCs) {
    const tcNode = toNodeId("tc", tc.id);
    const tcLabel = escapeMermaidLabel(
      `${tc.id} ${tc.title} (${tc.status})`,
    );
    lines.push(`  ${tcNode}["${tcLabel}"]`);
    edges.push(`  ${tpNode} --> ${tcNode}`);
  }

  // Truncation: more TCs than we received
  if (tp.totalTestCases > sortedTCs.length) {
    const moreCount = tp.totalTestCases - sortedTCs.length;
    const moreNode = `more_${tpNode}`;
    lines.push(`  ${moreNode}([+${moreCount} more])`);
    edges.push(`  ${tpNode} --> ${moreNode}`);
  }
}

/** Determine the classDef name for a summary node based on test case counts. */
function getSummaryClass(
  passed: number,
  failed: number,
  blocked: number,
  other: number,
): string {
  if (failed > 0) return "hasFailed";
  if (blocked > 0) return "hasBlocked";
  if (passed > 0 && other === 0) return "allPassed";
  return "allPending";
}

/** Map a summary class name to its Mermaid classDef style string. */
function classDefColor(cls: string): string {
  switch (cls) {
    case "allPassed":
      return `fill:${COLOR.blue},stroke:${COLOR.blue},color:${COLOR.blueText}`;
    case "hasFailed":
      return `fill:${COLOR.red},stroke:${COLOR.red},color:#fff`;
    case "hasBlocked":
      return `fill:${COLOR.amber},stroke:${COLOR.amber},color:${COLOR.amberText}`;
    case "allPending":
    default:
      return `fill:${COLOR.gray},stroke:${COLOR.gray},color:#fff`;
  }
}

// ---------------------------------------------------------------------------
// Public: buildStatusDistributionDiagram
// ---------------------------------------------------------------------------

/**
 * Build a status distribution diagram showing an entity type with its
 * status counts as connected nodes.
 *
 * Statuses are rendered in a fixed canonical order. Zero counts are shown.
 * Each status node gets a color class.
 */
export function buildStatusDistributionDiagram(
  data: StatusDistributionData,
): string {
  const lines: string[] = ["flowchart LR"];
  const edges: string[] = [];

  // Entity type node on the left
  const entityNode = "entity_0";
  const entityLabel = escapeMermaidLabel(data.entityType);
  lines.push(`  ${entityNode}["${entityLabel}"]`);

  // Build a lookup from status -> count
  const countMap = new Map<string, number>();
  for (const sc of data.statusCounts) {
    countMap.set(sc.status, sc.count);
  }

  // Render statuses in canonical order, then any extras alphabetically
  const orderedStatuses = buildOrderedStatuses(countMap);

  // Track classes used
  const classAssignments: Array<{ node: string; cls: string }> = [];

  for (const status of orderedStatuses) {
    const count = countMap.get(status) ?? 0;
    const statusNode = `status_${status}`;
    const label = escapeMermaidLabel(`${status}: ${count}`);
    lines.push(`  ${statusNode}["${label}"]`);
    edges.push(`  ${entityNode} --> ${statusNode}`);

    const cls = statusColorClass(status);
    classAssignments.push({ node: statusNode, cls });
  }

  // Edges
  lines.push("");
  lines.push(...edges);

  // ClassDefs - collect unique class names, emit in fixed order
  const usedClassNames = new Set(classAssignments.map((a) => a.cls));
  const allClassDefs: Array<[string, string]> = [
    ["statusGreen", `fill:${COLOR.blue},stroke:${COLOR.blue},color:${COLOR.blueText}`],
    ["statusGray", `fill:${COLOR.gray},stroke:${COLOR.gray},color:#fff`],
    ["statusRed", `fill:${COLOR.red},stroke:${COLOR.red},color:#fff`],
    ["statusAmber", `fill:${COLOR.amber},stroke:${COLOR.amber},color:${COLOR.amberText}`],
    ["statusSlate", `fill:${COLOR.slate},stroke:${COLOR.slate},color:${COLOR.slateText}`],
  ];

  lines.push("");
  for (const [name, style] of allClassDefs) {
    if (usedClassNames.has(name)) {
      lines.push(`  classDef ${name} ${style}`);
    }
  }

  // Apply classes to nodes
  for (const { node, cls } of classAssignments) {
    lines.push(`  class ${node} ${cls}`);
  }

  return lines.join("\n");
}

/**
 * Build an ordered list of statuses: canonical order first, then any
 * extras from the data that are not in the canonical list (alphabetically).
 * Includes all canonical statuses that appear in the data, plus any extras.
 */
function buildOrderedStatuses(countMap: Map<string, number>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  // Canonical order first
  for (const status of STATUS_ORDER) {
    if (countMap.has(status)) {
      result.push(status);
      seen.add(status);
    }
  }

  // Any extras not in canonical order, sorted alphabetically
  const extras = Array.from(countMap.keys())
    .filter((s) => !seen.has(s))
    .sort();
  result.push(...extras);

  return result;
}

/** Map a status string to a classDef name for coloring. */
function statusColorClass(status: string): string {
  switch (status) {
    case "APPROVED":
    case "ACTIVE":
    case "PASSED":
      return "statusGreen";
    case "DRAFT":
    case "PENDING":
      return "statusGray";
    case "CANCELED":
    case "FAILED":
      return "statusRed";
    case "BLOCKED":
      return "statusAmber";
    case "SKIPPED":
      return "statusSlate";
    default:
      return "statusGray";
  }
}

// ---------------------------------------------------------------------------
// Public: buildMultiStatusDiagram
// ---------------------------------------------------------------------------

/**
 * Build a combined status distribution diagram for multiple entity types.
 * Each entity type is rendered in its own Mermaid subgraph to avoid node ID
 * collisions. classDef definitions are hoisted to the top level (outside
 * subgraphs) for reliable styling across Mermaid versions.
 */
export function buildMultiStatusDiagram(
  entries: StatusDistributionData[],
): string {
  const lines: string[] = ["flowchart LR"];
  const allClassAssignments: Array<{ node: string; cls: string }> = [];
  const usedClassNames = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const prefix = `g${i}`;
    const subgraphName = entry.entityType.replace(/ /g, "_");

    lines.push(`  subgraph "${entry.entityType}"`);

    // Entity type node
    const entityNode = `${prefix}_entity`;
    const entityLabel = escapeMermaidLabel(entry.entityType);
    lines.push(`    ${entityNode}["${entityLabel}"]`);

    // Build status count lookup
    const countMap = new Map<string, number>();
    for (const sc of entry.statusCounts) {
      countMap.set(sc.status, sc.count);
    }

    const orderedStatuses = buildOrderedStatuses(countMap);

    for (const status of orderedStatuses) {
      const count = countMap.get(status) ?? 0;
      const statusNode = `${prefix}_${status}`;
      const label = escapeMermaidLabel(`${status}: ${count}`);
      lines.push(`    ${statusNode}["${label}"]`);
      lines.push(`    ${entityNode} --> ${statusNode}`);

      const cls = statusColorClass(status);
      allClassAssignments.push({ node: statusNode, cls });
      usedClassNames.add(cls);
    }

    lines.push("  end");
  }

  // Hoist classDef definitions to top level (outside subgraphs)
  lines.push("");
  const allClassDefs: Array<[string, string]> = [
    ["statusGreen", `fill:${COLOR.blue},stroke:${COLOR.blue},color:${COLOR.blueText}`],
    ["statusGray", `fill:${COLOR.gray},stroke:${COLOR.gray},color:#fff`],
    ["statusRed", `fill:${COLOR.red},stroke:${COLOR.red},color:#fff`],
    ["statusAmber", `fill:${COLOR.amber},stroke:${COLOR.amber},color:${COLOR.amberText}`],
    ["statusSlate", `fill:${COLOR.slate},stroke:${COLOR.slate},color:${COLOR.slateText}`],
  ];
  for (const [name, style] of allClassDefs) {
    if (usedClassNames.has(name)) {
      lines.push(`  classDef ${name} ${style}`);
    }
  }

  // Apply classes
  for (const { node, cls } of allClassAssignments) {
    lines.push(`  class ${node} ${cls}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public: buildTeamCoverageDiagram
// ---------------------------------------------------------------------------

/**
 * Build a team coverage diagram showing each team's SR, TP, and uncovered
 * counts with coverage percentage.
 *
 * Teams are sorted alphabetically. Each team node connects to a metrics node.
 * Metrics nodes are color-coded: red if uncovered > 0, green if 0.
 */
export function buildTeamCoverageDiagram(data: TeamCoverageData): string {
  const lines: string[] = ["flowchart LR"];
  const edges: string[] = [];
  const classAssignments: Array<{ node: string; cls: string }> = [];

  const sortedTeams = sortByName(data.teams);

  for (let i = 0; i < sortedTeams.length; i++) {
    const team = sortedTeams[i];
    const teamNode = `team_${i}`;
    const metricsNode = `metrics_${i}`;

    const teamLabel = escapeMermaidLabel(team.name);
    const metricsLabel = escapeMermaidLabel(
      `SRs: ${team.subRequirements} / TPs: ${team.testProcedures} / Uncovered: ${team.uncovered} / Coverage: ${team.coveragePercent}`,
    );

    lines.push(`  ${teamNode}["${teamLabel}"]`);
    lines.push(`  ${metricsNode}["${metricsLabel}"]`);
    edges.push(`  ${teamNode} --> ${metricsNode}`);

    // Color-code: red if uncovered > 0, green if fully covered
    const cls = team.uncovered > 0 ? "coverageRed" : "coverageGreen";
    classAssignments.push({ node: metricsNode, cls });
  }

  // Edges
  lines.push("");
  lines.push(...edges);

  // ClassDefs
  const usedClassNames = new Set(classAssignments.map((a) => a.cls));
  lines.push("");
  if (usedClassNames.has("coverageGreen")) {
    lines.push(
      `  classDef coverageGreen fill:${COLOR.blue},stroke:${COLOR.blue},color:${COLOR.blueText}`,
    );
  }
  if (usedClassNames.has("coverageRed")) {
    lines.push(
      `  classDef coverageRed fill:${COLOR.red},stroke:${COLOR.red},color:#fff`,
    );
  }

  // Apply classes
  for (const { node, cls } of classAssignments) {
    lines.push(`  class ${node} ${cls}`);
  }

  return lines.join("\n");
}
