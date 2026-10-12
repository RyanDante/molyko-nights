import type { GameState } from './game'

export function copyGameState(state: GameState): GameState {
  return {
    ...state,
    player: { ...state.player },
    money: {
      ...state.money,
      transactions: state.money.transactions.map((transaction) => ({ ...transaction })),
    },
    education: { ...state.education },
    skills: { ...state.skills },
    employment: { ...state.employment },
    clock: { ...state.clock },
    events: state.events.map((event) => ({ ...event })),
  }
}
