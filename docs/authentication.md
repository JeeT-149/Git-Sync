# Authentication

GitSync uses a modern, secure OAuth 2.0 flow with PKCE to authenticate with GitHub, ensuring no secrets are bundled within the extension.

## GitHub App
- **Name**: Git-Sync Pro
- **Permissions**: Read and write access to contents. Read access to metadata.

## Flow Details
1. **Initiation**: When the user clicks "Connect GitHub", the extension generates a secure `state` string and a PKCE `code_verifier`.
2. **Launch**: `chrome.identity.launchWebAuthFlow` is called with the GitHub authorization URL, passing the Client ID, `state`, and `code_challenge`.
3. **Redirection**: GitHub redirects back to the extension's `chromiumapp.org` redirect URI with an authorization code.
4. **Exchange**: The extension sends the authorization code and the `code_verifier` to the GitSync Auth Broker.
5. **Token Delivery**: The Auth Broker (which securely holds the Client Secret) exchanges the code with GitHub for an access token and returns it to the extension.
6. **Storage**: The extension stores the access token in `chrome.storage.session`, ensuring it is cleared when the browser is closed and is inaccessible to content scripts.

## Security Considerations
- **No Hardcoded Secrets**: The Client Secret and Private Key are never stored in the extension code.
- **PKCE**: Prevents authorization code interception attacks.
- **State Validation**: Prevents CSRF attacks during the OAuth flow.
- **Session Storage**: Access tokens are kept in temporary memory (`chrome.storage.session`) rather than persistent disk storage (`chrome.storage.local`).
