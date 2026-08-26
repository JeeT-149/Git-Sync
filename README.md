# GitSync

Automatically sync your accepted LeetCode solutions to GitHub — no copy-paste, no manual commits.

## How it works

1. Install the extension and connect your GitHub account (secure OAuth, no personal access token needed).
2. Pick a target repository and branch.
3. Solve problems on LeetCode as normal.
4. Hit **Submit** — GitSync captures your code and pushes it straight to GitHub, along with an auto-generated README containing the problem statement, topics, and (where available) runtime/memory stats.

Every sync produces a single clean commit: your solution file + a documented README, atomically.

## Setup (for contributors / local development)

### 1. GitHub App Installation
GitSync uses a GitHub App for secure authentication. 
To install it on your current account, go to https://github.com/apps/git-sync-pro while logged into your GitHub account.

### 2. Extension Installation
1. Download/clone the repo
2. Go to chrome://extensions in Chrome
3. Toggle on "Developer mode" (top-right switch)
4. Click "Load unpacked"
5. Select the folder containing manifest.json
6. The GitSync icon should appear in your extensions bar
7. Click it, connect your GitHub account, pick a repo + branch, and you're set
8. Go solve a LeetCode problem and hit Submit — it should sync automatically

> [!NOTE]
> **New Repositories:** If you create a brand-new repository on GitHub for GitSync, you cannot push code until the repository has at least one branch. Please check the "Add a README file" box when creating the repo so the initial `main` branch is created!

## Architecture

- **Extension** (this repo) — Chrome MV3 extension, handles LeetCode detection, code capture, and GitHub API sync.
- **Auth Broker** ([git-sync-auth-broker](https://github.com/JeeT-149/git-sync-auth-broker)) — a minimal, stateless Vercel serverless function that performs the OAuth token exchange. It never stores tokens, solution code, or user data.

See `docs/` for detailed architecture, authentication flow, and sync-engine documentation.

## Privacy

GitSync only requests the GitHub permissions needed to read/write to the repository you select. No analytics, no tracking, no third-party data collection. See [PRIVACY.md](./PRIVACY.md) for details.

## License

MIT — see [LICENSE](./LICENSE).
