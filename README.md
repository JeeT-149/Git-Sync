# GitSync

A Manifest V3 Chrome extension that syncs accepted LeetCode and GeeksforGeeks solutions directly to GitHub without a backend.

## Features

- Automatic accepted-submission detection
- LeetCode + GeeksforGeeks adapters
- GitHub fine-grained PAT support
- Create-or-update semantics: the newest accepted code replaces the old solution file
- Automatic README per problem
- Easy / Medium / Hard statistics
- Daily streak
- Blind 75 / Blind 150 progress
- Topic and interview-pattern heuristics
- Local sync history and failed-sync diagnostics
- No backend, analytics, or third-party server

## Important

This is intentionally a DOM/editor integration extension. LeetCode and GeeksforGeeks can change their UI without notice, so the site adapters may need selector adjustments over time.

## Recommended GitHub token

Create a fine-grained personal access token limited to your target repository with:

- Repository access: only the repository used by this extension
- Repository permissions: Contents -> Read and write

The extension only talks to `api.github.com`.

## Development

1. Open `chrome://extensions`
2. Turn on Developer mode
3. Click Load unpacked
4. Select this folder
5. Open the extension settings and configure GitHub
6. Open a LeetCode or GFG problem
7. Submit a correct solution
8. Check the GitHub repository

For debugging:
- `chrome://extensions` -> extension -> Service worker -> Inspect
- Open the page DevTools console on LeetCode/GFG
- The extension logs with `GitSync`
