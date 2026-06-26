/**
 * Extracts plain text from a PDF File/Blob entirely in the browser.
 * Uses pdf.js with a CDN worker fallback so it works even when the
 * Vite ?url worker import fails in some deployment environments.
 */

let pdfjsLib = null;

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;
  try {
    // Try local bundled version first
    const mod = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
    mod.GlobalWorkerOptions.workerSrc = workerMod.default;
    pdfjsLib = mod;
  } catch {
    // Fallback: load from CDN
    const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    pdfjsLib = mod;
  }
  return pdfjsLib;
}

export async function extractTextFromPdf(file) {
  const lib = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buffer }).promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    let lastY = null;
    let line = "";
    const lines = [];

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (line.trim()) lines.push(line.trim());
        line = "";
      }
      line += item.str + (item.hasEOL ? "" : " ");
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    fullText += lines.join("\n") + "\n";
  }

  return fullText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
