import { configurationError, GAME_BALANCE } from '../config/balance'
import { ageOnDate, nextDate } from '../models/calendar'
import { copyGameState } from '../models/copy'
import { gameStateError } from '../models/validation'
import type { GameState } from '../models/game'

export type TimeAdvanceResult =
  | { ok: true; state: GameState }
  | { ok: false; message: string }

const MAX_ADVANCE_MINUTES = 365 * 24 * 60

function addTransaction(state: GameState, date: string, amount: number): void {
  state.money.balance += amount
  state.money.transactions.push({
    id: state.money.transactions.length + 1,
    day: state.clock.day,
    date,
    description: 'Daily living costs',
    amount,
    balanceAfter: state.money.balance,
  })
}

function addEvent(state: GameState, description: string): void {
  state.events.push({
    id: state.events.length + 1,
    day: state.clock.day,
    date: state.currentDate,
    description,
  })
}

function ordinalSuffix(age: number): string {
  const lastTwoDigits = age % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return 'th'
  switch (age % 10) {
    case 1: return 'st'
    case 2: return 'nd'
    case 3: return 'rd'
    default: return 'th'
  }
}

export function advanceSimulationTime(
  state: GameState,
  durationMinutes: number,
): TimeAdvanceResult {
  const stateError = gameStateError(state)
  if (stateError) return { ok: false, message: `Invalid game state: ${stateError}` }
  const configError = configurationError(GAME_BALANCE)
  if (configError) return { ok: false, message: `Invalid game configuration: ${configError}` }
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0
    || durationMinutes > MAX_ADVANCE_MINUTES) {
    return {
      ok: false,
      message: `Time advance must be an integer from 1 to ${MAX_ADVANCE_MINUTES} minutes.`,
    }
  }

  const next = copyGameState(state)
  const totalMinutes = next.clock.minuteOfDay + durationMinutes
  const crossedDays = Math.floor(totalMinutes / (24 * 60))
  next.clock.minuteOfDay = totalMinutes % (24 * 60)

  for (let count = 0; count < crossedDays; count += 1) {
    const previousAge = next.player.age
    const followingDate = nextDate(next.currentDate)
    if (!followingDate) {
      return { ok: false, message: 'The simulation calendar cannot advance past year 9999.' }
    }
    next.currentDate = followingDate
    next.clock.day += 1

    const age = ageOnDate(next.birthDate, next.currentDate)
    if (age === null) return { ok: false, message: 'The simulation reached an invalid birthday.' }
    if (age > previousAge) {
      next.player.age = age
      addEvent(next, `You celebrated your ${age}${ordinalSuffix(age)} birthday.`)
    }

    if (next.money.balance < GAME_BALANCE.dailyExpense) {
      return {
        ok: false,
        message: 'You cannot cover the daily living costs required to advance time.',
      }
    }
    const balanceBeforeExpense = next.money.balance
    addTransaction(next, next.currentDate, -GAME_BALANCE.dailyExpense)
    if (balanceBeforeExpense > 0 && next.money.balance === 0) {
      addEvent(next, 'Your funds were depleted by daily living costs.')
    }
  }

  const advancedStateError = gameStateError(next)
  if (advancedStateError) {
    return { ok: false, message: `Time advance would create an invalid game state: ${advancedStateError}` }
  }
  return { ok: true, state: next }
}
