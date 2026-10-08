// Browser file save/load (download + file picker). File System Access API may replace this later.

export function fileNameFor(docName: string): string {
  // Replace characters that are invalid in Windows/macOS/Linux file names; keep everything else.
  // eslint-disable-next-line no-control-regex
  const safe = docName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim()
  return `${safe || 'Untitled'}.json`
}

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later: some browsers cancel the download if the URL is revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
