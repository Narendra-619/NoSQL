import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

const sizes = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

export default function AdminDialog({
  eyebrow,
  title,
  description,
  size = 'lg',
  onClose,
  children,
}) {
  const titleId = useId()

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-[6px] border border-line bg-paper shadow-[0_30px_90px_rgba(27,27,23,0.28)] sm:rounded-[6px] ${sizes[size]}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-line bg-paper/95 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            {eyebrow && <p className="label">{eyebrow}</p>}
            <h2
              id={titleId}
              className="mt-1 font-serif text-[1.55rem] leading-tight tracking-[-0.02em] text-ink"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-[16px] text-muted transition-colors hover:border-forest hover:text-forest"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
