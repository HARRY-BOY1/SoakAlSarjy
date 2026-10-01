/* =========================================================
   sync.js — Professional Supabase persistence bridge
   Normalized tables + legacy localStorage compatibility
   ========================================================= */
(function () {
  const cfg = window.SUPABASE_CONFIG;
  const sdk = window.supabase;

  const TABLES = {
    users: 'marketplace_users',
    listings: 'marketplace_listings',
    favs: 'marketplace_favorites',
    messages: 'marketplace_messages',
    reviews: 'marketplace_reviews',
    notifications: 'marketplace_notifications',
    reports: 'marketplace_reports'
  };

  const KEYS = {
    users: 'sq_users',
    listings: 'sq_listings',
    favs: 'sq_favs',
    messages: 'sq_msgs',
    reviews: 'sq_reviews',
    notifications: 'sq_notifs',
    reports: 'sq_reports'
  };

  const SYNC_KEYS = Object.values(KEYS);

  let client = null;
  let syncing = false;
  let internalWrite = false;
  let backendAvailable = true;
  let pendingLocalChange = false;
  let pushTimer = null;

  if (!cfg || !sdk || typeof sdk.createClient !== 'function') {
    console.warn(
      'Supabase SDK/config not found; local browser storage remains active.'
    );
    return;
  }

  client = sdk.createClient(cfg.url, cfg.key);
  window.marketplaceSupabase = client;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null || value === undefined ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    internalWrite = true;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } finally {
      internalWrite = false;
    }
  }

  function now() {
    return new Date().toISOString();
  }

  function disableBackend(error) {
    backendAvailable = false;

    console.warn(
      'Supabase sync disabled:',
      error && (error.message || error)
    );
  }

  function refreshUI() {
    try {
      if (typeof window.__reloadData === 'function') {
        window.__reloadData();
      }

      if (typeof window.renderAll === 'function') {
        window.renderAll();
      }
    } catch (e) {
      console.warn('UI refresh failed:', e);
    }
  }

  /* =========================
     USERS
     ========================= */

  function toUser(row) {
    return {
      id: row.id,
      name: row.name || '',
      phone: row.phone || '',
      city: row.city || '',
      verified: !!row.verified,
      bio: row.bio || ''
    };
  }

  function fromUser(remote, local) {
    return Object.assign({}, local || {}, {
      id: remote.id,
      name: remote.name || '',
      phone: remote.phone || '',
      city: remote.city || '',
      verified: !!remote.verified,
      bio: remote.bio || ''
    });
  }

  /* =========================
     LISTINGS
     ========================= */

  function toListing(row) {
    return {
      id: row.id,
      user_id: row.userId || row.user_id || null,
      title: row.title || '',
      cat: row.cat || '',
      city: row.city || '',
      type: row.type || 'sale',
      condition: row.condition || 'used',
      brand: row.brand || '',
      model: row.model || '',
      quantity: Number.isFinite(Number(row.quantity))
        ? Number(row.quantity)
        : 1,
      price: Number.isFinite(Number(row.price))
        ? Number(row.price)
        : 0,
      phone: row.phone || '',
      description: row.desc || row.description || '',
      tags: Array.isArray(row.tags) ? row.tags : [],
      images: Array.isArray(row.images) ? row.images : [],
      delivery: row.delivery || 'pickup',
      negotiable: !!row.negotiable,
      featured: !!row.featured,
      views: Number.isFinite(Number(row.views))
        ? Number(row.views)
        : 0,
      updated_at: now()
    };
  }

  function fromListing(remote, local) {
    return Object.assign({}, local || {}, {
      id: remote.id,
      userId: remote.user_id || remote.userId || '',
      title: remote.title || '',
      cat: remote.cat || '',
      city: remote.city || '',
      type: remote.type || 'sale',
      condition: remote.condition || 'used',
      brand: remote.brand || '',
      model: remote.model || '',
      quantity: remote.quantity == null ? 1 : remote.quantity,
      price: Number(remote.price || 0),
      phone: remote.phone || '',
      desc: remote.description || '',
      description: remote.description || '',
      tags: Array.isArray(remote.tags) ? remote.tags : [],
      images: Array.isArray(remote.images) ? remote.images : [],
      delivery: remote.delivery || 'pickup',
      negotiable: !!remote.negotiable,
      featured: !!remote.featured,
      views: Number(remote.views || 0)
    });
  }

  /* =========================
     GENERIC TABLES
     ========================= */

  function toGeneric(row, kind) {
    const base = Object.assign({}, row);
    const id = base.id;

    delete base.id;

    const result = {
      id: id,
      data: base
    };

    if (kind === 'favs') {
      result.user_id = row.userId || row.user_id || null;
      result.listing_id = row.listingId || row.listing_id || null;
    }

    if (kind === 'messages') {
      result.from_user_id =
        row.fromUserId ||
        row.from_user_id ||
        row.from ||
        null;

      result.to_user_id =
        row.toUserId ||
        row.to_user_id ||
        row.to ||
        null;
    }

    if (kind === 'reviews') {
      result.author_id =
        row.authorId ||
        row.author_id ||
        row.userId ||
        null;

      result.target_id =
        row.targetId ||
        row.target_id ||
        null;

      result.rating =
        row.rating == null
          ? null
          : Number(row.rating);
    }

    if (kind === 'notifications') {
      result.user_id =
        row.userId ||
        row.user_id ||
        null;
    }

    if (kind === 'reports') {
      result.user_id =
        row.userId ||
        row.user_id ||
        null;

      result.listing_id =
        row.listingId ||
        row.listing_id ||
        null;
    }

    return result;
  }

  function fromGeneric(remote, local, kind) {
    const data =
      remote.data &&
      typeof remote.data === 'object'
        ? remote.data
        : {};

    const result = Object.assign(
      {},
      local || {},
      data,
      {
        id: remote.id
      }
    );

    if (kind === 'favs') {
      result.userId =
        remote.user_id ||
        result.userId ||
        '';

      result.listingId =
        remote.listing_id ||
        result.listingId ||
        '';
    }

    if (kind === 'messages') {
      result.fromUserId =
        remote.from_user_id ||
        result.fromUserId ||
        '';

      result.toUserId =
        remote.to_user_id ||
        result.toUserId ||
        '';
    }

    if (kind === 'reviews') {
      result.authorId =
        remote.author_id ||
        result.authorId ||
        '';

      result.targetId =
        remote.target_id ||
        result.targetId ||
        '';

      if (remote.rating != null) {
        result.rating = remote.rating;
      }
    }

    if (kind === 'notifications') {
      result.userId =
        remote.user_id ||
        result.userId ||
        '';
    }

    if (kind === 'reports') {
      result.userId =
        remote.user_id ||
        result.userId ||
        '';

      result.listingId =
        remote.listing_id ||
        result.listingId ||
        '';
    }

    return result;
  }

  /* =========================
     LOCAL STORAGE
     ========================= */

  function localItems(kind) {
    return read(KEYS[kind], []);
  }

  function setLocalItems(kind, items) {
    write(
      KEYS[kind],
      Array.isArray(items) ? items : []
    );
  }

  /* =========================
     SUPABASE
     ========================= */

  async function fetchTable(kind) {
    const { data, error } = await client
      .from(TABLES[kind])
      .select('*');

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  }

  async function upsertRows(kind, rows) {
    if (!rows.length) {
      return;
    }

    const { error } = await client
      .from(TABLES[kind])
      .upsert(rows, {
        onConflict: 'id'
      });

    if (error) {
      throw error;
    }
  }

  async function removeMissing(kind, localIds) {
    /*
      Safety guard:
      Never wipe an entire Supabase table if localStorage
      temporarily returns an empty array.
    */

    if (!localIds.length) {
      return;
    }

    const remote = await fetchTable(kind);
    const keep = new Set(localIds);

    const idsToDelete = remote
      .map(row => row.id)
      .filter(id => id && !keep.has(id));

    if (!idsToDelete.length) {
      return;
    }

    const { error } = await client
      .from(TABLES[kind])
      .delete()
      .in('id', idsToDelete);

    if (error) {
      throw error;
    }
  }

  /* =========================
     PULL FROM SUPABASE
     ========================= */

  async function pull() {
    if (!backendAvailable || syncing) {
      return false;
    }

    syncing = true;

    try {
      for (const kind of Object.keys(TABLES)) {
        const remote = await fetchTable(kind);
        const local = localItems(kind);

        const localById = new Map(
          local
            .filter(x => x && x.id)
            .map(x => [x.id, x])
        );

        let merged;

        if (kind === 'users') {
          merged = remote.map(row =>
            fromUser(
              row,
              localById.get(row.id)
            )
          );
        } else if (kind === 'listings') {
          merged = remote.map(row =>
            fromListing(
              row,
              localById.get(row.id)
            )
          );
        } else {
          merged = remote.map(row =>
            fromGeneric(
              row,
              localById.get(row.id),
              kind
            )
          );
        }

        /*
          Keep local-only records until push() uploads them.
        */

        const remoteIds = new Set(
          remote.map(row => row.id)
        );

        for (const item of local) {
          if (
            item &&
            item.id &&
            !remoteIds.has(item.id)
          ) {
            merged.push(item);
          }
        }

        setLocalItems(kind, merged);
      }

      pendingLocalChange = false;

      return true;

    } catch (error) {
      disableBackend(error);
      return false;

    } finally {
      syncing = false;
    }
  }

  /* =========================
     PUSH TO SUPABASE
     ========================= */

  async function push() {
    if (!backendAvailable || syncing) {
      return false;
    }

    syncing = true;
    pendingLocalChange = false;

    try {
      for (const kind of Object.keys(TABLES)) {
        const items =
          localItems(kind)
            .filter(x => x && x.id);

        let rows;

        if (kind === 'users') {
          rows = items.map(toUser);

        } else if (kind === 'listings') {
          rows = items.map(toListing);

        } else {
          rows = items.map(item =>
            toGeneric(item, kind)
          );
        }

        await upsertRows(
          kind,
          rows
        );

        /*
          Delete records removed from the local application.
          Empty arrays are intentionally protected.
        */

        if (items.length) {
          await removeMissing(
            kind,
            items.map(item => item.id)
          );
        }
      }

      return true;

    } catch (error) {
      disableBackend(error);
      return false;

    } finally {
      syncing = false;
    }
  }

  /* =========================
     AUTOMATIC SYNC
     ========================= */

  function schedulePush() {
    if (
      !backendAvailable ||
      internalWrite
    ) {
      return;
    }

    pendingLocalChange = true;

    clearTimeout(pushTimer);

    pushTimer = setTimeout(
      async function () {
        await push();
      },
      700
    );
  }

  const originalSetItem =
    localStorage.setItem.bind(
      localStorage
    );

  localStorage.setItem =
    function (key, value) {
      originalSetItem(key, value);

      if (
        SYNC_KEYS.includes(key) &&
        !internalWrite
      ) {
        schedulePush();
      }
    };

  /* =========================
     INITIAL SYNC
     ========================= */

  async function initialSync() {
    if (!backendAvailable) {
      return;
    }

    /*
      First pull shared data from Supabase.
      Then upload local-only data.
    */

    const pulled = await pull();

    if (pulled) {
      refreshUI();

      await push();
    }
  }

  window.addEventListener(
    'load',
    function () {
      initialSync();

      /*
        Keep users synchronized every 15 seconds.
      */

      setInterval(
        async function () {
          if (
            !backendAvailable ||
            syncing ||
            pendingLocalChange
          ) {
            return;
          }

          const changed = await pull();

          if (changed) {
            refreshUI();
          }
        },
        15000
      );

      /*
        Immediately refresh when the user
        returns to the browser tab.
      */

      document.addEventListener(
        'visibilitychange',
        function () {
          if (
            !document.hidden &&
            backendAvailable &&
            !syncing
          ) {
            pull().then(
              function (ok) {
                if (ok) {
                  refreshUI();
                }
              }
            );
          }
        }
      );
    }
  );

})();
