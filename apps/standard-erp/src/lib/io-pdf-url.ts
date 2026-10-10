/** Preview / fetch URL for IO PDFs (uploaded files are served via API, not always as static public files). */
export function ioPdfServeUrl(webPath: string): string {
  if (webPath.startsWith('/io-pdfs/')) {
    return `/api/io/pdf?path=${encodeURIComponent(webPath)}`
  }
  return webPath
}
