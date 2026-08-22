import { GITHUB_REFRESH_BROKER } from "./github-config.js";

let refreshPromise = null;

const ACCESS_TOKEN_SAFETY_WINDOW_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_SAFETY_WINDOW_MS = 10 * 60 * 1000;

export async function hasValidAuthentication() {
  const session = await chrome.storage.session.get([
    "githubAccessToken",
    "githubTokenExpiresAt"
  ]);

  if (session.githubAccessToken) {
    const expiresAt = session.githubTokenExpiresAt;

    if (!expiresAt || Date.now() < expiresAt) {
      return true;
    }
  }

  const local = await chrome.storage.local.get([
    "githubRefreshToken",
    "githubRefreshTokenExpiresAt"
  ]);

  if (!local.githubRefreshToken) {
    return false;
  }

  if (
    local.githubRefreshTokenExpiresAt &&
    Date.now() + REFRESH_TOKEN_SAFETY_WINDOW_MS >=
      local.githubRefreshTokenExpiresAt
  ) {
    return false;
  }

  return true;
}

export async function clearAuthentication() {
  await chrome.storage.session.remove([
    "githubAccessToken",
    "githubTokenExpiresAt"
  ]);

  await chrome.storage.session.remove([
    "githubOAuthState",
    "githubCodeVerifier"
  ]);

  const currentSettingsData =
    await chrome.storage.local.get("settings");

  const settings =
    currentSettingsData.settings || {};

  await chrome.storage.local.set({
    settings: {
      ...settings,
      githubOwner: "",
      githubRepo: "",
      githubBranch: ""
    }
  });

  await chrome.storage.local.remove([
    "githubRefreshToken",
    "githubRefreshTokenExpiresAt",
    "githubUsername",
    "githubAvatarUrl",
    "githubConnectedAt"
  ]);
}

export async function restoreAuthentication() {
  const session =
    await chrome.storage.session.get([
      "githubAccessToken",
      "githubTokenExpiresAt"
    ]);

  if (session.githubAccessToken) {
    const expiresAt =
      session.githubTokenExpiresAt;

    const stillValid =
      !expiresAt ||
      Date.now() + ACCESS_TOKEN_SAFETY_WINDOW_MS <
        expiresAt;

    if (stillValid) {
      return session.githubAccessToken;
    }
  }

  const local =
    await chrome.storage.local.get([
      "githubRefreshToken",
      "githubRefreshTokenExpiresAt"
    ]);

  if (!local.githubRefreshToken) {
    return null;
  }

  if (
    local.githubRefreshTokenExpiresAt &&
    Date.now() + REFRESH_TOKEN_SAFETY_WINDOW_MS >=
      local.githubRefreshTokenExpiresAt
  ) {
    await clearAuthentication();
    throw new Error(
      "GitHub authorization has expired. Please reconnect GitHub."
    );
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    refreshAccessToken(
      local.githubRefreshToken
    );

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function getValidAccessToken(
  forceRefresh = false
) {
  if (!forceRefresh) {
    const token =
      await restoreAuthentication();

    if (token) {
      return token;
    }

    throw new Error(
      "Not connected to GitHub. Please connect GitHub."
    );
  }

  const local =
    await chrome.storage.local.get([
      "githubRefreshToken",
      "githubRefreshTokenExpiresAt"
    ]);

  if (!local.githubRefreshToken) {
    throw new Error(
      "GitHub connection is unavailable. Please reconnect GitHub."
    );
  }

  if (
    local.githubRefreshTokenExpiresAt &&
    Date.now() + REFRESH_TOKEN_SAFETY_WINDOW_MS >=
      local.githubRefreshTokenExpiresAt
  ) {
    await clearAuthentication();

    throw new Error(
      "GitHub authorization has expired. Please reconnect GitHub."
    );
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    refreshAccessToken(
      local.githubRefreshToken
    );

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function refreshAccessToken(
  refreshToken
) {
  let response;

  try {
    response = await fetch(
      GITHUB_REFRESH_BROKER,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          refresh_token:
            refreshToken
        })
      }
    );
  } catch (error) {
    console.error(
      "[GitSync] Refresh broker request failed:",
      error
    );

    // IMPORTANT:
    // Do not log the refresh token.
    // Do not clear authentication on a
    // temporary network failure.
    throw new Error(
      "GitHub refresh service is temporarily unavailable. Please try again."
    );
  }

  let tokenData;

  try {
    tokenData =
      await response.json();
  } catch {
    throw new Error(
      "GitHub refresh service returned an invalid response."
    );
  }

  if (!response.ok) {
    const errorCode =
      tokenData.error_code ||
      tokenData.error ||
      "";

    const permanentlyInvalid =
      [
        "invalid_grant",
        "bad_refresh_token",
        "refresh_token_expired",
        "unauthorized"
      ].includes(
        String(errorCode).toLowerCase()
      );

    if (permanentlyInvalid) {
      await clearAuthentication();

      throw new Error(
        "GitHub authorization has expired or been revoked. Please reconnect GitHub."
      );
    }

    throw new Error(
      tokenData.error ||
      "GitHub token refresh failed."
    );
  }

  if (!tokenData.access_token) {
    throw new Error(
      "GitHub refresh service did not return an access token."
    );
  }

  const accessToken =
    tokenData.access_token;

  const expiresIn =
    Number(tokenData.expires_in) || null;

  const newRefreshToken =
    tokenData.refresh_token ||
    refreshToken;

  const refreshExpiresIn =
    Number(
      tokenData.refresh_token_expires_in
    ) || null;

  const now = Date.now();

  await chrome.storage.session.set({
    githubAccessToken:
      accessToken,

    githubTokenExpiresAt:
      expiresIn
        ? now + expiresIn * 1000
        : null
  });

  await chrome.storage.local.set({
    githubRefreshToken:
      newRefreshToken,

    githubRefreshTokenExpiresAt:
      refreshExpiresIn
        ? now + refreshExpiresIn * 1000
        : undefined
  });

  return accessToken;
}