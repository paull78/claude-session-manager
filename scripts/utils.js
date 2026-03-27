/**
 * Shared utilities for claude-session-manager hooks.
 * Node.js built-in modules only.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const SESSION_MANAGER_DIR = path.join(os.homedir(), ".claude", "session-manager");
const CONFIG_FILE = path.join(SESSION_MANAGER_DIR, "config.json");
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SCHEMA_VERSION = 1;

/**
 * Check if a data object's schema version matches expected.
 * Logs a warning if mismatched but never fails (forward compatibility).
 */
function checkSchemaVersion(data, label) {
  if (data && data.schemaVersion && data.schemaVersion !== SCHEMA_VERSION) {
    process.stderr.write(
      `[claude-session-manager] Warning: ${label} has schemaVersion ${data.schemaVersion}, expected ${SCHEMA_VERSION}. Data may need migration.\n`
    );
  }
}

/**
 * Read and parse config.json. Returns parsed object or null.
 */
function readConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Given CWD, find matching repo slug from config.
 * Mirrors the bash resolve_slug logic but read-only (no auto-track).
 */
function resolveSlug(cwd) {
  const config = readConfig();
  if (!config || !config.repos) return null;

  for (const [slug, entry] of Object.entries(config.repos)) {
    if (entry && entry.path === cwd) {
      return slug;
    }
  }
  return null;
}

/**
 * Convert absolute path to Claude's project encoding.
 * /home/user/projects/my-app -> -home-user-projects-my-app
 */
