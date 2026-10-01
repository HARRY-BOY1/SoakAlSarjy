/* =========================================================
   سوق الشورجة — السكربت الرئيسي الكامل
   ========================================================= */

/* ============ 1) الثوابت ============ */
const CURRENCY = 'د.ع';

const K = {
  users:'sq_users', listings:'sq_listings', favs:'sq_favs',
  msgs:'sq_msgs', notifs:'sq_notifs', reviews:'sq_reviews',
  recent:'sq_recent', session:'sq_session', theme:'sq_theme', lang:'sq_lang'
};

const CATEGORIES = [
  {id:'cars',        name:'سيارات',     nameEn:'Cars',         icon:'car'},
  {id:'realestate',  name:'عقارات',     nameEn:'Real Estate',  icon:'home'},
  {id:'electronics', name:'إلكترونيات', nameEn:'Electronics',  icon:'device-laptop'},
  {id:'mobiles',     name:'موبايلات',   nameEn:'Mobiles',      icon:'device-mobile'},
  {id:'furniture',   name:'أثاث',       nameEn:'Furniture',    icon:'sofa'},
  {id:'fashion',     name:'أزياء',      nameEn:'Fashion',      icon:'shirt'},
  {id:'jobs',        name:'وظائف',      nameEn:'Jobs',         icon:'briefcase'},
  {id:'services',    name:'خدمات',      nameEn:'Services',     icon:'tools'},
  {id:'animals',     name:'حيوانات',    nameEn:'Animals',      icon:'paw'},
  {id:'games',       name:'ألعاب',      nameEn:'Games',        icon:'device-gamepad-2'},
  {id:'sports',      name:'رياضة',      nameEn:'Sports',       icon:'ball-football'},
  {id:'other',       name:'أخرى',       nameEn:'Other',         icon:'package'}
];

const CITIES = ['بغداد','البصرة','الموصل','أربيل','النجف','كربلاء','كركوك','الأنبار','بابل',
  'ديالى','ذي قار','السليمانية','دهوك','واسط','ميسان','المثنى','صلاح الدين','القادسية'];
const LISTING_TYPES = {sale:'بيع',wanted:'مطلوب',exchange:'بدل/تبادل'};
const CONDITIONS = {new:'جديد',used:'مستعمل',refurbished:'مجدد'};

const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"%3E%3Crect width="800" height="600" fill="%23eef2f7"/%3E%3Cpath d="M250 390l90-105 75 82 60-65 125 138H200z" fill="%23cbd5e1"/%3E%3Ccircle cx="520" cy="220" r="48" fill="%23cbd5e1"/%3E%3Ctext x="400" y="500" text-anchor="middle" font-family="Arial" font-size="28" fill="%2364758b"%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';

/* ============ 2) أدوات مساعدة ============ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const esc = (s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = n=>Number(n||0).toLocaleString('en-US');
const iconHTML = (name, className='ui-icon') => `<img class="${className}" src="assets/icons/${esc(name)}.svg" alt="" aria-hidden="true"/>`;
const catObj = id=>CATEGORIES.find(c=>c.id===id)||{name:'أخرى',nameEn:'Other',icon:'package'};

function timeAgo(ts){
  const d = Math.floor((Date.now()-ts)/1000);
  if(d<60) return T('now');
  if(d<3600) return `${Math.floor(d/60)} ${T('min_ago')}`;
  if(d<86400) return `${Math.floor(d/3600)} ${T('hour_ago')}`;
  if(d<2592000) return `${Math.floor(d/86400)} ${T('day_ago')}`;
  return new Date(ts).toLocaleDateString('ar-EG');
}
function timeShort(ts){ return new Date(ts).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'}); }
function stars(n){ const full=Math.round(n); return '★'.repeat(full)+'☆'.repeat(5-full); }

function toast(msg,type=''){
  const t = document.createElement('div');
  t.className = 'toast '+type;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),320); },3200);
}

/* ضغط الصور */
function compressImage(file,maxSize=900,quality=.72){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w>h && w>maxSize){ h = Math.round(h*maxSize/w); w = maxSize; }
        else if(h>=w && h>maxSize){ w = Math.round(w*maxSize/h); h = maxSize; }
        const c = document.createElement('canvas');
        c.width=w; c.height=h;
        const ctx = c.getContext('2d');
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============ 3) التخزين ============ */
const store = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v===null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }
    catch(e){ toast('الذاكرة ممتلئة! استخدم صوراً أصغر','error'); return false; } }
};

/* ============ 4) المتغيرات العامة ============ */
let users     = store.get(K.users,[]);
let listings  = store.get(K.listings,[]);
let favs      = store.get(K.favs,[]);
let msgs      = store.get(K.msgs,[]);
let notifs    = store.get(K.notifs,[]);
let reviews   = store.get(K.reviews,[]);
let recent    = store.get(K.recent,[]);
let currentUser = null;
let lang = store.get(K.lang,'ar');

let filters = { q:'', cat:'all', city:'all', min:'', max:'', condition:'all', type:'all', sort:'new' };
let pendingImages = [];
let activeChat = null;
let activeOfferListingId = null;

/* ============ 5) تنظيف بيانات العرض القديمة ============ */
function seed(){
  const demoUserIds = new Set(['u_demo1','u_demo2']);
  const hadDemoData = users.some(u=>demoUserIds.has(u.id)) ||
    listings.some(l=>demoUserIds.has(l.userId) || (l.images||[]).some(img=>String(img).includes('picsum.photos')));
  if(!hadDemoData) return;

  users = users.filter(u=>!demoUserIds.has(u.id));
  listings = listings.filter(l=>!demoUserIds.has(l.userId) && !(l.images||[]).some(img=>String(img).includes('picsum.photos')));
  reviews = reviews.filter(r=>!demoUserIds.has(r.targetId) && !demoUserIds.has(r.authorId));
  favs = favs.filter(f=>!demoUserIds.has(f.userId));
  msgs = msgs.filter(m=>!demoUserIds.has(m.from) && !demoUserIds.has(m.to));
  notifs = notifs.filter(n=>!demoUserIds.has(n.userId));
  store.set(K.users,users); store.set(K.listings,listings); store.set(K.reviews,reviews);
  store.set(K.favs,favs); store.set(K.msgs,msgs); store.set(K.notifs,notifs);
}

/* ============ 6) الترجمة ============ */
const TRANSLATIONS = {
  ar:{ now:'الآن', min_ago:'دقيقة', hour_ago:'ساعة', day_ago:'يوم' },
  en:{ now:'now', min_ago:'min ago', hour_ago:'hour ago', day_ago:'day ago' }
};
function T(key){ return (TRANSLATIONS[lang]||TRANSLATIONS.ar)[key] || key; }

