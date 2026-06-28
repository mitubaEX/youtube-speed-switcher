(() => {
  const MIN_RATE = 0.25;
  const MAX_RATE = 16;
  const SHORT_VIDEO_SEC = 600; // 10 min — 短尺動画 (音楽など) は等倍扱い
  const OVERLAY_ID = '__yt_speed_switcher_overlay__';

  const clampRate = (r) => Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(r * 100) / 100));

  const getVideo = () => document.querySelector('video');

  const isMusicHost = () => location.hostname === 'music.youtube.com';

  const isMusicCategory = () => {
    const genre = document.querySelector('meta[itemprop="genre"]')?.getAttribute('content');
    return !!(genre && genre.trim().toLowerCase() === 'music');
  };

  const isShortVideo = () => {
    const v = getVideo();
    const d = v?.duration;
    return Number.isFinite(d) && d > 0 && d <= SHORT_VIDEO_SEC;
  };

  // "現在ライブ中" のみ true。アーカイブは finite duration になるので除外される。
  // meta[itemprop="isLiveBroadcast"] や .ytp-live はアーカイブにも残ることがあるため使わない。
  const isLiveVideo = () => {
    const v = getVideo();
    return !!(v && v.duration === Infinity);
  };

  // 等倍にしたい条件: ライブ / 音楽ホスト / 音楽カテゴリ / 短尺動画 (≤10分)
  const shouldForceNormalSpeed = () =>
    isLiveVideo() || isMusicHost() || isMusicCategory() || isShortVideo();

  const forceReason = () => {
    if (isLiveVideo()) return 'live';
    if (isMusicHost()) return 'music';
    if (isMusicCategory()) return 'music';
    if (isShortVideo()) return 'short';
    return null;
  };

  // For user actions ("set X via popup / shortcut"): always apply and remember.
  const setRate = (rate) => {
    const video = getVideo();
    if (!video) return null;
    const next = clampRate(rate);
    video.playbackRate = next;
    showOverlay(`${next}x`);
    chrome.storage.sync.set({ lastRate: next }).catch(() => {});
    return next;
  };

  const bumpRate = (delta) => {
    const video = getVideo();
    if (!video) return null;
    return setRate(video.playbackRate + delta);
  };

  // For automatic apply on page/video load:
  //   - 音楽ホスト / 音楽カテゴリ / 短尺(≤10分) → 1.0x
  //   - それ以外 → lastRate
  // Does NOT update lastRate.
  const applyAutoRate = async () => {
    const video = getVideo();
    if (!video) return;
    let target;
    const reason = forceReason();
    if (reason) {
      target = 1.0;
    } else {
      const { lastRate } = await chrome.storage.sync.get(['lastRate']);
      target = typeof lastRate === 'number' ? lastRate : 1.0;
    }
    target = clampRate(target);
    if (video.playbackRate !== target) {
      video.playbackRate = target;
      const tag =
        reason === 'live' ? ' (live)' :
        reason === 'music' ? ' (music)' :
        reason === 'short' ? ' (≤10min)' :
        '';
      showOverlay(`${target}x${tag}`);
    }
  };

  const ensureOverlay = () => {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    Object.assign(el.style, {
      position: 'fixed',
      top: '80px',
      left: '24px',
      padding: '10px 18px',
      background: 'rgba(0,0,0,0.78)',
      color: '#fff',
      font: 'bold 22px/1 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
      borderRadius: '8px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 160ms ease',
    });
    document.documentElement.appendChild(el);
    return el;
  };

  let overlayTimer = null;
  const showOverlay = (text) => {
    const el = ensureOverlay();
    el.textContent = text;
    el.style.opacity = '1';
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => { el.style.opacity = '0'; }, 1200);
  };

  // The genre meta tag and video.duration are populated asynchronously after
  // SPA navigation. Wait until at least one signal is ready, or time out.
  const applyAutoRateWithRetry = (() => {
    let scheduled = false;
    return () => {
      if (scheduled) return;
      scheduled = true;
      let tries = 0;
      const tick = () => {
        const video = getVideo();
        const haveGenre = !!document.querySelector('meta[itemprop="genre"]');
        const haveDuration = video && Number.isFinite(video.duration) && video.duration > 0;
        if (video && (haveGenre || haveDuration || tries >= 15)) {
          applyAutoRate();
          scheduled = false;
          return;
        }
        tries++;
        setTimeout(tick, 200);
      };
      tick();
    };
  })();

  let lastUrl = location.href;
  const observe = () => {
    const obs = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        applyAutoRateWithRetry();
      }
      const v = getVideo();
      if (v && !v.dataset.__ytSpeedHooked) {
        v.dataset.__ytSpeedHooked = '1';
        v.addEventListener('loadedmetadata', applyAutoRateWithRetry);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('yt-navigate-finish', applyAutoRateWithRetry);
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;
    let rate = null;
    switch (msg.type) {
      case 'set-rate':
        rate = setRate(Number(msg.rate));
        break;
      case 'bump-rate':
        rate = bumpRate(Number(msg.delta));
        break;
      case 'get-rate': {
        const v = getVideo();
        rate = v ? v.playbackRate : null;
        sendResponse({ rate, forceReason: forceReason() });
        return true;
      }
      default:
        return;
    }
    sendResponse({ rate, forceReason: forceReason() });
    return true;
  });

  applyAutoRateWithRetry();
  observe();
})();
