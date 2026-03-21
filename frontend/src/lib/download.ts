export async function downloadFile(url: string, fallbackName?: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to download file.");
  }

  const blob = await res.blob();
  const objectUrl = window.URL.createObjectURL(blob);

  let filename = fallbackName;
  const disposition = res.headers.get("content-disposition");
  if (disposition) {
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  const link = document.createElement("a");
  link.href = objectUrl;
  if (filename) {
    link.download = filename;
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
