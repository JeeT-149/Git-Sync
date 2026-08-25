import {
  startGitHubLogin
} from "../auth/github-auth.js";
import {
  githubFetch,
  getRepositories,
  getBranches,
  testAccess
} from "../github/github-api.js";
import {
  clearAuthentication,
  hasValidAuthentication
} from "../auth/token-manager.js";
import { syncSubmission as engineSyncSubmission, retrySync } from "../sync/sync-engine.js";
import { getDashboard } from "../dashboard/dashboard.js";

import { resolveProblemImages } from "../docs/image-assets.js";

const DEFAULTS = {
  settings: {
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
    leetcodeEnabled: true
  },
  records: [],
  lastSync: null
};

// in service-worker.js
if (chrome.alarms) {
  chrome.alarms.create("gitsync-auth-heartbeat", { periodInMinutes: 120 });
} else {
  console.warn("[GitSync] chrome.alarms unavailable — check manifest permissions.");
}

chrome.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "gitsync-auth-heartbeat") return;

  try {
    await getValidAccessToken();
  } catch (err) {
    console.warn("[GitSync] Heartbeat auth check failed:", err.message);
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    const current =
      await chrome.storage.local.get(
        DEFAULTS
      );

    await chrome.storage.local.set({
      settings: {
        ...DEFAULTS.settings,
        ...(current.settings || {})
      },

      records: Array.isArray(
        current.records
      )
        ? current.records
        : [],

      lastSync:
        current.lastSync || null
    });
  } catch (error) {
    console.error(
      "[GitSync] Installation initialization failed:",
      error
    );
  }
});

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error(
          "[GitSync] Message handler error:",
          error
        );

        sendResponse({
          ok: false,
          error:
            error?.message ||
            String(error)
        });
      });

    return true;
  }
);

chrome.notifications?.onClicked.addListener((notificationId) => {
  chrome.action.openPopup?.().catch(() => {});
  chrome.notifications.clear(notificationId);
});

async function handleMessage(
  message,
  sender
) {
  switch (message?.type) {
    case "GET_SETTINGS":
      return {
        ok: true,
        settings: await getSettings()
      };

    case "SAVE_SETTINGS":
      await chrome.storage.local.set({
        settings:
          normalizeSettings(
            message.settings
          )
      });

      return {
        ok: true
      };

    case "GET_GITHUB_USER":
      return getGithubUser();

    case "GET_GITHUB_REPOSITORIES":
      return { ok: true, repositories: await getRepositories() };

    case "GET_GITHUB_BRANCHES":
      return { ok: true, branches: await getBranches(message.owner, message.repo) };

    case "SELECT_REPOSITORY":
      await chrome.storage.local.set({
        settings: {
          ...await getSettings(),
          githubOwner: message.owner,
          githubRepo: message.repo,
          githubBranch: message.branch || ""
        }
      });
      return { ok: true };

    case "SELECT_BRANCH":
      await chrome.storage.local.set({
        settings: {
          ...await getSettings(),
          githubBranch: message.branch
        }
      });
      return { ok: true };

    case "TEST_REPOSITORY_ACCESS":
      return { ok: true, access: await testAccess(message.owner, message.repo, message.branch) };

    case "CONNECT_GITHUB":
      return connectGitHub();

    case "DISCONNECT_GITHUB":
      return disconnectGitHub();

    case "SYNC_SUBMISSION":
      return syncSubmission(
        message.submission
      );

    case "RETRY_SYNC":
      return retrySync(message.problemSlug);

    case "GET_DASHBOARD":
      return getDashboard();

    case "CLEAR_HISTORY":
      await chrome.storage.local.set({
        records: [],
        lastSync: null
      });

      return {
        ok: true
      };

    case "RESOLVE_PROBLEM_IMAGES":
      try {
        const result = await resolveProblemImages(
          message.markdown,
          message.imageUrls,
          message.assetsFolderPath
        );
        return { ok: true, result };
      } catch (err) {
        return { ok: false, error: err.message };
      }

    default:
      return {
        ok: false,
        error: "Unknown message type."
      };
  }
}

