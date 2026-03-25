#!/usr/bin/env node
/**
 * Stop hook for claude-session-manager.
 * Called asynchronously every time Claude responds. Must be efficient.
 * Reads only the tail of the JSONL transcript to extract latest state.
 */

"use strict";

const {
  resolveSlug,
  getCurrentSessionId,
  findJSONLForCwd,
  tailJSONL,
  findPlanReferences,
  extractSummary,
  hasTaskCreate,
  updateSessionJson,
} = require("./utils");

function main() {
  // 1. Determine CWD
  const cwd = process.cwd();

  // 2. Resolve repo slug. If not tracked, exit silently.
  const slug = resolveSlug(cwd);
  if (!slug) return;

  // 3. Get current session ID
  const sessionId = getCurrentSessionId(slug);
  if (!sessionId) return;

  // 4. Find the JSONL file for this session
  //    We need the Claude session ID, which might differ from ours.
  //    Look up the Claude session from active sessions or try with our sessionId.
  //    The JSONL is keyed by Claude's sessionId, not ours. We need to find it.
  //    Strategy: scan active sessions to find one matching our CWD, or look for
  //    recently-modified JSONL files in the project directory.
  const jsonlPath = findJSONLForCwd(cwd);
  if (!jsonlPath) return;

  // 5. Read last ~5 assistant messages (read 20 raw lines since many are non-assistant)
  const messages = tailJSONL(jsonlPath, 20);

  if (messages.length === 0) return;

  // 6. Extract data from the tail
  const summary = extractSummary(messages);
  const planRefs = findPlanReferences(messages);
  const taskCreated = hasTaskCreate(messages);

  // 7. Build updates — only set fields that have values
  const updates = {};

  if (summary) {
    updates.summary = summary;
  }

  if (planRefs.length > 0) {
    updates.planFile = planRefs[0];
  }

  if (taskCreated) {
    updates.taskSessionId = sessionId;
  }

  // Only write if we have something to update
  if (Object.keys(updates).length > 0) {
    updateSessionJson(slug, sessionId, updates);
  }
}

// Run with full error protection
try {
  main();
} catch {
  // Never crash, never block
}
