interface Step {
  number: number
  title: string
}

interface BookingStepIndicatorProps {
  currentStep: number
  steps: Step[]
  /** Steps before the current one are revisitable. */
  onSelect?: (step: number) => void
}

/**
 * One progress indicator: a hairline segment per step, filled up to the current one,
 * with its name underneath. Finished steps can be revisited.
 */
export function BookingStepIndicator({ currentStep, steps, onSelect }: BookingStepIndicatorProps) {
  return (
    <nav aria-label="Booking progress">
      <ol className="sf-bk-progress">
        {steps.map((step) => {
          const done = currentStep > step.number
          const current = currentStep === step.number
          return (
            <li key={step.number} className="min-w-0">
              <button
                type="button"
                disabled={!done || !onSelect}
                onClick={() => onSelect?.(step.number)}
                aria-current={current ? "step" : undefined}
                aria-label={`${step.title}, step ${step.number} of ${steps.length}${done ? ", done. Go back to this step" : ""}`}
                data-state={done ? "done" : current ? "current" : "todo"}
                className="sf-bk-progress-step"
              >
                <span className="sf-bk-progress-bar" aria-hidden="true" />
                <span className="sf-bk-progress-label" aria-hidden="true">{step.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
