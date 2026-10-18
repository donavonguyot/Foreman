import { defineAgent } from "eve";
import { MODELS } from "./lib/models.js";

/**
 * Root agent runtime configuration.
 *
 * @remarks
 * Sets the model and the session budget for Foreman, the software factory
 * orchestrator; the rest of the agent's surface (channels, connections,
 * extensions, tools, skills, subagents) is discovered from the filesystem
 * under `agent/`. Conversation history is compacted once it reaches 75% of
 * the context window. The per-session output token limit caps runaway
 * sessions. Smaller per-station hook budgets normally stop first and leave
 * capacity for the root handoff. The built-in root-copy tool is disabled so
 * work goes through the bounded station wrappers.
 */
export default defineAgent({
  compaction: { thresholdPercent: 0.75 },
  limits: {
    maxOutputTokensPerSession: 45_000,
  },
  model: MODELS.orchestrator,
  tool: false,
});
