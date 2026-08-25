async function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

const connectButton = document.getElementById("connectGithub");
const disconnectButton = document.getElementById("disconnectGithub");
const repoSelect = document.getElementById("repoSelect");
const branchSelect = document.getElementById("branchSelect");
const branchSelectionDiv = document.getElementById("branchSelection");
const testAccessBtn = document.getElementById("testAccessBtn");
const accessTestResult = document.getElementById("accessTestResult");

connectButton.addEventListener("click", async () => {
  connectButton.disabled = true;
  connectButton.textContent = "Connecting...";
  try {
    const response = await send("CONNECT_GITHUB");
    if (!response?.ok) throw new Error(response?.error || "GitHub connection failed.");
    await initGitHubState();
  } catch (error) {
    alert(error.message);
  } finally {
    connectButton.disabled = false;
    connectButton.textContent = "Connect GitHub";
  }
});

disconnectButton.addEventListener("click", async () => {
  await send("DISCONNECT_GITHUB");
  document.getElementById("disconnectedState").style.display = "block";
  document.getElementById("connectedState").style.display = "none";
  document.getElementById("githubStatus").textContent = "Not connected";
});

repoSelect.addEventListener("change", async (e) => {
  const value = e.target.value;
  if (!value) {
    branchSelectionDiv.style.display = "none";
    return;
  }
  
  const [owner, repo] = value.split("/");
  repoSelect.disabled = true;
  await send("SELECT_REPOSITORY", { owner, repo, branch: "" });
  await loadBranches(owner, repo);
  repoSelect.disabled = false;
});

branchSelect.addEventListener("change", async (e) => {
  const branch = e.target.value;
  if (!branch) return;
  await send("SELECT_BRANCH", { branch });
  accessTestResult.textContent = "";
});

testAccessBtn.addEventListener("click", async () => {
  const value = repoSelect.value;
  const branch = branchSelect.value;
  if (!value || !branch) {
    setAccessStatus("Please select a repository and branch.", true);
    return;
  }
  
  const [owner, repo] = value.split("/");
  testAccessBtn.disabled = true;
  testAccessBtn.textContent = "Testing...";
  setAccessStatus("Testing access...", false);
  
  try {
    const response = await send("TEST_REPOSITORY_ACCESS", { owner, repo, branch });
    if (response.ok) {
      setAccessStatus(`✓ Access OK. (${response.access.private ? 'Private' : 'Public'} Repo)`, false);
    } else {
      setAccessStatus(`✕ ${response.error}`, true);
    }
  } catch (err) {
    setAccessStatus(`✕ ${err.message}`, true);
  } finally {
    testAccessBtn.disabled = false;
    testAccessBtn.textContent = "Test Access";
  }
});

function setAccessStatus(msg, isError) {
  accessTestResult.textContent = msg;
  accessTestResult.style.color = isError ? "#ff8ea8" : "#7ee2aa";
}

document.getElementById("settingsBtn").onclick = () => chrome.runtime.openOptionsPage();
document.getElementById("refreshBtn").onclick = load;
document.getElementById("clearBtn").onclick = async () => {
  if (confirm("Clear only local sync history? GitHub files will not be deleted.")) {
    await send("CLEAR_HISTORY");
    load();
  }
};

load();

async function load() {
  await initGitHubState();
  
  const dashboard = await send("GET_DASHBOARD");
  if (!dashboard.ok) return;

  setText("total", dashboard.totalSolved || 0);
  setText("streak", `${dashboard.streak?.current || 0} 🔥`);
  setText("easy", dashboard.byDifficulty?.Easy || 0);
  setText("medium", dashboard.byDifficulty?.Medium || 0);
  setText("hard", dashboard.byDifficulty?.Hard || 0);


  const syncStatusEl = document.getElementById("syncStatus");
  if (dashboard.failedCount > 0) {
    syncStatusEl.textContent = `⚠ ${dashboard.failedCount} sync failed`;
    syncStatusEl.style.color = "#fbbf24";
  } else if (dashboard.totalRecords > 0) {
    syncStatusEl.textContent = "✓ All synced";
    syncStatusEl.style.color = "#34d399";
  } else {
    syncStatusEl.textContent = "";
  }

  const recent = document.getElementById("recent");
  recent.innerHTML = "";
  if (!dashboard.recentActivity || !dashboard.recentActivity.length) {
    recent.innerHTML = `<div class="meta" style="padding: 12px; text-align: center;">No syncs yet — solve a problem and hit Submit to get started</div>`;
    return;
  }

  for (const r of dashboard.recentActivity) {
    const row = document.createElement("div");
    row.className = "row";
    
    const badgeHtml = r.status === "FAILED" 
      ? `<div class="badge" style="background:#451a1e; color:#ff8ea8; margin-right: 8px;">FAILED</div>
         <button class="retry-btn" data-slug="${escapeHtml(r.problemSlug)}" style="padding: 4px 8px; font-size: 11px; border-radius: 4px; background: #3f3f46; color: white; border: none; cursor: pointer;">Retry</button>`
      : `<div class="badge">SYNCED</div>`;

    row.innerHTML = `
      <div>
        <div class="name">${escapeHtml(r.problemTitle || r.problemSlug)}</div>
        <div class="meta">${escapeHtml(r.platform)} · ${escapeHtml(r.language)} · ${escapeHtml(r.difficulty)}</div>
      </div>
      <div style="display:flex; align-items:center;">
        ${badgeHtml}
      </div>
    `;
    recent.appendChild(row);
  }

  // Attach retry handlers
  const retryBtns = recent.querySelectorAll('.retry-btn');
  retryBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const btnEl = e.target;
      const problemSlug = btnEl.getAttribute('data-slug');
      btnEl.disabled = true;
      btnEl.textContent = "Retrying...";
      await handleRetryClick(problemSlug, btnEl);
    });
  });
}