function toggleLang(){
  lang = lang==='ar' ? 'en' : 'ar';
  store.set(K.lang,lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='ar' ? 'rtl' : 'ltr';
  const lc = $('#langCode'); if(lc) lc.textContent = lang.toUpperCase();
  toast(lang==='ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English');
  renderAll();
}

/* ============ 7) الثيم ============ */
function applyTheme(){
  const t = store.get(K.theme,'light');
  document.documentElement.setAttribute('data-theme',t);
  const icon = $('#themeIcon');
  if(icon) icon.setAttribute('href', t==='dark' ? '#i-sun' : '#i-moon');
}
function toggleTheme(){
  const t = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme',t);
  store.set(K.theme,t);
  const icon = $('#themeIcon');
  if(icon) icon.setAttribute('href', t==='dark' ? '#i-sun' : '#i-moon');
}

/* ============ 8) عرض الأقسام ============ */
/* الشريط العلوي (navbar) */
function renderCategories(){
  const bar = $('#catsBar');
  if(!bar) return;
  bar.innerHTML = `<button class="cat active" data-cat="all">${iconHTML('package')} الكل</button>` +
    CATEGORIES.map(c=>`<button class="cat" data-cat="${c.id}">${iconHTML(c.icon)} ${c.name}</button>`).join('');

  bar.onclick = e=>{
    const b = e.target.closest('.cat'); if(!b) return;
    setCategory(b.dataset.cat);
  };
}

/* الشريط الجانبي للأقسام */
function renderSideCats(){
  const body = $('#sideCatsBody');
  if(!body) return;
  body.innerHTML = CATEGORIES.map(c=>`
    <div class="side-cat-item" data-cat="${c.id}">
      ${iconHTML(c.icon)} ${c.name}
    </div>
  `).join('');

  body.onclick = e=>{
    const item = e.target.closest('[data-cat]');
    if(item) setCategory(item.dataset.cat);
  };
}

/* أزرار الأقسام السريعة */
function renderQuickCats(){
  const grid = $('#quickCats');
  if(!grid) return;
  grid.innerHTML = CATEGORIES.slice(0,12).map(c=>`
    <div class="qcat" data-cat="${c.id}">
      <div class="qcat-em">${iconHTML(c.icon)}</div>
      <b>${c.name}</b>
    </div>
  `).join('');

  grid.onclick = e=>{
    const item = e.target.closest('[data-cat]');
    if(item) setCategory(item.dataset.cat);
  };
}

/* فلتر الأقسام بالشريط الجانبي */
function renderFilterCats(){
  const box = $('#filterCats');
  if(!box) return;
  box.innerHTML = `<div class="filter-cat-item active" data-cat="all">${iconHTML('package')} الكل</div>` +
    CATEGORIES.map(c=>`<div class="filter-cat-item" data-cat="${c.id}">${iconHTML(c.icon)} ${c.name}</div>`).join('');

  box.onclick = e=>{
    const item = e.target.closest('[data-cat]');
    if(item) setCategory(item.dataset.cat);
  };
}

/* تغيير القسم في كل الأماكن */
function setCategory(catId){
  filters.cat = catId;
  $$('.cat').forEach(x=>x.classList.toggle('active', x.dataset.cat===catId));
  $$('.filter-cat-item').forEach(x=>x.classList.toggle('active', x.dataset.cat===catId));
  renderListings();
  const grid = $('#grid');
  if(grid){
    window.scrollTo({top: grid.offsetTop - 160, behavior:'smooth'});
  }
}

/* ============ 9) السلايدر ============ */
function initSlider(){
  const track = $('#sliderTrack');
  const dots = $('#sliderDots');
  if(!track || !dots) return;

  const slides = track.children.length;
  let idx = 0;
  let timer;

  dots.innerHTML = Array.from({length:slides}, (_,i)=>
    `<button data-i="${i}" class="${i===0?'active':''}"></button>`
  ).join('');

  function go(i){
    idx = (i + slides) % slides;
    track.style.transform = `translateX(${idx * 100}%)`;
    $$('button', dots).forEach((d,k)=>d.classList.toggle('active', k===idx));
  }

  dots.onclick = e=>{
    const b = e.target.closest('button');
    if(b){ go(Number(b.dataset.i)); reset(); }
  };
  const nextBtn = $('#sliderNext');
  const prevBtn = $('#sliderPrev');
  if(nextBtn) nextBtn.onclick = ()=>{ go(idx+1); reset(); };
  if(prevBtn) prevBtn.onclick = ()=>{ go(idx-1); reset(); };

  /* أزرار الأقسام داخل السلايدات */
  document.querySelectorAll('[data-slide-go]').forEach(btn=>{
    btn.onclick = ()=> setCategory(btn.dataset.slideGo);
  });

  function start(){ timer = setInterval(()=>go(idx+1), 5000); }
  function reset(){ clearInterval(timer); start(); }
  start();
}

/* ============ 10) المصادقة ============ */
function renderAuth(){
  const area = $('#authArea');
  if(!area) return;

  if(currentUser){
    area.innerHTML = `
      <div class="dropdown">
        <div class="user-chip" id="userChip">
          <div class="avatar">${esc(currentUser.name.charAt(0))}</div>
          <span>${esc(currentUser.name.split(' ')[0])}</span>
        </div>
        <div class="dd-menu" id="userMenu">
          <button class="dd-item" data-go="profile"><svg class="ic" style="width:17px"><use href="#i-user"/></svg> ملفي الشخصي</button>
          <button class="dd-item" data-go="my"><svg class="ic" style="width:17px"><use href="#i-grid"/></svg> إعلاناتي</button>
          <button class="dd-item" data-go="fav"><svg class="ic" style="width:17px"><use href="#i-heart"/></svg> المفضلة</button>
          <button class="dd-item" data-go="inbox"><svg class="ic" style="width:17px"><use href="#i-mail"/></svg> الرسائل</button>
          <div class="dd-sep"></div>
          <button class="dd-item" id="logoutBtn" style="color:var(--danger)">
            <svg class="ic" style="width:17px"><use href="#i-out"/></svg> تسجيل الخروج
          </button>
        </div>
      </div>`;

    $('#userChip').onclick = e=>{ e.stopPropagation(); $('#userMenu').classList.toggle('open'); };
    $('#userMenu').onclick = e=>{
      const g = e.target.closest('[data-go]');
      if(g){
        $('#userMenu').classList.remove('open');
        if(g.dataset.go==='my') openMy();
        if(g.dataset.go==='fav') openFav();
        if(g.dataset.go==='inbox') openInbox();
        if(g.dataset.go==='profile') openProfile(currentUser.id);
      }
    };
    $('#logoutBtn').onclick = ()=>{
      currentUser = null;
      store.set(K.session,null);
      renderAll();
      toast('تم تسجيل الخروج');
    };
  } else {
    area.innerHTML = `<button class="btn btn-ghost" id="loginBtn">
      <svg class="ic"><use href="#i-user"/></svg><span class="login-label">دخول</span>
    </button>`;
    $('#loginBtn').onclick = ()=>openAuth('login');
  }
}

function openAuth(tab='login'){ switchAuthTab(tab); openOverlay('#ovAuth'); }
function switchAuthTab(tab){
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  const fl = $('#formLogin');
  const fr = $('#formReg');
  const at = $('#authTitle');
  if(fl) fl.style.display = tab==='login' ? '' : 'none';
  if(fr) fr.style.display = tab==='reg'   ? '' : 'none';
  if(at) at.textContent   = tab==='login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
}

/* ============ 11) الفلترة والعرض ============ */
function getFiltered(){
  let arr = listings.slice();
  const {q,cat,city,min,max,condition,type,sort} = filters;

  if(cat!=='all')  arr = arr.filter(l=>l.cat===cat);
  if(city!=='all') arr = arr.filter(l=>l.city===city);
  if(min!=='')     arr = arr.filter(l=>Number(l.price)>=Number(min));
  if(max!=='')     arr = arr.filter(l=>Number(l.price)<=Number(max));
  if(condition!=='all') arr = arr.filter(l=>(l.condition||'used')===condition);
  if(type!=='all') arr = arr.filter(l=>(l.type||'sale')===type);
  if(q.trim()){
    const s = q.trim().toLowerCase();
    arr = arr.filter(l=>(l.title+' '+l.desc+' '+l.city+' '+(l.brand||'')+' '+(l.model||'')+' '+(l.tags||[]).join(' ')+' '+catObj(l.cat).name).toLowerCase().includes(s));
  }

  if(sort==='new')        arr.sort((a,b)=>b.ts-a.ts);
  else if(sort==='old')   arr.sort((a,b)=>a.ts-b.ts);
  else if(sort==='cheap') arr.sort((a,b)=>a.price-b.price);
  else if(sort==='expensive') arr.sort((a,b)=>b.price-a.price);
  else if(sort==='views') arr.sort((a,b)=>(b.views||0)-(a.views||0));
  else if(sort==='rated') arr.sort((a,b)=>avgRating(b.userId)-avgRating(a.userId));

  arr.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));
  return arr;
}

function avgRating(userId){
  const rs = reviews.filter(r=>r.targetId===userId);
  if(!rs.length) return 0;
  return rs.reduce((s,r)=>s+r.rating,0)/rs.length;
}

/* ============ 12) بطاقة المنتج ============ */
function cardHTML(l){
  const img = (l.images && l.images[0]) ? l.images[0] : PLACEHOLDER_IMAGE;
  const isFav = currentUser && favs.some(f=>f.userId===currentUser.id && f.listingId===l.id);
  const seller = users.find(u=>u.id===l.userId) || {};
  const r = avgRating(l.userId);
  const rCount = reviews.filter(x=>x.targetId===l.userId).length;

  return `<article class="card" data-id="${l.id}">
    <div class="card-media">
      <img src="${esc(img)}" alt="${esc(l.title)}" loading="lazy"
           onerror="this.src='${PLACEHOLDER_IMAGE}'"/>
      <button class="fav-toggle ${isFav?'on':''}" data-fav="${l.id}">
        <svg class="ic" style="width:19px;height:19px"><use href="#i-heart"/></svg>
      </button>
      ${l.featured ? `<span class="tag">${iconHTML('star')} مميز</span>` : ''}
      ${seller.verified ? '<span class="verified-tag"><svg class="ic"><use href="#i-shield"/></svg> موثّق</span>' : ''}
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(l.title)}</h3>
      <div class="card-price">${l.type==='wanted'?'مطلوب من ':''}${num(l.price)} <small>${CURRENCY}</small></div>
      <div class="card-badges"><span>${CONDITIONS[l.condition||'used']||'مستعمل'}</span>${l.negotiable?'<span>قابل للتفاوض</span>':''}</div>
      ${rCount ? `<div class="card-rating"><span class="stars">${stars(r)}</span> (${rCount})</div>` : ''}
      <div class="card-meta">
        <span><svg class="ic"><use href="#i-pin"/></svg>${esc(l.city)}</span>
        <span><svg class="ic"><use href="#i-clock"/></svg>${timeAgo(l.ts)}</span>
      </div>
    </div>
  </article>`;
}

/* ============ 13) عرض الإعلانات ============ */
function renderListings(){
  const arr = getFiltered();
  const grid = $('#grid');
  if(!grid) return;

  const statL = $('#statListings'); if(statL) statL.textContent = listings.length;
  const statU = $('#statUsers');    if(statU) statU.textContent = users.length;
  const statV = $('#statViews');    if(statV) statV.textContent = num(listings.reduce((s,l)=>s+(l.views||0),0));

  const tbT = $('#tbTitle');
  const tbC = $('#tbCount');
  if(tbT) tbT.innerHTML = `<svg class="ic"><use href="#i-tag"/></svg> ` +
    (filters.cat==='all' ? 'أحدث الإعلانات' : catObj(filters.cat).em+' '+catObj(filters.cat).name);
  if(tbC) tbC.textContent = arr.length + ' إعلان';

  if(!arr.length){
    grid.innerHTML = `<div class="empty">
      <div class="em">🔍</div><h3>لا توجد إعلانات مطابقة</h3>
      <p>جرّب تغيير الفلاتر أو البحث بكلمات أخرى.</p>
    </div>`;
    return;
  }

  grid.innerHTML = arr.map(l=>cardHTML(l)).join('');
}

/* الأكثر رواجاً */
function renderTrending(){
  const strip = $('#trendStrip');
  if(!strip) return;
  const top = listings.slice().sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,8);
  strip.innerHTML = top.map(l=>cardHTML(l)).join('');
}

/* شوهدت مؤخراً */
function renderRecent(){
  const sect = $('#recentSection');
  const strip = $('#recentStrip');
  if(!sect || !strip) return;

  const valid = recent.map(id=>listings.find(l=>l.id===id)).filter(Boolean).slice(0,8);
  if(!valid.length){ sect.style.display='none'; return; }
  sect.style.display = '';
  strip.innerHTML = valid.map(l=>cardHTML(l)).join('');
}

function pushRecent(id){
  recent = [id, ...recent.filter(x=>x!==id)].slice(0,12);
  store.set(K.recent, recent);
}

