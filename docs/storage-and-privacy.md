# Storage and Privacy

GitSync strictly separates sensitive authentication data from persistent, non-sensitive preferences.

## Data Storage

### `chrome.storage.session`
Used exclusively for sensitive or temporary data. This storage is cleared when the browser session ends.
- `githubAccessToken`
- `githubTokenExpiresAt`
- `githubRefreshToken`
- `githubRefreshTokenExpiresAt`
- Temporary OAuth `state` and `code_verifier` strings.

### `chrome.storage.local`
Used for persistent preferences and historical data.
- UI preferences (e.g., commit messages, enabled platforms).
- Repository configuration (owner, name, branch).
- Sync history and dashboard statistics.

## Privacy Commitments
- **No Telemetry**: GitSync does not include third-party tracking, analytics, or telemetry.
- **No Data Collection**: Your code, submissions, and GitHub data are passed directly between the extension and the GitHub API. The Auth Broker only handles the temporary OAuth code exchange and stores nothing.
- **Least Privilege**: The extension limits host permissions strictly to the target platforms (LeetCode, GeeksforGeeks), the Auth Broker, and the GitHub API. No `<all_urls>` permission is used.
