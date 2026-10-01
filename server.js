/* =========================================================
   سوق الشورجة — Secure Express API
   ملاحظة: اضبط ADMIN_PHONE و ADMIN_PASSWORD_HASH كأسرار بيئية.
   لا تضع كلمة مرور أو hash إداري داخل GitHub أو data.json.
   ========================================================= */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PHONE = normalizePhone(process.env.ADMIN_PHONE || '07748820203');
const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || '');
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();
const adminSessions = new Map();
const loginAttempts = new Map();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=()');
  next();
});
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

let db = {
  users: [], listings: [], messages: [], reviews: [], notifications: [], reports: [],
  siteContent: {}, homepageBanners: [], animatedAds: [], socialLinks: [], auditEvents: []
};

const DEFAULT_CONTENT = {
  about: { title: 'من نحن', body: 'سوق الشورجة منصة عراقية بسيطة وموثوقة لبيع وشراء المنتجات والخدمات والتواصل المباشر بين الناس.' },
  help: { title: 'المساعدة', body: 'استخدم البحث والأقسام للوصول إلى الإعلان المناسب. لا ترسل أموالاً قبل التحقق من المنتج والبائع.' },
  terms: { title: 'الشروط والأحكام', body: 'باستخدام سوق الشورجة توافق على نشر معلومات صحيحة واحترام المستخدمين وعدم نشر المواد الممنوعة أو الإعلانات الوهمية.' },
  privacy: { title: 'سياسة الخصوصية', body: 'نستخدم بيانات الحساب والإعلان لتشغيل السوق وتحسين الأمان. لا نعرض البريد أو بيانات الحساب الحساسة للعامة.' },
  contact: { title: 'تواصل معنا', body: 'للاقتراحات والبلاغات تواصل مع إدارة سوق الشورجة عبر قناة التليكرام الرسمية.' },
  blog: { title: 'المدونة', body: 'نصائح للبيع والشراء الآمن، كتابة إعلان واضح، والتواصل المسؤول مع البائعين والمشترين.' },
  jobs: { title: 'الوظائف', body: 'سيتم نشر فرص العمل المتاحة لدى سوق الشورجة هنا عند توفرها.' }
};
const DEFAULT_SOCIAL = [
  { key: 'telegram', label: 'Telegram', url: 'https://t.me/HarryScloser6', enabled: true },
  { key: 'youtube', label: 'YouTube', url: '', enabled: false }
];

