/* =========================================================
   sync.js — مزامنة آمنة ومحسّنة مع سيرفر Node.js
   ========================================================= */
(function () {
  const API = location.origin;
  const SYNC_KEYS = ['sq_users','sq_listings','sq_msgs','sq_reviews','sq_notifs','sq_reports'];
  let lastHash = '';
  let pushing = false;
  let pendingLocalChange = false;
  let internalWrite = false;
  let backendAvailable = true;

  function read(k, d) {
    try { const v=JSON.parse(localStorage.getItem(k)); return v===null||v===undefined?d:v; }
    catch (e) { return d; }
  }
  function snapshot() {
    return JSON.stringify({
      u:read('sq_users',[]), l:read('sq_listings',[]), m:read('sq_msgs',[]),
      r:read('sq_reviews',[]), n:read('sq_notifs',[]), p:read('sq_reports',[])
    });
  }
  function refreshUI() {
    if (typeof window.__reloadData === 'function') window.__reloadData();
    if (typeof window.renderAll === 'function') window.renderAll();
  }

  async function pull() {
    if(!backendAvailable || pushing || pendingLocalChange) return false;
    try {
      const r=await fetch(API+'/api/data',{cache:'no-store'});
      if(!r.ok){ backendAvailable=false; return false; }
      const d=await r.json();
      const incoming=JSON.stringify({
        u:d.users||[],l:d.listings||[],m:d.messages||[],
        r:d.reviews||[],n:d.notifications||[],p:d.reports||[]
      });
      if(incoming===lastHash) return true;
      internalWrite=true;
      localStorage.setItem('sq_users',JSON.stringify(d.users||[]));
      localStorage.setItem('sq_listings',JSON.stringify(d.listings||[]));
      localStorage.setItem('sq_msgs',JSON.stringify(d.messages||[]));
      localStorage.setItem('sq_reviews',JSON.stringify(d.reviews||[]));
      localStorage.setItem('sq_notifs',JSON.stringify(d.notifications||[]));
      localStorage.setItem('sq_reports',JSON.stringify(d.reports||[]));
      internalWrite=false;
      lastHash=snapshot();
      return true;
    } catch(e) { backendAvailable=false; return false; }
  }

  async function push() {
    if(!backendAvailable || pushing) return;
    pushing=true;
    pendingLocalChange=false;
    try {
      const r=await fetch(API+'/api/sync',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          users:read('sq_users',[]), listings:read('sq_listings',[]),
          messages:read('sq_msgs',[]), reviews:read('sq_reviews',[]),
          notifications:read('sq_notifs',[]), reports:read('sq_reports',[])
        })
      });
      if(r.ok){ lastHash=snapshot(); }
    }catch(e){ backendAvailable=false; } finally{ pushing=false; }
  }

  const _set=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){
    _set(k,v);
    if(SYNC_KEYS.includes(k) && !internalWrite){
      pendingLocalChange=true;
      clearTimeout(window.__pushT);
      window.__pushT=setTimeout(push,350);
    }
  };

  window.addEventListener('load',async()=>{
    const ok=await pull();
    if(ok && typeof window.renderAll==='function') refreshUI();

    setInterval(async()=>{
      if(!backendAvailable || pushing || pendingLocalChange) return;
      const before=snapshot();
      const got=await pull();
      if(got && before!==snapshot()) refreshUI();
    },4000);

    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden && !pushing){
        pendingLocalChange=false;
        pull().then(ok=>ok&&refreshUI());
      }
    });
  });
})();
