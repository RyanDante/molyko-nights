import { STARTING_SCENARIO } from './config/balance'
import type { GameState } from './models/game'

export { GAME_BALANCE, STARTING_SCENARIO } from './config/balance'
export { performAction } from './actions/performAction'
export type { Action, ActionResult } from './actions/types'
export type {
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
  return {
    ...STARTING_SCENARIO,
    player: { ...STARTING_SCENARIO.player },
    money: { ...STARTING_SCENARIO.money, transactions: [] },
    education: { ...STARTING_SCENARIO.education },
    skills: { ...STARTING_SCENARIO.skills },
    employment: { ...STARTING_SCENARIO.employment },
    clock: { ...STARTING_SCENARIO.clock },
    events: [{
      id: 1,
      day: STARTING_SCENARIO.clock.day,
      description: 'You begin independent life in a small room in Molyko.',
    }],
    randomSeed: seed >>> 0,
  }
}
