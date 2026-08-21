const DEFAULTS = {
  settings: {
    githubToken: "",
    githubOwner: "",
    githubRepo: "",
    githubBranch: "main",
    autoSync: true,
    acceptedOnly: true,
    includeProblemStatement: true,
    includeRuntime: true,
    includeMemory: true,
    rootFolder: "",
    commitPrefix: "GitSync",
    leetcodeEnabled: true,
    gfgEnabled: true
  },
  records: [],
  lastSync: null
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set({
    settings: { ...DEFAULTS.settings, ...(current.settings || {}) },
    records: Array.isArray(current.records) ? current.records : [],
    lastSync: current.lastSync || null
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((error) => {
      console.error("[GitSync]", error);
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_SETTINGS":
      return { ok: true, settings: await getSettings() };

    case "SAVE_SETTINGS":
      await chrome.storage.local.set({ settings: normalizeSettings(message.settings) });
      return { ok: true };

    case "TEST_GITHUB":
      return testGithub(message.settings || await getSettings());

    case "SYNC_SUBMISSION":
      return syncSubmission(message.submission);

    case "GET_DASHBOARD":
      return getDashboard();

    case "CLEAR_HISTORY":
      await chrome.storage.local.set({ records: [], lastSync: null });
      return { ok: true };

    default:
      return { ok: false, error: "Unknown message type." };
  }
}

async function getSettings() {
  const data = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS.settings, ...(data.settings || {}) };
}

function normalizeSettings(s = {}) {
  return {
    ...DEFAULTS.settings,
    ...s,
    githubOwner: String(s.githubOwner || "").trim(),
    githubRepo: String(s.githubRepo || "").trim().replace(/\.git$/i, ""),
    githubBranch: String(s.githubBranch || "main").trim() || "main",
    rootFolder: sanitizePathPart(String(s.rootFolder || "").trim()),
    commitPrefix: String(s.commitPrefix || "GitSync").trim()
  };
}

async function testGithub(settings) {
  const s = normalizeSettings(settings);
  validateGithubSettings(s);
  const res = await githubFetch(`https://api.github.com/repos/${encodeURIComponent(s.githubOwner)}/${encodeURIComponent(s.githubRepo)}`, s.githubToken);
  if (!res.ok) {
    throw new Error(await githubError(res, "GitHub repository check failed."));
  }
  const repo = await res.json();
  return {
    ok: true,
    repository: `${repo.full_name}`,
    defaultBranch: repo.default_branch || s.githubBranch,
    private: !!repo.private,
    message: "GitHub connection is working."
  };
}

async function syncSubmission(submission) {
  const settings = await getSettings();
  if (!settings.autoSync) {
    return { ok: true, skipped: true, message: "Automatic sync is disabled." };
  }

  validateGithubSettings(settings);

  if (!submission || !submission.platform || !submission.problemSlug || !submission.code) {
    throw new Error("Submission payload is incomplete.");
  }

  if (settings.acceptedOnly && submission.status !== "ACCEPTED") {
    return { ok: true, skipped: true, message: `Ignored ${submission.status || "non-accepted"} submission.` };
  }

  if (submission.platform === "leetcode" && !settings.leetcodeEnabled) {
    return { ok: true, skipped: true, message: "LeetCode sync is disabled." };
  }
  if (submission.platform === "gfg" && !settings.gfgEnabled) {
    return { ok: true, skipped: true, message: "GeeksforGeeks sync is disabled." };
  }

  const recordsData = await chrome.storage.local.get({ records: [] });
  const records = Array.isArray(recordsData.records) ? recordsData.records : [];

  const existing = records.find(
    r => r.platform === submission.platform &&
         r.problemSlug === submission.problemSlug &&
         r.language === submission.language &&
         r.codeHash === submission.codeHash
  );

  if (existing) {
    return { ok: true, skipped: true, duplicate: true, message: "This exact accepted submission was already synced." };
  }

  const solutionPath = buildSolutionPath(submission, settings);
  const readmePath = solutionPath.replace(/\/[^/]+$/, "/README.md");

  const solutionResult = await upsertGithubFile(
    settings,
    solutionPath,
    submission.code,
    `${settings.commitPrefix}: ${submission.platform} - ${submission.problemTitle}`
  );

  const readme = buildReadme(submission, solutionPath);
  const readmeResult = await upsertGithubFile(
    settings,
    readmePath,
    readme,
    `${settings.commitPrefix}: update README - ${submission.problemTitle}`
  );

  const now = new Date().toISOString();

  const record = {
    id: crypto.randomUUID(),
    platform: submission.platform,
    problemSlug: submission.problemSlug,
    problemTitle: submission.problemTitle,
    difficulty: submission.difficulty || "Unknown",
    language: submission.language || "Unknown",
    codeHash: submission.codeHash,
    path: solutionPath,
    url: submission.url,
    status: submission.status,
    topics: submission.topics || [],
    patterns: submission.patterns || [],
    runtime: submission.runtime || "",
    memory: submission.memory || "",
    submittedAt: submission.submittedAt || now,
    syncedAt: now,
    commitUrl: solutionResult.commitUrl || readmeResult.commitUrl || ""
  };

  records.unshift(record);
  const bounded = records.slice(0, 1000);

  await chrome.storage.local.set({
    records: bounded,
    lastSync: {
      ok: true,
      at: now,
      title: submission.problemTitle,
      path: solutionPath,
      commitUrl: record.commitUrl
    }
  });

  return {
    ok: true,
    skipped: false,
    createdOrUpdated: solutionResult.createdOrUpdated,
    path: solutionPath,
    commitUrl: record.commitUrl
  };
}

function validateGithubSettings(settings) {
  if (!settings.githubToken) throw new Error("GitHub token is missing. Open Settings.");
  if (!settings.githubOwner) throw new Error("GitHub owner is missing.");
  if (!settings.githubRepo) throw new Error("GitHub repository is missing.");
  if (!settings.githubBranch) throw new Error("GitHub branch is missing.");
}

async function githubFetch(url, token, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      ...(options.headers || {})
    }
  });
}

