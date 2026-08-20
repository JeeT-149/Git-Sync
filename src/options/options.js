const defaults = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  rootFolder: "",
  commitPrefix: "LeetSync Pro",
  autoSync: true,
  acceptedOnly: true,
  includeProblemStatement: true,
  includeRuntime: true,
  includeMemory: true,
  leetcodeEnabled: true,
  gfgEnabled: true
};

const ids = Object.keys(defaults);
load();

document.getElementById("save").onclick = save;
document.getElementById("test").onclick = test;
document.getElementById("clear").onclick = async () => {
  if (!confirm("Clear local settings and history? This does not delete GitHub files.")) return;
  await send("CLEAR_HISTORY");
  await chrome.storage.local.set({ settings: defaults });
  load();
  setStatus("githubStatus", "Local settings reset.", false);
};

async function load() {
  const response = await send("GET_SETTINGS");
  const s = { ...defaults, ...(response.settings || {}) };

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!s[id];
    else el.value = s[id] ?? "";
  }
}

async function save() {
  const s = read();
  const res = await send("SAVE_SETTINGS", { settings: s });
  if (res.ok) setStatus("githubStatus", "Settings saved.", false);
  else setStatus("githubStatus", res.error || "Save failed.", true);
}

async function test() {
  await save();
  setStatus("githubStatus", "Checking GitHub...", false);
  const s = read();
  const res = await send("TEST_GITHUB", { settings: s });
  if (res.ok) {
    setStatus("githubStatus", `✓ ${res.message} Repository: ${res.repository}. Branch: ${res.defaultBranch}`, false);
  } else {
    setStatus("githubStatus", `✕ ${res.error}`, true);
  }
}

function read() {
  const s = {};
  for (const id of ids) {
    const el = document.getElementById(id);
    s[id] = el?.type === "checkbox" ? el.checked : (el?.value ?? "");
  }
  return s;
}

function setStatus(id, text, error) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.color = error ? "#ff8ea8" : "#7ee2aa";
}

function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}