/* ============ 14) تفاصيل الإعلان ============ */
function openDetail(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;

  l.views = (l.views||0)+1;
  store.set(K.listings,listings);
  pushRecent(id);

  const seller = users.find(u=>u.id===l.userId) || {name:'مستخدم', city:'—'};
  const imgs = (l.images && l.images.length) ? l.images : [PLACEHOLDER_IMAGE];
  const isFav = currentUser && favs.some(f=>f.userId===currentUser.id && f.listingId===l.id);
  const isMine = currentUser && currentUser.id===l.userId;

  const sellerReviews = reviews.filter(r=>r.targetId===l.userId);
  const rAvg = sellerReviews.length ? sellerReviews.reduce((s,r)=>s+r.rating,0)/sellerReviews.length : 0;
  const similar = listings.filter(x=>x.cat===l.cat && x.id!==l.id).slice(0,4);

  const detailBox = $('#detailBox');
  if(!detailBox) return;

  detailBox.innerHTML = `
    <div class="detail-gallery">
      <button class="close-x" data-close style="position:absolute;top:12px;inset-inline-start:12px;background:rgba(0,0,0,.5);color:#fff;z-index:5">
        <svg class="ic"><use href="#i-close"/></svg>
      </button>
      <div class="main-img"><img id="mainImg" src="${esc(imgs[0])}" alt="${esc(l.title)}"/></div>
      ${imgs.length>1 ? `<div class="thumbs-strip" id="strip">
        ${imgs.map((s,i)=>`<img src="${esc(s)}" data-i="${i}" class="${i===0?'active':''}"/>`).join('')}
      </div>` : ''}
    </div>

    <div class="detail-info">
      <div class="detail-price">${num(l.price)} <small>${CURRENCY}</small></div>
      <h2 class="detail-title">${esc(l.title)}</h2>

      <div class="chips">
        <span class="chip">${iconHTML(catObj(l.cat).icon)} ${catObj(l.cat).name}</span>
        <span class="chip"><svg class="ic"><use href="#i-check-circle"/></svg>${CONDITIONS[l.condition||'used']||'مستعمل'}</span>
        <span class="chip"><svg class="ic"><use href="#i-truck"/></svg>${l.delivery==='delivery'?'توصيل متاح':'استلام من البائع'}</span>
        <span class="chip"><svg class="ic"><use href="#i-pin"/></svg>${esc(l.city)}</span>
        <span class="chip"><svg class="ic"><use href="#i-clock"/></svg>${timeAgo(l.ts)}</span>
        <span class="chip"><svg class="ic"><use href="#i-eye"/></svg>${num(l.views)}</span>
      </div>

      <div class="seller-box" data-profile="${l.userId}">
        <div class="avatar">${esc((seller.name||'م').charAt(0))}</div>
        <div style="flex:1">
          <b>${esc(seller.name||'مستخدم')} ${seller.verified?'<svg class="ic" style="width:15px;color:var(--success)"><use href="#i-shield"/></svg>':''}</b>
          <small>${sellerReviews.length ? `${iconHTML('star','inline-icon')} ${rAvg.toFixed(1)} (${sellerReviews.length} تقييم)` : 'لا توجد تقييمات'} • ${esc(seller.city||'')}</small>
        </div>
        <svg class="ic" style="color:var(--muted)"><use href="#i-user"/></svg>
      </div>

      <div>
        <div style="font-weight:800;margin-bottom:7px">📝 الوصف</div>
        <div class="desc-box">${esc(l.desc)}</div>
      </div>

      <div class="spec-grid">
        ${l.brand?`<div><small>الماركة</small><b>${esc(l.brand)}</b></div>`:''}
        ${l.model?`<div><small>الموديل</small><b>${esc(l.model)}</b></div>`:''}
        <div><small>الكمية</small><b>${num(l.quantity||1)}</b></div>
        <div><small>السعر</small><b>${l.negotiable?'قابل للتفاوض':'ثابت'}</b></div>
      </div>

      ${similar.length ? `
      <div>
        <div style="font-weight:800;margin-bottom:10px">🔍 إعلانات مشابهة</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          ${similar.map(s=>{
            const im = (s.images&&s.images[0])||PLACEHOLDER_IMAGE;
            return `<div class="conv" data-similar="${s.id}" style="padding:8px">
              <img src="${esc(im)}" style="width:50px;height:50px;border-radius:9px;object-fit:cover;flex:none"/>
              <div class="conv-body">
                <b style="font-size:12.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(s.title)}</b>
                <p style="color:var(--primary);font-weight:800;font-size:12px">${num(s.price)} ${CURRENCY}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <div class="detail-actions">
        ${isMine ? `
          <div class="detail-actions-row">
            <button class="btn btn-ghost" data-qr="${l.id}"><svg class="ic"><use href="#i-qr"/></svg> QR</button>
            <button class="btn btn-ghost" data-print="${l.id}"><svg class="ic"><use href="#i-print"/></svg> طباعة</button>
            <button class="btn btn-danger" data-del="${l.id}"><svg class="ic"><use href="#i-trash"/></svg> حذف</button>
          </div>
        ` : `
          <button class="btn btn-primary btn-block" data-chat="${l.id}">
            <svg class="ic"><use href="#i-chat"/></svg> تواصل مع البائع
          </button>
          <button class="btn btn-accent btn-block" data-offer="${l.id}">
            <svg class="ic"><use href="#i-tag"/></svg> أرسل عرض شراء
          </button>
          <div class="detail-actions-row">
            <button class="btn btn-ghost" data-showphone="${l.id}">
              <svg class="ic"><use href="#i-phone"/></svg> <span id="phoneTxt">الهاتف</span>
            </button>
            <button class="btn btn-ghost" data-favbig="${l.id}">
              <svg class="ic" ${isFav?'style="fill:#dc2626;stroke:#dc2626"':''}><use href="#i-heart"/></svg>
            </button>
            <button class="btn btn-ghost" data-share="${l.id}"><svg class="ic"><use href="#i-share"/></svg></button>
            <button class="btn btn-ghost" data-qr="${l.id}"><svg class="ic"><use href="#i-qr"/></svg></button>
          </div>
          <button class="btn btn-ghost btn-block" data-report="${l.id}" style="color:var(--muted);font-size:13px">
            <svg class="ic" style="width:15px"><use href="#i-flag"/></svg> إبلاغ عن الإعلان
          </button>
        `}
      </div>
    </div>`;

  const strip = $('#strip');
  if(strip){
    strip.onclick = e=>{
      const t = e.target.closest('img'); if(!t) return;
      const mainImg = $('#mainImg');
      if(mainImg) mainImg.src = t.src;
      $$('img',strip).forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
    };
  }

  openOverlay('#ovDetail');
}

/* أحداث نافذة التفاصيل */
document.addEventListener('click', e=>{
  if(!e.target.closest('#ovDetail')) return;

  const chatB   = e.target.closest('[data-chat]');
  const phoneB  = e.target.closest('[data-showphone]');
  const favB    = e.target.closest('[data-favbig]');
  const delB    = e.target.closest('[data-del]');
  const shareB  = e.target.closest('[data-share]');
  const qrB     = e.target.closest('[data-qr]');
  const reportB = e.target.closest('[data-report]');
  const offerB  = e.target.closest('[data-offer]');
  const printB  = e.target.closest('[data-print]');
  const profB   = e.target.closest('[data-profile]');
  const simB    = e.target.closest('[data-similar]');

  if(chatB){
    const l = listings.find(x=>x.id===chatB.dataset.chat);
    if(!l) return;
    if(!currentUser){ openAuth('login'); return; }
    if(currentUser.id===l.userId){ toast('هذا إعلانك الخاص'); return; }
    closeOverlay('#ovDetail');
    openChat(l.userId, l.id);
  }
  if(phoneB){
    const l = listings.find(x=>x.id===phoneB.dataset.showphone);
    if(!l) return;
    const phone = l.phone || (users.find(u=>u.id===l.userId)||{}).phone || '—';
    const pt = $('#phoneTxt');
    if(pt) pt.textContent = phone;
    phoneB.style.background = 'var(--primary-50)';
    phoneB.style.color = 'var(--primary)';
    toast('رقم الهاتف: '+phone,'success');
  }
  if(favB){ toggleFav(favB.dataset.favbig); openDetail(favB.dataset.favbig); }
  if(shareB){ shareListing(shareB.dataset.share); }
  if(qrB){ showQR(qrB.dataset.qr); }
  if(reportB){ openReport(reportB.dataset.report); }
  if(offerB){ openOffer(offerB.dataset.offer); }
  if(printB){ printListing(printB.dataset.print); }
  if(profB){ closeOverlay('#ovDetail'); openProfile(profB.dataset.profile); }
  if(simB){ closeOverlay('#ovDetail'); openDetail(simB.dataset.similar); }
  if(delB){
    if(!confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) return;
    listings = listings.filter(x=>x.id!==delB.dataset.del);
    store.set(K.listings,listings);
    closeOverlay('#ovDetail');
    renderAll();
    toast('تم حذف الإعلان','success');
  }
});

/* ============ 15) نشر إعلان ============ */
function openOffer(listingId){
  if(!currentUser){ openAuth('login'); toast('سجّل الدخول لإرسال عرض'); return; }
  const l = listings.find(x=>x.id===listingId);
  if(!l || l.userId===currentUser.id){ toast('لا يمكنك إرسال عرض على إعلانك','error'); return; }
  activeOfferListingId = listingId;
  const price = $('#offerPrice'); if(price) price.value = l.price || '';
  const note = $('#offerNote'); if(note) note.value = '';
  openOverlay('#ovOffer');
}

const offerForm = $('#formOffer');
if(offerForm) offerForm.onsubmit = e=>{
  e.preventDefault();
  if(!currentUser || !activeOfferListingId) return;
  const l = listings.find(x=>x.id===activeOfferListingId);
  if(!l) return;
  const amount = Number($('#offerPrice')?.value)||0;
  if(amount<=0) return;
  const note = $('#offerNote')?.value.trim() || '';
  const text = `عرض شراء: ${num(amount)} ${CURRENCY}${note ? ` — ${note}` : ''}`;
  msgs.push({id:uid(),from:currentUser.id,to:l.userId,listingId:l.id,text,ts:Date.now(),read:false,type:'offer',offerPrice:amount});
  store.set(K.msgs,msgs);
  pushNotif(l.userId,'msg',`${currentUser.name} أرسل عرض شراء على إعلانك`,l.id);
  closeOverlay('#ovOffer');
  toast('تم إرسال عرضك للبائع ✅','success');
  activeOfferListingId = null;
  updateBadges();
};

function setupAddBtn(){
  const btn = $('#addBtn');
  if(!btn) return;
  btn.onclick = ()=>{
    if(!currentUser){ openAuth('reg'); toast('أنشئ حساباً أولاً'); return; }
    pendingImages = [];
    renderThumbs();
    const form = $('#formAdd');
    if(form) form.reset();
    const addCity = $('#addCity');
    if(addCity && currentUser.city) addCity.value = currentUser.city;
    openOverlay('#ovAdd');
  };
}

function renderThumbs(){
  const thumbs = $('#thumbs');
  if(!thumbs) return;
  thumbs.innerHTML = pendingImages.map((src,i)=>`
    <div class="thumb">
      <img src="${esc(src)}"/>
      <button type="button" data-rm="${i}"><svg class="ic"><use href="#i-close"/></svg></button>
    </div>`).join('');
}

function setupAddForm(){
  const thumbs = $('#thumbs');
  if(thumbs){
    thumbs.onclick = e=>{
      const b = e.target.closest('[data-rm]'); if(!b) return;
      pendingImages.splice(Number(b.dataset.rm),1);
      renderThumbs();
    };
  }

  const uploader = $('#uploader');
  const fileInput = $('#fileInput');
  if(uploader && fileInput){
    uploader.onclick = ()=> fileInput.click();
    const addFiles = async files=>{
      files = [...files];
      if(!files.length) return;
      if(pendingImages.length + files.length > 5){ toast('الحد الأقصى 5 صور','error'); }
      const take = files.slice(0, 5 - pendingImages.length);
      toast('جارٍ معالجة الصور...');
      for(const file of take){
        try{ pendingImages.push(await compressImage(file)); }catch(err){ console.warn(err); }
      }
      renderThumbs();
      if(take.length) toast('تمت إضافة '+take.length+' صورة','success');
    };
    fileInput.onchange = async e=>{ await addFiles(e.target.files); e.target.value = ''; };
    uploader.ondragover = e=>{ e.preventDefault(); uploader.classList.add('dragover'); };
    uploader.ondragleave = ()=>uploader.classList.remove('dragover');
    uploader.ondrop = async e=>{ e.preventDefault(); uploader.classList.remove('dragover'); await addFiles(e.dataTransfer.files); };
  }

  const addUrlBtn = $('#addUrlBtn');
  if(addUrlBtn){
    addUrlBtn.onclick = ()=>{
      const imgUrl = $('#imgUrl');
      const u = imgUrl.value.trim();
      if(!u) return;
      if(pendingImages.length>=5){ toast('الحد الأقصى 5 صور','error'); return; }
      pendingImages.push(u);
      imgUrl.value = '';
      renderThumbs();
    };
  }

  const saveBtn = $('#saveListingBtn');
  if(saveBtn){
    saveBtn.onclick = ()=>{
      const form = $('#formAdd');
      if(!form.reportValidity()) return;

      const f = new FormData(form);
      const l = {
        id: uid(), userId: currentUser.id,
        title: String(f.get('title')).trim(),
        cat: String(f.get('cat')),
        city: String(f.get('city')),
        type: String(f.get('type')||'sale'),
        condition: String(f.get('condition')||'used'),
        brand: String(f.get('brand')||'').trim(),
        model: String(f.get('model')||'').trim(),
        quantity: Math.max(1, Number(f.get('quantity'))||1),
        price: Number(f.get('price'))||0,
        phone: String(f.get('phone')||'').trim() || currentUser.phone,
        desc: String(f.get('desc')).trim(),
        tags: String(f.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,10),
        delivery: String(f.get('delivery')||'pickup'),
        negotiable: f.get('negotiable') === 'on',
        images: pendingImages.slice(),
        featured: !!f.get('featured'),
        views: 0, ts: Date.now()
      };

      if(!l.images.length) l.images = [PLACEHOLDER_IMAGE];

      listings.unshift(l);
      if(!store.set(K.listings,listings)) return;

      closeOverlay('#ovAdd');
      pendingImages = [];
      renderAll();
      toast('تم نشر إعلانك بنجاح ✅','success');
      setTimeout(()=>openDetail(l.id), 250);
    };
  }
}

/* ============ 16) المفضلة ============ */
function toggleFav(listingId){
  if(!currentUser){ openAuth('login'); toast('سجّل الدخول أولاً'); return; }
  const idx = favs.findIndex(f=>f.userId===currentUser.id && f.listingId===listingId);
  if(idx>-1){ favs.splice(idx,1); toast('أُزيل من المفضلة'); }
  else { favs.push({userId:currentUser.id, listingId, ts:Date.now()}); toast('أُضيف إلى المفضلة','success'); }
  store.set(K.favs,favs);
  renderListings();
  updateBadges();
}

function openFav(){
  if(!currentUser) return;
  const my = favs.filter(f=>f.userId===currentUser.id);
  const items = my.map(f=>listings.find(l=>l.id===f.listingId)).filter(Boolean);

  const favBox = $('#favBox');
  if(!favBox) return;

  favBox.innerHTML = items.length ? items.map(l=>{
    const img = (l.images&&l.images[0])||PLACEHOLDER_IMAGE;
    return `<div class="conv" data-open="${l.id}">
      <img src="${esc(img)}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none"/>
      <div class="conv-body">
        <b>${esc(l.title)}</b>
        <p style="color:var(--primary);font-weight:800">${num(l.price)} ${CURRENCY}</p>
        <p>${esc(l.city)} • ${timeAgo(l.ts)}</p>
      </div>
      <button class="close-x" data-unfav="${l.id}"><svg class="ic" style="width:17px;color:var(--danger)"><use href="#i-trash"/></svg></button>
    </div>`;
  }).join('') : `<div class="empty" style="border:none;padding:40px 10px">
      <div class="em">💔</div><h3>المفضلة فارغة</h3>
      <p>اضغط على القلب في أي إعلان لحفظه.</p></div>`;

  favBox.onclick = e=>{
    const un = e.target.closest('[data-unfav]');
    if(un){ e.stopPropagation(); toggleFav(un.dataset.unfav); openFav(); return; }
    const op = e.target.closest('[data-open]');
    if(op){ closeOverlay('#ovFav'); openDetail(op.dataset.open); }
  };
  openOverlay('#ovFav');
}

/* ============ 17) إعلاناتي ============ */
function openMy(){
  if(!currentUser) return;
  const items = listings.filter(l=>l.userId===currentUser.id).sort((a,b)=>b.ts-a.ts);

  const myBox = $('#myBox');
  if(!myBox) return;

  myBox.innerHTML = items.length ? items.map(l=>{
    const img = (l.images&&l.images[0])||PLACEHOLDER_IMAGE;
    return `<div class="conv" data-open="${l.id}">
      <img src="${esc(img)}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none"/>
      <div class="conv-body">
        <b>${esc(l.title)}</b>
        <p style="color:var(--primary);font-weight:800">${num(l.price)} ${CURRENCY}</p>
        <p>${iconHTML('eye','inline-icon')} ${num(l.views||0)} • ${timeAgo(l.ts)}</p>
      </div>
      <button class="close-x" data-delmy="${l.id}"><svg class="ic" style="width:17px;color:var(--danger)"><use href="#i-trash"/></svg></button>
    </div>`;
  }).join('') : `<div class="empty" style="border:none;padding:40px 10px">
      ${iconHTML('package','empty-icon')}<h3>لا توجد إعلانات</h3>
      <p>ابدأ بنشر أول إعلان لك!</p></div>`;

  myBox.onclick = e=>{
    const d = e.target.closest('[data-delmy]');
    if(d){
      e.stopPropagation();
      if(!confirm('حذف هذا الإعلان؟')) return;
      listings = listings.filter(l=>l.id!==d.dataset.delmy);
      store.set(K.listings,listings);
      renderAll(); openMy();
      toast('تم الحذف','success');
      return;
    }
    const op = e.target.closest('[data-open]');
    if(op){ closeOverlay('#ovMy'); openDetail(op.dataset.open); }
  };
  openOverlay('#ovMy');
}

/* ============ 18) الرسائل ============ */
function openChat(otherId, listingId){
  if(!currentUser){ openAuth('login'); return; }
  const other = users.find(u=>u.id===otherId);
  if(!other){ toast('المستخدم غير موجود','error'); return; }

  activeChat = { otherId, listingId };
  const l = listingId ? listings.find(x=>x.id===listingId) : null;

  const chatName = $('#chatName');
  const chatCtx = $('#chatCtx');
  if(chatName) chatName.textContent = other.name;
  if(chatCtx) chatCtx.innerHTML = l
    ? `<svg class="ic" style="width:16px"><use href="#i-tag"/></svg> بخصوص: ${esc(l.title)}`
    : `<svg class="ic" style="width:16px"><use href="#i-chat"/></svg> محادثة عامة`;

  renderChat();
  openOverlay('#ovChat');
  setTimeout(()=>{ const ci = $('#chatInput'); if(ci) ci.focus(); }, 200);
}

function renderChat(){
  if(!activeChat || !currentUser) return;
  const {otherId} = activeChat;
  const list = msgs
    .filter(m => (m.from===currentUser.id && m.to===otherId) || (m.from===otherId && m.to===currentUser.id))
    .sort((a,b)=>a.ts-b.ts);

  const box = $('#chatMsgs');
  if(!box) return;

  if(!list.length){
    box.innerHTML = `<div style="margin:auto;text-align:center;color:var(--muted);font-size:13.5px">
      ${iconHTML('message','empty-icon')}ابدأ المحادثة</div>`;
  } else {
    box.innerHTML = list.map(m=>`
      <div class="bubble ${m.from===currentUser.id?'me':'them'}">
        ${esc(m.text)}<time>${timeShort(m.ts)}</time>
      </div>`).join('');
  }
  box.scrollTop = box.scrollHeight;
}

function sendMsg(){
  const inp = $('#chatInput');
  if(!inp) return;
  const txt = inp.value.trim();
  if(!txt || !activeChat) return;

  msgs.push({
    id: uid(), from: currentUser.id, to: activeChat.otherId,
    listingId: activeChat.listingId || null,
    text: txt, ts: Date.now(), read: false
  });
  store.set(K.msgs, msgs);
  inp.value = '';
  renderChat();
  updateBadges();

  /* رد تلقائي تجريبي */
  const target = activeChat.otherId;
  setTimeout(()=>{
    if(!activeChat || activeChat.otherId!==target) return;
    msgs.push({
      id: uid(), from: target, to: currentUser.id,
      listingId: activeChat.listingId || null,
      text: 'أهلاً بك 👋 الإعلان متوفر. متى تحب نلتقي؟',
      ts: Date.now(), read: false
    });
    store.set(K.msgs, msgs);
    const ovChat = $('#ovChat');
    if(ovChat && ovChat.classList.contains('open')) renderChat();
    updateBadges();
  }, 2200);
}

function openInbox(){
  if(!currentUser) return;
  const map = new Map();
  msgs.forEach(m=>{
    if(m.from!==currentUser.id && m.to!==currentUser.id) return;
    const other = m.from===currentUser.id ? m.to : m.from;
    const cur = map.get(other);
    if(!cur || m.ts>cur.ts) map.set(other, m);
  });

  const convs = [...map.entries()].sort((a,b)=>b[1].ts-a[1].ts);
  const inboxBox = $('#inboxBox');
  if(!inboxBox) return;

  inboxBox.innerHTML = convs.length ? convs.map(([otherId,m])=>{
    const u = users.find(x=>x.id===otherId) || {name:'مستخدم'};
    return `<div class="conv" data-chat-with="${otherId}" data-listing="${m.listingId||''}">
      <div class="avatar">${esc(u.name.charAt(0))}</div>
      <div class="conv-body">
        <b>${esc(u.name)} ${!m.read && m.to===currentUser.id ? '<span style="color:var(--danger);font-size:11px">● جديد</span>' : ''}</b>
        <p>${esc(m.text)}</p>
      </div>
      <time>${timeAgo(m.ts)}</time>
    </div>`;
  }).join('') : `<div class="empty" style="border:none;padding:40px 10px">
      <div class="em">📭</div><h3>لا توجد رسائل</h3></div>`;

  inboxBox.onclick = e=>{
    const c = e.target.closest('[data-chat-with]');
    if(!c) return;
    msgs.forEach(m=>{ if(m.from===c.dataset.chatWith && m.to===currentUser.id) m.read = true; });
    store.set(K.msgs,msgs);
    updateBadges();
    closeOverlay('#ovInbox');
    openChat(c.dataset.chatWith, c.dataset.listing || null);
  };
  openOverlay('#ovInbox');
}

/* ============ 19) الإشعارات ============ */
function pushNotif(userId, type, text, listingId=null){
  notifs.unshift({ id:uid(), userId, type, text, listingId, ts:Date.now(), read:false });
  notifs = notifs.slice(0, 50);
  store.set(K.notifs, notifs);
  updateBadges();
}

function openNotif(){
  if(!currentUser) return;
  const mine = notifs.filter(n=>n.userId===currentUser.id);
  const notifBox = $('#notifBox');
  if(!notifBox) return;

  notifBox.innerHTML = mine.length ? mine.map(n=>`
    <div class="notif ${n.read?'':'unread'}">
      <div class="notif-icon">${iconHTML(n.type==='msg'?'message':n.type==='fav'?'heart':n.type==='review'?'star':'bell')}</div>
      <div class="notif-body">
        <b>${esc(n.text)}</b>
        <time>${timeAgo(n.ts)}</time>
      </div>
    </div>`).join('') : `<div class="empty" style="border:none;padding:40px 10px">
      ${iconHTML('bell-off','empty-icon')}<h3>لا توجد إشعارات</h3></div>`;

  mine.forEach(n=>n.read=true);
  store.set(K.notifs,notifs);
  updateBadges();
  openOverlay('#ovNotif');
}

/* ============ 20) التقييمات ============ */
function addReview(targetId, rating, text){
  if(!currentUser){ openAuth('login'); return; }
  if(currentUser.id===targetId){ toast('لا يمكنك تقييم نفسك','error'); return; }
  if(reviews.some(r=>r.targetId===targetId && r.authorId===currentUser.id)){
    toast('لقد قيّمت هذا البائع مسبقاً','error'); return;
  }
  reviews.push({ id:uid(), targetId, authorId:currentUser.id, rating, text, ts:Date.now() });
  store.set(K.reviews,reviews);
  pushNotif(targetId,'review',`${currentUser.name} قيّمك بـ ${rating} نجوم`);
  toast('شكراً لتقييمك ⭐','success');
}

/* ============ 21) الملف الشخصي ============ */
function openProfile(userId){
  const u = users.find(x=>x.id===userId);
  if(!u) return;

  const uListings = listings.filter(l=>l.userId===userId);
  const uReviews = reviews.filter(r=>r.targetId===userId);
  const rAvg = uReviews.length ? uReviews.reduce((s,r)=>s+r.rating,0)/uReviews.length : 0;
  const canReview = currentUser && currentUser.id!==userId &&
                    !uReviews.some(r=>r.authorId===currentUser.id);

  const profileBox = $('#profileBox');
  if(!profileBox) return;

  profileBox.innerHTML = `
    <div class="profile-header">
      <div class="avatar">${esc(u.name.charAt(0))}</div>
      <h3>${esc(u.name)} ${u.verified?'<svg class="ic" style="width:18px;color:var(--success)"><use href="#i-shield"/></svg>':''}</h3>
      <p>${esc(u.city||'—')} • عضو منذ ${new Date(u.ts).toLocaleDateString('ar-EG')}</p>
      ${u.bio ? `<p style="margin-top:6px;font-style:italic">"${esc(u.bio)}"</p>` : ''}
    </div>

    <div class="profile-stats">
      <div class="profile-stat"><b>${uListings.length}</b><span>إعلان</span></div>
      <div class="profile-stat"><b>${rAvg.toFixed(1)}</b><span>التقييم</span></div>
      <div class="profile-stat"><b>${uReviews.length}</b><span>مراجعة</span></div>
    </div>

    <div class="rating-box" style="margin-top:16px">
      <div style="font-weight:800;margin-bottom:10px">${iconHTML('star','inline-icon')} التقييمات</div>
      ${uReviews.length ? uReviews.map(r=>{
        const a = users.find(x=>x.id===r.authorId) || {name:'مستخدم'};
        return `<div class="review-item">
          <div class="avatar">${esc(a.name.charAt(0))}</div>
          <div class="review-body">
            <b>${esc(a.name)} <span style="color:#f59e0b">${stars(r.rating)}</span></b>
            <p>${esc(r.text)}</p>
            <time>${timeAgo(r.ts)}</time>
          </div>
        </div>`;
      }).join('') : '<p class="hint">لا توجد تقييمات بعد</p>'}
    </div>

    ${canReview ? `
      <div class="rating-box" style="margin-top:16px">
        <div style="font-weight:800;margin-bottom:10px">${iconHTML('star','inline-icon')} أضف تقييمك</div>
        <div class="star-picker" id="starPicker">
          <span data-v="1">★</span><span data-v="2">★</span><span data-v="3">★</span><span data-v="4">★</span><span data-v="5">★</span>
        </div>
        <textarea class="inp" id="reviewText" placeholder="اكتب تجربتك مع هذا البائع..." rows="3" style="margin-top:10px"></textarea>
        <button class="btn btn-primary btn-block" id="submitReview" style="margin-top:10px" disabled>إرسال التقييم</button>
      </div>
    ` : ''}
  `;

  const picker = $('#starPicker');
  if(picker){
    let selected = 0;
    picker.onclick = e=>{
      const s = e.target.closest('span'); if(!s) return;
      selected = Number(s.dataset.v);
      $$('span',picker).forEach(x=>x.classList.toggle('on', Number(x.dataset.v)<=selected));
      const sr = $('#submitReview');
      if(sr) sr.disabled = false;
    };
    const submitBtn = $('#submitReview');
    if(submitBtn){
      submitBtn.onclick = ()=>{
        const rt = $('#reviewText');
        const txt = rt ? rt.value.trim() : '';
        if(!selected){ toast('اختر عدد النجوم','error'); return; }
        addReview(userId, selected, txt || 'بدون تعليق');
        openProfile(userId);
      };
    }
  }

  openOverlay('#ovProfile');
}

/* ============ 22) أدوات مساعدة ============ */
function updateBadges(){
  const fc = currentUser ? favs.filter(f=>f.userId===currentUser.id).length : 0;
  const fEl = $('#favCount'); if(fEl){ fEl.textContent = fc; fEl.dataset.n = fc; }

  let mc = 0;
  if(currentUser) mc = msgs.filter(m=>m.to===currentUser.id && !m.read).length;
  const mEl = $('#msgCount'); if(mEl){ mEl.textContent = mc; mEl.dataset.n = mc; }

  let nc = 0;
  if(currentUser) nc = notifs.filter(n=>n.userId===currentUser.id && !n.read).length;
  const nEl = $('#notifCount'); if(nEl){ nEl.textContent = nc; nEl.dataset.n = nc; }
}

function shareListing(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const txt = `${l.title} — ${num(l.price)} ${CURRENCY}\n${l.city}\n${l.desc.slice(0,100)}...`;
  if(navigator.share){
    navigator.share({ title:l.title, text:txt }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(txt).then(()=>toast('تم نسخ نص الإعلان','success'));
  }
}

function showQR(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const canvas = $('#qrCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 280;
  canvas.width = size; canvas.height = size;

  const txt = `سوق الشورجة:${l.id}`;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size,size);
  ctx.fillStyle = '#0f172a';
  const cell = 10;
  for(let y=0; y<28; y++){
    for(let x=0; x<28; x++){
      const code = txt.charCodeAt((x+y*28)%txt.length) + x*7 + y*13;
      if(code % 3 === 0) ctx.fillRect(x*cell, y*cell, cell, cell);
    }
  }
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0,0,70,70); ctx.fillStyle='#fff'; ctx.fillRect(10,10,50,50); ctx.fillStyle='#0f172a'; ctx.fillRect(20,20,30,30);
  ctx.fillStyle = '#1d4ed8'; ctx.fillRect(size-70,0,70,70); ctx.fillStyle='#fff'; ctx.fillRect(size-60,10,50,50); ctx.fillStyle='#0f172a'; ctx.fillRect(size-50,20,30,30);
  ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0,size-70,70,70); ctx.fillStyle='#fff'; ctx.fillRect(10,size-60,50,50); ctx.fillStyle='#0f172a'; ctx.fillRect(20,size-50,30,30);

  openOverlay('#ovQR');
}

function printListing(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const seller = users.find(u=>u.id===l.userId) || {};
  const w = window.open('', '_blank');
  w.document.write(`
    <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>${esc(l.title)}</title>
    <style>body{font-family:Tahoma,sans-serif;max-width:700px;margin:30px auto;padding:20px;line-height:1.8}
      h1{color:#1d4ed8;font-size:24px} .price{font-size:28px;font-weight:800;color:#1d4ed8;margin:14px 0}
      img{max-width:100%;border-radius:12px;margin:10px 0} .meta{color:#64748b;font-size:14px}
      .desc{background:#f5f7fb;padding:16px;border-radius:12px;white-space:pre-wrap;margin-top:14px}
      hr{border:none;border-top:1px solid #e5e9f0;margin:20px 0}
    </style></head><body>
    <h1>${esc(l.title)}</h1>
    <div class="price">${num(l.price)} ${CURRENCY}</div>
    <div class="meta">الموقع: ${esc(l.city)} • ${new Date(l.ts).toLocaleString('ar-EG')}</div>
    <hr/>
    <div class="desc">${esc(l.desc)}</div>
    <hr/>
    <p><b>البائع:</b> ${esc(seller.name||'—')} • <b>الهاتف:</b> ${esc(l.phone||seller.phone||'—')}</p>
    <p style="text-align:center;color:#64748b;font-size:12px;margin-top:30px">— سوق الشورجة —</p>
    <script>setTimeout(()=>window.print(),400)<\/script>
    </body></html>`);
  w.document.close();
}

function openReport(id){
  const r = $('#reportReason'); if(r) r.value = 'spam';
  const n = $('#reportNote');   if(n) n.value = '';
  const s = $('#sendReport');
  if(s){
    s.onclick = ()=>{
      closeOverlay('#ovReport');
      toast('تم إرسال الإبلاغ، شكراً لك 🙏','success');
    };
  }
  openOverlay('#ovReport');
}

/* ============ 23) النوافذ ============ */
function openOverlay(sel){
  $$('.overlay').forEach(o=>o.classList.remove('open'));
  const o = $(sel);
  if(o){ o.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closeOverlay(sel){
  const o = $(sel);
  if(o) o.classList.remove('open');
  if(!$$('.overlay.open').length) document.body.style.overflow='';
}

/* ============ 24) الفلاتر ============ */
function fillSelects(){
  const cityOpts = CITIES.map(c=>`<option value="${c}">${c}</option>`).join('');
  const fCity = $('#fCity');   if(fCity) fCity.innerHTML = `<option value="all">كل المدن</option>` + cityOpts;
  const fCondition = $('#fCondition'); if(fCondition) fCondition.innerHTML = '<option value="all">كل الحالات</option>' + Object.entries(CONDITIONS).map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
  const fType = $('#fType'); if(fType) fType.innerHTML = '<option value="all">بيع ومطلوب وبدل</option>' + Object.entries(LISTING_TYPES).map(([v,n])=>`<option value="${v}">${n}</option>`).join('');
  const addCity = $('#addCity'); if(addCity) addCity.innerHTML = `<option value="">اختر المدينة</option>` + cityOpts;
  const regCity = $('#regCity'); if(regCity) regCity.innerHTML = `<option value="">اختر المدينة</option>` + cityOpts;
  const addCat = $('#addCat'); if(addCat) addCat.innerHTML = `<option value="">اختر القسم</option>` +
    CATEGORIES.map(c=>`<option value="${c.id}">${c.em} ${c.name}</option>`).join('');
}

function resetAll(){
  filters = { q:'', cat:'all', city:'all', min:'', max:'', condition:'all', type:'all', sort:'new' };
  const si = $('#searchInput'); if(si) si.value = '';
  const fc = $('#fCity'); if(fc) fc.value = 'all';
  const fm = $('#fMin'); if(fm) fm.value = '';
  const fx = $('#fMax'); if(fx) fx.value = '';
  const fco = $('#fCondition'); if(fco) fco.value = 'all';
  const fty = $('#fType'); if(fty) fty.value = 'all';
  const fs = $('#fSort'); if(fs) fs.value = 'new';
  $$('.cat').forEach(c=>c.classList.toggle('active', c.dataset.cat==='all'));
  $$('.filter-cat-item').forEach(c=>c.classList.toggle('active', c.dataset.cat==='all'));
  renderListings();
  window.scrollTo({top:0,behavior:'smooth'});
}

/* اقتراحات البحث */
function renderSuggest(q){
  const sug = $('#searchSuggest');
  if(!sug) return;
  if(!q.trim()){ sug.classList.remove('open'); return; }
  const s = q.trim().toLowerCase();
  const matches = listings
    .filter(l=>l.title.toLowerCase().includes(s))
    .slice(0,6);
  if(!matches.length){ sug.classList.remove('open'); return; }
  sug.innerHTML = matches.map(l=>{
    const img = (l.images&&l.images[0])||PLACEHOLDER_IMAGE;
    return `<div class="suggest-item" data-sug="${l.id}">
      <img src="${esc(img)}" style="width:36px;height:36px;border-radius:8px;object-fit:cover"/>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.title)}</span>
      <b style="color:var(--primary);font-size:13px">${num(l.price)}</b>
    </div>`;
  }).join('');
  sug.classList.add('open');
}

/* ============ 25) التشغيل الكامل ============ */
function renderAll(){
  renderSideCats();
  renderQuickCats();
  renderFilterCats();
  renderAuth();
  renderListings();
  renderTrending();
  renderRecent();
  updateBadges();
}

function init(){
  seed();
  applyTheme();

  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='ar' ? 'rtl' : 'ltr';
  const lc = $('#langCode'); if(lc) lc.textContent = lang.toUpperCase();

  fillSelects();
  renderSideCats();
  renderQuickCats();
  renderFilterCats();
  initSlider();

  const sid = store.get(K.session,null);
  if(sid) currentUser = users.find(u=>u.id===sid) || null;

  renderAll();
  setupAddBtn();
  setupAddForm();

  const yr = $('#year'); if(yr) yr.textContent = new Date().getFullYear();

  /* تحديث كل دقيقة */
  setInterval(()=>{ if(!$$('.overlay.open').length) renderListings(); }, 60000);
}

/* ============ 26) ربط الأحداث ============ */
document.addEventListener('DOMContentLoaded', ()=>{

  /* --- التشغيل --- */
  init();

  /* --- الهيدر --- */
  const themeBtn = $('#themeBtn'); if(themeBtn) themeBtn.onclick = toggleTheme;
  const langBtn  = $('#langBtn');  if(langBtn)  langBtn.onclick  = toggleLang;

  const favBtn = $('#favBtn');
  if(favBtn) favBtn.onclick = ()=>{ if(!currentUser){openAuth('login');return;} openFav(); };

  const msgBtn = $('#msgBtn');
  if(msgBtn) msgBtn.onclick = ()=>{ if(!currentUser){openAuth('login');return;} openInbox(); };

  const notifBtn = $('#notifBtn');
  if(notifBtn) notifBtn.onclick = ()=>{ if(!currentUser){openAuth('login');return;} openNotif(); };

  const logoBtn = $('#logoBtn');
  if(logoBtn) logoBtn.onclick = e=>{ e.preventDefault(); resetAll(); };

  const boostBtn = $('#boostBtn');
  if(boostBtn) boostBtn.onclick = ()=>{
    if(!currentUser){openAuth('reg');return;}
    toast('ميزة الترقية قادمة قريباً! ⭐');
  };

  /* --- البحث --- */
  const searchBtn = $('#searchBtn');
  const searchInput = $('#searchInput');
  const searchSuggest = $('#searchSuggest');

  if(searchBtn) searchBtn.onclick = ()=>{
    filters.q = searchInput.value;
    renderListings();
    if(searchSuggest) searchSuggest.classList.remove('open');
  };
  if(searchInput){
    searchInput.addEventListener('input', e=>{
      clearTimeout(window.__st);
      window.__st = setTimeout(()=>{
        filters.q = e.target.value;
        renderListings();
        renderSuggest(e.target.value);
      }, 280);
    });
    searchInput.addEventListener('keydown', e=>{
      if(e.key==='Enter'){
        filters.q = e.target.value;
        renderListings();
        if(searchSuggest) searchSuggest.classList.remove('open');
      }
    });
  }
  if(searchSuggest){
    searchSuggest.onclick = e=>{
      const s = e.target.closest('[data-sug]');
      if(s){ searchSuggest.classList.remove('open'); openDetail(s.dataset.sug); }
    };
  }
  document.addEventListener('click', e=>{
    if(!e.target.closest('.search-wrap') && searchSuggest){
      searchSuggest.classList.remove('open');
    }
    if(!e.target.closest('.dropdown')){
      $$('.dd-menu').forEach(m=>m.classList.remove('open'));
    }
  });

  /* --- الفلاتر --- */
  const fCity = $('#fCity');
  if(fCity) fCity.onchange = e=>{ filters.city = e.target.value; renderListings(); };
  const fMin = $('#fMin');
  if(fMin) fMin.oninput = e=>{ filters.min = e.target.value; renderListings(); };
  const fMax = $('#fMax');
  if(fMax) fMax.oninput = e=>{ filters.max = e.target.value; renderListings(); };
  const fCondition = $('#fCondition');
  if(fCondition) fCondition.onchange = e=>{ filters.condition = e.target.value; renderListings(); };
  const fType = $('#fType');
  if(fType) fType.onchange = e=>{ filters.type = e.target.value; renderListings(); };
  const fSort = $('#fSort');
  if(fSort) fSort.onchange = e=>{ filters.sort = e.target.value; renderListings(); };
  const clearFilters = $('#clearFilters');
  if(clearFilters) clearFilters.onclick = resetAll;
  const clearRecent = $('#clearRecent');
  if(clearRecent) clearRecent.onclick = ()=>{ recent=[]; store.set(K.recent,[]); renderRecent(); };

  /* --- الشبكة (بطاقات) --- */
  document.body.addEventListener('click', e=>{
    const favBtnEl = e.target.closest('[data-fav]');
    if(favBtnEl){
      e.stopPropagation();
      toggleFav(favBtnEl.dataset.fav);
      return;
    }
    const card = e.target.closest('.card');
    if(card && !e.target.closest('.overlay')){
      openDetail(card.dataset.id);
    }
  });

  /* --- تابات المصادقة --- */
  $$('.tab').forEach(t=> t.onclick = ()=>switchAuthTab(t.dataset.tab));

  /* --- تسجيل الدخول --- */
  const formLogin = $('#formLogin');
  if(formLogin){
    formLogin.onsubmit = e=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const phone = String(f.get('phone')).trim();
      const pass  = String(f.get('pass'));
      const u = users.find(x=>x.phone===phone && x.pass===pass);
      if(!u){ toast('بيانات الدخول غير صحيحة','error'); return; }
      currentUser = u;
      store.set(K.session,u.id);
      closeOverlay('#ovAuth');
      e.target.reset();
      renderAll();
      toast('مرحباً، '+u.name.split(' ')[0]+' 👋','success');
    };
  }

  /* --- التسجيل --- */
  const formReg = $('#formReg');
  if(formReg){
    formReg.onsubmit = e=>{
      e.preventDefault();
      const f = new FormData(e.target);
      const name  = String(f.get('name')).trim();
      const phone = String(f.get('phone')).trim();
      const city  = String(f.get('city'));
      const pass  = String(f.get('pass'));
      if(users.some(u=>u.phone===phone)){ toast('الرقم مسجل مسبقاً','error'); return; }
      const u = {id:uid(), name, phone, city, pass, ts:Date.now(), verified:false, bio:''};
      users.push(u);
      store.set(K.users,users);
      currentUser = u;
      store.set(K.session,u.id);
      closeOverlay('#ovAuth');
      e.target.reset();
      renderAll();
      toast('تم إنشاء حسابك 🎉','success');
    };
  }

  /* --- الرسائل --- */
  const chatSend = $('#chatSend');
  if(chatSend) chatSend.onclick = sendMsg;
  const chatInput = $('#chatInput');
  if(chatInput){
    chatInput.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); sendMsg(); }
    });
  }

  /* --- إغلاق النوافذ --- */
  document.addEventListener('click', e=>{
    if(e.target.closest('[data-close]')){
      const ov = e.target.closest('.overlay');
      if(ov) closeOverlay('#'+ov.id);
    }
    if(e.target.classList.contains('overlay')) closeOverlay('#'+e.target.id);
  });

  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      const open = $$('.overlay.open');
      if(open.length) closeOverlay('#'+open[open.length-1].id);
      $$('.dd-menu').forEach(m=>m.classList.remove('open'));
    }
  });

  /* --- زر "جميع الأقسام" --- */
  const toggleCats = $('#toggleCats');
  if(toggleCats){
    toggleCats.onclick = ()=>{
      const sideCats = $('#sideCats');
      if(sideCats){
        sideCats.scrollIntoView({behavior:'smooth', block:'center'});
      }
    };
  }

  /* --- الأكثر بحثاً --- */
  document.addEventListener('click', e=>{
    const hot = e.target.closest('[data-hot]');
    if(hot){
      e.preventDefault();
      const si = $('#searchInput');
      if(si) si.value = hot.dataset.hot;
      filters.q = hot.dataset.hot;
      renderListings();
      const grid = $('#grid');
      if(grid) window.scrollTo({top: grid.offsetTop - 160, behavior:'smooth'});
    }
  });

  /* --- روابط الفوتر --- */
  const fl = $('#footerLogin');
  const ff = $('#footerFav');
  const fm = $('#footerMy');
  const fmsg = $('#footerMsgs');
  if(fl) fl.onclick = e=>{ e.preventDefault(); openAuth('login'); };
  if(ff) ff.onclick = e=>{ e.preventDefault(); if(!currentUser){openAuth('login');return;} openFav(); };
  if(fm) fm.onclick = e=>{ e.preventDefault(); if(!currentUser){openAuth('login');return;} openMy(); };
  if(fmsg) fmsg.onclick = e=>{ e.preventDefault(); if(!currentUser){openAuth('login');return;} openInbox(); };

  /* --- أزرار "عرض الكل" --- */
  $$('[data-more]').forEach(btn=>{
    btn.onclick = ()=>{
      const grid = $('#grid');
      if(grid) window.scrollTo({top: grid.offsetTop - 160, behavior:'smooth'});
    };
  });
});

