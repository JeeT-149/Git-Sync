export function notifySyncResult({ status, problemTitle, problemSlug }) {
  const iconUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // Fallback 1x1 transparent icon, since icons/icon128.png is missing

  if (status === "SYNCED") {
    chrome.notifications.create(`gitsync-${problemSlug}`, {
      type: "basic",
      iconUrl: iconUrl,
      title: "GitSync",
      message: `✅ Synced: ${problemTitle}`,
      priority: 0
    });
  } else if (status === "FAILED") {
    chrome.notifications.create(`gitsync-${problemSlug}`, {
      type: "basic",
      iconUrl: iconUrl,
      title: "GitSync",
      message: `⚠️ Sync failed: ${problemTitle} — tap to retry`,
      priority: 1
    });
  }
}
