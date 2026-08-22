import { fetchProblemMetadata } from "../platforms/problem-extractor.js";
import { convertProblemHtmlToMarkdown } from "../docs/html-to-markdown.js";
import { resolveProblemImages } from "../docs/image-assets.js";
import { inferPatterns } from "../docs/pattern-map.js";
import { buildReadme } from "../docs/readme-template.js";

export async function prepareSubmissionDocs(submission) {
  const { titleSlug, problemFolderPath } = submission;

  const meta = await fetchProblemMetadata(titleSlug);
  const { markdown: rawMarkdown, imageUrls } = convertProblemHtmlToMarkdown(meta.contentHtml);

  const assetsFolderPath = `${problemFolderPath}/assets`;
  const { markdown: finalMarkdown, files: imageFiles } = await resolveProblemImages(
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

  return { readmeContent, imageFiles };
}