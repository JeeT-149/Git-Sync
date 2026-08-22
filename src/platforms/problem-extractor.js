const GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

export async function fetchProblemMetadata(titleSlug) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        difficulty
        content
        topicTags { name }
        exampleTestcases
      }
    }
  `;

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    credentials: "include", // reuses the user's existing LeetCode session
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { titleSlug } })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch problem metadata: HTTP ${response.status}`);
  }

  const { data, errors } = await response.json();

  if (errors?.length) {
    throw new Error(`LeetCode GraphQL error: ${errors[0].message}`);
  }

  if (!data?.question) {
    throw new Error("Problem metadata not found.");
  }

  return {
    title: data.question.title,
    difficulty: data.question.difficulty,
    contentHtml: data.question.content, // raw HTML problem statement
    topics: (data.question.topicTags || []).map((t) => t.name)
  };
}