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
  findSessionJSONLPath,
  tailJSONL,
  findPlanReferences,
  extractSummary,
  hasTaskCreate,
  updateSessionJson,
  readSessionJson,
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

  // 5. Read last 5 assistant messages
  const messages = tailJSONL(jsonlPath, 20); // read more lines to ensure we get ~5 assistant msgs

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
    updates.planFile = planRefs[0]; // Use first plan reference found
  }

  if (taskCreated) {
    updates.taskSessionId = sessionId;
  }

  // Only write if we have something to update
  if (Object.keys(updates).length > 0) {
    updateSessionJson(slug, sessionId, updates);
  }
}

/**
 * Find the most recently modified JSONL file in the Claude projects directory
 * for the given CWD. This is more robust than trying to match session IDs,
 * since Claude's session ID differs from our plugin's session ID.
 */
function findJSONLForCwd(cwd) {
  const path = require("path");
  const fs = require("fs");
  const { encodePath, CLAUDE_DIR } = require("./utils");

  const encoded = encodePath(cwd);
  const projectDir = path.join(CLAUDE_DIR, "projects", encoded);

  try {
    if (!fs.existsSync(projectDir)) return null;

    const files = fs.readdirSync(projectDir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => {
        const fullPath = path.join(projectDir, f);
        try {
          const stat = fs.statSync(fullPath);
          return { path: fullPath, mtime: stat.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);

    // Return the most recently modified JSONL file
    return files.length > 0 ? files[0].path : null;
  } catch {
    return null;
  }
}

// Run with full error protection
try {
  main();
} catch {
  // Never crash, never block
}
