// 淺色／深色切換：預設跟隨系統，手動切換後記住
const root = document.documentElement;
const themeBtn = document.getElementById('theme-btn');
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const icons = {
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
};
const current = () => root.dataset.theme || (sysDark.matches ? 'dark' : 'light');
function renderThemeBtn() {
  const next = current() === 'dark' ? 'light' : 'dark';
  themeBtn.innerHTML = icons[next] + (next === 'light' ? '淺色' : '深色');
  themeBtn.setAttribute('aria-label', '切換為' + (next === 'light' ? '淺色' : '深色') + '模式');
}
themeBtn.addEventListener('click', () => {
  const next = current() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('npm-south-theme', next); } catch (e) {}
  renderThemeBtn();
});
sysDark.addEventListener('change', renderThemeBtn);
renderThemeBtn();

// ---------- 美食資料與地圖 ----------
const navUrl = s => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.name + ' ' + s.addr.replace(/（.*?）/g, ''));

let pinNo = 0;
SHOPS.forEach(s => { if (s.ll) s.no = ++pinNo; });

// 營業狀態：依 open 欄位與台灣時間推算（國定假日、臨時公休無法反映）
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3);
function parseOpen(spec) {
  const week = {};
  spec.split(';').forEach(part => {
    const [days, times] = part.trim().split(' ');
    const ranges = times ? times.split(',').map(r => r.split('-').map(toMin)) : null;
    days.split(',').forEach(d => {
      const [a, b] = d.split('-').map(Number);
      for (let i = a; i <= (b || a); i++) week[i] = ranges;
    });
  });
  return week;
}
function taipeiNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1, min: +p.hour * 60 + +p.minute };
}
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function shopStatus(s) {
  if (!s.open) return null;
  const { day, min } = taipeiNow();
  const week = parseOpen(s.open);
  if (!(day in week)) return { cls: 'off', text: '今日公休' };
  const ranges = week[day];
  if (!ranges) return { cls: 'unknown', text: '今天有營業・時間未載明' };
  const cur = ranges.find(([a, b]) => min >= a && min < b);
  if (cur) return { cls: 'open', text: '營業中・到 ' + hhmm(cur[1]) };
  const next = ranges.find(([a]) => min < a);
  if (next) return { cls: 'later', text: '休息中・' + hhmm(next[0]) + ' 開' };
  return { cls: 'off', text: '今日已打烊' };
}
function renderStatus() {
  SHOPS.forEach(s => {
    if (!s.el) return;
    const st = shopStatus(s);
    s.el.className = 'status ' + (st ? st.cls : '');
    s.el.textContent = st ? st.text : '';
    s.el.title = s.off === '未載明' ? '公休日未載明，請先電話確認' : '';
  });
}

// ---------- 依日期自動更新：過期提醒、今日開館、日落 ----------
const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
// data-from／data-until（含當天）範圍外的內容自動隱藏；提醒框裡的項目都過期就整框收起
function applyDates() {
  const today = todayStr();
  document.querySelectorAll('[data-from], [data-until]').forEach(el => {
    const { from, until } = el.dataset;
    el.hidden = !!((from && today < from) || (until && today > until));
  });
  document.querySelectorAll('.notice').forEach(n => {
    const items = [...n.querySelectorAll(':scope > .ni')];
    if (items.length) n.hidden = items.every(i => i.hidden);
  });
  // 資料確認日期超過 60 天，提醒以官網為準
  document.querySelectorAll('.asof[data-date]').forEach(el => {
    el.classList.toggle('stale', (Date.parse(today) - Date.parse(el.dataset.date)) / 864e5 > 60);
  });
}

// 南院日落時間（NOAA 簡化公式，回傳台灣時間的分鐘數）
function sunsetMin(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const n = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 864e5;
  const g = 2 * Math.PI / 365 * (n - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const lat = MUSEUM[0] * Math.PI / 180;
  const ha = Math.acos(Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl));
  return Math.round(720 - 4 * (MUSEUM[1] - ha * 180 / Math.PI) - eqt + 480);
}

