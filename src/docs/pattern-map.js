// Best-effort mapping from LeetCode's official topic tags to common
// interview "patterns". This is inferred, not authoritative — the
// README labels it as such rather than presenting it as LeetCode data.
const TOPIC_TO_PATTERNS = {
  "Array": ["Two Pointers", "Prefix Sum"],
  "Two Pointers": ["Two Pointers"],
  "Sliding Window": ["Sliding Window"],
  "Hash Table": ["Hash Map Lookup"],
  "Stack": ["Monotonic Stack"],
  "Binary Search": ["Binary Search"],
  "Tree": ["DFS", "BFS"],
  "Graph": ["DFS", "BFS", "Union Find"],
  "Dynamic Programming": ["Dynamic Programming"],
  "Backtracking": ["Backtracking"],
  "Greedy": ["Greedy"],
  "Trie": ["Trie Traversal"],
  "Topological Sort": ["Topological Sort"],
  "Union Find": ["Union Find"],
  "Bit Manipulation": ["Bitmasking"]
};

export function inferPatterns(topics) {
  const patterns = new Set();
  for (const topic of topics) {
    (TOPIC_TO_PATTERNS[topic] || []).forEach((p) => patterns.add(p));
  }
  return Array.from(patterns);
}