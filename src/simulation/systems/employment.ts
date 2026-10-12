import { GAME_BALANCE } from '../config/balance'
import type { GameState } from '../models/game'

export function isEligibleForEmployment(state: GameState): boolean {
  return state.employment.status === 'unemployed'
    && state.employment.shiftsCompleted >= GAME_BALANCE.action.work.employmentAfterShifts
}