function encodePath(absPath) {
  return absPath.replace(/\//g, "-");
}

/**
 * Read our plugin's session JSON for a given slug and sessionId.
 */
function readSessionJson(slug, sessionId) {
  try {
    const filePath = path.join(
      SESSION_MANAGER_DIR,
      "repos",
      slug,
      "sessions",
      `${sessionId}.json`
    );
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Read, merge updates, write back atomically (write to .tmp then rename).
 */
function updateSessionJson(slug, sessionId, updates) {
  const filePath = path.join(
    SESSION_MANAGER_DIR,
    "repos",
    slug,
    "sessions",
    `${sessionId}.json`
  );
  const tmpPath = filePath + ".tmp";

  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    // If we can't read the existing file, start fresh
  }

  const merged = { ...existing, ...updates };
  fs.writeFileSync(tmpPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Read the current session ID from .current-session-{slug} marker file.
 */
function getCurrentSessionId(slug) {
  try {
    const markerPath = path.join(SESSION_MANAGER_DIR, `.current-session-${slug}`);
    return fs.readFileSync(markerPath, "utf8").trim();
  } catch {
    return null;
  }
}

/**
 * Read last N lines from a JSONL file efficiently (reads from end of file).
 * Parse each line as JSON, return array of objects.
 * Skips lines that fail JSON.parse.
 */
function tailJSONL(filePath, n) {
  try {
    const fd = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fd);
    const fileSize = stat.size;

    if (fileSize === 0) {
      fs.closeSync(fd);
      return [];
    }

    // Read from the end in chunks to find the last N lines
    const chunkSize = 8192;
    let position = fileSize;
    let buffer = "";
    let lines = [];

    while (position > 0 && lines.length <= n) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const chunk = Buffer.alloc(readSize);
      fs.readSync(fd, chunk, 0, readSize, position);
      buffer = chunk.toString("utf8") + buffer;

      // Split into lines and keep counting
      const parts = buffer.split("\n");
      if (parts.length > n + 1) {
        // We have enough lines
        break;
      }
    }

    fs.closeSync(fd);

    // Split final buffer into lines and take last N non-empty
    const allLines = buffer.split("\n").filter((l) => l.trim().length > 0);
    const lastN = allLines.slice(-n);

    const results = [];
    for (const line of lastN) {
      try {
        results.push(JSON.parse(line));
      } catch {
        // Skip unparseable lines
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Read ALL lines from a JSONL file. Parse each as JSON, skip failures.
 */
function readAllJSONL(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const results = [];
    for (const line of lines) {
      try {
        results.push(JSON.parse(line));
      } catch {
        // Skip unparseable lines
      }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Find the JSONL transcript path for a session by exact sessionId.
 * Looks at ~/.claude/projects/{encodedPath}/{sessionId}.jsonl
 */
function findSessionJSONLPath(cwd, sessionId) {
  const encoded = encodePath(cwd);
  const jsonlPath = path.join(CLAUDE_DIR, "projects", encoded, `${sessionId}.jsonl`);
  if (fs.existsSync(jsonlPath)) {
    return jsonlPath;
  }
  return null;
}

/**
 * Find the most recently modified JSONL file in the Claude projects directory
 * for the given CWD. More robust than exact sessionId matching since Claude's
 * internal session ID differs from our plugin's session ID.
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

/**
 * Find references to ~/.claude/plans/ paths in messages.
 * Looks in assistant text content, tool_use inputs, and user content.
 */
function findPlanReferences(messages) {
  const planPaths = new Set();
  const planPattern = /~\/\.claude\/plans\/[^\s"'`,)}\]]+|\/Users\/[^\s"'`,)}\]]*\/\.claude\/plans\/[^\s"'`,)}\]]+/g;

  for (const msg of messages) {
    if (!msg || !msg.message || !msg.message.content) continue;

    const content = msg.message.content;

    if (typeof content === "string") {
      const matches = content.match(planPattern);
      if (matches) matches.forEach((m) => planPaths.add(m));
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (!block) continue;

        // Text blocks
        if (block.type === "text" && block.text) {
          const matches = block.text.match(planPattern);
          if (matches) matches.forEach((m) => planPaths.add(m));
        }

        // Tool use blocks — check input for file paths
        if (block.type === "tool_use" && block.input) {
          const input = block.input;
          // Check file_path (Write, Edit tools)
          if (typeof input.file_path === "string") {
            const fp = input.file_path;
            if (fp.includes(".claude/plans/")) {
              planPaths.add(fp);
            }
          }
          // Check content and command fields too
          for (const key of ["content", "command", "path"]) {
            if (typeof input[key] === "string") {
              const matches = input[key].match(planPattern);
              if (matches) matches.forEach((m) => planPaths.add(m));
            }
          }
        }
      }
    }
  }

  return Array.from(planPaths);
}

/**
 * Extract key decisions from messages.
 * Looks for decision-indicating patterns and AskUserQuestion tool uses.
 * Returns max 10 decisions, each max ~100 chars.
 */
function extractDecisions(messages) {
  const decisions = [];
  const decisionPatterns = [
    /(?:decided to|chose to|going with|let's go with|the approach is|we'll use|I'll use|opting for|settled on|picked)\s+(.{10,150}?)(?:\.|$|\n)/gi,
  ];

  for (const msg of messages) {
    if (!msg || !msg.message || !msg.message.content) continue;
    if (decisions.length >= 10) break;

    const content = msg.message.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (decisions.length >= 10) break;

        // Check text blocks for decision language
        if (block && block.type === "text" && block.text) {
          for (const pattern of decisionPatterns) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(block.text)) !== null && decisions.length < 10) {
              let decision = match[1].trim();
              if (decision.length > 100) {
                decision = decision.substring(0, 97) + "...";
              }
              if (decision.length >= 10) {
                decisions.push(decision);
              }
            }
          }
        }

        // Check for AskUserQuestion tool uses where user made a choice
        if (
          block &&
          block.type === "tool_use" &&
          block.name === "AskUserQuestion"
        ) {
          // The question itself might be in input.question
          if (block.input && block.input.question) {
            let q = block.input.question.trim();
            if (q.length > 100) q = q.substring(0, 97) + "...";
            if (q.length >= 5) {
              decisions.push("User asked: " + q);
            }
          }
        }
      }
    }
  }

  return decisions.slice(0, 10);
}

/**
 * Read tasks for a session and count by status.
 */
function getTaskSummary(sessionId) {
  const tasksDir = path.join(CLAUDE_DIR, "tasks", sessionId);
  const result = { total: 0, completed: 0, pending: 0, inProgress: 0, tasks: [] };

  try {
    if (!fs.existsSync(tasksDir)) return result;
    const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(tasksDir, file), "utf8");
        const task = JSON.parse(raw);
        result.total++;
        if (task.status === "completed") result.completed++;
        else if (task.status === "in_progress") result.inProgress++;
        else result.pending++;
        result.tasks.push({
          id: task.id,
          subject: task.subject || "",
          status: task.status || "pending",
        });
      } catch {
        // Skip unreadable task files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return result;
}

/**
 * Get git info for a working directory.
 * Returns { branch, commitHash } or nulls on failure.
 */
function getGitInfo(cwd) {
  const result = { branch: null, commitHash: null };
  try {
    result.branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    // not a git repo or git not available
  }
  try {
    result.commitHash = execSync("git rev-parse --short HEAD", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    // ignore
  }
  return result;
}

/**
 * Count commits between two refs.
 */
function getCommitCount(cwd, fromRef, toRef) {
  try {
    const output = execSync(`git rev-list --count ${fromRef}..${toRef}`, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Get git status --short output.
 */
function getGitStatus(cwd) {
  try {
    return execSync("git status --short", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Get the last commit message (one line).
 */
function getLastCommitMessage(cwd) {
  try {
    return execSync("git log --oneline -1 --no-decorate", {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Extract a short summary from the last substantive assistant text message.
 * Returns first text block, truncated to maxLen chars.
 */
function extractSummary(messages, maxLen = 200) {
  // Walk backwards to find the last assistant message with text
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || !msg.message || msg.message.role !== "assistant") continue;
    const content = msg.message.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block && block.type === "text" && block.text && block.text.trim().length > 10) {
        let text = block.text.trim();
        // Take first 1-2 sentences
        const sentenceEnd = text.search(/[.!?]\s/);
        if (sentenceEnd > 20 && sentenceEnd < maxLen) {
          text = text.substring(0, sentenceEnd + 1);
        } else if (text.length > maxLen) {
          text = text.substring(0, maxLen - 3) + "...";
        }
        return text;
      }
    }
  }
  return null;
}

/**
 * Check if any message contains a TaskCreate tool use.
 */
function hasTaskCreate(messages) {
  for (const msg of messages) {
    if (!msg || !msg.message || !Array.isArray(msg.message.content)) continue;
    for (const block of msg.message.content) {
      if (block && block.type === "tool_use" && block.name === "TaskCreate") {
        return true;
      }
    }
  }
  return false;
}

/**
 * Delete the current-session marker file.
 */
function deleteCurrentSessionMarker(slug) {
  try {
    const markerPath = path.join(SESSION_MANAGER_DIR, `.current-session-${slug}`);
    fs.unlinkSync(markerPath);
  } catch {
    // Ignore if already gone
  }
}

module.exports = {
  SESSION_MANAGER_DIR,
  CLAUDE_DIR,
  SCHEMA_VERSION,
  checkSchemaVersion,
  readConfig,
  resolveSlug,
  encodePath,
  readSessionJson,
  updateSessionJson,
  getCurrentSessionId,
  tailJSONL,
  readAllJSONL,
  findSessionJSONLPath,
  findJSONLForCwd,
  findPlanReferences,
  extractDecisions,
  getTaskSummary,
  getGitInfo,
  getCommitCount,
  getGitStatus,
  getLastCommitMessage,
  extractSummary,
  hasTaskCreate,
  deleteCurrentSessionMarker,
};
