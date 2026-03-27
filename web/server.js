#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const DATA_DIR = path.join(os.homedir(), '.claude', 'session-manager');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function sendJSON(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function sendHTML(res, filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(html);
  } catch (err) {
    sendJSON(res, 404, { error: 'index.html not found' });
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

function loadConfig() {
  return readJSON(path.join(DATA_DIR, 'config.json')) || {};
}

function listRepoSlugs() {
  const reposDir = path.join(DATA_DIR, 'repos');
  try {
    return fs.readdirSync(reposDir).filter((name) => {
      const stat = safeStat(path.join(reposDir, name));
      return stat && stat.isDirectory();
    });
  } catch {
    return [];
  }
}

function loadSessionsForRepo(slug) {
  const sessionsDir = path.join(DATA_DIR, 'repos', slug, 'sessions');
  try {
    const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
    return files.map((f) => {
      const data = readJSON(path.join(sessionsDir, f));
      if (!data) return null;
      data._repoSlug = slug;
      return data;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function loadProjectsForRepo(slug) {
  const projectsDir = path.join(DATA_DIR, 'repos', slug, 'projects');
  try {
    const files = fs.readdirSync(projectsDir).filter((f) => f.endsWith('.json') && !f.endsWith('.takeaway.md'));
    return files.map((f) => {
      const data = readJSON(path.join(projectsDir, f));
      if (!data) return null;
      data._repoSlug = slug;
      // Check for takeaway file
      const takeawayPath = path.join(projectsDir, data.slug + '.takeaway.md');
      data._hasTakeaway = !!safeStat(takeawayPath);
      return data;
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function classifySession(s) {
  const startedAt = s.startedAt ? new Date(s.startedAt).getTime() : null;
  const endedAt = s.endedAt ? new Date(s.endedAt).getTime() : null;

  if (!endedAt) return 'meaningful';

  const durationMin = (startedAt && endedAt) ? (endedAt - startedAt) / 60000 : 0;
  const commitCount = s.commitCount || 0;
  const projectSlug = s.projectSlug || null;

  if (endedAt && durationMin < 2 && commitCount === 0 && projectSlug === null) {
    return 'noise';
  }
  if (commitCount > 0 && projectSlug === null) {
    return 'orphaned';
  }
  return 'meaningful';
}

function computeDuration(s) {
  const startedAt = s.startedAt ? new Date(s.startedAt).getTime() : null;
  const endedAt = s.endedAt ? new Date(s.endedAt).getTime() : null;
  if (startedAt && endedAt) {
    return Math.round((endedAt - startedAt) / 60000);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleIndex(req, res) {
  const indexPath = path.join(__dirname, '..', 'web', 'index.html');
  sendHTML(res, indexPath);
}

function handleConfig(req, res) {
  try {
    const config = loadConfig();
    sendJSON(res, 200, config);
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleOverview(_req, res) {
  try {
    const repoSlugs = listRepoSlugs();
    const allSessions = [];
    const allProjects = [];

    for (const slug of repoSlugs) {
      allSessions.push(...loadSessionsForRepo(slug));
      allProjects.push(...loadProjectsForRepo(slug));
    }

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const sessionsThisWeek = allSessions.filter((s) => {
      const t = s.startedAt ? new Date(s.startedAt).getTime() : 0;
      return t >= oneWeekAgo;
    }).length;

    const completedProjects = allProjects.filter((p) => p.status === 'completed').length;
    const projectsWithTakeaways = allProjects.filter((p) => p._hasTakeaway).length;

    // Recent sessions (last 10 by startedAt descending)
    const sorted = allSessions
      .slice()
      .sort((a, b) => {
        const ta = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const tb = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);

    const recentSessions = sorted.map((s) => ({
      sessionId: s.sessionId,
      repoSlug: s._repoSlug,
      branch: s.branch,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      duration: computeDuration(s),
      commitCount: s.commitCount || 0,
      summary: s.summary || null,
      projectSlug: s.projectSlug || null,
      classification: classifySession(s),
    }));

    sendJSON(res, 200, {
      repoCount: repoSlugs.length,
      activeProjects: allProjects.filter((p) => p.status !== 'completed').length,
      totalSessions: allSessions.length,
      sessionsThisWeek,
      completedProjects,
      projectsWithTakeaways,
      recentSessions,
    });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleProjects(req, res) {
  try {
    const config = loadConfig();
    const repos = config.repos || {};
    const repoSlugs = listRepoSlugs();
    const allProjects = [];

    for (const slug of repoSlugs) {
      const projects = loadProjectsForRepo(slug);
      const sessions = loadSessionsForRepo(slug);
      const repoConfig = repos[slug] || {};

      for (const p of projects) {
        const sessionCount = sessions.filter((s) => s.projectSlug === p.slug).length;
        allProjects.push({
          slug: p.slug,
          title: p.title || p.slug,
          status: p.status || 'active',
          repo: slug,
          group: repoConfig.group || null,
          sessionCount,
          createdAt: p.createdAt || null,
          updatedAt: p.updatedAt || null,
          completedAt: p.completedAt || null,
          hasTakeaway: p._hasTakeaway,
          branches: p.branches || [],
          description: p.description || null,
        });
      }
    }

    sendJSON(res, 200, allProjects);
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleSessions(req, res) {
  try {
    const repoSlugs = listRepoSlugs();
    const allSessions = [];

    for (const slug of repoSlugs) {
      const sessions = loadSessionsForRepo(slug);
      for (const s of sessions) {
        allSessions.push({
          sessionId: s.sessionId,
          repoSlug: s._repoSlug,
          branch: s.branch || null,
          startedAt: s.startedAt || null,
          endedAt: s.endedAt || null,
          duration: computeDuration(s),
          commitCount: s.commitCount || 0,
          summary: s.summary || null,
          projectSlug: s.projectSlug || null,
          notes: s.notes || [],
          classification: classifySession(s),
        });
      }
    }

    sendJSON(res, 200, allSessions);
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleDeleteSession(req, res, slug, id) {
  try {
    const filePath = path.join(DATA_DIR, 'repos', slug, 'sessions', id + '.json');
    if (!safeStat(filePath)) {
      sendJSON(res, 404, { error: 'Session not found' });
      return;
    }
    fs.unlinkSync(filePath);
    sendJSON(res, 200, { ok: true });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

async function handleBulkDelete(req, res) {
  try {
    const body = await parseBody(req);
    const sessions = body.sessions || [];
    let deleted = 0;

    for (const { slug, id } of sessions) {
      const filePath = path.join(DATA_DIR, 'repos', slug, 'sessions', id + '.json');
      try {
        fs.unlinkSync(filePath);
        deleted++;
      } catch {
        // Skip files that don't exist or can't be deleted
      }
    }

    sendJSON(res, 200, { ok: true, deleted });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleKnowledge(req, res) {
  try {
    const indexPath = path.join(DATA_DIR, 'knowledge-index.json');
    const data = readJSON(indexPath);
    sendJSON(res, 200, (data && data.entries) || []);
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

function handleGitInfo(req, res, slug) {
  try {
    const config = loadConfig();
    const repoConfig = (config.repos || {})[slug];
    if (!repoConfig || !repoConfig.path) {
      sendJSON(res, 404, { error: 'Repo not found in config' });
      return;
    }

    const repoPath = repoConfig.path;
    if (!safeStat(repoPath)) {
      sendJSON(res, 404, { error: 'Repo path does not exist' });
      return;
    }

    const execOpts = { cwd: repoPath, encoding: 'utf8', timeout: 5000 };

    let branch = null;
    try {
      branch = execSync('git rev-parse --abbrev-ref HEAD', execOpts).trim();
    } catch { /* ignore */ }

    let lastCommit = null;
    try {
      lastCommit = execSync('git log -1 --format=%H', execOpts).trim();
    } catch { /* ignore */ }

    let uncommittedChanges = false;
    try {
      const status = execSync('git status --porcelain', execOpts).trim();
      uncommittedChanges = status.length > 0;
    } catch { /* ignore */ }

    sendJSON(res, 200, { branch, lastCommit, uncommittedChanges });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    // Static: serve index.html
    if (method === 'GET' && pathname === '/') {
      return handleIndex(req, res);
    }

    // API routes
    if (method === 'GET' && pathname === '/api/config') {
      return handleConfig(req, res);
    }
    if (method === 'GET' && pathname === '/api/overview') {
      return handleOverview(req, res);
    }
    if (method === 'GET' && pathname === '/api/projects') {
      return handleProjects(req, res);
    }
    if (method === 'GET' && pathname === '/api/sessions') {
      return handleSessions(req, res);
    }
    if (method === 'GET' && pathname === '/api/knowledge') {
      return handleKnowledge(req, res);
    }

    // DELETE /api/sessions/:slug/:id
    const deleteMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      return handleDeleteSession(req, res, deleteMatch[1], deleteMatch[2]);
    }

    // POST /api/sessions/bulk-delete
    if (method === 'POST' && pathname === '/api/sessions/bulk-delete') {
      return await handleBulkDelete(req, res);
    }

    // GET /api/git-info/:slug
    const gitInfoMatch = pathname.match(/^\/api\/git-info\/([^/]+)$/);
    if (method === 'GET' && gitInfoMatch) {
      return handleGitInfo(req, res, gitInfoMatch[1]);
    }

    // 404
    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Server start
// ---------------------------------------------------------------------------

function startServer(port) {
  const listenPort = port || 0;
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleRequest(req, res).catch((err) => {
        try {
          sendJSON(res, 500, { error: err.message });
        } catch {
          // response may already be sent
        }
      });
    });

    server.on('error', reject);

    server.listen(listenPort, '127.0.0.1', () => {
      const assignedPort = server.address().port;
      resolve({ server, port: assignedPort });
    });
  });
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const port = parseInt(process.argv[2] || process.env.PORT || '0', 10);
  startServer(port)
    .then(({ port: assignedPort }) => {
      console.log(`Session manager dashboard server listening on http://127.0.0.1:${assignedPort}`);
    })
    .catch((err) => {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    });
}

module.exports = { startServer };
