# Contributing to GitSync

Thanks for considering a contribution!

## Local setup

1. Clone the repo.
2. `chrome://extensions` → enable Developer mode → **Load unpacked** → select the repo folder.
3. After any code change, reload the extension **and** refresh any open LeetCode tab (MV3 service workers don't hot-reload into already-open tabs).

## Code style

- Keep auth logic in `src/auth/`, GitHub API calls in `src/github/`, platform-specific detection in `src/content/`, and sync orchestration in `src/sync/`.
- No personal access tokens, ever — all GitHub auth goes through the OAuth broker.
- Never log tokens, secrets, or full API responses to the console.

## Submitting changes

1. Fork the repo, create a branch off `main`.
2. Test your change against a real LeetCode submission end-to-end before opening a PR.
3. Open a PR describing what changed and why.

## Reporting bugs

Open a GitHub issue with the console output (extension popup console **and** service worker console — `chrome://extensions` → GitSync → "service worker" link) and the URL of the problem you were testing with.