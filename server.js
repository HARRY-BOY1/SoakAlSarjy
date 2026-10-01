/* =========================================================
   سوق الشورجة — Pella / Express Server
   جاهز للاستضافة على Pella Express
   ========================================================= */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data.json');

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

let db = {
  users: [], listings: [], messages: [], reviews: [],
  notifications: [], reports: []
};

function normalizeDB() {
  for (const k of Object.keys(db)) {
    if (!Array.isArray(db[k])) db[k] = [];
  }
  db.users = db.users.map(u => ({ ...u, verified: !!u.verified, bio: u.bio || '' }));
}

function loadDB() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      normalizeDB();
      saveDB();
      return;
    }
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    db = { ...db, ...parsed };
    normalizeDB();
  } catch (e) {
    console.error('⚠️ تعذر قراءة data.json:', e.message);
    normalizeDB();
  }
}

function saveDB() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function safeUser(user) {
  return user ? { ...user } : null;
}

function cleanListing(body) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 5).map(String) : [];
  return {
    title: String(body.title || '').trim().slice(0, 180),
    cat: String(body.cat || '').slice(0, 60),
    city: String(body.city || '').slice(0, 80),
    type: ['sale','wanted','exchange'].includes(body.type) ? body.type : 'sale',
    condition: ['new','used','refurbished'].includes(body.condition) ? body.condition : 'used',
    brand: String(body.brand || '').trim().slice(0, 80),
    model: String(body.model || '').trim().slice(0, 100),
    quantity: Math.max(1, Number(body.quantity) || 1),
    price: Number(body.price) || 0,
    phone: String(body.phone || '').trim().slice(0, 40),
    desc: String(body.desc || '').trim().slice(0, 5000),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map(x => String(x).trim().slice(0, 40)).filter(Boolean) : [],
    delivery: body.delivery === 'delivery' ? 'delivery' : 'pickup',
    negotiable: !!body.negotiable,
    images,
    featured: !!body.featured
  };
}

loadDB();

// Health check — مفيد لـ Pella وعمليات المراقبة.
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'al-sharji-market', uptime: Math.floor(process.uptime()) });
});

// API
app.get('/api/data', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    users: db.users.map(safeUser),
    listings: db.listings,
    messages: db.messages,
    reviews: db.reviews,
    notifications: db.notifications,
    reports: db.reports
  });
});

app.post('/api/sync', (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.users)) db.users = body.users;
  if (Array.isArray(body.listings)) db.listings = body.listings;
  if (Array.isArray(body.messages)) db.messages = body.messages;
  if (Array.isArray(body.reviews)) db.reviews = body.reviews;
  if (Array.isArray(body.notifications)) db.notifications = body.notifications;
  if (Array.isArray(body.reports)) db.reports = body.reports;
  normalizeDB();
  saveDB();
  res.json({ ok: true, counts: counts() });
});

app.post('/api/register', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 100);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const city = String(body.city || '').slice(0, 80);
  const pass = String(body.pass || '');

  if (!name || !phone || pass.length < 6) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  if (db.users.some(u => u.phone === phone)) {
    return res.status(400).json({ error: 'phone_exists' });
  }

  const user = {
    id: uid(), name, phone, city, pass,
    ts: Date.now(), verified: false, bio: ''
  };
  db.users.push(user);
  saveDB();
  res.status(201).json({ user: safeUser(user) });
});

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  const phone = String(body.phone || '').trim();
  const pass = String(body.pass || '');
  const user = db.users.find(u => u.phone === phone && u.pass === pass);
  if (!user) return res.status(401).json({ error: 'invalid' });
  res.json({ user: safeUser(user) });
});

app.post('/api/listings', (req, res) => {
  const data = cleanListing(req.body || {});
  if (!data.title || !data.cat || !data.city || !data.desc) {
    return res.status(400).json({ error: 'invalid_listing' });
  }
  const listing = { ...data, id: uid(), ts: Date.now(), views: 0 };
  db.listings.unshift(listing);
  saveDB();
  res.status(201).json({ listing });
});

app.put('/api/listings/:id', (req, res) => {
  const index = db.listings.findIndex(l => l.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'not_found' });
  const old = db.listings[index];
  const data = cleanListing({ ...old, ...(req.body || {}) });
  db.listings[index] = { ...old, ...data, id: old.id, ts: old.ts || Date.now(), updatedAt: Date.now() };
  saveDB();
  res.json({ listing: db.listings[index] });
});

app.delete('/api/listings/:id', (req, res) => {
  const before = db.listings.length;
  db.listings = db.listings.filter(l => l.id !== req.params.id);
  db.reports = db.reports.filter(r => r.listingId !== req.params.id);
  saveDB();
  res.json({ ok: true, deleted: before - db.listings.length });
});

app.post('/api/reports', (req, res) => {
  const body = req.body || {};
  const report = {
    ...body,
    id: uid(),
    reason: String(body.reason || '').slice(0, 500),
    ts: Date.now(),
    status: 'new'
  };
  db.reports.unshift(report);
  db.reports = db.reports.slice(0, 1000);
  saveDB();
  res.status(201).json({ ok: true, report });
});

app.get('/api/stats', (req, res) => {
  res.json({
    users: db.users.length,
    listings: db.listings.length,
    views: db.listings.reduce((s, l) => s + (Number(l.views) || 0), 0),
    messages: db.messages.length,
    reviews: db.reviews.length,
    reports: db.reports.length,
    uptime: Math.floor(process.uptime()) + 's'
  });
});

function counts() {
  return {
    users: db.users.length,
    listings: db.listings.length,
    messages: db.messages.length,
    reviews: db.reviews.length,
    notifications: db.notifications.length,
    reports: db.reports.length
  };
}

// Static frontend. ملفات المشروع يجب أن تكون في نفس مجلد server.js.
app.use(express.static(__dirname, {
  index: 'index.html',
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('service-worker.js') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// SPA fallback للصفحات غير الـ API.
// Express 5 لا يقبل المسار '*' بصيغة Express 4؛ لذلك نستخدم middleware
// عام حتى نتجنب خطأ path-to-regexp ونبقي API منفصلاً.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   سوق الشورجة — Pella Express Server      ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`✅ Listening on ${HOST}:${PORT}`);
  console.log(`🌐 Public URL is supplied by Pella`);
  console.log(`👥 المستخدمين: ${db.users.length}`);
  console.log(`📦 الإعلانات: ${db.listings.length}`);
  console.log(`🚩 البلاغات: ${db.reports.length}`);
  console.log(`💾 قاعدة البيانات: ${DATA_FILE}`);
});

process.on('SIGTERM', () => {
  try { saveDB(); } finally { process.exit(0); }
});
process.on('SIGINT', () => {
  try { saveDB(); } finally { process.exit(0); }
});
