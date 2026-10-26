import { Check } from "lucide-react"

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

/** Four labelled cells; every label stays visible on a phone. Done steps carry a tick and can be revisited. */
export function BookingStepIndicator({ currentStep, steps, onSelect }: BookingStepIndicatorProps) {
  const current = steps.find((step) => step.number === currentStep)
  return (
    <nav aria-label="Booking steps">
      <ol className="sf-steps">
        {steps.map((step) => {
          const isCompleted = currentStep > step.number
          const isCurrent = currentStep === step.number
          return (
            <li key={step.number} className="min-w-0">
              <button
                type="button"
                disabled={!isCompleted || !onSelect}
                onClick={() => onSelect?.(step.number)}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${step.number} of ${steps.length}: ${step.title}${isCompleted ? ", done, go back" : ""}`}
                data-done={isCompleted && Boolean(onSelect)}
                className="sf-step"
              >
                {isCompleted ? <Check aria-hidden="true" /> : <span className="sf-step-num" aria-hidden="true">{step.number}</span>}
                <span aria-hidden="true">{step.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {current ? <p className="sf-step-label" aria-live="polite">Step {current.number} of {steps.length}</p> : null}
    </nav>
  )
}
