(() => {
  const LOG = (...args) => console.debug("[GitSync]", ...args);
  const platform = location.hostname.includes("geeksforgeeks") ? "gfg" : "leetcode";

  if (platform === "leetcode" && !location.pathname.includes("/problems/")) return;

  const state = {
    lastResult: "",
    lastFingerprint: "",
    observer: null,
    pollTimer: null
  };
  
  let currentPath = location.pathname;

  injectUi();
  attachSubmitListener();

  let isSyncInProgress = false;

  function attachSubmitListener() {
    window.addEventListener("message", async (e) => {
      if (platform !== "leetcode") return;
      if (e.source !== window || e.data?.source !== "gitsync" || e.data?.type !== "GITSYNC_SUBMIT_DETECTED") return;

      LOG("Submit detected via network interception");

      if (isSyncInProgress) {
        LOG("Sync already in progress for this submit click. Ignoring.");
        return;
      }

      isSyncInProgress = true;
      try {
        await handleSubmissionEvent();
      } finally {
        setTimeout(() => {
          isSyncInProgress = false;
        }, 3000);
      }
    });
  }

  async function handleSubmissionEvent() {
    const data = await collectSubmission();
    if (!data?.code) {
      showToast("Submit detected, but code extraction failed. Open extension settings for diagnostics.", true);
      return;
    }

    const fingerprint = `${data.platform}:${data.problemSlug}:${data.codeHash}`;
    if (fingerprint === state.lastFingerprint) {
      LOG("Duplicate submit detected. Skipping.");
      return;
    }
    state.lastFingerprint = fingerprint;

    LOG("Code captured");
    
    if (data.platform === "leetcode") {
      LOG("Generating Markdown and downloading images");
      try {
        const { settings } = await chrome.storage.local.get("settings");
        const s = settings || {};
        const { prepareSubmissionDocs, getTrueMetadata } = await import(chrome.runtime.getURL("src/sync/prepare-submission.js"));
        
        const meta = await getTrueMetadata(data.problemSlug);
        if (meta && meta.difficulty) {
          data.difficulty = meta.difficulty;
        }

        const root = s.rootFolder ? `${s.rootFolder}/` : "";
        const diff = sanitizePathPart(data.difficulty || "Unknown");
        const folderName = sanitizePathPart(data.problemSlug || "Problem");
        const problemFolderPath = [root, "LeetCode", diff, folderName].filter(Boolean).join("/");
        const solutionFileName = `solution${extensionFor(data.language)}`;

        data.titleSlug = data.problemSlug;
        data.problemFolderPath = problemFolderPath;
        data.solutionFileName = solutionFileName;
        
        const { readmeContent, imageFiles, canonicalTitle } = await prepareSubmissionDocs(data, meta);
        
        if (canonicalTitle) {
          data.problemTitle = canonicalTitle;
        }
        data.readmeContent = readmeContent;
        data.imageFiles = imageFiles;
      } catch (err) {
        LOG("Failed to generate markdown:", err.message);
      }
    }

    LOG("Starting GitHub sync");

    const response = await chrome.runtime.sendMessage({ type: "SYNC_SUBMISSION", submission: data });

    if (response?.ok && !response.skipped) {
      LOG("File create/update result:", response.createdOrUpdated);
      LOG("Repository:", response.path);
      LOG("Solution path:", response.path);
      showToast(`✓ Synced: ${data.problemTitle}`, false);
    } else if (response?.ok && response.skipped) {
      if (!response.duplicate) showToast(response.message || "Skipped", false);
    } else {
      LOG("Sync failed:", response?.error);
      showToast(`✕ Sync failed: ${response?.error || "Unknown error"}`, true);
    }
  }

  async function collectSubmission() {
    const meta = platform === "leetcode"
      ? collectLeetCode()
      : collectGfg();

    const editor = await requestEditorCode();
    const code = editor?.code || fallbackCode();
    if (!code?.trim()) return null;

    const language = normalizeLanguage(editor?.language || meta.language || detectLanguageFromPage());
    const codeHash = await sha256(code);

    return {
      ...meta,
      platform,
      code,
      codeHash,
      language,
      status: "ACCEPTED",
      submittedAt: new Date().toISOString()
    };
  }

  function collectLeetCode() {
    const slugMatch = location.pathname.match(/\/problems\/([^/]+)/);
    const problemSlug = slugMatch?.[1] || document.title.toLowerCase().replace(/\s*-\s*leetcode.*$/i, "").replace(/\W+/g, "-");

    const title =
      textOf("h1") ||
      textOf('[data-cy="question-title"]') ||
      document.title.replace(/\s*-\s*leetcode.*$/i, "").trim();

    const difficulty =
      textOf('[class*="text-difficulty"]') ||
      findNearbyDifficulty() ||
      "Unknown";

    const runtime = findMetric("Runtime");
    const memory = findMetric("Memory");

    const problemStatement = extractProblemStatement();

    return {
      problemTitle: title || prettySlug(problemSlug),
      problemSlug,
      difficulty: normalizeDifficulty(difficulty),
      runtime,
      memory,
      url: location.href,
      problemStatement,
      ...classify(title + " " + problemStatement)
    };
  }

  function collectGfg() {
    const slugMatch = location.pathname.match(/\/(?:problems|practice|problem)\/([^/?#]+)/i);
    const problemSlug = slugMatch?.[1] || location.pathname.split("/").filter(Boolean).pop() || "problem";

    const title =
      textOf("h1") ||
      textOf('[class*="problem-title"]') ||
      document.title.replace(/\s*\|\s*GeeksforGeeks.*$/i, "").trim();

    const body = document.body?.innerText || "";
    const difficultyMatch = body.match(/\b(Easy|Medium|Hard)\b/i);

    return {
      problemTitle: title || prettySlug(problemSlug),
      problemSlug,
      difficulty: normalizeDifficulty(difficultyMatch?.[1] || "Unknown"),
      runtime: findMetric("Time Complexity") || "",
      memory: findMetric("Space Complexity") || "",
      url: location.href,
      problemStatement: extractGfgProblemStatement(),
      ...classify(title + " " + body.slice(0, 15000))
    };
  }

  function extractProblemStatement() {
    const selectors = [
      '[data-track-load="description_content"]',
      '[class*="elfjS"]',
      '[class*="question-content"]',
      '[class*="problem-statement"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.innerText?.trim()) return el.innerText.trim();
    }
    return "";
  }

  function extractGfgProblemStatement() {
    const selectors = [
      '[class*="problem-statement"]',
      '[class*="problem_description"]',
      '[class*="problems_problem_content"]',
      'div[class*="problem"]'
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el?.innerText?.trim() && el.innerText.length > 100) {
        return el.innerText.trim().slice(0, 12000);
      }
    }
    return "";
  }

  function findMetric(label) {
    const elements = [...document.querySelectorAll("body *")];
    const target = elements.find(el => {
      const t = el.textContent?.trim() || "";
      return t === label || t.startsWith(label);
    });
    return target?.parentElement?.innerText?.replace(/\s+/g, " ").trim() || "";
  }

  function findNearbyDifficulty() {
    const all = document.querySelectorAll("span, div, a, button");
    for (const el of all) {
      const t = (el.textContent || "").trim();
      if (/^(Easy|Medium|Hard)$/i.test(t)) return t;
    }
    return "";
  }

  function detectLanguageFromPage() {
    const body = document.body?.innerText || "";
    const candidates = [
      "C++", "C#", "Java", "Python3", "Python", "JavaScript", "TypeScript",
      "Go", "Kotlin", "Rust", "Swift", "PHP", "Ruby", "SQL"
    ];
    return candidates.find(x => new RegExp(`\\b${escapeRegex(x)}\\b`, "i").test(body)) || "";
  }

  function fallbackCode() {
    const candidates = [
      ...document.querySelectorAll("textarea"),
      ...document.querySelectorAll('[contenteditable="true"]')
    ];
    const best = candidates
      .map(el => el.value ?? el.innerText ?? "")
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0];
    return best || "";
  }

  function requestEditorCode() {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        window.removeEventListener("message", onMessage);
        resolve(null);
      }, 1200);

      function onMessage(event) {
        if (event.source !== window) return;
        const d = event.data;
        if (!d || d.source !== "gitsync" || d.type !== "GITSYNC_EDITOR_CODE") return;
        if (d.requestId !== requestId) return;
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(d.result || null);
      }

      window.addEventListener("message", onMessage);
      window.postMessage({
        source: "gitsync",
        type: "GITSYNC_GET_EDITOR_CODE",
        requestId
      }, "*");
    });
  }

  function classify(text = "") {
    const t = text.toLowerCase();
    const topicRules = [
      ["Array", /\barray|subarray|subsequence\b/],
      ["String", /\bstring|substring|palindrome\b/],
      ["Hash Table", /\bhash|frequency|map|set\b/],
      ["Two Pointers", /\btwo pointers?\b|sorted.*pair/],
      ["Sliding Window", /\bsliding window\b|window.*substring/],
      ["Stack", /\bstack|parentheses|monotonic\b/],
      ["Queue", /\bqueue|deque|bfs\b/],
      ["Linked List", /\blinked list|node.*next\b/],
      ["Tree", /\btree|binary tree|bst\b/],
      ["Graph", /\bgraph|vertex|edge|adjacency\b/],
      ["Heap", /\bheap|priority queue\b/],
      ["Binary Search", /\bbinary search|lower bound|upper bound\b/],
      ["Dynamic Programming", /\bdynamic programming|\bdp\b|memoization|tabulation/],
      ["Greedy", /\bgreedy\b|minimum.*locally|maximum.*locally/],
      ["Backtracking", /\bbacktracking|permutation|combination|subsets\b/],
      ["Trie", /\btrie|prefix tree\b/],
      ["Bit Manipulation", /\bbitwise|bit manipulation|xor\b/],
      ["Math", /\bprime|gcd|lcm|modulo|factorial|matrix\b/]
    ];

    const topics = topicRules.filter(([, rx]) => rx.test(t)).map(([name]) => name);
    const patterns = [];

    if (/sliding window/.test(t)) patterns.push("Sliding Window");
    if (/two pointers?/.test(t)) patterns.push("Two Pointers");
    if (/\bbfs\b|\bbreadth/.test(t)) patterns.push("BFS");
    if (/\bdfs\b|\bdepth first/.test(t)) patterns.push("DFS");
    if (/binary search/.test(t)) patterns.push("Binary Search");
    if (/monotonic/.test(t)) patterns.push("Monotonic Stack");
    if (/prefix sum/.test(t)) patterns.push("Prefix Sum");
    if (/backtracking/.test(t)) patterns.push("Backtracking");
    if (/union find|disjoint set/.test(t)) patterns.push("Union Find");
    if (/topological/.test(t)) patterns.push("Topological Sort");

    return {
      topics: [...new Set(topics)],
      patterns: [...new Set(patterns)]
    };
  }

  function normalizeLanguage(value) {
    const v = String(value || "").toLowerCase().replace(/\s+/g, "");
    if (v.includes("python")) return "Python";
    if (v.includes("java")) return "Java";
    if (v === "cpp" || v.includes("c++")) return "C++";
    if (v.includes("csharp") || v === "c#") return "C#";
    if (v.includes("typescript")) return "TypeScript";
    if (v.includes("javascript")) return "JavaScript";
    if (v === "go" || v.includes("golang")) return "Go";
    if (v.includes("kotlin")) return "Kotlin";
    if (v.includes("rust")) return "Rust";
    if (v.includes("swift")) return "Swift";
    if (v.includes("php")) return "PHP";
    if (v.includes("ruby")) return "Ruby";
    if (v.includes("sql")) return "SQL";
    if (v === "c") return "C";
    return value || "Unknown";
  }

  function normalizeDifficulty(value) {
    const v = String(value || "").toLowerCase();
    if (v.includes("easy")) return "Easy";
    if (v.includes("medium")) return "Medium";
    if (v.includes("hard")) return "Hard";
    return "Unknown";
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function textOf(selector) {
    return document.querySelector(selector)?.textContent?.trim() || "";
  }

  function prettySlug(slug) {
    return slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function injectUi() {
    const style = document.createElement("style");
    style.textContent = `
      #gitsync-toast {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 2147483647;
        max-width: 420px;
        padding: 12px 16px;
        border-radius: 12px;
        background: #111827;
        color: white;
        font: 600 14px/1.4 system-ui, sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,.28);
        opacity: 0;
        transform: translateY(10px);
        transition: .2s ease;
        pointer-events: none;
      }
      #gitsync-toast.show { opacity: 1; transform: translateY(0); }
      #gitsync-toast.error { background: #7f1d1d; }
    `;
    document.documentElement.appendChild(style);
    const toast = document.createElement("div");
    toast.id = "gitsync-toast";
    document.documentElement.appendChild(toast);
  }

  function sanitizePathPart(s) {
    return String(s).replace(/[<>:"/\\|?*\x00-\x1F]/g, "").replace(/\s+/g, " ").trim().replace(/\.+$/g, "").slice(0, 120);
  }

  function extensionFor(language = "") {
    const l = language.toLowerCase().replace(/[^a-z+#]/g, "");
    const map = {
      java: ".java", python: ".py", python3: ".py", c: ".c", cpp: ".cpp", "c++": ".cpp",
      csharp: ".cs", "c#": ".cs", javascript: ".js", typescript: ".ts", go: ".go",
      kotlin: ".kt", rust: ".rs", swift: ".swift", php: ".php", ruby: ".rb", sql: ".sql", scala: ".scala"
    };
    return map[l] || ".txt";
  }

  let toastTimer;
  function showToast(message, error) {
    const toast = document.getElementById("gitsync-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("error", !!error);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 5000);
  }
})();
