# GitSync Privacy Policy

_Last updated: [25-08-2026]_

GitSync ("the extension") syncs your accepted LeetCode solutions to a GitHub repository you choose. This document explains what data is accessed and how it's handled.

## What GitSync accesses

- **GitHub**: via OAuth, scoped to read/write access on the repository you explicitly select. GitSync never accesses repositories you haven't chosen.
- **LeetCode**: the problem statement, title, difficulty, topics, and your submitted code — read directly from the page you're on, only when you click Submit.

## What GitSync stores

- **On your device** (`chrome.storage`): your GitHub connection state, selected repository/branch, sync history, and extension settings. This data never leaves your device except to communicate with GitHub's API directly.
- **On our servers**: nothing. The authentication broker (a small serverless function used only during GitHub's OAuth token exchange) does not store tokens, solution code, or any user data. It has no database.

## What GitSync does NOT do

- No analytics or usage tracking.
- No third-party data sharing.
- No personal access token entry — authentication is handled entirely through GitHub's official OAuth flow.

## Third parties

GitSync communicates directly with:
- `api.github.com` (GitHub's official API)
- `git-sync-auth-broker.vercel.app` (the OAuth exchange broker, source available at [https://github.com/JeeT-149/git-sync-auth-broker])

## Contact

Questions or concerns: open an issue at [https://github.com/JeeT-149/GitSync/issues]