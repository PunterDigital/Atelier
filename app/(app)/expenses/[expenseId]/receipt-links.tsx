"use client";

// Receipts are stored inline as base64 data URLs. Browsers block top-level
// navigation to a `data:` URL (an anti-phishing measure), so a plain
// `<a href={dataUrl} target="_blank">` silently opens a blank tab and the
// PDF/image never renders. Converting to a short-lived `blob:` object URL
// sidesteps that restriction - blob URLs are allowed to open in a new tab.
//
// The base64 -> Blob decode is synchronous on purpose: it keeps the
// window.open call inside the click's user gesture so popup blockers leave
// it alone.

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64 = ""] = dataUrl.split(",", 2);
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function ReceiptLinks({
  dataUrl,
  filename,
}: {
  dataUrl: string;
  filename: string;
}) {
  function openInNewTab() {
    const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
    window.open(url, "_blank", "noopener,noreferrer");
    // The tab holds its own reference once opened, so the object URL can be
    // released shortly after without breaking the view.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function download() {
    const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-3 text-sm">
      <button
        type="button"
        onClick={openInNewTab}
        className="text-primary underline-offset-4 hover:underline"
      >
        Open
      </button>
      <button
        type="button"
        onClick={download}
        className="text-primary underline-offset-4 hover:underline"
      >
        Download
      </button>
    </div>
  );
}
