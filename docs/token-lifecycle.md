# Token Lifecycle & Architecture

GitSync relies on a secure separation of state for GitHub App authentication to provide a persistent yet secure user experience.

## Storage Architecture

**Session Storage (`chrome.storage.session`)**
- `githubAccessToken`: The active GitHub API token (expires in 8 hours).
- `githubTokenExpiresAt`: Timestamp marking token expiration.
- *Why Session Storage?* Session storage is volatile. It guarantees the access token is cleared out of memory if the browser restarts, meaning no sensitive, active token is ever persisted to disk.

**Persistent Storage (`chrome.storage.local`)**
- `githubRefreshToken`: The long-lived GitHub credential (expires in 6 months).
- `githubRefreshTokenExpiresAt`: Timestamp for refresh token expiration.
- `githubUsername`, `githubAvatarUrl`, `githubConnectedAt`: Cached connection state.
- *Why Local Storage?* To avoid requiring the user to manually log in every time the browser is closed. The refresh token allows GitSync to automatically restore the access token via the Auth Broker in the background.

## Silent Refresh & Rotation

1. **Initial Login**: The user connects via `chrome.identity`. The broker exchanges the auth code. GitSync receives both an access token and a refresh token.
2. **Persistence**: The access token goes to session storage; the refresh token goes to local storage.
3. **Browser Restart**: `chrome.storage.session` is wiped.
4. **Restoration**: The next time the user opens the popup or submits a LeetCode problem, the service worker detects the missing access token. It reads the refresh token from local storage and sends it to the `/api/github-refresh` broker endpoint.
5. **Token Rotation**: GitHub invalidates the old refresh token and returns a *new* access token and a *new* refresh token.
6. **Single-Flight Mutex**: If multiple submissions or repository checks happen concurrently while the token is expired, a central `refreshPromise` ensures only one refresh request goes out, preventing concurrent requests from generating conflicting rotated refresh tokens.

## Disconnect & Revocation

- When the user explicitly clicks **Disconnect**, all associated GitHub connection settings (`githubOwner`, `githubRepo`, `githubBranch`), the username, avatar, refresh token, and access token are completely wiped from both local and session storage.
- If the user revokes the application directly on GitHub, the next background refresh attempt will fail, safely triggering a local storage wipe and requiring a fresh reconnect.
