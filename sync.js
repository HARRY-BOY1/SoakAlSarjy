/* =========================================================
   sync.js — Supabase persistence bridge for the Vercel build
   ========================================================= */
(function () {
  const cfg = window.SUPABASE_CONFIG;
  const sdk = window.supabase;
  const TABLE = 'marketplace_state';
  const ROW_ID = 'global';
  const SYNC_KEYS = ['sq_users','sq_listings','sq_favs','sq_msgs','sq_reviews','sq_notifs','sq_reports'];
  let client = null;
  let lastHash = '';
  let pushing = false;
  let pendingLocalChange = false;
  let internalWrite = false;
  let backendAvailable = true;

  if (!cfg || !sdk || typeof sdk.createClient !== 'function') {
    console.warn('Supabase SDK/config not found; local browser storage remains active.');
    return;
  }
  client = sdk.createClient(cfg.url, cfg.key);
  window.marketplaceSupabase = client;

  function read(k, d) {
    try { const v=JSON.parse(localStorage.getItem(k)); return v===null||v===undefined?d:v; }
    catch (e) { return d; }
  }
  function stateFromLocal() {
    return {
      id: ROW_ID,
      users: read('sq_users',[]),
      listings: read('sq_listings',[]),
      favs: read('sq_favs',[]),
      messages: read('sq_msgs',[]),
      reviews: read('sq_reviews',[]),
      notifications: read('sq_notifs',[]),
      reports: read('sq_reports',[]),
      updated_at: new Date().toISOString()
    };
  }
  function stateHash(s) {
    return JSON.stringify({u:s.users||[],l:s.listings||[],f:s.favs||[],m:s.messages||[],r:s.reviews||[],n:s.notifications||[],p:s.reports||[]});
  }
  function refreshUI() {
    if (typeof window.__reloadData === 'function') window.__reloadData();
    if (typeof window.renderAll === 'function') window.renderAll();
  }
  function setLocalState(d) {
    internalWrite = true;
    localStorage.setItem('sq_users',JSON.stringify(d.users||[]));
    localStorage.setItem('sq_listings',JSON.stringify(d.listings||[]));
    localStorage.setItem('sq_favs',JSON.stringify(d.favs||[]));
    localStorage.setItem('sq_msgs',JSON.stringify(d.messages||[]));
    localStorage.setItem('sq_reviews',JSON.stringify(d.reviews||[]));
    localStorage.setItem('sq_notifs',JSON.stringify(d.notifications||[]));
    localStorage.setItem('sq_reports',JSON.stringify(d.reports||[]));
    internalWrite = false;
  }
  function disableBackend(error) {
    backendAvailable = false;
    if (error) console.warn('Supabase sync disabled:', error.message || error);
  }

  async function pull() {
    if (!backendAvailable || pushing || pendingLocalChange) return false;
    const {data, error} = await client.from(TABLE).select('*').eq('id',ROW_ID).maybeSingle();
    if (error) { disableBackend(error); return false; }
    if (!data) return false;
    const remoteHash = stateHash(data);
    if (remoteHash === lastHash) return true;
    setLocalState(data);
    lastHash = remoteHash;
    return true;
  }

  async function push() {
    if (!backendAvailable || pushing) return;
    pushing = true;
    pendingLocalChange = false;
    const state = stateFromLocal();
    const {error} = await client.from(TABLE).upsert(state,{onConflict:'id'});
    if (error) disableBackend(error);
    else lastHash = stateHash(state);
    pushing = false;
  }

  const _set = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(k,v) {
    _set(k,v);
    if (SYNC_KEYS.includes(k) && !internalWrite && backendAvailable) {
      pendingLocalChange = true;
      clearTimeout(window.__supabasePushTimer);
      window.__supabasePushTimer = setTimeout(push,500);
    }
  };

  window.addEventListener('load', async () => {
    const pulled = await pull();
    if (pulled) refreshUI();
    else if (backendAvailable) await push();
    setInterval(async () => {
      if (!backendAvailable || pushing || pendingLocalChange) return;
      const before = lastHash;
      const got = await pull();
      if (got && before !== lastHash) refreshUI();
    }, 8000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && backendAvailable && !pushing) {
        pendingLocalChange = false;
        pull().then(ok => ok && refreshUI());
      }
    });
  });
})();
