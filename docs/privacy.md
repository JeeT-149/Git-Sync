# Privacy Policy

GitSync is designed to operate with minimal data collection and maximum privacy.

## Data Storage
- **Local Storage**: Your GitHub repository selections, connection state (username, avatar), and long-lived refresh tokens are stored securely in your browser's local storage. This data never leaves your local machine except to communicate with GitHub.
- **Session Storage**: The short-lived GitHub access token is stored in session storage and is completely erased when your browser restarts.

## Auth Broker
The Auth Broker exists solely to securely proxy OAuth requests (token exchange and refresh) to GitHub without exposing the GitHub Client Secret to the frontend extension.
The broker **does not**:
- Retain your access or refresh tokens.
- Retain your GitHub username or repository configurations.
- Retain, log, or inspect the source code you submit.
- Collect analytics or telemetry data.

All data transmitted to GitHub via the API passes securely over HTTPS. When you choose to Disconnect within the extension, your local configuration is immediately erased.
