#!/usr/bin/env node
/**
 * SessionEnd hook for claude-session-manager.
 * Called asynchronously once when the session closes. Can do more processing.
 * Reads the full JSONL transcript and generates a resume briefing.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
  SESSION_MANAGER_DIR,
  CLAUDE_DIR,
  resolveSlug,
  getCurrentSessionId,
  readSessionJson,
  updateSessionJson,
  readAllJSONL,
  encodePath,
  findPlanReferences,
  extractDecisions,
  extractSummary,
  getTaskSummary,
  getGitInfo,
  getCommitCount,
  getGitStatus,
  getLastCommitMessage,
  deleteCurrentSessionMarker,
} = require("./utils");

function main() {
  // 1. Determine CWD, resolve slug, get session ID
  const cwd = process.cwd();

  const slug = resolveSlug(cwd);
  if (!slug) return;

  const sessionId = getCurrentSessionId(slug);
  if (!sessionId) return;

  // Read our existing session data for startCommit etc.
  const sessionData = readSessionJson(slug, sessionId) || {};

  // 2. Find the JSONL file for this session
  const jsonlPath = findJSONLForCwd(cwd);

  // 3. Read ALL messages from the JSONL
  let messages = [];
  if (jsonlPath) {
    messages = readAllJSONL(jsonlPath);
  }

  // 4. Extract data
  const keyDecisions = messages.length > 0 ? extractDecisions(messages) : [];
  const planRefs = messages.length > 0 ? findPlanReferences(messages) : [];
  const planFile = planRefs.length > 0 ? planRefs[0] : sessionData.planFile || null;
  const taskSummary = getTaskSummary(sessionId);
  const finalSummary = messages.length > 0 ? extractSummary(messages, 300) : sessionData.summary || null;

  // 5. Get git info
  const gitInfo = getGitInfo(cwd);
  const startCommit = sessionData.startCommit || null;
  let commitCount = 0;
  if (startCommit && gitInfo.commitHash) {
    commitCount = getCommitCount(cwd, startCommit, "HEAD");
  }

  // 6. Update session JSON
  const updates = {
    endedAt: new Date().toISOString(),
    endCommit: gitInfo.commitHash || null,
    commitCount,
    keyDecisions,
  };

  if (finalSummary) {
    updates.summary = finalSummary;
  }
  if (planFile) {
    updates.planFile = planFile;
  }

  updateSessionJson(slug, sessionId, updates);

  // 7. Generate briefing markdown
  const branch = gitInfo.branch || sessionData.branch || "unknown";
  const lastCommitMsg = getLastCommitMessage(cwd);
  const gitStatus = getGitStatus(cwd);
  const timestamp = new Date().toISOString();

  let briefing = `# Resume Briefing: ${branch}
Generated: ${timestamp}

## Current State
- **Repo:** ${slug} | **Branch:** ${branch}
- **Last commit:** \`${gitInfo.commitHash || "unknown"}\` ${lastCommitMsg}
- **Uncommitted changes:** ${gitStatus || "none"}
`;

  if (commitCount > 0) {
    briefing += `- **Commits this session:** ${commitCount}\n`;
  }

  briefing += `
## Session Summary
${finalSummary || "No summary available."}

## Key Decisions
`;

  if (keyDecisions.length > 0) {
    for (const d of keyDecisions) {
      briefing += `- ${d}\n`;
    }
  } else {
    briefing += "No key decisions recorded.\n";
  }

  briefing += `
## Plan Progress
`;

  if (planFile) {
    briefing += `Active plan file: \`${planFile}\`\nClaude will read this on resume for detailed plan context.\n`;
  } else {
    briefing += "No plan file referenced in this session.\n";
  }

  briefing += `
## Tasks
`;

  if (taskSummary.total > 0) {
    briefing += `${taskSummary.completed}/${taskSummary.total} tasks completed`;
    if (taskSummary.inProgress > 0) {
      briefing += `, ${taskSummary.inProgress} in progress`;
    }
    if (taskSummary.pending > 0) {
      briefing += `, ${taskSummary.pending} pending`;
    }
    briefing += "\n";

    // List pending and in-progress tasks
    const remaining = taskSummary.tasks.filter(
      (t) => t.status !== "completed"
    );
    if (remaining.length > 0) {
      briefing += "\nRemaining tasks:\n";
      for (const t of remaining) {
        const statusLabel = t.status === "in_progress" ? "[in progress]" : "[pending]";
        briefing += `- ${statusLabel} ${t.subject}\n`;
      }
    }
  } else {
    briefing += "No tasks tracked for this session.\n";
  }

  briefing += `
## Suggested Next Steps
`;

  // Generate suggestions based on what we know
  const suggestions = [];
  const pendingTasks = taskSummary.tasks.filter((t) => t.status !== "completed");
  if (pendingTasks.length > 0) {
    suggestions.push(`Continue with pending tasks (${pendingTasks.length} remaining)`);
  }
  if (planFile) {
    suggestions.push("Review plan file for next steps");
  }
  if (gitStatus) {
    suggestions.push("Review and commit uncommitted changes");
  }
  if (suggestions.length === 0) {
    suggestions.push("Review session summary above and determine next priorities");
  }

  for (const s of suggestions) {
    briefing += `- ${s}\n`;
  }

  // Write briefing file
  const briefingDir = path.join(SESSION_MANAGER_DIR, "repos", slug, "briefings");
  try {
    fs.mkdirSync(briefingDir, { recursive: true });
    const briefingPath = path.join(briefingDir, "latest.md");
    const tmpPath = briefingPath + ".tmp";
    fs.writeFileSync(tmpPath, briefing, "utf8");
    fs.renameSync(tmpPath, briefingPath);
  } catch {
    // Non-critical failure
  }

  // 8. Clean up the .current-session marker
  deleteCurrentSessionMarker(slug);
}

/**
 * Find the most recently modified JSONL file in the Claude projects directory
 * for the given CWD.
 */
function findJSONLForCwd(cwd) {
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
