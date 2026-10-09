// Hover with a delay: `shown` turns true only after the pointer has stayed for `delayMs`, and
// false as soon as it leaves. Used for node tooltips (decision D2 of Phase 3), so moving the
// mouse across the canvas doesn't flash a tooltip on every node it passes.
import { useCallback, useEffect, useRef, useState } from 'react'

export function useHoverIntent(delayMs: number) {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const onEnter = useCallback(() => {
    cancel()
    timer.current = setTimeout(() => {
      timer.current = null
      setShown(true)
    }, delayMs)
  }, [cancel, delayMs])

  const onLeave = useCallback(() => {
    cancel()
    setShown(false)
  }, [cancel])

  // A timer still running when the card goes away must not fire afterwards.
  useEffect(() => cancel, [cancel])

  return { shown, onEnter, onLeave }
}
