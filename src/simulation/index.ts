import { STARTING_SCENARIO } from './config/balance'
import { configurationError, GAME_BALANCE } from './config/balance'
import { copyGameState } from './models/copy'
import { gameStateError } from './models/validation'
import type { GameState } from './models/game'

export { GAME_BALANCE, STARTING_SCENARIO, configurationError as validateConfiguration } from './config/balance'
export { performAction } from './actions/performAction'
export { isEligibleForEmployment } from './systems/employment'
export { advanceSimulationTime } from './systems/time'
export type { DailySummaryContext, TimeAdvanceResult } from './systems/time'
export type { Action, ActionResult } from './actions/types'
export type {
  DailySummary,
  Education,
  Employment,
  GameState,
  LifeEvent,
  Money,
  Player,
  SimulationClock,
  SkillName,
  Transaction,
} from './models/game'

export function createGame(seed: number = STARTING_SCENARIO.randomSeed): GameState {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('Random seed must be a safe integer.')
  }
  const configError = configurationError(GAME_BALANCE)
  if (configError) throw new Error(`Invalid game configuration: ${configError}`)
  const state = copyGameState(STARTING_SCENARIO)
  state.events = [{
    id: 1,
    day: state.clock.day,
    date: state.currentDate,
    description: 'You begin independent life in a small room in Molyko.',
  }]
  state.randomSeed = seed >>> 0
  const stateError = gameStateError(state)
  if (stateError) throw new Error(`Invalid starting scenario: ${stateError}`)
  return state
}