/* ============ 27) جسر المزامنة (sync.js) ============ */
window.__reloadData = function () {
  users    = store.get(K.users, []);
  listings = store.get(K.listings, []);
  favs     = store.get(K.favs, []);
  msgs     = store.get(K.msgs, []);
  notifs   = store.get(K.notifs, []);
  reviews  = store.get(K.reviews, []);

  if (currentUser) {
    const u = users.find(x => x.id === currentUser.id);
    if (u) currentUser = u;
  }
};

window.renderAll = renderAll;

/* =========================================================
   سوق الشورجة — تحسينات وتفعيل الوظائف v2.0
   - تعديل/ترقية الإعلانات
   - تقارير حقيقية محفوظة
   - إشعارات الرسائل والمفضلة
   - تنقل وبانرات فعالة
   - مشاركة بروابط مباشرة
   - صفحة معلومات/مساعدة
   - تحسين البحث والـ PWA
   ========================================================= */
let __editListingId = null;
let __reportListingId = null;
let __deferredInstallPrompt = null;

function ensureEnhancementsUI(){
  if(!document.getElementById('ovEdit')){
    document.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" id="ovEdit">
        <div class="modal lg">
          <div class="modal-head">
            <h2><svg class="ic"><use href="#i-tag"/></svg> تعديل الإعلان</h2>
            <button class="close-x" data-close><svg class="ic"><use href="#i-close"/></svg></button>
          </div>
          <div class="modal-body">
            <form id="formEdit">
              <div class="form-row"><label>عنوان الإعلان <i>*</i></label><input class="inp" id="editTitle" maxlength="90" required/></div>
              <div class="form-2">
                <div class="form-row"><label>القسم <i>*</i></label><select class="inp" id="editCat" required></select></div>
                <div class="form-row"><label>المدينة <i>*</i></label><select class="inp" id="editCity" required></select></div>
              </div>
              <div class="form-2">
                <div class="form-row"><label>السعر <i>*</i></label><input class="inp" id="editPrice" type="number" min="0" required/></div>
                <div class="form-row"><label>رقم التواصل</label><input class="inp" id="editPhone" type="tel"/></div>
              </div>
              <div class="form-row"><label>الوصف <i>*</i></label><textarea class="inp" id="editDesc" maxlength="1500" rows="6" required></textarea></div>
              <label class="check-row"><input type="checkbox" id="editFeatured"/> <span>إظهار الإعلان كمميز ⭐</span></label>
            </form>
          </div>
          <div class="modal-foot">
            <button class="btn btn-primary btn-block" id="saveEditBtn">حفظ التعديلات</button>
            <button class="btn btn-ghost" data-close>إلغاء</button>
          </div>
        </div>
      </div>`);
  }
  if(!document.getElementById('ovInfo')){
    document.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" id="ovInfo">
        <div class="modal">
          <div class="modal-head">
            <h2 id="infoTitle">سوق الشورجة</h2>
            <button class="close-x" data-close><svg class="ic"><use href="#i-close"/></svg></button>
          </div>
          <div class="modal-body" id="infoBody"></div>
        </div>
      </div>`);
  }

  const ec = $('#editCat');
  const eci = $('#editCity');
  if(ec && !ec.options.length) ec.innerHTML = CATEGORIES.map(c=>`<option value="${c.id}">${c.em} ${c.name}</option>`).join('');
  if(eci && !eci.options.length) eci.innerHTML = CITIES.map(c=>`<option value="${c}">${c}</option>`).join('');

  const saveEdit = $('#saveEditBtn');
  if(saveEdit && !saveEdit.dataset.bound){
    saveEdit.dataset.bound = '1';
    saveEdit.onclick = saveEditedListing;
  }
}

