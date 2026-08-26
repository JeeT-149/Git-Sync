# GitSync Auth Broker: Refresh Endpoint

This is the code required for the `git-sync-auth-broker` Vercel project to support the new token refresh lifecycle.

Create a new file in your broker repository at `api/github-refresh.js`:

```javascript
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10kb',
    },
  },
};

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'chrome-extension://cphepalcajldmiodfbljmedocihhgdne');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Method restriction
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Content-Type restriction
  if (req.headers['content-type'] !== 'application/json') {
    return res.status(400).json({ error: 'Unsupported Media Type' });
  }

  // Origin verification
  const origin = req.headers.origin;
  if (origin !== 'chrome-extension://cphepalcajldmiodfbljmedocihhgdne') {
    return res.status(403).json({ error: 'Forbidden Origin' });
  }

  const { refresh_token } = req.body;

  if (typeof refresh_token !== 'string') {
    return res.status(400).json({ error: 'Invalid refresh_token' });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    });

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Bad Gateway' });
    }

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error_description || 'GitHub token refresh failed.' });
    }

    // Return only non-sensitive elements required by the extension
    res.setHeader('Access-Control-Allow-Origin', 'chrome-extension://cphepalcajldmiodfbljmedocihhgdne');
    return res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      refresh_token_expires_in: data.refresh_token_expires_in,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
```
