const $ = id => document.getElementById(id);
let token = localStorage.getItem('fb_token');
let user = JSON.parse(localStorage.getItem('fb_user') || 'null');
let registering = false;

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderNav() {
  $('nav').innerHTML = user
    ? `<span>Hi, ${esc(user.name)} (${user.role})</span><button id="out">Logout</button>`
    : `<button id="in">Login / Register</button>`;
  if (user) $('out').onclick = () => { localStorage.clear(); token = user = null; init(); };
  else $('in').onclick = () => $('authBox').classList.toggle('hidden');
  $('donorBox').classList.toggle('hidden', !(user && user.role === 'donor'));
  $('mineBox').classList.toggle('hidden', !user);
  if (user) $('authBox').classList.add('hidden');
}

function setAuthMode(reg) {
  registering = reg;
  $('authTitle').textContent = reg ? 'Register' : 'Login';
  $('aName').classList.toggle('hidden', !reg);
  $('aRole').classList.toggle('hidden', !reg);
  $('aSwitch').textContent = reg ? 'Already have an account? Login' : 'New here? Register';
}
$('aSwitch').onclick = e => { e.preventDefault(); setAuthMode(!registering); };
$('aSubmit').onclick = async () => {
  try {
    const body = { email: $('aEmail').value, password: $('aPass').value };
    if (registering) Object.assign(body, { name: $('aName').value, role: $('aRole').value });
    const r = await api(registering ? '/api/register' : '/api/login', 'POST', body);
    token = r.token; user = r.user;
    localStorage.setItem('fb_token', token); localStorage.setItem('fb_user', JSON.stringify(user));
    $('aMsg').textContent = ''; init();
  } catch (e) { $('aMsg').textContent = e.message; }
};

$('lSubmit').onclick = async () => {
  try {
    await api('/api/listings', 'POST', {
      title: $('lTitle').value, description: $('lDesc').value, category: $('lCat').value,
      servings: $('lServ').value, city: $('lCity').value, address: $('lAddr').value, expiresAt: $('lExp').value
    });
    ['lTitle', 'lDesc', 'lServ', 'lCity', 'lAddr', 'lExp'].forEach(i => $(i).value = '');
    $('lMsg').style.color = 'green'; $('lMsg').textContent = 'Posted!';
    loadAll();
  } catch (e) { $('lMsg').style.color = '#c62828'; $('lMsg').textContent = e.message; }
};

async function loadStats() {
  const s = await api('/api/stats');
  $('stats').innerHTML = [
    ['mealsSaved', 'Meals shared'], ['kgFoodWasteAvoided', 'kg waste avoided'],
    ['co2AvoidedKg', 'kg CO₂e avoided'], ['activeListings', 'Active listings'], ['donors', 'Donors']
  ].map(([k, l]) => `<div class="stat"><b>${s[k]}</b>${l}</div>`).join('');
}

async function loadListings() {
  const p = new URLSearchParams({ q: $('fQ').value, city: $('fCity').value, category: $('fCat').value });
  const items = await api('/api/listings?' + p);
  $('list').innerHTML = items.length ? items.map(l => `
    <div class="item">
      <span class="tag">${esc(l.category)}</span>
      <h4>${esc(l.title)}</h4>
      <div>${esc(l.description)}</div>
      <div class="meta">🍽 ${l.servings} servings · 📍 ${esc(l.city)}${l.address ? ', ' + esc(l.address) : ''}<br>
      ⏰ Pickup before ${new Date(l.expiresAt).toLocaleString()}<br>👤 ${esc(l.donorName)}</div>
      ${user && user.role === 'receiver' ? `<button data-claim="${l.id}">Claim</button>` : ''}
    </div>`).join('') : '<p>No food available right now. Check back soon!</p>';
  document.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
    try { await api(`/api/listings/${b.dataset.claim}/claim`, 'POST'); loadAll(); } catch (e) { alert(e.message); }
  });
}

async function loadMine() {
  if (!user) return;
  $('mineTitle').textContent = user.role === 'donor' ? 'My posted food' : 'My claimed food';
  const items = await api('/api/me/listings');
  $('mine').innerHTML = items.length ? items.map(l => `
    <div class="meta"><b>${esc(l.title)}</b> – ${l.servings} servings – <span class="tag">${l.status}</span>
    ${l.claimedByName && user.role === 'donor' ? ' by ' + esc(l.claimedByName) : ''}
    ${user.role === 'donor' && l.status === 'available' ? `<button class="danger" data-del="${l.id}">Delete</button>` : ''}</div>`).join('')
    : '<p>Nothing yet.</p>';
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    await api('/api/listings/' + b.dataset.del, 'DELETE'); loadAll();
  });
}

const loadAll = () => Promise.all([loadStats(), loadListings(), loadMine()]);
['fQ', 'fCity'].forEach(i => $(i).oninput = loadListings);
$('fCat').onchange = loadListings;
function init() { setAuthMode(false); renderNav(); loadAll(); }
init();