async function githubError(res, prefix) {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.message ? ` ${body.message}` : "";
  } catch {}
  return `${prefix} HTTP ${res.status}.${detail}`;
}

async function upsertGithubFile(settings, path, content, message) {
  const owner = encodeURIComponent(settings.githubOwner);
  const repo = encodeURIComponent(settings.githubRepo);
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}`;

  let existingSha = null;
  const getRes = await githubFetch(`${url}?ref=${encodeURIComponent(settings.githubBranch)}`, settings.githubToken);

  if (getRes.ok) {
    const data = await getRes.json();
    existingSha = data.sha || null;
  } else if (getRes.status !== 404 && getRes.status !== 409) {
    throw new Error(await githubError(getRes, `Could not inspect ${path}.`));
  }

  const bytes = new TextEncoder().encode(content);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join("");
  const base64 = btoa(binary);

  const payload = {
    message,
    content: base64,
    branch: settings.githubBranch
  };

  if (existingSha) payload.sha = existingSha;

  const putRes = await githubFetch(url, settings.githubToken, {
    method: "PUT",
    body: JSON.stringify(payload)
  });

  if (!putRes.ok) {
    throw new Error(await githubError(
      putRes,
      `GitHub could not ${existingSha ? "update" : "create"} ${path}.`
    ));
  }

  const result = await putRes.json();
  return {
    createdOrUpdated: existingSha ? "updated" : "created",
    commitUrl: result?.commit?.html_url || ""
  };
}

function buildSolutionPath(submission, settings) {
  const root = settings.rootFolder ? `${settings.rootFolder}/` : "";
  const platform = submission.platform === "gfg" ? "GeeksForGeeks" : "LeetCode";
  const difficulty = sanitizePathPart(submission.difficulty || "Unknown");
  const title = sanitizePathPart(submission.problemTitle || submission.problemSlug || "Problem");
  const folder = [root, platform, difficulty, title].filter(Boolean).join("/");
  return `${folder}/solution${extensionFor(submission.language)}`;
}

function extensionFor(language = "") {
  const l = language.toLowerCase().replace(/[^a-z+]/g, "");
  const map = {
    java: ".java",
    python: ".py",
    python3: ".py",
    c: ".c",
    cpp: ".cpp",
    "c++": ".cpp",
    csharp: ".cs",
    "c#": ".cs",
    javascript: ".js",
    typescript: ".ts",
    go: ".go",
    kotlin: ".kt",
    rust: ".rs",
    swift: ".swift",
    php: ".php",
    ruby: ".rb",
    sql: ".sql",
    scala: ".scala"
  };
  return map[l] || ".txt";
}

function sanitizePathPart(s) {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "")
    .slice(0, 120);
}

function buildReadme(s, solutionPath) {
  const lines = [
    `# ${s.problemTitle}`,
    "",
    `**Platform:** ${s.platform === "gfg" ? "GeeksforGeeks" : "LeetCode"}`,
    `**Difficulty:** ${s.difficulty || "Unknown"}`,
    `**Language:** ${s.language || "Unknown"}`,
    `**Status:** ${s.status || "ACCEPTED"}`,
    `**Problem:** [Open problem](${s.url})`
  ];

  if (s.topics?.length) lines.push(`**Topics:** ${s.topics.join(", ")}`);
  if (s.patterns?.length) lines.push(`**Patterns:** ${s.patterns.join(", ")}`);
  if (s.runtime) lines.push(`**Runtime:** ${s.runtime}`);
  if (s.memory) lines.push(`**Memory:** ${s.memory}`);

  if (s.problemStatement) {
    lines.push("", "## Problem", "", s.problemStatement.slice(0, 12000));
  }

  lines.push(
    "",
    "## Solution",
    "",
    `Source file: [${solutionPath.split("/").pop()}](./${solutionPath.split("/").pop()})`,
    "",
    "## Complexity",
    "",
    "Add your final time and space complexity here if desired.",
    "",
    `Synced by GitSync on ${new Date().toLocaleString()}`
  );

  return lines.join("\n") + "\n";
}