// 展廳：週二至週五 09:00–17:00、週末 09:00–18:00、週一休館（國定假日與連假週一無法反映）
const FREE_DAYS = ['01-01', '05-18', '09-27', '10-10'];
function museumStatus() {
  const { day, min } = taipeiNow();
  const today = todayStr();
  const close = day >= 6 ? 18 * 60 : 17 * 60;
  let st;
  if (day === 1) st = { cls: 'off', text: '今天週一，展廳休館；戶外園區照常開放' };
  else if (min < 9 * 60) st = { cls: 'later', text: '展廳 09:00 開館，今天開到 ' + hhmm(close) };
  else if (min < close) st = { cls: 'open', text: '展廳開放中・到 ' + hhmm(close) };
  else st = { cls: 'off', text: '展廳今日已閉館' + (min < 22 * 60 ? '；戶外園區開到 22:00' : '') };
  if (FREE_DAYS.includes(today.slice(5)) && day !== 1) st.text += '・今天全館免費';
  st.sun = '今天日落約 ' + hhmm(sunsetMin(today));
  return st;
}
function renderToday() {
  applyDates();
  const st = museumStatus();
  const el = document.getElementById('today-status');
  el.hidden = false;
  el.innerHTML = '<b>今日南院</b><span class="status ' + st.cls + '">' + st.text + '</span><small>' + st.sun + '・國定假日與連假週一的開館時間請查官網</small>';
  const [, m, d] = todayStr().split('-').map(Number);
  document.querySelectorAll('.sun-today').forEach(s => { s.textContent = '今天（' + m + '/' + d + '）約 ' + hhmm(sunsetMin(todayStr())); });
}

const driveText = s => s.drive === '館內' ? '就在南院館內' : '南大門開車' + s.drive;

document.querySelectorAll('.shops').forEach(ul => {
  SHOPS.filter(s => s.area === ul.dataset.area).forEach(s => {
    const li = document.createElement('li');
    li.className = 'shop';
    li.innerHTML =
      '<div class="shop-head">' +
        (s.ll ? '<button class="num" type="button" aria-label="在地圖上顯示' + s.name + '">' + s.no + '</button>'
              : '<button class="num" type="button" disabled title="地圖未標示">–</button>') +
        '<div><b>' + s.name + '</b><small>' + s.note + '</small><span class="status"></span></div>' +
      '</div>' +
      '<p class="shop-desc">' + s.desc + '</p>' +
      '<dl><dt>地址</dt><dd>' + s.addr + '</dd><dt>時間</dt><dd>' + s.hours + '</dd><dt>公休</dt><dd>' + s.off + '</dd>' +
        (s.tel ? '<dt>電話</dt><dd>' + s.tel + '</dd>' : '') + '</dl>' +
      '<div class="shop-links">' +
        '<a href="' + navUrl(s) + '" target="_blank" rel="noopener">導航</a>' +
        (s.fb ? '<a href="' + s.fb + '" target="_blank" rel="noopener">Facebook</a>' : '') +
      '</div>';
    if (s.ll) li.querySelector('.num').addEventListener('click', () => focusShop(s));
    s.el = li.querySelector('.status');
    ul.appendChild(li);
  });
});
const MUSEUM = [23.47384, 120.29233];   // 南院本館（OSM）
renderStatus();
renderToday();
setInterval(() => { renderStatus(); renderToday(); }, 60000);

