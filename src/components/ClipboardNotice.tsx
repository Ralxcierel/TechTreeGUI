// Handles copy, cut and paste of nodes, and shows why a paste failed (P5-2).
import { ErrorBanner } from './ErrorBanner'
import { useClipboard } from './useClipboard'

export function ClipboardNotice() {
  const { error, dismiss } = useClipboard()
  return error ? <ErrorBanner message={error} onDismiss={dismiss} /> : null
}
