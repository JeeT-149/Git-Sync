import {
  getRef,
  getCommit,
  createBlob,
  createTree,
  createCommit,
  updateRef
} from "../github/github-api.js";
import { notifySyncResult } from "../notifications/notify.js";

const DEDUPE_TTL_MS = 8000;
const branchLocks = new Map();

async function hashCode(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isDuplicateSubmission(fingerprint) {
  const key = `dedupe:${fingerprint}`;
  const stored = await chrome.storage.session.get(key);

  if (stored[key] && Date.now() - stored[key] < DEDUPE_TTL_MS) {
    return true;
  }

  await chrome.storage.session.set({ [key]: Date.now() });
  return false;
}

function withBranchLock(lockKey, fn) {
  const previous = branchLocks.get(lockKey) || Promise.resolve();
  const run = previous.then(fn, fn);
  branchLocks.set(lockKey, run.catch(() => {}));
  return run;
}

async function recordSyncHistory(submission, result) {
  const { records = [] } = await chrome.storage.local.get("records");
  const key = submission.problemSlug;
  const filtered = records.filter(r => r.problemSlug !== key);

  const entry = {
    problemSlug: submission.problemSlug,
    problemTitle: submission.problemTitle,
    difficulty: submission.difficulty,
    language: submission.language,
    platform: submission.platform || "LeetCode",
    status: result.status,
    syncedAt: Date.now()
  };

  if (result.status === "SYNCED") {
    entry.commitSha = result.commitSha;
  } else if (result.status === "FAILED") {
    entry.error = result.error;
    entry.retryPayload = {
      owner: submission.owner,
      repo: submission.repo,
      branch: submission.branch,
      solutionPath: submission.solutionPath,
      solutionContent: submission.solutionContent,
      readmePath: submission.readmePath,
      readmeContent: submission.readmeContent,
      imageFiles: submission.imageFiles,
      commitMessage: submission.commitMessage,
      submissionId: submission.submissionId
    };
  }

  filtered.push(entry);

  const storageUpdate = { records: filtered };
  if (result.status === "SYNCED") {
    storageUpdate.lastSync = {
      ok: true,
      at: entry.syncedAt,
      title: entry.problemTitle,
      commitUrl: `https://github.com/${submission.owner}/${submission.repo}/commit/${result.commitSha}`
    };
  } else if (result.status === "FAILED") {
    storageUpdate.lastSync = {
      ok: false,
      at: entry.syncedAt,
      title: entry.problemTitle,
      error: result.error
    };
  }

  await chrome.storage.local.set(storageUpdate);
}

/**
 * submission: {
 *   owner, repo, branch,
 *   problemSlug, language, code, submissionId (optional),
 *   solutionPath, solutionContent,
 *   readmePath, readmeContent,
 *   imageFiles (optional): [{ path, base64Content }, ...],
 *   commitMessage
 * }
 */
export async function syncSubmission(submission) {
  const {
    owner, repo, branch,
    problemSlug, language, code, submissionId,
    solutionPath, solutionContent,
    readmePath, readmeContent,
    imageFiles = [],
    commitMessage
  } = submission;

  const codeHash = await hashCode(code);
  const fingerprint = submissionId
    ? `${owner}/${repo}/${problemSlug}/${language}/${submissionId}`
    : `${owner}/${repo}/${problemSlug}/${language}/${codeHash}`;

  if (await isDuplicateSubmission(fingerprint)) {
    return { status: "SKIPPED_DUPLICATE" };
  }

  const lockKey = `${owner}/${repo}/${branch}`;

  const textFiles = [
    { path: solutionPath, content: solutionContent, encoding: "utf-8" },
    { path: readmePath, content: readmeContent, encoding: "utf-8" }
  ];

  const base64Files = imageFiles.map((img) => ({
    path: img.path,
    content: img.base64Content,
    encoding: "base64"
  }));

  const result = await withBranchLock(lockKey, () =>
    commitFilesAtomic({
      owner,
      repo,
      branch,
      files: [...textFiles, ...base64Files],
      message: commitMessage
    })
  );

  await recordSyncHistory(submission, result);

  notifySyncResult({
    status: result.status,
    problemTitle: submission.problemTitle,
    problemSlug: submission.problemSlug
  });

  return result;
}

async function commitFilesAtomic({ owner, repo, branch, files, message }) {
  const MAX_ATTEMPTS = 2;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const parentSha = await getRef(owner, repo, branch);
      const baseTreeSha = await getCommit(owner, repo, parentSha);

      const treeItems = await Promise.all(
        files.map(async (file) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: await createBlob(owner, repo, file.content, file.encoding)
        }))
      );

      const newTreeSha = await createTree(owner, repo, baseTreeSha, treeItems);
      const newCommitSha = await createCommit(owner, repo, message, newTreeSha, parentSha);
      const refResponse = await updateRef(owner, repo, branch, newCommitSha);

      if (refResponse.ok) {
        return { status: "SYNCED", commitSha: newCommitSha };
      }

      if (
        (refResponse.status === 409 || refResponse.status === 422) &&
        attempt < MAX_ATTEMPTS
      ) {
        continue;
      }

      throw new Error(`Failed to update ref: HTTP ${refResponse.status}`);
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_ATTEMPTS) break;
    }
  }

  return { status: "FAILED", error: lastError?.message || "Unknown sync error" };
}

export async function retrySync(problemSlug) {
  const { records = [] } = await chrome.storage.local.get("records");
  const record = records.find(r => r.problemSlug === problemSlug);

  if (!record || record.status !== "FAILED" || !record.retryPayload) {
    return { ok: false, error: "No retryable failure found for this problem." };
  }

  const result = await syncSubmission({
    ...record.retryPayload,
    problemSlug: record.problemSlug,
    problemTitle: record.problemTitle,
    difficulty: record.difficulty,
    language: record.language,
    platform: record.platform
  });

  return { ok: true, result };
}