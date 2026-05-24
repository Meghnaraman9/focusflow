// FocusFlow Dashboard Script

const DEFAULT_PRODUCTIVE = ["github.com","stackoverflow.com","leetcode.com","notion.so","figma.com","coursera.org","udemy.com","kaggle.com","claude.ai","docs.google.com","developer.mozilla.org","huggingface.co","trello.com","linear.app","codepen.io"];
const DEFAULT_UNPRODUCTIVE = ["facebook.com","instagram.com","twitter.com","x.com","tiktok.com","reddit.com","youtube.com","netflix.com","twitch.tv","discord.com","9gag.com","buzzfeed.com","pinterest.com"];

let settings = { productive: [...DEFAULT_PRODUCTIVE], unproductive: [...DEFAULT_UNPRODUCTIVE] };

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function classifyDomain(domain) {
  if (settings.productive.some(d => domain.includes(d))) return "productive";
  if (settings.unproductive.some(d => domain.includes(d))) return "unproductive";
  return "neutral";
}

function formatTime(secs) {
  const m = Math.round(secs / 60);
  if (m >= 60) return `${Math.floor(m/60)}h ${m%60}m`;
  return `${m}m`;
}

function todayString() { return new Date().toISOString().slice(0,10); }

function dateString(daysAgo) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0,10);
}

async function getSessions() {
  const r = await chrome.storage.local.get(["sessions"]);
  return r.sessions || [];
}

function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'overview') renderOverview();
  if (name === 'sites') renderSites();
  if (name === 'weekly') renderWeekly();
  if (name === 'settings') renderSettings();
}

// ---- OVERVIEW ----
let hourlyChart, donutChart, barChart;

async function renderOverview() {
  const all = await getSessions();
  const today = todayString();
  const sessions = all.filter(s => s.start.startsWith(today));

  const totalSecs = sessions.reduce((a,s) => a+s.duration, 0);
  const prodSecs  = sessions.filter(s => classifyDomain(s.domain) === "productive").reduce((a,s) => a+s.duration, 0);
  const unprodSecs = sessions.filter(s => classifyDomain(s.domain) === "unproductive").reduce((a,s) => a+s.duration, 0);
  const domains = new Set(sessions.map(s => s.domain));

  document.getElementById("kpi-total").textContent = formatTime(totalSecs);
  document.getElementById("kpi-prod").textContent = formatTime(prodSecs);
  document.getElementById("kpi-unprod").textContent = formatTime(unprodSecs);
  document.getElementById("kpi-sites").textContent = domains.size;
  document.getElementById("kpi-prod-pct").textContent = totalSecs > 0 ? `${Math.round(prodSecs/totalSecs*100)}% of today` : "0% of today";
  document.getElementById("kpi-unprod-pct").textContent = totalSecs > 0 ? `${Math.round(unprodSecs/totalSecs*100)}% of today` : "0% of today";

  // Hourly
  const hourly = Array(24).fill(0);
  sessions.forEach(s => {
    const h = new Date(s.start).getHours();
    hourly[h] += s.duration / 60;
  });
  const labels = Array.from({length:24},(_,i) => i===0?'12am':i<12?`${i}am`:i===12?'12pm':`${i-12}pm`);
  if (hourlyChart) hourlyChart.destroy();
  hourlyChart = new Chart(document.getElementById("hourly-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: hourly, backgroundColor: "rgba(232,255,71,0.6)", borderColor: "#e8ff47", borderWidth: 1, borderRadius: 4 }]
    },
    options: {
      responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#6060aa", font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: "#1b1b24" } },
        y: { ticks: { color: "#6060aa", font: { size: 10 } }, grid: { color: "#1b1b24" } }
      }
    }
  });

  // Donut
  const neutSecs = totalSecs - prodSecs - unprodSecs;
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(document.getElementById("donut-chart"), {
    type: "doughnut",
    data: {
      labels: ["Productive","Unproductive","Neutral"],
      datasets: [{ data: [prodSecs, unprodSecs, neutSecs], backgroundColor: ["rgba(71,255,178,0.8)","rgba(255,79,79,0.8)","rgba(136,136,170,0.5)"], borderWidth: 0 }]
    },
    options: {
      responsive: true, cutout: "65%",
      plugins: { legend: { labels: { color: "#f0f0f5", font: { size: 11 } } } }
    }
  });

  // Bar
  const domainMap = {};
  sessions.forEach(s => { domainMap[s.domain] = (domainMap[s.domain]||0) + s.duration; });
  const sorted = Object.entries(domainMap).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const barColors = sorted.map(([d]) => {
    const c = classifyDomain(d);
    return c === "productive" ? "rgba(71,255,178,0.7)" : c === "unproductive" ? "rgba(255,79,79,0.7)" : "rgba(136,136,170,0.5)";
  });
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById("bar-chart"), {
    type: "bar",
    data: {
      labels: sorted.map(([d]) => d),
      datasets: [{ data: sorted.map(([,s]) => Math.round(s/60)), backgroundColor: barColors, borderRadius: 6 }]
    },
    options: {
      indexAxis: "y", responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#6060aa" }, grid: { color: "#1b1b24" } },
        y: { ticks: { color: "#f0f0f5", font: { size: 11 } }, grid: { color: "transparent" } }
      }
    }
  });
}

