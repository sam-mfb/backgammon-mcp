interface DemoControlsProps {
  currentStep: number
  totalSteps: number
  description: string
  onBack: () => void
  onForward: () => void
  onReset: () => void
}

export function DemoControls({
  currentStep,
  totalSteps,
  description,
  onBack,
  onForward,
  onReset,
}: DemoControlsProps) {
  const canGoBack = currentStep >= 0
  const canGoForward = currentStep < totalSteps - 1

  return (
    <div className="demo-controls">
      <button
        className="demo-controls__button"
        onClick={onReset}
        disabled={currentStep < 0}
      >
        Reset
      </button>
      <button
        className="demo-controls__button"
        onClick={onBack}
        disabled={!canGoBack}
      >
        ← Back
      </button>
      <div className="demo-controls__info">
        <div className="demo-controls__step">
          Step {currentStep + 1} / {totalSteps}
        </div>
        <div className="demo-controls__description">
          {description || 'Ready to start'}
        </div>
      </div>
      <button
        className="demo-controls__button demo-controls__button--primary"
        onClick={onForward}
        disabled={!canGoForward}
      >
        Forward →
      </button>
    </div>
  )
}
