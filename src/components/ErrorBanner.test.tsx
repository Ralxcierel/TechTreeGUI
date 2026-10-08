// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBanner } from './ErrorBanner'

afterEach(cleanup)

describe('ErrorBanner', () => {
  it('shows the title and each detail as an alert', () => {
    render(
      <ErrorBanner
        message={{
          title: 'Could not load x.json',
          details: ['a is missing.', 'b must be a string.'],
        }}
        onDismiss={() => {}}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Could not load x.json')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'a is missing.',
      'b must be a string.',
    ])
  })

  it('shows at most 8 details and says how many more there are', () => {
    const details = Array.from({ length: 11 }, (_, i) => `problem ${i + 1}`)
    render(<ErrorBanner message={{ title: 'T', details }} onDismiss={() => {}} />)
    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toHaveLength(9)
    expect(items[7]).toBe('problem 8')
    expect(items[8]).toBe('…and 3 more.')
  })

  it('renders no list when there are no details', () => {
    render(<ErrorBanner message={{ title: 'T', details: [] }} onDismiss={() => {}} />)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('calls onDismiss from the close button', () => {
    const onDismiss = vi.fn()
    render(<ErrorBanner message={{ title: 'T', details: [] }} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
