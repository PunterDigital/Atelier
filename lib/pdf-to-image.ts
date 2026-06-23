// Browser-side PDF rasterization for receipt scanning. Groq vision reads
// images, not PDFs, so when a user scans a PDF receipt we render its first
// page to a JPEG here and send that instead. Doing this client-side keeps the
// server free of native canvas/PDF dependencies (important for self-hosting) -
// the stored receipt remains the original PDF; this image is scan-only.
//
// pdfjs is loaded lazily (dynamic import) so it never weighs down the expense
// form's initial bundle - the cost is paid only when someone scans a PDF.

// Render width to aim for: high enough that receipt text stays legible to the
// vision model, low enough that the resulting JPEG stays well under the scan
// size cap (~1.5MB).
const TARGET_WIDTH = 1600;
const JPEG_QUALITY = 0.85;

export type ScanImage = { dataUrl: string; mimeType: "image/jpeg" };

// Decode a base64 data URL (data:...;base64,XXXX) into raw bytes for pdfjs.
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Renders the first page of a PDF (given as a data URL) to a JPEG data URL.
// Throws if the PDF can't be parsed or rendered - the caller turns that into a
// "try a PNG/JPEG instead" message.
export async function pdfFirstPageToImage(pdfDataUrl: string): Promise<ScanImage> {
  const pdfjs = await import("pdfjs-dist");
  // Bundled worker, resolved by the bundler from node_modules - no CDN, so it
  // works offline / air-gapped.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const loadingTask = pdfjs.getDocument({ data: dataUrlToBytes(pdfDataUrl) });
  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    // Scale to hit TARGET_WIDTH, but never upscale past 2x a tiny page.
    const unscaled = page.getViewport({ scale: 1 });
    const scale = Math.min(2, TARGET_WIDTH / unscaled.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context unavailable");
    // PDFs are transparent; flatten onto white so the scan looks like paper.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), mimeType: "image/jpeg" };
  } finally {
    // Frees the document and tears down the worker.
    await loadingTask.destroy();
  }
}