function openEditListing(id){
  if(!currentUser){ openAuth('login'); return; }
  const l = listings.find(x=>x.id===id);
  if(!l || l.userId!==currentUser.id){ toast('لا تملك صلاحية تعديل هذا الإعلان','error'); return; }
  ensureEnhancementsUI();
  __editListingId = id;
  $('#editTitle').value = l.title || '';
  $('#editCat').value = l.cat || 'other';
  $('#editCity').value = l.city || currentUser.city || CITIES[0];
  $('#editPrice').value = Number(l.price)||0;
  $('#editPhone').value = l.phone || currentUser.phone || '';
  $('#editDesc').value = l.desc || '';
  $('#editFeatured').checked = !!l.featured;
  openOverlay('#ovEdit');
}

function saveEditedListing(){
  const l = listings.find(x=>x.id===__editListingId);
  if(!l || !currentUser || l.userId!==currentUser.id) return;
  const form = $('#formEdit');
  if(!form || !form.reportValidity()) return;
  l.title = $('#editTitle').value.trim();
  l.cat = $('#editCat').value;
  l.city = $('#editCity').value;
  l.price = Number($('#editPrice').value)||0;
  l.phone = $('#editPhone').value.trim() || currentUser.phone;
  l.desc = $('#editDesc').value.trim();
  l.featured = $('#editFeatured').checked;
  l.updatedAt = Date.now();
  store.set(K.listings, listings);
  closeOverlay('#ovEdit');
  renderAll();
  toast('تم حفظ تعديلات الإعلان ✅','success');
  setTimeout(()=>openDetail(l.id),150);
}

