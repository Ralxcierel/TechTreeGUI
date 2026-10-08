// A dismissible banner listing what went wrong (e.g. every problem found in a file that won't load).

export interface BannerMessage {
  title: string
  details: string[]
}

const MAX_DETAILS = 8

interface ErrorBannerProps {
  message: BannerMessage
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  const shown = message.details.slice(0, MAX_DETAILS)
  const hidden = message.details.length - shown.length
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__body">
        <strong>{message.title}</strong>
        {shown.length > 0 && (
          <ul>
            {shown.map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
            {hidden > 0 && <li>…and {hidden} more.</li>}
          </ul>
        )}
      </div>
      <button className="error-banner__close" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
