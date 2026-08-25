import { fetchProblemMetadata } from "../platforms/problem-extractor.js";
import { convertProblemHtmlToMarkdown } from "../docs/html-to-markdown.js";
import { inferPatterns } from "../docs/pattern-map.js";
import { buildReadme } from "../docs/readme-template.js";

async function resolveProblemImagesViaBackground(markdown, imageUrls, assetsFolderPath) {
  const response = await chrome.runtime.sendMessage({
    type: "RESOLVE_PROBLEM_IMAGES",
    markdown,
    imageUrls,
    assetsFolderPath
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Image resolution failed in background.");
  }

  return response.result; // { markdown, files }
}

export async function prepareSubmissionDocs(submission) {
  const { titleSlug, problemFolderPath } = submission;

  const meta = await fetchProblemMetadata(titleSlug);
  console.log("[GitSync DEBUG] raw contentHtml:", meta.contentHtml);
  console.log("[GitSync DEBUG] topics:", meta.topics);

  const { markdown: rawMarkdown, imageUrls } = convertProblemHtmlToMarkdown(meta.contentHtml);
  console.log("[GitSync DEBUG] imageUrls found:", imageUrls);

  const assetsFolderPath = `${problemFolderPath}/assets`;
  const { markdown: finalMarkdown, files: imageFiles } = await resolveProblemImagesViaBackground(
    rawMarkdown,
    imageUrls,
    assetsFolderPath
  );

  const patterns = inferPatterns(meta.topics);

  const readmeContent = buildReadme({
    title: meta.title,
    platform: "LeetCode",
    difficulty: meta.difficulty,
    language: submission.language,
    status: submission.status,
    problemUrl: `https://leetcode.com/problems/${titleSlug}/`,
    topics: meta.topics,
    patterns,
    runtime: submission.runtime,
    memory: submission.memory,
    problemMarkdown: finalMarkdown,
    solutionFileName: submission.solutionFileName
  });

  return {
    readmeContent,
    imageFiles,
    canonicalTitle: meta.title
  };
}