function toggleFeaturedListing(id){
  if(!currentUser){ openAuth('login'); return; }
  const l = listings.find(x=>x.id===id);
  if(!l || l.userId!==currentUser.id){ toast('لا تملك صلاحية ترقية هذا الإعلان','error'); return; }
  l.featured = !l.featured;
  l.updatedAt = Date.now();
  store.set(K.listings,listings);
  renderAll();
  toast(l.featured ? 'تم تفعيل تمييز الإعلان ⭐' : 'تم إلغاء تمييز الإعلان');
  if($('#ovMy')?.classList.contains('open')) openMy();
}

function openInfo(type){
  ensureEnhancementsUI();
  const data = {
    about: ['عن سوق الشورجة', '<p>سوق الشورجة منصة عراقية لعرض وشراء وبيع مختلف المنتجات والإعلانات، مع بحث وفلترة ومفضلة ومحادثات وتقييمات.</p><p class="hint">يمكنك نشر إعلان، التواصل مع البائع، حفظ الإعلانات ومتابعة إشعاراتك من نفس الموقع.</p>'],
    help: ['المساعدة', '<p><b>البحث:</b> اكتب اسم المنتج أو المدينة ثم استخدم الفلاتر.</p><p><b>النشر:</b> سجّل الدخول واضغط «أضف إعلان» وأضف الصور والتفاصيل.</p><p><b>التواصل:</b> افتح الإعلان واضغط «تواصل مع البائع».</p><p><b>المفضلة:</b> اضغط رمز القلب لحفظ الإعلان والرجوع إليه لاحقاً.</p>'],
    contact: ['تواصل معنا', '<p>للتواصل مع إدارة الموقع استخدم قسم الإبلاغ داخل الإعلان للمشاكل المتعلقة بالإعلانات.</p><p class="hint">يمكن إضافة بريد أو رقم دعم رسمي لاحقاً من إعدادات المشروع.</p>'],
    terms: ['الشروط والأحكام', '<p>استخدم المنصة لنشر إعلانات حقيقية ومعلومات صحيحة، ولا تنشر محتوى مخالفاً للقوانين أو يضر بالمستخدمين.</p>'],
    privacy: ['سياسة الخصوصية', '<p>هذا الإصدار يخزن البيانات محلياً في المتصفح، ومع تشغيل السيرفر تتم مزامنتها مع ملف <code>data.json</code>.</p><p class="hint">لا تشارك كلمات المرور أو البيانات الحساسة مع أي شخص.</p>']
  };
  const d = data[type] || data.about;
  $('#infoTitle').textContent = d[0];
  $('#infoBody').innerHTML = d[1];
  openOverlay('#ovInfo');
}

