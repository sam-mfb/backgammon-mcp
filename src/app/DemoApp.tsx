import { useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from './store'
import { resetGame } from '@/game'
import { BoardView } from '@/viewer'
import { DemoControls } from './DemoControls'
import { DEMO_SEQUENCE } from './presetMoves'

export function DemoApp() {
  const dispatch = useDispatch<AppDispatch>()
  const gameState = useSelector((state: RootState) => state.game)
  const [currentStep, setCurrentStep] = useState(-1)

  const handleForward = useCallback(() => {
    const nextStep = currentStep + 1
    if (nextStep < DEMO_SEQUENCE.length) {
      dispatch(DEMO_SEQUENCE[nextStep].action)
      setCurrentStep(nextStep)
    }
  }, [currentStep, dispatch])

  const handleBack = useCallback(() => {
    if (currentStep < 0) return

    const targetStep = currentStep - 1

    // Reset game and replay up to targetStep
    dispatch(resetGame())
    for (let i = 0; i <= targetStep; i++) {
      dispatch(DEMO_SEQUENCE[i].action)
    }
    setCurrentStep(targetStep)
  }, [currentStep, dispatch])

  const handleReset = useCallback(() => {
    dispatch(resetGame())
    setCurrentStep(-1)
  }, [dispatch])

  const description = currentStep >= 0
    ? DEMO_SEQUENCE[currentStep].description
    : ''

  return (
    <div className="demo-app">
      <h1>Backgammon MCP</h1>
      <BoardView gameState={gameState} />
      <DemoControls
        currentStep={currentStep}
        totalSteps={DEMO_SEQUENCE.length}
        description={description}
        onBack={handleBack}
        onForward={handleForward}
        onReset={handleReset}
      />
    </div>
  )
}