let map;
const markers = new Map();
// OpenStreetMap 圖磚：需經 http(s) 開啟（file:// 沒有 Referer 會被擋），本機預覽請用 localhost
const osmLayer = () => L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> 貢獻者'
});
function initMap() {
  if (map || !window.L) return;
  map = L.map('map', { scrollWheelZoom: false });
  osmLayer().addTo(map);
  L.marker(MUSEUM, {
    icon: L.divIcon({ className: '', html: '<div class="pin museum">南</div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
    zIndexOffset: 1000
  }).addTo(map).bindPopup('<b>故宮南院</b>本館');
  SHOPS.filter(s => s.ll).forEach(s => {
    // 館內餐廳與南院標記同點，圖示往右上偏移避免重疊
    const anchor = s.nudge ? [-4, 30] : [13, 13];
    const m = L.marker(s.ll, { icon: L.divIcon({ className: '', html: '<div class="pin">' + s.no + '</div>', iconSize: [26, 26], iconAnchor: anchor, popupAnchor: s.nudge ? [17, -30] : [0, -13] }) })
      .addTo(map)
      .bindPopup(() => {
        const st = shopStatus(s);
        return '<b>' + s.name + '</b>' + (st ? '<span class="status ' + st.cls + '">' + st.text + '</span><br>' : '') +
          s.hours + '<br>公休：' + s.off + (s.drive ? '<br>' + driveText(s) : '') + '<br><a href="' + navUrl(s) + '" target="_blank" rel="noopener">導航 →</a>';
      });
    markers.set(s, m);
  });
  showArea('南院');
  initRings();
}
// 以南院為中心的直線距離圈（公里）；標籤放在圓上最靠近畫面中央的位置
const RINGS = [1, 2, 3, 5, 10, 15, 20];
let ringLabels = [];
function initRings() {
  RINGS.forEach(km => {
    L.circle(MUSEUM, { radius: km * 1000, className: km <= 3 ? 'dist-ring near' : 'dist-ring', interactive: false }).addTo(map);
    const label = L.marker(MUSEUM, { interactive: false, keyboard: false, zIndexOffset: -1000,
      icon: L.divIcon({ className: '', html: '<span class="ring-label">' + km + ' km</span>', iconSize: [0, 0] }) }).addTo(map);
    ringLabels.push({ km, label });
  });
  map.on('zoomend moveend', placeRingLabels);
  placeRingLabels();
}
function placeRingLabels() {
  const c = map.latLngToContainerPoint(MUSEUM);
  const size = map.getSize();
  const mid = size.divideBy(2);
  const d = mid.subtract(c);
  const base = Math.hypot(d.x, d.y) < 20 ? -Math.PI / 4 : Math.atan2(d.y, d.x);
  const kmPx = c.distanceTo(map.latLngToContainerPoint([MUSEUM[0] + 1 / 111.32, MUSEUM[1]]));
  const inView = p => p.x > 24 && p.y > 14 && p.x < size.x - 24 && p.y < size.y - 14;
  let last = -Infinity;
  ringLabels.forEach(({ km, label }) => {
    const r = km * kmPx;
    // 從朝向畫面中央的方向開始，左右交替找一個落在畫面內的位置
    let p = null;
    for (let i = 0; i <= 24 && !p; i++) {
      const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 12;
      const q = c.add(L.point(Math.cos(a) * r, Math.sin(a) * r));
      if (inView(q)) p = q;
    }
    // 圈太小、離上一個標籤太近或整圈都在畫面外就不顯示
    const show = p && r > 24 && r - last > 34;
    if (p) label.setLatLng(map.containerPointToLatLng(p));
    const el = label.getElement();
    if (el) el.style.display = show ? '' : 'none';
    if (show) last = r;
  });
}
function showArea(area) {
  document.querySelectorAll('.chips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.area === area));
  const pts = SHOPS.filter(s => s.ll && (!area || s.area === area)).map(s => s.ll);
  if (area === '南院' || !area) pts.push(MUSEUM);
  map.fitBounds(pts, { padding: [28, 28], maxZoom: 17 });
}
function focusShop(s) {
  document.getElementById('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
  map.setView(s.ll, 17);
  markers.get(s).openPopup();
}
document.querySelectorAll('.chips button').forEach(b => b.addEventListener('click', () => showArea(b.dataset.area)));

// ---------- 園區地圖（看展頁） ----------
let parkMap;
const SPOT_MARK = { photo: '景', art: '藝', park: 'P', bus: '車' };
function initParkMap() {
  if (parkMap || !window.L) return;
  parkMap = L.map('park-map', { scrollWheelZoom: false, zoomSnap: 0.25 });
  osmLayer().addTo(parkMap);
  L.marker(MUSEUM, {
    icon: L.divIcon({ className: '', html: '<div class="pin museum">南</div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
    zIndexOffset: 1000
  }).addTo(parkMap).bindPopup('<b>故宮南院本館</b>展廳所在的主建築。');
  SPOTS.forEach(s => {
    L.marker(s.ll, { icon: L.divIcon({ className: '', html: '<div class="pin spot-' + s.type + '">' + SPOT_MARK[s.type] + '</div>', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -11] }) })
      .addTo(parkMap)
      .bindPopup('<b>' + s.name + '</b>' + s.desc);
  });
  // 一開始只框住拍照點與公共藝術；停車場在南北兩端，拖曳地圖就看得到
  const core = SPOTS.filter(s => s.type === 'photo' || s.type === 'art').map(s => s.ll);
  parkMap.fitBounds(core.concat([MUSEUM]), { padding: [14, 14] });
}

// 分頁：依網址 # 切換，支援返回鍵
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.tabbar a');
function showPage() {
  const id = location.hash.slice(1);
  const target = document.getElementById(id);
  const active = target && target.classList.contains('page') ? id : 'home';
  pages.forEach(p => { p.hidden = p.id !== active; });
  navLinks.forEach(a => {
    if (a.getAttribute('href') === '#' + active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // 瀏覽器會先捲到 #錨點，延後一拍再回到頁首
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  // 地圖要在容器可見後才能正確計算尺寸
  if (active === 'food') { initMap(); if (map) map.invalidateSize(); }
  if (active === 'see') { initParkMap(); if (parkMap) parkMap.invalidateSize(); }
}
window.addEventListener('hashchange', showPage);
showPage();

// 一日／二日切換
const tabs = document.querySelectorAll('.seg [role="tab"]');
function select(tab) {
  tabs.forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next); next.focus();
    }
  });
});

// 勾選清單記在本機瀏覽器
const boxes = document.querySelectorAll('.check input');
let saved = [];
try { saved = JSON.parse(localStorage.getItem('npm-south-check-v4') || '[]'); } catch (e) {}
boxes.forEach((b, i) => {
  b.checked = !!saved[i];
  b.addEventListener('change', () => {
    try { localStorage.setItem('npm-south-check-v4', JSON.stringify([...boxes].map(x => x.checked))); } catch (e) {}
  });
});

// ---------- 首頁：水墨開場的視差、浮現與數字 ----------
(() => {
  const home = document.getElementById('home');
  const par = home.querySelector('.ik-par'), mast = home.querySelector('.ik-mast'), copy = home.querySelector('.ik-copy');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking || home.hidden || reduce.matches) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = Math.min(scrollY, innerHeight);
      par.style.transform = `translate3d(0,${y * .3}px,0) scale(${1 + y / innerHeight * .06})`;
      mast.style.transform = `translate3d(0,${y * .14}px,0)`;
      copy.style.transform = `translate3d(0,${y * -.08}px,0)`;
      mast.style.opacity = copy.style.opacity = Math.max(0, 1 - y / innerHeight * 1.3);
    });
  }, { passive: true });

  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    if (!e.target.classList.contains('ik-stats')) return;
    const nums = [...e.target.querySelectorAll('dd')], t0 = performance.now();
    (function step(now) {
      const k = ease(Math.min(1, (now - t0) / 1600));
      nums.forEach(el => { el.firstChild.textContent = Math.round(+el.dataset.to * k); });
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }), { rootMargin: '0px 0px -10% 0px' });
  home.querySelectorAll('.rv').forEach(el => io.observe(el));
})();

// 其他分頁：內容捲進畫面時淡入浮現
(() => {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.page:not(#home) :is(.notice, .seg, .day-title, .timeline > li, .card, .ex-list > li, .photos figure, .list > li, .shops > li, .check > li, .tips > li, .sub, .more)')
    .forEach(el => { el.classList.add('rv'); io.observe(el); });
})();
