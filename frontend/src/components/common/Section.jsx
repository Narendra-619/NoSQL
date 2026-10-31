export default function Section({ id, eyebrow, title, action, children, className = '' }) {
  return (
    <section id={id} className={`border-t border-line pt-6 md:pt-7 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {eyebrow && <p className="label">{eyebrow}</p>}
            {title && (
              <h2 className="mt-1.5 font-serif text-[1.45rem] leading-tight tracking-[-0.015em] text-ink md:text-[1.6rem]">
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
