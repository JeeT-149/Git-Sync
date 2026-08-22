export function buildReadme({
  title,
  platform,
  difficulty,
  language,
  status,
  problemUrl,
  topics,
  patterns,
  runtime,
  memory,
  problemMarkdown,
  solutionFileName
}) {
  const lines = [`# ${title}`, ""];

  lines.push(`**Platform:** ${platform}`);
  lines.push(`**Difficulty:** ${difficulty}`);
  lines.push(`**Language:** ${language}`);
  if (status) lines.push(`**Status:** ${status}`);
  lines.push(`**Problem:** [${title}](${problemUrl})`);

  if (topics?.length) lines.push(`**Topics:** ${topics.join(", ")}`);
  if (patterns?.length) lines.push(`**Patterns (inferred):** ${patterns.join(", ")}`);
  if (runtime) lines.push(`**Runtime:** ${runtime}`);
  if (memory) lines.push(`**Memory:** ${memory}`);

  lines.push("", "---", "", "## Problem Statement", "", problemMarkdown, "");
  lines.push("---", "", `**Solution:** [\`${solutionFileName}\`](./${solutionFileName})`, "");

  return lines.join("\n");
}