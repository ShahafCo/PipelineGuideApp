'use strict';

const express   = require('express');
const helmet    = require('helmet');
const morgan    = require('morgan');
const matter    = require('gray-matter');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const crypto    = require('crypto');
const dotenv    = require('dotenv');
const { body, query, param, validationResult } = require('express-validator');

dotenv.config({ path: path.join(__dirname, '.env') });

// ── Config ────────────────────────────────────────────────────────────────────
const PORT       = parseInt(process.env.PORT  || '7842', 10);
const GUIDES_DIR = path.resolve(
  (process.env.GUIDES_DIR || '~/guides').replace(/^~/, os.homedir())
);
const DEV        = process.env.NODE_ENV !== 'production';

const USERS_FILE = process.env.USERS_FILE
  ? path.resolve(process.env.USERS_FILE)
  : path.join(__dirname, 'users.json');

let users = [];
if (fs.existsSync(USERS_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    users = raw.filter(u => u.username && u.password && u.role);
  }
  catch (e) { console.error('FATAL: Could not parse users.json:', e.message); process.exit(1); }
} else if (!DEV) {
  console.error(`FATAL: ${USERS_FILE} not found. Run setup or create users.json.`);
  process.exit(1);
}

const sessions = new Map(); // token → { username, role }

fs.mkdirSync(GUIDES_DIR, { recursive: true });

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.use(helmet());
app.use(morgan('short'));
app.use(express.json({ limit: '2mb' }));

// ── Auth middleware ───────────────────────────────────────────────────────────
function auth(req, res, next) {
  if (DEV && !users.length) { req.user = { username: 'dev', role: 'admin' }; return next(); }
  const header  = req.headers['authorization'] || '';
  const tok     = header.startsWith('Bearer ') ? header.slice(7) : '';
  const session = sessions.get(tok);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  req.user = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden: admin role required' });
  next();
}

// ── Path safety ───────────────────────────────────────────────────────────────
// Ensures a caller-supplied relative path stays inside GUIDES_DIR.
function safePath(rel) {
  const abs = path.resolve(GUIDES_DIR, rel.replace(/^\/+/, ''));
  if (!abs.startsWith(GUIDES_DIR + path.sep) && abs !== GUIDES_DIR) return null;
  return abs;
}

function validResult(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) { res.status(400).json({ errors: errs.array() }); return false; }
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp'
};

function parseMeta(filePath, raw) {
  const { data: fm, content } = matter(raw);
  const lines = content.split('\n');

  let title = fm.title || '';
  if (!title) {
    const h1 = lines.find(l => l.startsWith('# '));
    title = h1 ? h1.slice(2).trim()
               : path.basename(filePath, '.md').replace(/-/g, ' ');
  }

  let desc = fm.description || '';
  if (!desc) {
    const p = lines.find(l => l.trim() && !l.startsWith('#') && !l.startsWith('-'));
    desc = p ? p.slice(0, 110) + (p.length > 110 ? '…' : '') : '';
  }

  const rel  = path.relative(GUIDES_DIR, filePath);
  const parts = rel.split(path.sep);
  const cat  = parts.length > 1 ? parts[0] : 'general';
  const tags = fm.tags
    ? String(fm.tags).split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const pathParts = parts.slice(0, -1);
  return { path: rel.replace(/\\/g, '/'), pathParts, title, cat, tags, desc, frontmatter: fm };
}

function walkGuides(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkGuides(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
  }
  return results.sort();
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (_req, res) => res.json({ ok: true, dir: GUIDES_DIR }));

// POST /api/login
app.post('/api/login',
  body('username').notEmpty().trim(),
  body('password').notEmpty(),
  (req, res) => {
    if (!validResult(req, res)) return;
    if (DEV && !users.length) {
      const tok = crypto.randomBytes(32).toString('hex');
      sessions.set(tok, { username: 'dev', role: 'admin' });
      return res.json({ token: tok, username: 'dev', role: 'admin' });
    }
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const tok = crypto.randomBytes(32).toString('hex');
    sessions.set(tok, { username: user.username, role: user.role });
    res.json({ token: tok, username: user.username, role: user.role });
  }
);

// POST /api/logout
app.post('/api/logout', auth, (req, res) => {
  const tok = (req.headers['authorization'] || '').slice(7);
  sessions.delete(tok);
  res.json({ ok: true });
});

