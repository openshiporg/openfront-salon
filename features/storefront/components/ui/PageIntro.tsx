import type { ReactNode } from "react"

interface PageIntroProps {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  aside?: ReactNode
  size?: "default" | "large"
}

export function PageIntro({ title, eyebrow, description, aside, size = "default" }: PageIntroProps) {
  return (
    <header className="mb-[var(--sf-space-xl)] flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 max-w-4xl">
        {eyebrow ? <div className="sf-eyebrow mb-4">{eyebrow}</div> : null}
        <h1 className={`sf-display ${size === "large" ? "text-[var(--sf-text-display)]" : "text-[var(--sf-text-display-s)]"}`}>{title}</h1>
        {description ? <p className="sf-lead mt-5">{description}</p> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  )
}
