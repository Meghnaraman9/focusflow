// FocusFlow Popup Script

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function formatMinutes(secs) {
  const m = Math.round(secs / 60);
  if (m >= 60) return `${Math.floor(m/60)}h ${m%60}m`;
  return `${m}m`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

async function loadData() {
  const result = await chrome.storage.local.get(["sessions"]);
  const all = result.sessions || [];
  const today = todayString();
  return all.filter(s => s.start.startsWith(today));
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function classifyDomain(domain) {
  const PRODUCTIVE = ["github.com","stackoverflow.com","leetcode.com","notion.so","figma.com","coursera.org","udemy.com","kaggle.com","claude.ai","docs.google.com","developer.mozilla.org","huggingface.co"];
  const UNPRODUCTIVE = ["facebook.com","instagram.com","twitter.com","x.com","tiktok.com","reddit.com","youtube.com","netflix.com","twitch.tv","discord.com"];
  if (PRODUCTIVE.some(d => domain.includes(d))) return "productive";
  if (UNPRODUCTIVE.some(d => domain.includes(d))) return "unproductive";
  return "neutral";
}

async function render() {
  // Current tab
  const tab = await getCurrentTab();
  const domain = tab?.url ? getDomain(tab.url) : "Unknown";
  const category = classifyDomain(domain);

  document.getElementById("current-domain").textContent = domain;
  const badge = document.getElementById("current-badge");
  badge.textContent = category.charAt(0).toUpperCase() + category.slice(1);
  badge.className = `current-badge badge-${category}`;

  // Today stats
  const sessions = await loadData();
  const totalSecs = sessions.reduce((a, s) => a + s.duration, 0);
  const prodSecs = sessions.filter(s => s.category === "productive").reduce((a, s) => a + s.duration, 0);
  const pct = totalSecs > 0 ? Math.round((prodSecs / totalSecs) * 100) : 0;

  document.getElementById("today-total").innerHTML = `${formatMinutes(totalSecs)}`;
  document.getElementById("productive-pct").innerHTML = `${pct}<span class="stat-unit">%</span>`;

  // Top sites
  const domainMap = {};
  sessions.forEach(s => {
    domainMap[s.domain] = (domainMap[s.domain] || 0) + s.duration;
  });
  const sorted = Object.entries(domainMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxSecs = sorted[0]?.[1] || 1;

  const container = document.getElementById("top-sites");
  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty">No activity yet today</div>`;
  } else {
    container.innerHTML = sorted.map(([dom, secs]) => {
      const cat = classifyDomain(dom);
      const colors = { productive: "#47ffb2", unproductive: "#ff4f4f", neutral: "#8888aa" };
      const pctW = Math.round((secs / maxSecs) * 100);
      return `<div class="bar-row">
        <div class="bar-name">${dom}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pctW}%;background:${colors[cat]}"></div></div>
        <div class="bar-time">${formatMinutes(secs)}</div>
      </div>`;
    }).join("");
  }
}

// Buttons
document.getElementById("dashboard-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
});

document.getElementById("clear-btn").addEventListener("click", async () => {
  const result = await chrome.storage.local.get(["sessions"]);
  const all = result.sessions || [];
  const today = todayString();
  const filtered = all.filter(s => !s.start.startsWith(today));
  await chrome.storage.local.set({ sessions: filtered });
  render();
});

render();
