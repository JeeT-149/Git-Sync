# GitSync Project History

## Origins
GitSync began as a project to automatically synchronize coding problem solutions from platforms like LeetCode and GeeksforGeeks to a user's GitHub repository. The original goal was to solve problems experienced with other sync extensions (like the original LeetSync) by creating a more robust, modern Manifest V3 extension.

## Initial Prototyping
The first iteration relied on a Personal Access Token (PAT) for GitHub authentication. Users had to manually create a PAT with appropriate scopes and paste it into the extension's settings page, along with specifying their repository owner, name, and branch.

## Stage 1: Secure OAuth Architecture
Recognizing the security risks and friction of asking users for PATs, the decision was made to remove PAT entry from the product entirely. A dedicated GitHub App ("Git-Sync Pro") was created. 
A secure OAuth architecture was implemented using:
- PKCE (Proof Key for Code Exchange) and state verification.
- A dedicated GitSync Auth Broker (`git-sync-auth-broker.vercel.app`) to handle the secure exchange of the authorization code for an access token, ensuring the Client Secret is never exposed in the extension.
- `chrome.storage.session` for securely storing the short-lived access token, ensuring it is cleared when the browser closes.
This resulted in a successful Stage 1 authentication flow where users could connect their GitHub account seamlessly.

## Stage 2: GitHub-First Workflow
With authentication working, Stage 2 focused on removing all remnants of the old PAT workflow from the UI and codebase. The popup was redesigned to be "GitHub-first," moving repository and branch selection out of the settings page and directly into the main popup. 
- GitHub API integration was added to dynamically fetch the user's available repositories and branches.
- Local storage was separated: secrets in session storage, preferences and selected repo in local storage.
- Settings page was refactored to only contain legitimate non-secret preferences.

## Stage 3: Persistent Connection and Token Lifecycle
The initial OAuth implementation required the user to reconnect every time the browser was restarted, as the access token was securely confined to volatile session storage. 
Stage 3 introduced a robust refresh architecture:
- A `/api/github-refresh` endpoint was added to the Auth Broker.
- A long-lived **refresh token** is now persisted safely in `chrome.storage.local`.
- A background `token-manager.js` with a single-flight mutex was implemented to silently refresh expiring access tokens behind the scenes.
- State is now preserved across browser restarts while maintaining the security guarantee that active API access tokens are never written to disk.

## Future Plans
- Expanding synchronization support.
- Enhancing dashboard analytics.
- Fine-tuning file synchronization and conflict resolution.
