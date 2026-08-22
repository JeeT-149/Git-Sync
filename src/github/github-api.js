import {
  getValidAccessToken
} from "../auth/token-manager.js";

const API_BASE = "https://api.github.com";

function resolveGithubUrl(path) {
  if (
    typeof path === "string" &&
    path.startsWith(API_BASE)
  ) {
    return path;
  }

  if (
    typeof path === "string" &&
    path.startsWith("/")
  ) {
    return `${API_BASE}${path}`;
  }

  throw new Error(
    `Invalid GitHub API path: ${path}`
  );
}

function buildHeaders(
  options,
  token
) {
  return {
    Accept:
      "application/vnd.github+json",

    Authorization:
      `Bearer ${token}`,

    "X-GitHub-Api-Version":
      "2026-03-10",

    ...(options.headers || {})
  };
}

async function makeRequest(
  path,
  token,
  options = {}
) {
  const url =
    resolveGithubUrl(path);

  return fetch(url, {
    ...options,

    headers:
      buildHeaders(
        options,
        token
      )
  });
}

export async function githubFetch(
  path,
  options = {}
) {
  let token =
    await getValidAccessToken();

  let response =
    await makeRequest(
      path,
      token,
      options
    );

  if (response.status !== 401) {
    return response;
  }

  // Access token may have expired between
  // the token check and the actual request.
  // Refresh exactly once.
  token =
    await getValidAccessToken(true);

  response =
    await makeRequest(
      path,
      token,
      options
    );

  return response;
}

export async function getRepositories() {
  const allRepos = [];

  let page = 1;

  const perPage = 100;

  while (true) {
    const response =
      await githubFetch(
        `/user/repos?page=${page}&per_page=${perPage}&sort=updated`
      );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch repositories: HTTP ${response.status}`
      );
    }

    const repos =
      await response.json();

    allRepos.push(
      ...repos
    );

    if (
      repos.length < perPage
    ) {
      break;
    }

    page++;

    if (page > 10) {
      break;
    }
  }

  return allRepos;
}

export async function getBranches(
  owner,
  repo
) {
  const response =
    await githubFetch(
      `/repos/${encodeURIComponent(
        owner
      )}/${encodeURIComponent(
        repo
      )}/branches?per_page=100`
    );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch branches: HTTP ${response.status}`
    );
  }

  return response.json();
}
// --- Add to github-api.js ---

export async function getRef(owner, repo, branch) {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(branch)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get ref for branch '${branch}': HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.object.sha; // current commit SHA
}

export async function getCommit(owner, repo, commitSha) {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits/${commitSha}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get commit ${commitSha}: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.tree.sha; // base tree SHA
}

// updated createBlob in github-api.js
export async function createBlob(owner, repo, content, encoding = "utf-8") {
  const payload =
    encoding === "base64"
      ? { content, encoding: "base64" }
      : { content: btoa(unescape(encodeURIComponent(content))), encoding: "base64" };

  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) throw new Error(`Failed to create blob: HTTP ${response.status}`);
  const data = await response.json();
  return data.sha;
}

export async function createTree(owner, repo, baseTreeSha, treeItems) {
  // treeItems: [{ path, sha, mode: "100644", type: "blob" }, ...]
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create tree: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

export async function createCommit(owner, repo, message, treeSha, parentSha) {
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/commits`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: [parentSha]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create commit: HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.sha;
}

export async function updateRef(owner, repo, branch, commitSha) {
  // force: false -> GitHub rejects non-fast-forward updates, which is
  // exactly the signal we want to detect a real conflict.
  const response = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitSha, force: false })
    }
  );

  return response; // caller inspects status (200 vs 422/409)
}

export async function testAccess(
  owner,
  repo,
  branch
) {
  const response =
    await githubFetch(
      `/repos/${encodeURIComponent(
        owner
      )}/${encodeURIComponent(
        repo
      )}`
    );

  if (!response.ok) {
    throw new Error(
      `Repository access failed. HTTP ${response.status}`
    );
  }

  const repoData =
    await response.json();

  const permissions =
    repoData.permissions || {};

  if (
    !permissions.push &&
    !permissions.admin
  ) {
    throw new Error(
      "Repository does not have write access."
    );
  }

  const branchResponse =
    await githubFetch(
      `/repos/${encodeURIComponent(
        owner
      )}/${encodeURIComponent(
        repo
      )}/branches/${encodeURIComponent(
        branch
      )}`
    );

  if (!branchResponse.ok) {
    throw new Error(
      `Branch '${branch}' not found or access denied. HTTP ${branchResponse.status}`
    );
  }

  return {
    repository:
      repoData.full_name,

    defaultBranch:
      repoData.default_branch,

    private:
      !!repoData.private,

    permissions
  };
}