async function getGithubUser() {
  try {
    const valid = await hasValidAuthentication();
    if (!valid) return { ok: true, connected: false };

    const local = await chrome.storage.local.get(["githubUsername", "githubAvatarUrl"]);
    if (local.githubUsername) {
      return { ok: true, connected: true, username: local.githubUsername, avatarUrl: local.githubAvatarUrl };
    }

    const userResponse = await githubFetch("/user");
    if (!userResponse.ok) return { ok: true, connected: false };
    const user = await userResponse.json();
    
    await chrome.storage.local.set({
      githubUsername: user.login,
      githubAvatarUrl: user.avatar_url
    });

    return { ok: true, connected: true, username: user.login, avatarUrl: user.avatar_url };
  } catch (error) {
    return { ok: true, connected: false };
  }
}

async function connectGitHub() {
  try {
    const auth =
      await startGitHubLogin();

    const now = Date.now();

    await chrome.storage.session.set({
      githubAccessToken:
        auth.accessToken,

      githubTokenExpiresAt:
        auth.expiresIn
          ? now +
            auth.expiresIn * 1000
          : null
    });

    if (auth.refreshToken) {
      await chrome.storage.local.set({
        githubRefreshToken:
          auth.refreshToken,

        githubRefreshTokenExpiresAt:
          auth.refreshTokenExpiresIn
            ? now +
              auth.refreshTokenExpiresIn *
                1000
            : null,

        githubConnectedAt:
          new Date().toISOString()
      });
    }

    const userResponse =
      await fetch(
        "https://api.github.com/user",
        {
          headers: {
            Accept:
              "application/vnd.github+json",

            Authorization:
              `Bearer ${auth.accessToken}`,

            "X-GitHub-Api-Version":
              "2026-03-10"
          }
        }
      );

    if (!userResponse.ok) {
      await clearAuthentication();

      throw new Error(
        `GitHub user verification failed. HTTP ${userResponse.status}`
      );
    }

    const user =
      await userResponse.json();

    await chrome.storage.local.set({
      githubUsername:
        user.login,

      githubAvatarUrl:
        user.avatar_url
    });

    return {
      ok: true,
      username:
        user.login,
      avatarUrl:
        user.avatar_url
    };
  } catch (error) {
    console.error(
      "[GitSync] GitHub connection failed:",
      error
    );

    return {
      ok: false,
      error:
        error?.message ||
        "GitHub connection failed."
    };
  }
}

async function disconnectGitHub() {
  await clearAuthentication();

  return {
    ok: true
  };
}


async function getSettings() {
  const data =
    await chrome.storage.local.get(
      DEFAULTS
    );

  return {
    ...DEFAULTS.settings,
    ...(data.settings || {})
  };
}

function normalizeSettings(
  settings = {}
) {
  return {
    ...DEFAULTS.settings,
    ...settings,

    githubOwner:
      String(
        settings.githubOwner || ""
      ).trim(),

    githubRepo:
      String(
        settings.githubRepo || ""
      )
        .trim()
        .replace(/\.git$/i, ""),

    githubBranch:
      String(
        settings.githubBranch || "main"
      ).trim() || "main",

    rootFolder:
      sanitizePathPart(
        String(
          settings.rootFolder || ""
        ).trim()
      ),

    commitPrefix:
      String(
        settings.commitPrefix ||
          "GitSync"
      ).trim()
  };
}



async function syncSubmission(
  submission
) {
  const settings =
    await getSettings();

  if (!settings.autoSync) {
    return {
      ok: true,
      skipped: true,
      message:
        "Automatic sync is disabled."
    };
  }

  validateGithubSettings(
    settings
  );

  if (
    !submission ||
    !submission.platform ||
    !submission.problemSlug ||
    !submission.code
  ) {
    throw new Error(
      "Submission payload is incomplete."
    );
  }

  if (
    settings.acceptedOnly &&
    submission.status !==
      "ACCEPTED"
  ) {
    return {
      ok: true,
      skipped: true,
      message:
        `Ignored ${
          submission.status ||
          "non-accepted"
        } submission.`
    };
  }

  if (
    submission.platform ===
      "leetcode" &&
    !settings.leetcodeEnabled
  ) {
    return {
      ok: true,
      skipped: true,
      message:
        "LeetCode sync is disabled."
    };
  }


  const recordsData =
    await chrome.storage.local.get({
      records: []
    });

  const records =
    Array.isArray(
      recordsData.records
    )
      ? recordsData.records
      : [];

  const existing =
    records.find(
      (record) =>
        record.platform ===
          submission.platform &&
        record.problemSlug ===
          submission.problemSlug &&
        record.language ===
          submission.language &&
        record.codeHash ===
          submission.codeHash
    );

  if (existing) {
    return {
      ok: true,
      skipped: true,
      duplicate: true,
      message:
        "This exact accepted submission was already synced."
    };
  }

  const solutionPath =
    buildSolutionPath(
      submission,
      settings
    );

  const readmePath =
    solutionPath.replace(
      /\/[^/]+$/,
      "/README.md"
    );

  const readme =
    submission.readmeContent || buildReadme(
      submission,
      solutionPath
    );

  const engineResult = await engineSyncSubmission({
    ...submission,
    owner: settings.githubOwner,
    repo: settings.githubRepo,
    branch: settings.githubBranch,
    solutionPath,
    solutionContent: submission.code,
    readmePath,
    readmeContent: readme,
    imageFiles: submission.imageFiles || [],
    commitMessage: `${settings.commitPrefix}: ${submission.platform} - ${submission.problemTitle}`
  });

  if (engineResult.status === "SKIPPED_DUPLICATE") {
    return {
      ok: true,
      skipped: true,
      duplicate: true,
      message: "This exact accepted submission was already synced."
    };
  }

  if (engineResult.status === "FAILED") {
    return {
      ok: false,
      error: engineResult.error || "Unknown sync error"
    };
  }

  const newCommitUrl = `https://github.com/${settings.githubOwner}/${settings.githubRepo}/commit/${engineResult.commitSha}`;

  return {
    ok: true,
    skipped: false,

    createdOrUpdated:
      "created",

    path:
      solutionPath,

    commitUrl:
      newCommitUrl
  };
}