// GET /api/me
app.get('/api/me', auth, (req, res) => res.json({ username: req.user.username, role: req.user.role }));

// GET /api/guides  — list all guides with metadata
app.get('/api/guides', auth, (_req, res) => {
  try {
    const files = walkGuides(GUIDES_DIR);
    const guides = files.map(f => {
      try {
        const raw = fs.readFileSync(f, 'utf8');
        const meta = parseMeta(f, raw);
        return { ...meta, updatedAt: fs.statSync(f).mtime.toISOString() };
      } catch { return null; }
    }).filter(Boolean);
    res.json({ guides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/guides/content?path=ci-cd/jenkins-pipeline/guide.md
app.get('/api/guides/content',
  auth,
  query('path').notEmpty().trim(),
  (req, res) => {
    if (!validResult(req, res)) return;
    const abs = safePath(req.query.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    if (!abs.endsWith('.md')) return res.status(400).json({ error: 'Not a markdown file' });
    try {
      const raw = fs.readFileSync(abs, 'utf8');
      const meta = parseMeta(abs, raw);
      res.json({ ...meta, content: raw });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/images?path=ci-cd/jenkins-pipeline/diagram.png
app.get('/api/images',
  auth,
  query('path').notEmpty().trim(),
  (req, res) => {
    if (!validResult(req, res)) return;
    const abs = safePath(req.query.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    const ext  = path.extname(abs).slice(1).toLowerCase();
    const mime = MIME[ext];
    if (!mime) return res.status(400).json({ error: 'Unsupported image type' });
    try {
      const buf = fs.readFileSync(abs);
      res.json({ data: buf.toString('base64'), mime, name: path.basename(abs) });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found' });
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/guides  — create a new guide
app.post('/api/guides',
  auth, requireAdmin,
  body('path').notEmpty().trim().matches(/\.md$/),
  body('content').notEmpty(),
  (req, res) => {
    if (!validResult(req, res)) return;
    const abs = safePath(req.body.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    if (fs.existsSync(abs)) return res.status(409).json({ error: 'Guide already exists' });
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, req.body.content, 'utf8');
      const meta = parseMeta(abs, req.body.content);
      res.status(201).json(meta);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/guides  — update an existing guide
app.put('/api/guides',
  auth, requireAdmin,
  body('path').notEmpty().trim().matches(/\.md$/),
  body('content').notEmpty(),
  (req, res) => {
    if (!validResult(req, res)) return;
    const abs = safePath(req.body.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Guide not found' });
    try {
      // Atomic write via temp file
      const tmp = abs + '.tmp';
      fs.writeFileSync(tmp, req.body.content, 'utf8');
      fs.renameSync(tmp, abs);
      const meta = parseMeta(abs, req.body.content);
      res.json(meta);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/guides
app.delete('/api/guides',
  auth, requireAdmin,
  body('path').notEmpty().trim().matches(/\.md$/),
  (req, res) => {
    if (!validResult(req, res)) return;
    const abs = safePath(req.body.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Guide not found' });
    try {
      fs.unlinkSync(abs);
      // Remove parent dir if now empty (best-effort)
      try {
        const parent = path.dirname(abs);
        if (parent !== GUIDES_DIR && fs.readdirSync(parent).length === 0)
          fs.rmdirSync(parent);
      } catch { /* ignore */ }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/images  — upload an image (base64 body)
app.post('/api/images',
  auth, requireAdmin,
  body('path').notEmpty().trim(),
  body('data').notEmpty(),   // base64
  body('mime').notEmpty(),
  (req, res) => {
    if (!validResult(req, res)) return;
    const abs = safePath(req.body.path);
    if (!abs) return res.status(400).json({ error: 'Invalid path' });
    const ext = path.extname(abs).slice(1).toLowerCase();
    if (!MIME[ext]) return res.status(400).json({ error: 'Unsupported image type' });
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      const buf = Buffer.from(req.body.data, 'base64');
      fs.writeFileSync(abs, buf);
      res.status(201).json({ ok: true, path: path.relative(GUIDES_DIR, abs).replace(/\\/g, '/') });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Pipeline Guide Server`);
  console.log(`  listening on  127.0.0.1:${PORT}`);
  console.log(`  guides dir    ${GUIDES_DIR}`);
  console.log(`  auth          ${users.length ? `${users.length} user(s)` : 'disabled (dev mode)'}`);
});
