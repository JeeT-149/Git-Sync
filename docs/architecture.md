# GitSync Architecture

GitSync is a Chrome Manifest V3 extension designed to run cleanly in the background and synchronize content securely.

## Core Components

### Popup (`src/popup/`)
The primary user interface for the extension.
- Displays the current GitHub connection state.
- Allows users to initiate the OAuth flow.
- Provides a dynamic interface for selecting a target repository and branch via the GitHub API.
- Shows recent sync statistics and dashboard metrics.

### Options (`src/options/`)
The settings page for configuring non-secret product preferences.
- Controls synchronization toggles (e.g., auto-sync, platforms to enable).
- Configures formatting options (e.g., commit prefixes, root folders).
- Data is saved to `chrome.storage.local`.

### Content Scripts (`src/content/`)
Injected into target platforms (LeetCode, GeeksforGeeks).
- Monitors for successful submissions.
- Extracts problem details, code, and metadata.
- Sends payloads to the Service Worker via the Chrome messaging API.

### Service Worker (`src/background/service-worker.js`)
The central orchestrator of the extension.
- Handles messages from Content Scripts and the UI.
- Manages the GitHub OAuth flow (via `chrome.identity`).
- Performs authenticated API requests to GitHub.
- Handles the actual file synchronization (upserting files to the target repository).

### Authentication Module (`src/auth/`)
Manages the OAuth 2.0 PKCE flow and token lifecycle.
- Generates state and code challenges.
- Launches the web auth flow.
- Communicates with the Auth Broker to exchange codes for tokens.
- Handles background token refresh and persistence via `token-manager.js` to ensure the connection survives browser restarts.

### GitHub API Module (`src/github/`)
Abstracts GitHub API interactions.
- Ensures the active access token is securely retrieved from session storage for requests.
- Handles 401 retries automatically using the token manager.
- Handles fetching repositories, branches, and testing access.

### Auth Broker
An external Vercel-hosted service (`git-sync-auth-broker.vercel.app`).
- Securely holds the GitHub App Client Secret.
- Exchanges the authorization code provided by the extension for access/refresh tokens.
- Supports a `/api/github-refresh` endpoint to silently refresh access tokens using a long-lived refresh token.
- Returns tokens to the extension without exposing the secret.

## Communication
- **UI to Background**: `chrome.runtime.sendMessage` with structured types (e.g., `CONNECT_GITHUB`, `GET_GITHUB_REPOSITORIES`).
- **Content to Background**: `chrome.runtime.sendMessage` (e.g., `SYNC_SUBMISSION`).
- **Background to GitHub**: standard `fetch` API using the access token from session storage.