function performSearch(q){
  filters.q = String(q||'').trim();
  renderListings();
  const grid = $('#grid');
  if(grid) window.scrollTo({top:grid.offsetTop-160, behavior:'smooth'});
}

function setNavMode(mode){
  if(mode==='home'){ resetAll(); return; }
  if(mode==='popular'){
    filters.cat='all'; filters.sort='views';
  } else if(mode==='deals'){
    filters.cat='all'; filters.sort='new';
  } else if(mode==='stores'){
    filters.cat='all'; filters.sort='rated';
    toast('يعرض لك الإعلانات من البائعين ذوي التقييمات الحالية');
  } else if(mode==='services'){
    filters.cat='services'; filters.sort='new';
  }
  renderListings();
  const grid=$('#grid');
  if(grid) window.scrollTo({top:grid.offsetTop-160,behavior:'smooth'});
}

function getShareUrl(id){
  return `${location.origin}${location.pathname}?listing=${encodeURIComponent(id)}`;
}

function shareListing(id){
  const l = listings.find(x=>x.id===id);
  if(!l) return;
  const url = getShareUrl(id);
  const txt = `${l.title} — ${num(l.price)} ${CURRENCY}\n📍 ${l.city}\n${url}`;
  if(navigator.share){
    navigator.share({title:l.title,text:txt,url}).catch(()=>{});
  } else if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(url).then(()=>toast('تم نسخ رابط الإعلان 🔗','success'))
      .catch(()=>toast('تعذر نسخ الرابط','error'));
  } else {
    const ta=document.createElement('textarea'); ta.value=url; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); ta.remove();
    toast('تم نسخ رابط الإعلان 🔗','success');
  }
}

