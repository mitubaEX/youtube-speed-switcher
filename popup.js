const PRESETS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const YOUTUBE_HOST = /^https:\/\/(www|m|music)\.youtube\.com\//;

const $grid = document.getElementById('grid');
const $current = document.getElementById('current');
const $badge = document.getElementById('badge');

const getActiveYouTubeTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !YOUTUBE_HOST.test(tab.url)) return null;
  return tab;
};

const sendToTab = async (tabId, msg) => {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch (_) {
    return null;
  }
};

const render = (active) => {
  $grid.innerHTML = '';
  for (const rate of PRESETS) {
    const btn = document.createElement('button');
    btn.className = 'btn' + (active === rate ? ' active' : '');
    btn.textContent = `${rate}x`;
    btn.dataset.rate = String(rate);
    $grid.appendChild(btn);
  }
};

const renderNoYouTube = () => {
  $grid.outerHTML = '<div class="nope">YouTube タブで開いてください</div>';
  $current.textContent = '—';
};

(async () => {
  const tab = await getActiveYouTubeTab();
  if (!tab) {
    renderNoYouTube();
    return;
  }

  const res = await sendToTab(tab.id, { type: 'get-rate' });
  const rate = res?.rate ?? 1.0;
  const reason = res?.forceReason;
  $current.textContent = `${rate}x`;
  $badge.textContent =
    reason === 'live' ? '🔴 ライブ配信中 — 1.0x で自動再生'
    : reason === 'music' ? '🎵 Music カテゴリ — 1.0x で自動再生'
    : reason === 'short' ? '⏱ 10分以下の短尺 — 1.0x で自動再生'
    : '';
  render(rate);

  $grid.addEventListener('click', async (e) => {
    const t = e.target.closest('.btn');
    if (!t) return;
    const rate = Number(t.dataset.rate);
    const res = await sendToTab(tab.id, { type: 'set-rate', rate });
    const applied = res?.rate ?? rate;
    $current.textContent = `${applied}x`;
    render(applied);
  });
})();