async function handleRetryClick(problemSlug, btnEl) {
  try {
    const response = await send("RETRY_SYNC", { problemSlug });
    if (response?.ok) {
      await load(); // re-fetch GET_DASHBOARD and re-render
    } else {
      btnEl.disabled = false;
      btnEl.textContent = "Failed";
      btnEl.style.background = "#451a1e";
      btnEl.style.color = "#ff8ea8";
    }
  } catch (err) {
    btnEl.disabled = false;
    btnEl.textContent = "Error";
  }
}

async function initGitHubState() {
  const userRes = await send("GET_GITHUB_USER");
  if (userRes.ok && userRes.connected) {
    document.getElementById("disconnectedState").style.display = "none";
    document.getElementById("connectedState").style.display = "block";
    document.getElementById("githubStatus").textContent = "Connected";
    
    document.getElementById("githubAccount").textContent = userRes.username;
    const avatar = document.getElementById("githubAvatar");
    if (userRes.avatarUrl) {
      avatar.src = userRes.avatarUrl;
      avatar.style.display = "block";
    }

    const { settings } = await send("GET_SETTINGS");
    await loadRepositories(settings);
  } else {
    document.getElementById("disconnectedState").style.display = "block";
    document.getElementById("connectedState").style.display = "none";
    document.getElementById("githubStatus").textContent = "Not connected";
  }
}

async function loadRepositories(settings) {
  repoSelect.innerHTML = '<option value="">Loading repositories...</option>';
  repoSelect.disabled = true;
  
  const response = await send("GET_GITHUB_REPOSITORIES");
  repoSelect.innerHTML = '<option value="">Select a repository...</option>';
  
  if (response.ok && response.repositories) {
    const repos = response.repositories;
    for (const repo of repos) {
      const option = document.createElement("option");
      option.value = repo.full_name;
      option.textContent = repo.full_name + (repo.private ? ' 🔒' : '');
      repoSelect.appendChild(option);
    }
    
    const selectedRepo = settings.githubOwner && settings.githubRepo 
      ? `${settings.githubOwner}/${settings.githubRepo}` 
      : "";
      
    if (selectedRepo && Array.from(repoSelect.options).some(o => o.value === selectedRepo)) {
      repoSelect.value = selectedRepo;
      await loadBranches(settings.githubOwner, settings.githubRepo, settings.githubBranch);
    }
  } else {
    repoSelect.innerHTML = '<option value="">Failed to load repositories</option>';
  }
  
  repoSelect.disabled = false;
}

async function loadBranches(owner, repo, selectedBranch = "") {
  branchSelectionDiv.style.display = "block";
  branchSelect.innerHTML = '<option value="">Loading branches...</option>';
  branchSelect.disabled = true;
  
  const response = await send("GET_GITHUB_BRANCHES", { owner, repo });
  branchSelect.innerHTML = '<option value="">Select a branch...</option>';
  
  if (response.ok && response.branches) {
    for (const b of response.branches) {
      const option = document.createElement("option");
      option.value = b.name;
      option.textContent = b.name;
      branchSelect.appendChild(option);
    }
    
    if (selectedBranch && Array.from(branchSelect.options).some(o => o.value === selectedBranch)) {
      branchSelect.value = selectedBranch;
    } else if (response.branches.length > 0) {
      // Default to the first branch if not specified
      branchSelect.value = response.branches[0].name;
      await send("SELECT_BRANCH", { branch: response.branches[0].name });
    }
  } else {
    branchSelect.innerHTML = '<option value="">Failed to load branches</option>';
  }
  
  branchSelect.disabled = false;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
