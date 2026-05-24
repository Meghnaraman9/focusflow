// FocusFlow - Background Service Worker

const BACKEND_URL = "http://localhost:8000";

const PRODUCTIVE_DOMAINS = [
  "github.com", "stackoverflow.com", "leetcode.com", "codepen.io",
  "developer.mozilla.org", "docs.python.org", "medium.com", "notion.so",
  "figma.com", "trello.com", "coursera.org", "udemy.com", "edx.org",
  "kaggle.com", "huggingface.co", "arxiv.org", "claude.ai", "docs.google.com"
];

const UNPRODUCTIVE_DOMAINS = [
  "facebook.com", "instagram.com", "twitter.com", "x.com",
  "tiktok.com", "snapchat.com", "reddit.com", "youtube.com",
  "netflix.com", "twitch.tv", "9gag.com", "buzzfeed.com",
  "pinterest.com", "discord.com"
];

let activeTabId = null;
let activeUrl = null;
let startTime = null;

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return null;
  }
}

function classifyDomain(domain) {
  if (!domain) return "neutral";
  if (PRODUCTIVE_DOMAINS.some(d => domain.includes(d))) return "productive";
  if (UNPRODUCTIVE_DOMAINS.some(d => domain.includes(d))) return "unproductive";
  return "neutral";
}

async function saveSession(url, start, end) {
  if (!url || !start || !end) return;
  const duration = Math.round((end - start) / 1000);
  if (duration < 2) return;

  const domain = getDomain(url);
  if (!domain) return;
  const category = classifyDomain(domain);

  const entry = {
    url,
    domain,
    category,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    duration
  };

  try {
    const result = await chrome.storage.local.get(["sessions"]);
    const sessions = result.sessions || [];
    sessions.push(entry);
    await chrome.storage.local.set({ sessions });
  } catch (e) {
    console.error("FocusFlow storage error:", e);
  }

  // Sync to backend (optional - only if running)
  try {
    fetch(BACKEND_URL + "/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    });
  } catch (e) {
    // backend offline - data saved locally
  }
}

function startTracking(tabId, url) {
  activeTabId = tabId;
  activeUrl = url;
  startTime = Date.now();
}

async function stopTracking() {
  if (activeUrl && startTime) {
    await saveSession(activeUrl, startTime, Date.now());
  }
  activeTabId = null;
  activeUrl = null;
  startTime = null;
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await stopTracking();
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith("http")) {
      startTracking(activeInfo.tabId, tab.url);
    }
  } catch (e) {
    // tab may have closed
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.url && tab.url.startsWith("http")) {
    if (tabId === activeTabId && tab.url !== activeUrl) {
      await stopTracking();
      startTracking(tabId, tab.url);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) {
    await stopTracking();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopTracking();
  } else {
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0 && tabs[0].url && tabs[0].url.startsWith("http")) {
        startTracking(tabs[0].id, tabs[0].url);
      }
    } catch (e) {
      // ignore
    }
  }
});

// Weekly report alarm
chrome.alarms.create("weekly-report", { periodInMinutes: 10080 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "weekly-report") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "FocusFlow Weekly Report Ready",
      message: "Your productivity report for the week is ready. Click to view."
    });
  }
});
