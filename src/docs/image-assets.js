/**
 * Downloads each image URL and returns committed-file descriptors,
 * plus the final markdown with placeholders resolved to relative paths.
 */
export async function resolveProblemImages(markdown, imageUrls, assetsFolderPath) {
  const files = [];
  let resolvedMarkdown = markdown;

  for (let i = 0; i < imageUrls.length; i++) {
    const index = i + 1;
    const url = imageUrls[i];

    let extension = "png";
    const match = url.match(/\.(png|jpg|jpeg|gif|svg)(\?|$)/i);
    if (match) extension = match[1].toLowerCase();

    const filename = `img-${index}.${extension}`;
    const relativePath = `${assetsFolderPath}/${filename}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const base64 = await blobToBase64(blob);

      files.push({ path: relativePath, base64Content: base64 });
      resolvedMarkdown = resolvedMarkdown.replace(`{{IMAGE_${index}}}`, `./assets/${filename}`);
    } catch (err) {
      console.warn(`[GitSync] Failed to fetch problem image ${url}:`, err.message);
      // Fall back to the original hotlink rather than breaking the README
      resolvedMarkdown = resolvedMarkdown.replace(`{{IMAGE_${index}}}`, url);
    }
  }

  return { markdown: resolvedMarkdown, files };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}