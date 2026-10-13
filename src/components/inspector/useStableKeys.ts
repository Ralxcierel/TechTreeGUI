// Stable React keys for a list whose items can be renamed (field keys, handle ids).
//
// Keying list editors by the item's own id would remount an editor when its id is renamed, losing
// focus (and swallowing a click on its buttons). So a renamed item keeps the React key it had:
// `aliases` maps its new id to that React key.
//
// (A "hook" is a function whose name starts with `use` that keeps state for the component calling
// it; this one remembers the renames between renders.)
import { useState } from 'react'

export interface StableKeys {
  /** The React key for the item with this id. */
  keyOf: (id: string) => string
  /** Call after an item's id was renamed, so its editor keeps its React key. */
  renamed: (oldId: string, newId: string) => void
  /** Call after an item was removed, so a later item with that id starts afresh. */
  removed: (id: string) => void
}

export function useStableKeys(ids: readonly string[]): StableKeys {
  const [aliases, setAliases] = useState<ReadonlyMap<string, string>>(new Map())
  // Renamed items first, then the rest by their own id, with "+" added until it is unique.
  const reactKeys = new Map<string, string>()
  const used = new Set<string>()
  for (const id of ids) {
    const alias = aliases.get(id)
    if (alias !== undefined) {
      reactKeys.set(id, alias)
      used.add(alias)
    }
  }
  for (const id of ids) {
    if (reactKeys.has(id)) continue
    let k = id
    while (used.has(k)) k = `+${k}`
    reactKeys.set(id, k)
    used.add(k)
  }
  const keyOf = (id: string) => reactKeys.get(id) ?? id
  return {
    keyOf,
    renamed: (oldId, newId) => {
      const reactKey = keyOf(oldId)
      setAliases((m) => {
        const next = new Map(m)
        next.delete(oldId)
        next.set(newId, reactKey)
        return next
      })
    },
    removed: (id) =>
      setAliases((m) => {
        if (!m.has(id)) return m
        const next = new Map(m)
        next.delete(id)
        return next
      }),
  }
}
