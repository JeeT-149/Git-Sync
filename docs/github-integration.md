# GitHub Integration

GitSync heavily integrates with GitHub to manage user preferences and synchronize code files.

## Repository and Branch Selection
Instead of manually typing repository details, the popup UI leverages the authenticated user's token to query the GitHub API.
- **Repositories**: Fetched via `GET /user/repos`. The extension handles pagination (up to a limit) to ensure most active repositories are selectable.
- **Branches**: Fetched via `GET /repos/{owner}/{repo}/branches`. This allows users to correctly target the exact branch without typos.
- **Access Testing**: An internal check verifies repository permissions (specifically the `push` capability) to ensure syncs will succeed before the user relies on them.

## File Synchronization
Submissions are synced to the selected repository and branch.
- The path structure is dynamically generated based on user preferences (e.g., `rootFolder`), the platform, difficulty, and problem title.
- Files are committed directly using the `PUT /repos/{owner}/{repo}/contents/{path}` API endpoint.
- Existing file SHAs are fetched beforehand to properly update existing files without conflict.

## API Abstraction
All GitHub calls run through a central abstraction layer (`src/github/github-api.js`), which injects the required headers, API versions, and access tokens, simplifying operations in the background worker.

## Error Handling
The extension parses GitHub API errors and bubbles them up to the UI gracefully, ensuring users understand if a rate limit has been hit or if permissions are missing.