function toggleFav(listingId){
  if(!currentUser){ openAuth('login'); toast('سجّل الدخول أولاً'); return; }
  const idx = favs.findIndex(f=>f.userId===currentUser.id && f.listingId===listingId);
  const l = listings.find(x=>x.id===listingId);
  if(idx>-1){
    favs.splice(idx,1); toast('أُزيل من المفضلة');
  } else {
    favs.push({userId:currentUser.id, listingId, ts:Date.now()});
    if(l && l.userId!==currentUser.id) pushNotif(l.userId,'fav',`${currentUser.name} أضاف إعلانك إلى المفضلة`,listingId);
    toast('أُضيف إلى المفضلة','success');
  }
  store.set(K.favs,favs);
  renderListings();
  updateBadges();
}

function sendMsg(){
  const inp = $('#chatInput');
  if(!inp || !currentUser) return;
  const txt = inp.value.trim();
  if(!txt || !activeChat) return;
  const target = activeChat.otherId;
  const listingId = activeChat.listingId || null;
  msgs.push({id:uid(),from:currentUser.id,to:target,listingId,text:txt,ts:Date.now(),read:false});
  store.set(K.msgs,msgs);
  const l = listingId ? listings.find(x=>x.id===listingId) : null;
  pushNotif(target,'msg',`${currentUser.name}: ${txt.slice(0,80)}`,listingId);
  inp.value='';
  renderChat();
  updateBadges();
}

function openReport(id){
  if(!currentUser){ openAuth('login'); toast('سجّل الدخول لإرسال بلاغ'); return; }
  __reportListingId=id;
  const r=$('#reportReason'); if(r) r.value='spam';
  const n=$('#reportNote'); if(n) n.value='';
  const s=$('#sendReport');
  if(s){
    s.onclick=()=>{
      const reports=store.get('sq_reports',[]);
      const exists=reports.some(x=>x.listingId===id && x.userId===currentUser.id);
      if(exists){ toast('سبق أن أبلغت عن هذا الإعلان','error'); return; }
      const report={
        id:uid(), listingId:id, userId:currentUser.id,
        reason:$('#reportReason')?.value||'other',
        note:$('#reportNote')?.value.trim()||'',
        ts:Date.now(), status:'new'
      };
      reports.unshift(report);
      store.set('sq_reports',reports.slice(0,500));
      const l=listings.find(x=>x.id===id);
      if(l && l.userId!==currentUser.id) pushNotif(l.userId,'report','تم استلام بلاغ على أحد إعلاناتك',id);
      closeOverlay('#ovReport');
      toast('تم حفظ البلاغ وإرساله للإدارة','success');
    };
  }
  openOverlay('#ovReport');
}

function openMy(){
  if(!currentUser) return;
  ensureEnhancementsUI();
  const items=listings.filter(l=>l.userId===currentUser.id).sort((a,b)=>b.ts-a.ts);
  const myBox=$('#myBox'); if(!myBox) return;
  myBox.innerHTML=items.length ? items.map(l=>{
    const img=(l.images&&l.images[0])||PLACEHOLDER_IMAGE;
    return `<div class="conv my-listing-row" data-open="${l.id}">
      <img src="${esc(img)}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none"/>
      <div class="conv-body">
        <b>${esc(l.title)} ${l.featured?`<span class="mini-featured">${iconHTML('star','inline-icon')} مميز</span>`:''}</b>
        <p style="color:var(--primary);font-weight:800">${num(l.price)} ${CURRENCY}</p>
        <p>${iconHTML('eye','inline-icon')} ${num(l.views||0)} • ${timeAgo(l.ts)}</p>
      </div>
      <div class="listing-tools" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" data-editmy="${l.id}" title="تعديل"><svg class="ic"><use href="#i-tag"/></svg></button>
        <button class="btn btn-ghost btn-sm" data-boostmy="${l.id}" title="تمييز">${iconHTML('star')}</button>
        <button class="close-x" data-delmy="${l.id}" title="حذف"><svg class="ic" style="width:17px;color:var(--danger)"><use href="#i-trash"/></svg></button>
      </div>
    </div>`;
  }).join(''):`<div class="empty" style="border:none;padding:40px 10px">${iconHTML('package','empty-icon')}<h3>لا توجد إعلانات</h3><p>ابدأ بنشر أول إعلان لك!</p></div>`;
  myBox.onclick=e=>{
    const edit=e.target.closest('[data-editmy]');
    if(edit){e.stopPropagation();openEditListing(edit.dataset.editmy);return;}
    const boost=e.target.closest('[data-boostmy]');
    if(boost){e.stopPropagation();toggleFeaturedListing(boost.dataset.boostmy);return;}
    const d=e.target.closest('[data-delmy]');
    if(d){
      e.stopPropagation();
      if(!confirm('حذف هذا الإعلان؟')) return;
      const id=d.dataset.delmy;
      listings=listings.filter(l=>l.id!==id);
      favs=favs.filter(f=>f.listingId!==id);
      recent=recent.filter(x=>x!==id);
      store.set(K.listings,listings); store.set(K.favs,favs); store.set(K.recent,recent);
      renderAll(); openMy(); toast('تم الحذف','success'); return;
    }
    const op=e.target.closest('[data-open]');
    if(op){closeOverlay('#ovMy');openDetail(op.dataset.open);}
  };
  openOverlay('#ovMy');
}

function registerEnhancementEvents(){
  ensureEnhancementsUI();

  document.querySelectorAll('.nav-link').forEach((a,i)=>{
    a.onclick=e=>{
      e.preventDefault();
      document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
      setNavMode(['home','popular','deals','stores','services'][i]||'home');
    };
  });

  const promoCats=['electronics','furniture','fashion'];
  document.querySelectorAll('.promo-card .btn').forEach((b,i)=>{
    b.onclick=()=>setCategory(promoCats[i]||'all');
  });

  document.querySelectorAll('.app-btn').forEach(b=>{
    b.onclick=()=>installOrExplain();
  });

  document.querySelectorAll('.topbar-links a').forEach((a,i)=>{
    a.onclick=e=>{e.preventDefault();openInfo(['about','help','contact'][i]);};
  });

  const footerCols=[...document.querySelectorAll('.footer-col')];
  footerCols.forEach(col=>{
    col.querySelectorAll('a:not([id])').forEach(a=>{
      const text=a.textContent.trim();
      a.onclick=e=>{
        e.preventDefault();
        const type=text.includes('مساعدة')?'help':text.includes('الشروط')?'terms':text.includes('الخصوصية')?'privacy':
          (text.includes('تواصل')?'contact':'about');
        openInfo(type);
      };
    });
  });

  document.querySelectorAll('.footer-social a').forEach(a=>{
    a.onclick=e=>{e.preventDefault();toast('روابط التواصل الاجتماعي ستُربط عند إضافة حسابات المشروع.');};
  });

  document.querySelectorAll('.search-hot a,.search-tags a').forEach(a=>{
    a.addEventListener('click',e=>{e.preventDefault();performSearch(a.dataset.hot||a.textContent.replace(/^\d+\.\s*/,'').trim());});
  });

  document.addEventListener('click',e=>{
    const qr=e.target.closest('[data-qr]');
    if(qr) return;
  });

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); __deferredInstallPrompt=e;
  });

  const params=new URLSearchParams(location.search);
  const shared=params.get('listing');
  if(shared) setTimeout(()=>openDetail(shared),500);
}

async function installOrExplain(){
  if(__deferredInstallPrompt){
    __deferredInstallPrompt.prompt();
    try{ await __deferredInstallPrompt.userChoice; }catch(_){}
    __deferredInstallPrompt=null;
    return;
  }
  toast('من المتصفح: افتح القائمة ثم اختر «إضافة إلى الشاشة الرئيسية»');
}

/* توصيل الأحداث الإضافية بعد تحميل الصفحة */
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(registerEnhancementEvents,0);
});
