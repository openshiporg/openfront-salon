import type { ReactNode } from "react"

interface PageIntroProps {
  title: ReactNode
  description?: ReactNode
  aside?: ReactNode
  /** Kept for existing callers; every page title now sits at one size, closed by the ink shelf edge. */
  size?: "default" | "large"
}

/** Page title in condensed caps on a heavy ink shelf edge; no label above it. */
export function PageIntro({ title, description, aside }: PageIntroProps) {
  return (
    <header className="sf-page-head">
      <div>
        <h1 className="sf-display sf-page-title">{title}</h1>
        {description ? <div className="sf-page-sub">{description}</div> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  )
}
