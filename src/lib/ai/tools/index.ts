// Barrel export - creates all LLM tools as a flat object.
// Pass a RequestContext to bind mutation tools to the current user.

import type { RequestContext } from "@/lib/request-context";
import { createProductRequirementTools } from "./product-requirement-tools";
import { createSubRequirementTools } from "./sub-requirement-tools";
import { createTestProcedureTools } from "./test-procedure-tools";
import { createTestCaseTools } from "./test-case-tools";
import { createAttachmentTools } from "./attachment-tools";
import { createReadTools } from "./read-tools";
import { createQueryTools } from "./query-tools";
import { createUIIntentTools } from "./ui-intent-tools";
import { withTimeout } from "./with-timeout";

/**
 * Creates all LLM tools, bound to the given RequestContext.
 *
 * Mutation tools use the context for auth and audit logging.
 * Read/query tools don't need context (they use Prisma directly).
 * UI intent tools open the context panel in the frontend.
 *
 * Returns a flat object suitable for passing to Vercel AI SDK's streamText().
 */
export function createAllTools(ctx: RequestContext) {
  const tools = {
    ...createProductRequirementTools(ctx),
    ...createSubRequirementTools(ctx),
    ...createTestProcedureTools(ctx),
    ...createTestCaseTools(ctx),
    ...createAttachmentTools(ctx),
    ...createReadTools(),
    ...createQueryTools(),
    ...createUIIntentTools(),
  };

  // Wrap every tool's execute with a 30s timeout.
  // If a tool hangs, the LLM gets an error message instead of the stream dying.
  // Cast needed because the SDK's tool() return type doesn't expose a generic
  // execute accessor. If the SDK renames execute, this loop silently stops
  // wrapping - check on SDK upgrades.
  for (const [name, t] of Object.entries(tools)) {
    const toolObj = t as { execute?: (...args: unknown[]) => Promise<unknown> };
    if (toolObj.execute) {
      toolObj.execute = withTimeout(name, toolObj.execute) as typeof toolObj.execute;
    }
  }

  return tools;
}

// Re-export individual creators for cases where only a subset is needed
export { createProductRequirementTools } from "./product-requirement-tools";
export { createSubRequirementTools } from "./sub-requirement-tools";
export { createTestProcedureTools } from "./test-procedure-tools";
export { createTestCaseTools } from "./test-case-tools";
export { createAttachmentTools } from "./attachment-tools";
export { createReadTools } from "./read-tools";
export { createQueryTools } from "./query-tools";
export { createUIIntentTools } from "./ui-intent-tools";
