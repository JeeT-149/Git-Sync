/**
 * Converts LeetCode's problem-statement HTML into Markdown.
 * Returns { markdown, imageUrls } — imageUrls in the order encountered,
 * so callers can map them to committed asset filenames.
 */
export function convertProblemHtmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imageUrls = [];
  let imageIndex = 0;

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(walk).join("");

    switch (tag) {
      case "p":
        return `${children}\n\n`;
      case "strong":
      case "b":
        return `**${children}**`;
      case "em":
      case "i":
        return `*${children}*`;
      case "code":
        return `\`${children}\``;
      case "pre": {
        const hasImage = node.querySelector("img");

        if (hasImage) {
          // LeetCode's "Example" blocks bundle Input/Output/Explanation text
          // with a diagram image inside one <pre>. Treat as rich content,
          // not code — fencing it would print the image markdown as literal text.
          return `${children.trim()}\n\n`;
        }

        return `\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
      }
      case "sup":
        return `^${children}`;
      case "br":
        return "\n";
      case "hr":
        return "\n---\n\n";
      case "ul":
        return `${children}\n`;
      case "ol":
        return `${children}\n`;
      case "li":
        return `- ${children.trim()}\n`;
      case "img": {
        imageIndex++;
        const src = node.getAttribute("src");
        const alt = node.getAttribute("alt") || `Example ${imageIndex}`;
        if (src) {
          imageUrls.push(src);
          // Placeholder resolved later once we know committed asset paths
          return `\n![${alt}]({{IMAGE_${imageIndex}}})\n\n`;
        }
        return "";
      }
      case "table":
        return convertTable(node) + "\n\n";
      default:
        return children;
    }
  }

  function convertTable(tableNode) {
    const rows = Array.from(tableNode.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children).map((cell) =>
        Array.from(cell.childNodes).map(walk).join("").trim()
      )
    );

    if (rows.length === 0) return "";

    const [header, ...body] = rows;
    const headerLine = `| ${header.join(" | ")} |`;
    const dividerLine = `| ${header.map(() => "---").join(" | ")} |`;
    const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);

    return [headerLine, dividerLine, ...bodyLines].join("\n");
  }

  const markdown = Array.from(doc.body.childNodes)
    .map(walk)
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { markdown, imageUrls };
}