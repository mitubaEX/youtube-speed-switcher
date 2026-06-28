const COMMAND_MAP = {
  'speed-music': { type: 'set-rate', rate: 1.0 },
  'speed-video': { type: 'set-rate', rate: 1.5 },
  'speed-fast':  { type: 'set-rate', rate: 2.0 },
  'speed-up':    { type: 'bump-rate', delta: 0.25 },
  'speed-down':  { type: 'bump-rate', delta: -0.25 },
};

const YOUTUBE_HOST = /^https:\/\/(www|m|music)\.youtube\.com\//;

chrome.commands.onCommand.addListener(async (command, tab) => {
  const payload = COMMAND_MAP[command];
  if (!payload) return;

  let targetTab = tab;
  if (!targetTab || !targetTab.id) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = active;
  }
  if (!targetTab || !targetTab.id || !targetTab.url || !YOUTUBE_HOST.test(targetTab.url)) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(targetTab.id, payload);
  } catch (e) {
    // content script not yet injected (e.g. on first load); ignore.
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.sync.get(['lastRate']);
  await chrome.storage.sync.set({
    lastRate: cur.lastRate ?? 1.5,
  });
  // Clean up storage from older versions.
  await chrome.storage.local.remove(['videoRates']).catch(() => {});
  await chrome.storage.sync.remove(['autoApply']).catch(() => {});
});
