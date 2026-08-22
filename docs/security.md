# Security Policy

GitSync adheres to a strict set of security protocols regarding GitHub authentication.

## Token Handling
- **Access Tokens**: Stored exclusively in `chrome.storage.session`. This ensures that they are cleared from memory when the browser restarts and are never written to disk.
- **Refresh Tokens**: Stored in `chrome.storage.local`. This allows the extension to silently refresh the access token and persist the user's connection. The refresh token is strictly isolated to the background service worker and `token-manager.js`. It is NEVER exposed to:
  - Content scripts
  - Popup scripts
  - External web pages (LeetCode, GFG)

## App Secrets
- The GitHub App Client Secret is NOT bundled in the extension source code.
- Token exchange and refresh requests are proxied securely through the Auth Broker, which securely holds the Client Secret in its server-side environment variables.

## Revocation
- When a user explicitly disconnects, the system completely wipes all traces of tokens (both access and refresh) and clears the repository configuration.
