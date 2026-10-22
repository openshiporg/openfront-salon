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

export function BookingStepIndicator({ currentStep, steps, onSelect }: BookingStepIndicatorProps) {
  return (
    <ol className="sf-steps sf-track sf-track-scroll" aria-label="Booking steps">
      {steps.map((step) => {
        const isCompleted = currentStep > step.number
        const isCurrent = currentStep === step.number
        return (
          <li key={step.number} className="shrink-0">
            <button
              type="button"
              disabled={!isCompleted || !onSelect}
              onClick={() => onSelect?.(step.number)}
              aria-current={isCurrent ? "step" : undefined}
              data-done={isCompleted}
              className={`sf-btn ${isCurrent ? "" : "sf-btn-quiet"} disabled:!opacity-100`}
              style={isCurrent ? undefined : { cursor: isCompleted ? "pointer" : "default" }}
            >
              <span className="sf-step-num">{isCompleted ? <Check className="!h-3 !w-3" aria-hidden="true" /> : step.number}</span>
              <span className={isCurrent ? "" : "hidden sm:inline"}>{step.title}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