function validateGithubSettings(
  settings
) {
  if (!settings.githubOwner) {
    throw new Error(
      "GitHub owner is missing."
    );
  }

  if (!settings.githubRepo) {
    throw new Error(
      "GitHub repository is missing."
    );
  }

  if (!settings.githubBranch) {
    throw new Error(
      "GitHub branch is missing."
    );
  }
}

async function githubError(
  response,
  prefix
) {
  let detail = "";

  try {
    const body =
      await response.json();

    detail =
      body?.message
        ? ` ${body.message}`
        : "";
  } catch {
    // Ignore invalid JSON error bodies.
  }

  return `${prefix} HTTP ${response.status}.${detail}`;
}



function buildSolutionPath(
  submission,
  settings
) {
  const root =
    settings.rootFolder
      ? `${settings.rootFolder}/`
      : "";

  const platform =
    submission.platform === "gfg"
      ? "GeeksForGeeks"
      : "LeetCode";

  const difficulty =
    sanitizePathPart(
      submission.difficulty ||
        "Unknown"
    );

  const title =
    sanitizePathPart(
      submission.problemSlug ||
        submission.problemTitle ||
        "Problem"
    );

  const folder = [
    root,
    platform,
    difficulty,
    title
  ]
    .filter(Boolean)
    .join("/");

  return (
    `${folder}/solution` +
    extensionFor(
      submission.language
    )
  );
}

function extensionFor(
  language = ""
) {
  const l =
    language
      .toLowerCase()
      .replace(
        /[^a-z+#]/g,
        ""
      );

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

  return (
    map[l] ||
    ".txt"
  );
}

function sanitizePathPart(s) {
  return String(s)
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /\.+$/g,
      ""
    )
    .slice(0, 120);
}

function buildReadme(
  submission,
  solutionPath
) {
  const lines = [
    `# ${submission.problemTitle}`,
    "",

    `**Platform:** ${
      submission.platform === "gfg"
        ? "GeeksforGeeks"
        : "LeetCode"
    }`,

    `**Difficulty:** ${
      submission.difficulty ||
      "Unknown"
    }`,

    `**Language:** ${
      submission.language ||
      "Unknown"
    }`,

    `**Status:** ${
      submission.status ||
      "ACCEPTED"
    }`,

    `**Problem:** [Open problem](${submission.url})`
  ];

  if (
    submission.topics?.length
  ) {
    lines.push(
      `**Topics:** ${submission.topics.join(", ")}`
    );
  }

  if (
    submission.patterns?.length
  ) {
    lines.push(
      `**Patterns:** ${submission.patterns.join(", ")}`
    );
  }

  if (submission.runtime) {
    lines.push(
      `**Runtime:** ${submission.runtime}`
    );
  }

  if (submission.memory) {
    lines.push(
      `**Memory:** ${submission.memory}`
    );
  }

  if (
    submission.problemStatement
  ) {
    lines.push(
      "",
      "## Problem",
      "",
      submission.problemStatement.slice(
        0,
        12000
      )
    );
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

  return (
    lines.join("\n") +
    "\n"
  );
}
