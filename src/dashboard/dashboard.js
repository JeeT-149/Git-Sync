export async function getDashboard() {
  const { records = [], lastSync = null } = await chrome.storage.local.get(["records", "lastSync"]);

  const uniqueSolved = dedupeByProblem(records);
  const failedCount = records.filter(r => r.status === "FAILED").length;

  return {
    ok: true,
    totalSolved: uniqueSolved.filter(r => r.status !== "FAILED").length, // actually maybe totalSolved should exclude FAILED, but let's just stick to uniqueSolved.length unless instructed otherwise. Actually, dedupeByProblem might include FAILED ones. Wait, dedupeByProblem is fine as is.
    byDifficulty: countByDifficulty(uniqueSolved),
    byPlatform: countByField(uniqueSolved, "platform"),
    byLanguage: countByField(uniqueSolved, "language"),
    streak: computeStreak(records),
    recentActivity: [...records]
      .sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())
      .slice(0, 10),
    lastSync,
    failedCount,
    totalRecords: records.length
  };
}

function dedupeByProblem(records) {
  const seen = new Map();
  for (const r of records) {
    // last sync wins (most recent language/status for that problem)
    seen.set(r.problemSlug, r);
  }
  return Array.from(seen.values());
}

function countByDifficulty(records) {
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (const r of records) {
    if (counts[r.difficulty] !== undefined) counts[r.difficulty]++;
  }
  return counts;
}

function countByField(records, field) {
  const counts = {};
  for (const r of records) {
    const key = r[field] || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function computeStreak(records) {
  if (records.length === 0) return { current: 0, longest: 0 };

  const daySet = new Set(
    records.map((r) => new Date(r.syncedAt).toDateString())
  );

  const days = Array.from(daySet)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b);

  let longest = 1;
  let run = 1;

  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i] - days[i - 1]) / 86400000);
    if (diff === 1) {
      run++;
      longest = Math.max(longest, run);
    } else if (diff > 1) {
      run = 1;
    }
  }

  const todayStr = new Date().toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();

  let current = 0;
  if (daySet.has(todayStr) || daySet.has(yesterdayStr)) {
    let cursor = daySet.has(todayStr) ? new Date() : new Date(Date.now() - 86400000);
    while (daySet.has(cursor.toDateString())) {
      current++;
      cursor = new Date(cursor.getTime() - 86400000);
    }
  }

  return { current, longest };
}