// ---- SITES ----
async function renderSites() {
  const all = await getSessions();
  const today = todayString();
  const sessions = all.filter(s => s.start.startsWith(today)).reverse();
  const tbody = document.getElementById("sites-tbody");
  if (sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#6060aa;padding:24px">No sessions recorded today</td></tr>`;
    return;
  }
  tbody.innerHTML = sessions.map(s => {
    const cat = classifyDomain(s.domain);
    const badgeClass = {productive:"bp",unproductive:"bu",neutral:"bn"}[cat];
    const time = new Date(s.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return `<tr class="session-row">
      <td>${s.domain}</td>
      <td><span class="badge-sm ${badgeClass}">${cat}</span></td>
      <td>${formatTime(s.duration)}</td>
      <td style="color:#6060aa">${time}</td>
    </tr>`;
  }).join("");
}

// ---- WEEKLY ----
let weeklyChart;
async function renderWeekly() {
  const all = await getSessions();
  const days = Array.from({length:7},(_,i)=>dateString(6-i));
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const grid = document.getElementById("week-grid");

  const weekData = days.map(day => {
    const sess = all.filter(s => s.start.startsWith(day));
    const total = sess.reduce((a,s)=>a+s.duration,0);
    const prod = sess.filter(s=>classifyDomain(s.domain)==="productive").reduce((a,s)=>a+s.duration,0);
    return { day, total, prod, label: dayNames[new Date(day+"T12:00:00").getDay()] };
  });

  const maxTotal = Math.max(...weekData.map(d=>d.total), 1);
  const todayStr = todayString();

  grid.innerHTML = weekData.map(d => {
    const pct = Math.round(d.total / maxTotal * 100);
    const isToday = d.day === todayStr;
    const color = d.total > 0 ? `hsl(${80 + (d.prod/Math.max(d.total,1))*40}, 90%, 60%)` : "#2a2a30";
    return `<div class="day-card ${isToday?"day-today":""}">
      <div class="day-name">${d.label}</div>
      <div class="day-total">${d.total > 0 ? formatTime(d.total) : "—"}</div>
      <div class="day-bar" style="background:${color};height:${Math.max(pct*0.04,0.04)}rem"></div>
    </div>`;
  }).join("");

  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(document.getElementById("weekly-chart"), {
    type: "line",
    data: {
      labels: weekData.map(d=>d.label),
      datasets: [
        { label: "Total", data: weekData.map(d=>Math.round(d.total/60)), borderColor: "#e8ff47", backgroundColor: "rgba(232,255,71,0.08)", tension: 0.4, fill: true, pointBackgroundColor: "#e8ff47" },
        { label: "Productive", data: weekData.map(d=>Math.round(d.prod/60)), borderColor: "#47ffb2", backgroundColor: "rgba(71,255,178,0.06)", tension: 0.4, fill: true, pointBackgroundColor: "#47ffb2" }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#f0f0f5", font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: "#6060aa" }, grid: { color: "#1b1b24" } },
        y: { ticks: { color: "#6060aa" }, grid: { color: "#1b1b24" } }
      }
    }
  });
}

// ---- SETTINGS ----
function renderSettings() {
  const prodList = document.getElementById("productive-list");
  const unprodList = document.getElementById("unproductive-list");

  prodList.innerHTML = settings.productive.map(d =>
    `<div class="domain-tag">${d}<button class="remove-btn" onclick="removeDomain('productive','${d}')">×</button></div>`
  ).join("");

  unprodList.innerHTML = settings.unproductive.map(d =>
    `<div class="domain-tag">${d}<button class="remove-btn" onclick="removeDomain('unproductive','${d}')">×</button></div>`
  ).join("");
}

function addDomain(type) {
  const input = document.getElementById(`add-${type}-input`);
  const val = input.value.trim().toLowerCase();
  if (val && !settings[type].includes(val)) {
    settings[type].push(val);
    input.value = "";
    renderSettings();
  }
}

function removeDomain(type, domain) {
  settings[type] = settings[type].filter(d => d !== domain);
  renderSettings();
}

// ---- SYNC ----
async function syncToBackend() {
  const all = await getSessions();
  try {
    const res = await fetch("http://localhost:8000/api/sessions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: all })
    });
    if (res.ok) alert("✓ Synced to backend successfully!");
    else alert("Sync failed: server returned error");
  } catch {
    alert("Backend offline. Run: uvicorn main:app --reload");
  }
}

// Init — wire up tab buttons properly
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const page = this.textContent.trim().toLowerCase();
    showPage(page, this);
  });
});

renderOverview();
