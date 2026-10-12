import { configurationError, GAME_BALANCE } from '../config/balance'
import { ageOnDate, nextDate } from '../models/calendar'
import { copyGameState } from '../models/copy'
import { gameStateError } from '../models/validation'
import type { DailySummary, GameState, LifeEvent, Transaction } from '../models/game'

export type TimeAdvanceResult =
  | { ok: true; state: GameState; dailySummaries: DailySummary[] }
  | { ok: false; message: string }

export interface DailySummaryContext {
  openingState: GameState
  educationMilestoneReached?: boolean
}

const MAX_ADVANCE_MINUTES = 365 * 24 * 60

function addTransaction(
  state: GameState,
  description: string,
  date: string,
  amount: number,
): Transaction {
  state.money.balance += amount
  const transaction: Transaction = {
    id: state.money.transactions.length + 1,
    day: state.clock.day,
    date,
    description,
    amount,
    balanceAfter: state.money.balance,
  }
  state.money.transactions.push(transaction)
  return transaction
}

function addEvent(state: GameState, description: string): LifeEvent {
  const event: LifeEvent = {
    id: state.events.length + 1,
    day: state.clock.day,
    date: state.currentDate,
    description,
  }
  state.events.push(event)
  return event
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
  context: DailySummaryContext = { openingState: state },
): TimeAdvanceResult {
  const stateError = gameStateError(state)
  if (stateError) return { ok: false, message: `Invalid game state: ${stateError}` }
  const openingStateError = gameStateError(context.openingState)
  if (openingStateError) {
    return { ok: false, message: `Invalid summary opening state: ${openingStateError}` }
  }
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
  const dailySummaries: DailySummary[] = []
  const transactionStartIndex = context.openingState.money.transactions.length
  const eventStartIndex = context.openingState.events.length
  let openingBalance = context.openingState.money.balance
  const needsChange = {
    hunger: state.player.hunger - context.openingState.player.hunger,
    energy: state.player.energy - context.openingState.player.energy,
    health: state.player.health - context.openingState.player.health,
  }

  for (let count = 0; count < crossedDays; count += 1) {
    const completedDate = next.currentDate
    const dayOpeningBalance = openingBalance
    const dayTransactions = next.money.transactions
      .slice(transactionStartIndex)
      .filter((transaction) => transaction.date === completedDate)
    let earnings = 0
    let expensesPaid = 0
    for (const transaction of dayTransactions) {
      openingBalance += transaction.amount
      if (transaction.amount > 0) earnings += transaction.amount
      else expensesPaid -= transaction.amount
    }

    const expensePaid = Math.min(next.money.balance, GAME_BALANCE.dailyExpense)
    const expenseUnpaid = GAME_BALANCE.dailyExpense - expensePaid
    if (expensePaid > 0) {
      const expense = addTransaction(
        next,
        'Daily living costs',
        completedDate,
        -expensePaid,
      )
      dayTransactions.push(expense)
      expensesPaid += expensePaid
    }
    next.money.unpaidLivingCostsTotal += expenseUnpaid
    if (!Number.isSafeInteger(next.money.unpaidLivingCostsTotal)) {
      return { ok: false, message: 'Unpaid living costs exceed the supported integer range.' }
    }
    if (expenseUnpaid > 0) {
      addEvent(
        next,
        `You could not pay ${expenseUnpaid.toLocaleString('en-US')} FCFA of the daily living costs.`,
      )
    }

    const followingDate = nextDate(completedDate)
    if (!followingDate) {
      return { ok: false, message: 'The simulation calendar cannot advance past year 9999.' }
    }
    next.currentDate = followingDate
    next.clock.day += 1
    const age = ageOnDate(next.birthDate, next.currentDate)
    if (age === null) return { ok: false, message: 'The simulation reached an invalid birthday.' }
    if (age > next.player.age) {
      next.player.age = age
      addEvent(next, `You celebrated your ${age}${ordinalSuffix(age)} birthday.`)
    }

    const dayEvents = next.events
      .slice(eventStartIndex)
      .filter((event) => event.date === completedDate)
    dailySummaries.push({
      dateCompleted: completedDate,
      dateNowCurrent: next.currentDate,
      openingBalance: dayOpeningBalance,
      closingBalance: next.money.balance,
      earnings,
      expensesPaid,
      expenseUnpaid,
      needsChange: count === 0
        ? { ...needsChange }
        : { hunger: 0, energy: 0, health: 0 },
      transactions: dayTransactions.map((transaction) => ({ ...transaction })),
      events: dayEvents.map((event) => ({ ...event })),
      educationMilestoneReached: count === 0
        && context.educationMilestoneReached === true,
    })
    openingBalance = next.money.balance
  }

  const advancedStateError = gameStateError(next)
  if (advancedStateError) {
    return { ok: false, message: `Time advance would create an invalid game state: ${advancedStateError}` }
  }
  return { ok: true, state: next, dailySummaries }
}
