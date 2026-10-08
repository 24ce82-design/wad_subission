// FoodBridge - zero-dependency Node.js server (built-in http module). Run: node server.js
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'change-this-secret';
const DB_FILE = path.join(__dirname, 'data.json');
const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

// ---------- tiny persistence layer ----------
let db = { users: [], listings: [], nextId: 1 };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const id = () => db.nextId++;

// ---------- auth helpers ----------
const hash = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
const verify = (pw, stored) => {
  const [salt, h] = stored.split(':');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash(pw, salt).split(':')[1]));
};
const sign = (payload) => {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 864e5 })).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
};
const getUser = (req) => {
  try {
    const [body, sig] = (req.headers.authorization || '').replace('Bearer ', '').split('.');
    const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
    if (sig !== expect) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url'));
    return p.exp < Date.now() ? null : db.users.find(u => u.id === p.id) || null;
  } catch { return null; }
};
const clean = (s, n = 200) => String(s || '').trim().slice(0, n);

// ---------- route handlers: return [status, data] ----------
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern + '$'), handler });
const needAuth = (h) => (ctx) => ctx.user ? h(ctx) : [401, { error: 'Please log in' }];

route('POST', '/api/register', ({ body }) => {
  const name = clean(body.name, 60), email = clean(body.email, 100).toLowerCase();
  const password = String(body.password || ''), role = body.role;
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return [400, { error: 'Valid name and email required' }];
  if (password.length < 6) return [400, { error: 'Password must be 6+ characters' }];
  if (!['donor', 'receiver'].includes(role)) return [400, { error: 'Role must be donor or receiver' }];
  if (db.users.some(u => u.email === email)) return [409, { error: 'Email already registered' }];
  const user = { id: id(), name, email, role, password: hash(password) };
  db.users.push(user); save();
  return [200, { token: sign({ id: user.id }), user: { id: user.id, name, role } }];
});

route('POST', '/api/login', ({ body }) => {
  const user = db.users.find(u => u.email === clean(body.email).toLowerCase());
  if (!user || !verify(String(body.password || ''), user.password)) return [401, { error: 'Invalid email or password' }];
  return [200, { token: sign({ id: user.id }), user: { id: user.id, name: user.name, role: user.role } }];
});

route('GET', '/api/listings', ({ query }) => {
  const q = query.get('q') || '', category = query.get('category') || '', city = query.get('city') || '';
  const now = Date.now();
  return [200, db.listings
    .filter(l => l.status === 'available' && new Date(l.expiresAt).getTime() > now)
    .filter(l => !category || l.category === category)
    .filter(l => !city || l.city.toLowerCase().includes(city.toLowerCase()))
    .filter(l => !q || (l.title + l.description).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))];
});

route('POST', '/api/listings', needAuth(({ user, body: b }) => {
  if (user.role !== 'donor') return [403, { error: 'Only donors can post food' }];
  const servings = parseInt(b.servings, 10);
  if (!clean(b.title) || !clean(b.city) || !(servings > 0) || isNaN(Date.parse(b.expiresAt)))
    return [400, { error: 'Title, city, servings and expiry are required' }];
  const listing = {
    id: id(), donorId: user.id, donorName: user.name,
    title: clean(b.title, 80), description: clean(b.description, 300),
    category: ['cooked', 'bakery', 'produce', 'packaged'].includes(b.category) ? b.category : 'cooked',
    servings, city: clean(b.city, 60), address: clean(b.address, 120),
    expiresAt: new Date(b.expiresAt).toISOString(), status: 'available', claimedBy: null,
    createdAt: new Date().toISOString()
  };
  db.listings.push(listing); save();
  return [201, listing];
}));

route('POST', '/api/listings/(\\d+)/claim', needAuth(({ user, params }) => {
  if (user.role !== 'receiver') return [403, { error: 'Only receivers can claim food' }];
  const l = db.listings.find(x => x.id === +params[0]);
  if (!l) return [404, { error: 'Listing not found' }];
  if (l.status !== 'available') return [409, { error: 'Already claimed' }];
  l.status = 'claimed'; l.claimedBy = user.id; l.claimedByName = user.name; save();
  return [200, l];
}));

route('DELETE', '/api/listings/(\\d+)', needAuth(({ user, params }) => {
  const i = db.listings.findIndex(x => x.id === +params[0] && x.donorId === user.id);
  if (i < 0) return [404, { error: 'Not found' }];
  db.listings.splice(i, 1); save();
  return [200, { ok: true }];
}));

route('GET', '/api/me/listings', needAuth(({ user }) => {
  const key = user.role === 'donor' ? 'donorId' : 'claimedBy';
  return [200, db.listings.filter(l => l[key] === user.id).reverse()];
}));

route('GET', '/api/stats', () => {
  const meals = db.listings.filter(l => l.status === 'claimed').reduce((s, l) => s + l.servings, 0);
  return [200, {
    mealsSaved: meals,
    kgFoodWasteAvoided: Math.round(meals * 0.4),   // ~0.4 kg per serving (assumption)
    co2AvoidedKg: Math.round(meals * 0.4 * 2.5),   // ~2.5 kg CO2e per kg food waste (assumption)
    donors: db.users.filter(u => u.role === 'donor').length,
    receivers: db.users.filter(u => u.role === 'receiver').length,
    activeListings: db.listings.filter(l => l.status === 'available').length
  }];
});

// ---------- server ----------
const send = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
    req.on('end', () => {
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { error: 'Invalid JSON' }); }
      for (const r of routes) {
        const m = r.method === req.method && url.pathname.match(r.re);
        if (m) {
          try { const [s, d] = r.handler({ body, query: url.searchParams, params: m.slice(1), user: getUser(req) }); return send(res, s, d); }
          catch (e) { console.error(e); return send(res, 500, { error: 'Server error' }); }
        }
      }
      send(res, 404, { error: 'Not found' });
    });
    return;
  }
  // static files
  const file = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`FoodBridge running at http://localhost:${PORT}`));
