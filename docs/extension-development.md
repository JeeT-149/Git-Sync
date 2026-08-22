# Extension Development

## Loading the Extension
1. Clone the repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the root directory of the project.

## Project Structure
- `src/auth/`: OAuth logic and broker integration.
- `src/background/`: Service worker for background operations.
- `src/content/`: DOM injection and scraping scripts.
- `src/data/`: Static data (e.g., Blind 75 lists).
- `src/github/`: GitHub API abstraction.
- `src/options/`: Settings page UI.
- `src/popup/`: Main extension popup UI.
- `docs/`: Project documentation.

## Testing Core Flows
- **Authentication**: Click "Connect GitHub", authorize the app, and ensure the UI reflects the connected state. Check the background console for errors.
- **Repository Selection**: Ensure repositories load dynamically. Test branch selection and access validation.
- **Synchronization**: Open a LeetCode problem, submit an accepted solution, and monitor the service worker console. Verify the file appears in the designated GitHub repository.

## Debugging
- Inspect the popup: Right-click the extension icon and select "Inspect popup".
- Inspect the service worker: Go to `chrome://extensions/`, find GitSync, and click "service worker" next to "Inspect views".
