export function fileUrlFromPath(filePath?: string) {
  const text = String(filePath || "").trim();
  if (!text) return "";
  const normalized = text.replace(/\\/g, "/");
  if (/^[a-z]+:\/\//i.test(normalized)) return normalized;
  if (/^[A-Za-z]:\//.test(normalized)) return encodeURI(`file:///${normalized}`);
  if (normalized.startsWith("/")) return encodeURI(`file://${normalized}`);
  return encodeURI(`file:///${normalized}`);
}
