// The app's keyboard shortcuts (D3 of Phase 5): Ctrl+Z undo, Ctrl+Shift+Z or Ctrl+Y redo (⌘ on
// macOS). While the focus is in a text box, the keys belong to that box (its own text undo).
//
// React note: `useEffect` runs after the component appears on screen. Here it adds one key
// listener to the whole window, and the function it returns removes the listener again when the
// component goes away, so listeners never pile up.
import { useEffect } from 'react'
import { useEditorStore } from '../editor/store'

/** Inputs that aren't for typing text: the shortcuts still work while one has the focus. */
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
])

/** Whether keys typed now go into a text box (which has its own undo, copy and paste). */
export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}

export type Shortcut = 'undo' | 'redo'

/** The app shortcut a key press means, or null. */
export function shortcutFor(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): Shortcut | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  // The letter, or the key's place on a US keyboard for other alphabets (e.g. "я" is on KeyZ).
  const key = /^[a-z]$/i.test(e.key)
    ? e.key.toLowerCase()
    : e.code.replace(/^Key/, '').toLowerCase()
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (key === 'y' && !e.shiftKey) return 'redo'
  return null
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const shortcut = shortcutFor(e)
      if (shortcut === null || isTextEntry(e.target)) return
      e.preventDefault()
      const state = useEditorStore.getState()
      if (shortcut === 'undo') state.undo()
      else state.redo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