function normalizePhone(value) {
  let phone = String(value || '').trim().replace(/[\s()-]/g, '');
  if (phone.startsWith('+964')) phone = '0' + phone.slice(4);
  if (phone.startsWith('964')) phone = '0' + phone.slice(3);
  return phone;
}
function uid() { return crypto.randomUUID(); }
function now() { return Date.now(); }
function safeUrl(value, allowed = ['http:', 'https:']) {
  try {
    const u = new URL(String(value || '').trim());
    return allowed.includes(u.protocol) ? u.toString() : '';
  } catch (_) { return ''; }
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, encoded) {
  try {
    const [scheme, salt, expected] = String(encoded || '').split('$');
    if (scheme !== 'scrypt' || !salt || !expected) return false;
    const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch (_) { return false; }
}
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }));
}
function setCookie(res, name, value, maxAge = SESSION_TTL) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAge / 1000)}${secure}`);
}
function clearCookie(res, name) { setCookie(res, name, '', 0); }
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id, name: user.name || 'مستخدم', phone: user.phone || '', city: user.city || '',
    email: user.email || '', avatarUrl: user.avatarUrl || '', bio: user.bio || '',
    socialLinks: user.socialLinks || {}, visibility: user.visibility || { showPhone: false, showEmail: false, showSocial: true },
    verified: !!user.verified, role: user.role === 'admin' ? 'admin' : 'user', status: user.status || 'active',
    ts: user.ts, updatedAt: user.updatedAt || user.ts
  };
}
function publicListing(listing) {
  const media = listing.media || {};
  const images = Array.isArray(listing.images) ? listing.images : [];
  return {
    ...listing,
    userId: String(listing.userId || ''),
    images: images.slice(0, 5),
    coverUrl: safeUrl(listing.coverUrl || images[0] || ''),
    galleryUrls: Array.isArray(listing.galleryUrls) ? listing.galleryUrls.map(safeUrl).filter(Boolean).slice(0, 8) : [],
    videoUrls: Array.isArray(listing.videoUrls) ? listing.videoUrls.map(safeUrl).filter(Boolean).slice(0, 2) : [],
    contactUrl: safeUrl(listing.contactUrl || ''),
    media: { ...media, cover: safeUrl(media.cover || listing.coverUrl || images[0] || '') }
  };
}
function normalizeDB() {
  const arrays = ['users','listings','messages','reviews','notifications','reports','homepageBanners','animatedAds','auditEvents'];
  for (const key of arrays) if (!Array.isArray(db[key])) db[key] = [];
  if (!db.siteContent || typeof db.siteContent !== 'object' || Array.isArray(db.siteContent)) db.siteContent = {};
  if (!Array.isArray(db.socialLinks)) db.socialLinks = [];
  db.users = db.users.map(user => {
    const u = { ...user };
    if (!u.passwordHash && u.pass) u.passwordHash = hashPassword(u.pass);
    delete u.pass;
    return {
      ...u, phone: normalizePhone(u.phone), verified: !!u.verified, bio: u.bio || '',
      role: u.role === 'admin' ? 'user' : 'user', status: u.status || 'active',
      socialLinks: u.socialLinks || {}, visibility: u.visibility || { showPhone: false, showEmail: false, showSocial: true },
      updatedAt: u.updatedAt || u.ts || now()
    };
  });
  db.listings = db.listings.map(l => ({
    ...l, images: Array.isArray(l.images) ? l.images.slice(0, 5) : [],
    galleryUrls: Array.isArray(l.galleryUrls) ? l.galleryUrls.slice(0, 8) : [],
    videoUrls: Array.isArray(l.videoUrls) ? l.videoUrls.slice(0, 2) : [],
    coverUrl: l.coverUrl || (l.images || [])[0] || '', contactUrl: l.contactUrl || '',
    mediaVersion: Number(l.mediaVersion || 1), moderationStatus: l.moderationStatus || 'published'
  }));
  for (const [key, value] of Object.entries(DEFAULT_CONTENT)) if (!db.siteContent[key]) db.siteContent[key] = value;
  if (!db.socialLinks.length) db.socialLinks = DEFAULT_SOCIAL;
}
function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
    normalizeDB();
    saveDB();
  } catch (error) {
    console.error('تعذر قراءة قاعدة البيانات:', error.message);
    normalizeDB();
  }
}
function saveDB() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}
function audit(action, actor, meta = {}) {
  db.auditEvents.unshift({ id: uid(), action, actorId: actor?.id || 'system', ts: now(), meta });
  db.auditEvents = db.auditEvents.slice(0, 2000);
}
function createSession(map, id, res, cookieName) {
  const token = crypto.randomBytes(32).toString('hex');
  map.set(token, { id, expiresAt: now() + SESSION_TTL, lastSeen: now() });
  setCookie(res, cookieName, token);
  return token;
}
function getSession(map, req, cookieName) {
  const token = parseCookies(req)[cookieName];
  const session = token && map.get(token);
  if (!session || session.expiresAt < now()) { if (token) map.delete(token); return null; }
  session.lastSeen = now();
  return { token, ...session };
}
function currentUser(req) {
  const session = getSession(sessions, req, 'sq_session');
  return session ? db.users.find(u => u.id === session.id && u.status === 'active') : null;
}
function currentAdmin(req) {
  const session = getSession(adminSessions, req, 'sq_admin_session');
  return session && session.id === 'primary' ? { id: 'primary', phone: ADMIN_PHONE, role: 'admin' } : null;
}
function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'auth_required' });
  req.user = user; next();
}
function requireAdmin(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(403).json({ error: 'admin_required' });
  req.admin = admin; next();
}
function cleanListing(body, ownerId) {
  const images = Array.isArray(body.images) ? body.images.slice(0, 5).map(safeUrl).filter(Boolean) : [];
  const galleryUrls = Array.isArray(body.galleryUrls) ? body.galleryUrls.slice(0, 8).map(safeUrl).filter(Boolean) : [];
  const videoUrls = Array.isArray(body.videoUrls) ? body.videoUrls.slice(0, 2).map(safeUrl).filter(Boolean) : [];
  const price = Number(body.price);
  return {
    title: String(body.title || '').trim().slice(0, 180), cat: String(body.cat || '').slice(0, 60),
    city: String(body.city || '').slice(0, 80), type: ['sale','wanted','exchange'].includes(body.type) ? body.type : 'sale',
    condition: ['new','used','refurbished'].includes(body.condition) ? body.condition : 'used',
    brand: String(body.brand || '').trim().slice(0, 80), model: String(body.model || '').trim().slice(0, 100),
    quantity: Math.max(1, Math.min(999999, Number(body.quantity) || 1)), price: Number.isFinite(price) ? Math.max(0, price) : 0,
    phone: String(body.phone || '').trim().slice(0, 40), desc: String(body.desc || '').trim().slice(0, 5000),
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map(x => String(x).trim().slice(0, 40)).filter(Boolean) : [],
    delivery: body.delivery === 'delivery' ? 'delivery' : 'pickup', negotiable: !!body.negotiable, images,
    coverUrl: safeUrl(body.coverUrl || images[0] || ''), galleryUrls, videoUrls, contactUrl: safeUrl(body.contactUrl || ''),
    mediaVersion: 1, featured: !!body.featured, userId: ownerId || String(body.userId || ''),
    moderationStatus: 'published'
  };
}

loadDB();

app.get('/health', (req, res) => res.json({ ok: true, service: 'al-shorja-market', uptime: Math.floor(process.uptime()) }));
app.get('/api/content', (req, res) => res.json({ content: db.siteContent, banners: db.homepageBanners.filter(x => x.status !== 'hidden'), ads: db.animatedAds.filter(x => x.status !== 'hidden'), socials: db.socialLinks }));
app.get('/api/data', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ users: db.users.map(publicUser), listings: db.listings.filter(l => l.moderationStatus !== 'hidden').map(publicListing), reviews: db.reviews, reports: [] });
});

app.post('/api/register', (req, res) => {
  const body = req.body || {}, name = String(body.name || '').trim().slice(0, 100), phone = normalizePhone(body.phone), pass = String(body.pass || '');
  if (!name || !/^07\d{9}$/.test(phone) || pass.length < 8) return res.status(400).json({ error: 'invalid_input' });
  if (phone === ADMIN_PHONE || db.users.some(u => normalizePhone(u.phone) === phone)) return res.status(409).json({ error: 'phone_exists' });
  const user = { id: uid(), name, phone, city: String(body.city || '').slice(0, 80), passwordHash: hashPassword(pass), ts: now(), verified: false, bio: '', role: 'user', status: 'active', socialLinks: {}, visibility: { showPhone: false, showEmail: false, showSocial: true } };
  db.users.push(user); saveDB(); createSession(sessions, user.id, res, 'sq_session');
  res.status(201).json({ user: publicUser(user) });
});
app.post('/api/login', (req, res) => {
  const phone = normalizePhone(req.body?.phone), pass = String(req.body?.pass || '');
  const user = db.users.find(u => normalizePhone(u.phone) === phone && u.status === 'active');
  if (!user || !verifyPassword(pass, user.passwordHash)) return res.status(401).json({ error: 'invalid' });
  createSession(sessions, user.id, res, 'sq_session'); res.json({ user: publicUser(user) });
});
app.post('/api/logout', (req, res) => { const token = parseCookies(req).sq_session; if (token) sessions.delete(token); clearCookie(res, 'sq_session'); res.json({ ok: true }); });
app.get('/api/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));
app.patch('/api/me', requireUser, (req, res) => {
  const allowed = ['name','city','email','avatarUrl','bio','socialLinks','visibility'];
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
    if (key === 'socialLinks' || key === 'visibility') req.user[key] = typeof req.body[key] === 'object' ? req.body[key] : req.user[key];
    else req.user[key] = String(req.body[key] || '').slice(0, key === 'bio' ? 1200 : 300);
  }
  req.user.updatedAt = now(); saveDB(); res.json({ user: publicUser(req.user) });
});
app.post('/api/me/contact', requireUser, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  if (!verifyPassword(currentPassword, req.user.passwordHash)) return res.status(400).json({ error: 'invalid_password' });
  if (req.body?.newEmail) req.user.email = String(req.body.newEmail).trim().slice(0, 160);
  if (req.body?.newPhone) {
    const phone = normalizePhone(req.body.newPhone);
    if (!/^07\d{9}$/.test(phone) || db.users.some(u => u.id !== req.user.id && u.phone === phone)) return res.status(400).json({ error: 'invalid_phone' });
    req.user.phone = phone;
  }
  req.user.updatedAt = now(); saveDB(); res.json({ user: publicUser(req.user) });
});
app.post('/api/me/password', requireUser, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword, req.user.passwordHash) || String(newPassword || '').length < 8) return res.status(400).json({ error: 'invalid_password' });
  req.user.passwordHash = hashPassword(newPassword); req.user.updatedAt = now(); saveDB(); res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD_HASH) return res.status(503).json({ error: 'admin_secret_not_configured' });
  const phone = normalizePhone(req.body?.phone), pass = String(req.body?.pass || ''), key = `${req.ip}:${phone}`;
  const attempt = loginAttempts.get(key) || { count: 0, until: 0 };
  if (attempt.until > now()) return res.status(429).json({ error: 'try_later' });
  if (phone !== ADMIN_PHONE || !verifyPassword(pass, ADMIN_PASSWORD_HASH)) {
    attempt.count += 1; if (attempt.count >= 5) { attempt.until = now() + 15 * 60 * 1000; attempt.count = 0; } loginAttempts.set(key, attempt);
    return res.status(401).json({ error: 'invalid' });
  }
  loginAttempts.delete(key); createSession(adminSessions, 'primary', res, 'sq_admin_session');
  res.json({ admin: { id: 'primary', phone: ADMIN_PHONE, role: 'admin' } });
});
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ admin: req.admin }));
app.post('/api/admin/logout', (req, res) => { const token = parseCookies(req).sq_admin_session; if (token) adminSessions.delete(token); clearCookie(res, 'sq_admin_session'); res.json({ ok: true }); });
app.get('/api/admin/data', requireAdmin, (req, res) => res.json({ users: db.users.map(publicUser), listings: db.listings.map(publicListing), reports: db.reports, content: db.siteContent, banners: db.homepageBanners, ads: db.animatedAds, socials: db.socialLinks, stats: counts() }));
app.get('/api/stats', requireAdmin, (req, res) => res.json(counts()));
app.delete('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const before = db.listings.length; db.listings = db.listings.filter(l => l.id !== req.params.id); db.reports = db.reports.filter(r => r.listingId !== req.params.id);
  audit('admin_delete_listing', req.admin, { listingId: req.params.id }); saveDB(); res.json({ ok: true, deleted: before - db.listings.length });
});
app.patch('/api/admin/listings/:id', requireAdmin, (req, res) => {
  const listing = db.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'not_found' });
  if (['published','hidden','rejected','pending'].includes(req.body?.moderationStatus)) listing.moderationStatus = req.body.moderationStatus;
  if (typeof req.body?.featured === 'boolean') listing.featured = req.body.featured;
  audit('admin_update_listing', req.admin, { listingId: listing.id, moderationStatus: listing.moderationStatus }); saveDB(); res.json({ listing: publicListing(listing) });
});
app.get('/api/admin/audit', requireAdmin, (req, res) => res.json({ events: db.auditEvents.slice(0, 200) }));
app.patch('/api/admin/content/:key', requireAdmin, (req, res) => {
  const key = String(req.params.key || '').slice(0, 40); const title = String(req.body?.title || '').trim().slice(0, 160); const body = String(req.body?.body || '').trim().slice(0, 10000);
  if (!title || !body) return res.status(400).json({ error: 'invalid_content' });
  db.siteContent[key] = { title, body, updatedAt: now() }; audit('admin_update_content', req.admin, { key }); saveDB(); res.json({ content: db.siteContent[key] });
});
app.patch('/api/admin/socials', requireAdmin, (req, res) => {
  const socials = Array.isArray(req.body?.socials) ? req.body.socials.slice(0, 10).map(s => ({ key: String(s.key || '').slice(0, 30), label: String(s.label || '').slice(0, 60), url: safeUrl(s.url), enabled: s.enabled !== false })) : [];
  db.socialLinks = socials; audit('admin_update_socials', req.admin); saveDB(); res.json({ socials: db.socialLinks });
});
app.post('/api/admin/banners', requireAdmin, (req, res) => {
  const b = { id: uid(), title: String(req.body?.title || '').slice(0, 160), body: String(req.body?.body || '').slice(0, 600), imageUrl: safeUrl(req.body?.imageUrl), targetUrl: safeUrl(req.body?.targetUrl), status: 'published', ts: now() };
  if (!b.title) return res.status(400).json({ error: 'invalid_banner' }); db.homepageBanners.unshift(b); audit('admin_create_banner', req.admin, { id: b.id }); saveDB(); res.status(201).json({ banner: b });
});
app.delete('/api/admin/banners/:id', requireAdmin, (req, res) => { db.homepageBanners = db.homepageBanners.filter(x => x.id !== req.params.id); audit('admin_delete_banner', req.admin, { id: req.params.id }); saveDB(); res.json({ ok: true }); });

app.post('/api/listings', requireUser, (req, res) => {
  const data = cleanListing(req.body || {}, req.user.id); if (!data.title || !data.cat || !data.city || !data.desc) return res.status(400).json({ error: 'invalid_listing' });
  const own = db.listings.filter(l => l.userId === req.user.id); if (data.featured && own.length > 0) data.featured = false;
  const listing = { ...data, id: uid(), ts: now(), views: 0 }; db.listings.unshift(listing); saveDB(); res.status(201).json({ listing: publicListing(listing) });
});
app.put('/api/listings/:id', requireUser, (req, res) => {
  const index = db.listings.findIndex(l => l.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'not_found' });
  const old = db.listings[index]; if (old.userId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  const data = cleanListing({ ...old, ...(req.body || {}) }, req.user.id); if (data.featured && db.listings.some(l => l.userId === req.user.id && l.id !== old.id)) data.featured = false;
  db.listings[index] = { ...old, ...data, id: old.id, ts: old.ts || now(), updatedAt: now() }; saveDB(); res.json({ listing: publicListing(db.listings[index]) });
});
app.delete('/api/listings/:id', requireUser, (req, res) => {
  const listing = db.listings.find(l => l.id === req.params.id); if (!listing) return res.status(404).json({ error: 'not_found' });
  if (listing.userId !== req.user.id) return res.status(403).json({ error: 'forbidden' });
  db.listings = db.listings.filter(l => l.id !== req.params.id); db.reports = db.reports.filter(r => r.listingId !== req.params.id); saveDB(); res.json({ ok: true });
});
app.post('/api/reports', requireUser, (req, res) => {
  const listingId = String(req.body?.listingId || ''); if (!db.listings.some(l => l.id === listingId)) return res.status(404).json({ error: 'not_found' });
  if (db.reports.some(r => r.listingId === listingId && r.reporterId === req.user.id && r.status !== 'rejected')) return res.status(409).json({ error: 'duplicate_report' });
  const report = { id: uid(), listingId, reporterId: req.user.id, reason: String(req.body?.reason || '').slice(0, 80), note: String(req.body?.note || '').slice(0, 500), ts: now(), status: 'new' };
  db.reports.unshift(report); saveDB(); res.status(201).json({ ok: true, report });
});

// لا تسمح بقراءة ملفات البيانات أو الخطط من المسار العام.
app.use(['/data.json', '/data.json.tmp', '/plan.md', '/.env'], (req, res) => res.status(404).end());
app.use(express.static(__dirname, { index: 'index.html', etag: true, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0, setHeaders(res, filePath) { if (filePath.endsWith('service-worker.js') || filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.use((req, res, next) => { if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' }); if (req.method !== 'GET' && req.method !== 'HEAD') return next(); res.sendFile(path.join(__dirname, 'index.html')); });
app.use((err, req, res, next) => { console.error('server error:', err.message); res.status(500).json({ error: 'server_error' }); });

function counts() { return { users: db.users.length, listings: db.listings.length, views: db.listings.reduce((s, l) => s + (Number(l.views) || 0), 0), messages: db.messages.length, reviews: db.reviews.length, reports: db.reports.length, banners: db.homepageBanners.length, ads: db.animatedAds.length, uptime: Math.floor(process.uptime()) + 's' }; }

app.listen(PORT, HOST, () => { console.log(`سوق الشورجة يستمع على ${HOST}:${PORT}`); console.log(`المستخدمون: ${db.users.length} — الإعلانات: ${db.listings.length}`); });
process.on('SIGTERM', () => { try { saveDB(); } finally { process.exit(0); } });
process.on('SIGINT', () => { try { saveDB(); } finally { process.exit(0); } });
