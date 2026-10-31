export default function PageHeader({ eyebrow, title, description, action, children }) {
  return (
    <header className="mb-8 md:mb-10">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && <p className="label">{eyebrow}</p>}
          <h1 className="mt-2 font-serif text-[clamp(2rem,4.5vw,3.1rem)] leading-[1.03] tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted md:text-[14px]">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
      {children}
    </header>
  )
}
