# Stage 2 Changelog

## Removed
- Removed the old Personal Access Token (PAT) entry fields from the settings UI.
- Removed legacy PAT validation and fallback logic from the service worker.
- Removed manual repository owner, name, and branch text inputs from the settings page.

## Added
- Introduced a dedicated `src/github/github-api.js` abstraction module.
- Added dynamic repository fetching from the GitHub API upon successful connection.
- Added dynamic branch fetching based on the selected repository.
- Implemented a "Test Access" feature to verify read and write permissions on the selected repository and branch.
- Created comprehensive `docs/` detailing the architecture, history, and development guidelines.

## Changed
- Completely redesigned the popup to act as the primary GitHub integration hub (GitHub-first workflow).
- Shifted repository and branch configuration storage to populate strictly via UI selection rather than manual text entry.
- Updated the synchronization logic to pull access tokens securely from `chrome.storage.session` instead of `chrome.storage.local`.
