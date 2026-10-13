// Browser file save/load (download + file picker). File System Access API may replace this later.

/** A safe file name for the document, with the given ending (e.g. "json", "game.json", "png"). */
export function fileNameFor(docName: string, extension = 'json'): string {
  // Replace characters that are invalid in Windows/macOS/Linux file names; keep everything else.
  // eslint-disable-next-line no-control-regex
  const safe = docName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim()
  return `${safe || 'Untitled'}.${extension}`
}

/** Starts a download of `blob` named `fileName`. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later: some browsers cancel the download if the URL is revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(fileName: string, text: string, type = 'application/json'): void {
  downloadBlob(fileName, new Blob([text], { type }))
}
