import {
  GITHUB_CLIENT_ID,
  GITHUB_AUTH_BROKER
} from "./github-config.js";

const AUTH_BASE =
  "https://github.com/login/oauth/authorize";

function randomString(
  byteLength = 32
) {
  const bytes =
    new Uint8Array(
      byteLength
    );

  crypto.getRandomValues(
    bytes
  );

  return Array.from(
    bytes
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

function base64UrlEncode(
  bytes
) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(
      byte
    );
  }

  return btoa(binary)
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}

async function createCodeChallenge(
  codeVerifier
) {
  const data =
    new TextEncoder().encode(
      codeVerifier
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return base64UrlEncode(
    new Uint8Array(digest)
  );
}

export async function startGitHubLogin() {
  if (!GITHUB_CLIENT_ID) {
    throw new Error(
      "GitHub Client ID is missing."
    );
  }

  if (!GITHUB_AUTH_BROKER) {
    throw new Error(
      "GitHub authentication broker URL is missing."
    );
  }

  const redirectUri =
    chrome.identity.getRedirectURL(
      "github"
    );

  const state =
    randomString(32);

  const codeVerifier =
    randomString(64);

  const codeChallenge =
    await createCodeChallenge(
      codeVerifier
    );

  await chrome.storage.session.set({
    githubOAuthState:
      state,

    githubCodeVerifier:
      codeVerifier
  });

  const params =
    new URLSearchParams({
      client_id:
        GITHUB_CLIENT_ID,

      redirect_uri:
        redirectUri,

      response_type:
        "code",

      state,

      code_challenge:
        codeChallenge,

      code_challenge_method:
        "S256"
    });

  const authorizationUrl =
    `${AUTH_BASE}?${params.toString()}`;

  let responseUrl;

  try {
    responseUrl =
      await chrome.identity.launchWebAuthFlow(
        {
          url:
            authorizationUrl,

          interactive:
            true
        }
      );
  } catch (error) {
    await chrome.storage.session.remove([
      "githubOAuthState",
      "githubCodeVerifier"
    ]);

    throw new Error(
      error?.message ||
      "Unable to open GitHub authorization."
    );
  }

  if (!responseUrl) {
    await chrome.storage.session.remove([
      "githubOAuthState",
      "githubCodeVerifier"
    ]);

    throw new Error(
      "GitHub authorization was cancelled."
    );
  }

  return handleCallback(
    responseUrl,
    redirectUri
  );
}

async function handleCallback(
  responseUrl,
  redirectUri
) {
  const url =
    new URL(responseUrl);

  const returnedState =
    url.searchParams.get(
      "state"
    );

  const code =
    url.searchParams.get(
      "code"
    );

  const error =
    url.searchParams.get(
      "error"
    );

  const errorDescription =
    url.searchParams.get(
      "error_description"
    );

  const stored =
    await chrome.storage.session.get([
      "githubOAuthState",
      "githubCodeVerifier"
    ]);

  try {
    if (error) {
      throw new Error(
        errorDescription ||
        `GitHub authorization failed: ${error}`
      );
    }

    if (!code) {
      throw new Error(
        "GitHub did not return an authorization code."
      );
    }

    if (
      !stored.githubOAuthState ||
      returnedState !==
        stored.githubOAuthState
    ) {
      throw new Error(
        "OAuth state verification failed."
      );
    }

    if (!stored.githubCodeVerifier) {
      throw new Error(
        "PKCE verifier is missing."
      );
    }

    const tokenResponse =
      await fetch(
        GITHUB_AUTH_BROKER,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              code,

              code_verifier:
                stored.githubCodeVerifier,

              redirect_uri:
                redirectUri
            })
        }
      );

    let tokenData;

    try {
      tokenData =
        await tokenResponse.json();
    } catch {
      throw new Error(
        "Authentication broker returned invalid JSON."
      );
    }

    if (
      !tokenResponse.ok ||
      !tokenData.access_token
    ) {
      throw new Error(
        tokenData.error ||
        "GitHub token exchange failed."
      );
    }

    return {
      accessToken:
        tokenData.access_token,

      expiresIn:
        Number(
          tokenData.expires_in
        ) || null,

      refreshToken:
        tokenData.refresh_token ||
        null,

      refreshTokenExpiresIn:
        Number(
          tokenData.refresh_token_expires_in
        ) || null
    };
  } finally {
    await chrome.storage.session.remove([
      "githubOAuthState",
      "githubCodeVerifier"
    ]);
  }
}