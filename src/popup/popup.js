async function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

document.getElementById("settingsBtn").onclick = () => chrome.runtime.openOptionsPage();
document.getElementById("setupBtn").onclick = () => chrome.runtime.openOptionsPage();
document.getElementById("refreshBtn").onclick = load;
document.getElementById("clearBtn").onclick = async () => {
  if (confirm("Clear only local sync history? GitHub files will not be deleted.")) {
    await send("CLEAR_HISTORY");
    load();
  }
};

load();

async function load() {
  const settings = (await send("GET_SETTINGS")).settings;
  const configured = !!(settings.githubToken && settings.githubOwner && settings.githubRepo);
  document.getElementById("setupCard").classList.toggle("hidden", configured);

  const dashboard = await send("GET_DASHBOARD");
  if (!dashboard.ok) return;

  setText("total", dashboard.total);
  setText("streak", `${dashboard.streak} 🔥`);
  setText("easy", dashboard.counts.Easy || 0);
  setText("medium", dashboard.counts.Medium || 0);
  setText("hard", dashboard.counts.Hard || 0);
  setText("gfg", dashboard.platforms.gfg || 0);

  setText("blind75Label", `${dashboard.blind75.completed}/${dashboard.blind75.total}`);
  setText("blind150Label", `${dashboard.blind150.completed}/${dashboard.blind150.total}`);
  document.getElementById("blind75Bar").style.width =
    `${dashboard.blind75.total ? (dashboard.blind75.completed / dashboard.blind75.total) * 100 : 0}%`;

  setText("syncStatus", dashboard.lastSync?.ok ? "✓ Connected" : "—");

  const recent = document.getElementById("recent");
  recent.innerHTML = "";
  if (!dashboard.recent.length) {
    recent.innerHTML = `<div class="meta">No syncs yet. Submit an accepted problem.</div>`;
    return;
  }

  for (const r of dashboard.recent) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <div class="name">${escapeHtml(r.problemTitle || r.problemSlug)}</div>
        <div class="meta">${escapeHtml(r.platform)} · ${escapeHtml(r.language)} · ${escapeHtml(r.difficulty)}</div>
      </div>
      <div class="badge">SYNCED</div>
    `;
    recent.appendChild(row);
  }
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
