#!/usr/bin/env node

/**
 * Launcher for the claude-session-manager web dashboard.
 * Starts the server on a random available port and opens the browser.
 *
 * Usage:
 *   node scripts/open-dashboard.js
 *   node scripts/open-dashboard.js 3456  (specific port)
 */

const { execSync } = require("child_process");
const path = require("path");

const port = parseInt(process.argv[2] || process.env.PORT || "0", 10);

const serverPath = path.join(__dirname, "..", "web", "server.js");
const { startServer } = require(serverPath);

startServer(port).then(({ server, port: assignedPort }) => {
  const url = `http://127.0.0.1:${assignedPort}`;

  console.log(`\n  claude-session-manager dashboard`);
  console.log(`  ${url}\n`);
  console.log(`  Press Ctrl+C to stop\n`);

  // Open browser (platform-specific)
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      execSync(`open "${url}"`);
    } else if (platform === "linux") {
      execSync(`xdg-open "${url}"`);
    } else if (platform === "win32") {
      execSync(`start "" "${url}"`);
    }
  } catch {
    console.log(`  Could not open browser automatically. Visit ${url}`);
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log("\n  Shutting down...");
    server.close(() => process.exit(0));
    // Force exit after 3s if connections hang
    setTimeout(() => process.exit(0), 3000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