async function getDashboard() {
  const data = await chrome.storage.local.get({ records: [], lastSync: null });
  const records = Array.isArray(data.records) ? data.records : [];

  const counts = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
  const languages = {};
  const platforms = { leetcode: 0, gfg: 0 };

  const latestByProblem = new Map();
  for (const r of records) {
    const key = `${r.platform}:${r.problemSlug}`;
    if (!latestByProblem.has(key)) latestByProblem.set(key, r);
  }

  for (const r of latestByProblem.values()) {
    counts[r.difficulty] = (counts[r.difficulty] || 0) + 1;
    languages[r.language] = (languages[r.language] || 0) + 1;
    if (r.platform === "leetcode") platforms.leetcode++;
    if (r.platform === "gfg") platforms.gfg++;
  }

  const dates = [...new Set(records.map(r => new Date(r.syncedAt || r.submittedAt).toISOString().slice(0, 10)))].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const date of dates) {
    const ds = cursor.toISOString().slice(0, 10);
    if (date === ds) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (date < ds) {
      break;
    }
  }

  const solvedKeys = new Set([...latestByProblem.keys()]);
  const blindData = await loadBlindLists(solvedKeys);

  return {
    ok: true,
    total: solvedKeys.size,
    counts,
    languages,
    platforms,
    streak,
    recent: records.slice(0, 12),
    lastSync: data.lastSync,
    blind75: blindData.blind75,
    blind150: blindData.blind150
  };
}

async function loadBlindLists(solvedKeys) {
  const url = chrome.runtime.getURL("src/data/blind-lists.json");
  const res = await fetch(url);
  const data = await res.json();

  const normalize = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  function progress(list) {
    const solvedTitles = new Set(
      [...solvedKeys].map(k => normalize(k.split(":").slice(1).join(":")))
    );
    const completed = list.filter(item => solvedTitles.has(normalize(item)));
    return {
      total: list.length,
      completed: completed.length,
      remaining: list.length - completed.length
    };
  }

  return {
    blind75: progress(data.blind75 || []),
    blind150: progress(data.blind150 || [])
  };
}
