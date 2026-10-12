import { ageOnDate, daysBetween, isValidDate } from './calendar'
import type { GameState } from './game'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function gameStateError(value: unknown): string | null {
  if (!isRecord(value)) return 'Game state must be an object.'
  const player = value.player
  const money = value.money
  const education = value.education
  const skills = value.skills
  const employment = value.employment
  const clock = value.clock

  if (!isRecord(player) || !isRecord(money) || !isRecord(education)
    || !isRecord(skills) || !isRecord(employment) || !isRecord(clock)) {
    return 'Game state is missing a required section.'
  }
  if (!isNonEmptyString(player.id) || !isNonEmptyString(player.name)) {
    return 'Player identity is invalid.'
  }
  for (const attribute of ['health', 'energy', 'hunger', 'mood']) {
    if (!isIntegerBetween(player[attribute], 0, 100)) {
      return `Player ${attribute} must be an integer from 0 to 100.`
    }
  }
  if (!isIntegerBetween(player.age, 0, 9_999)) return 'Player age is invalid.'
  if (!isIntegerBetween(money.balance, 0, Number.MAX_SAFE_INTEGER)
    || !isIntegerBetween(money.unpaidLivingCostsTotal, 0, Number.MAX_SAFE_INTEGER)
    || !Array.isArray(money.transactions)) {
    return 'Money state must have non-negative integer FCFA balances and a transaction list.'
  }
  if (!isNonEmptyString(education.level)
    || !isIntegerBetween(education.studySessionsCompleted, 0, Number.MAX_SAFE_INTEGER)) {
    return 'Education state is invalid.'
  }
  for (const skill of ['business', 'communication', 'craft']) {
    if (!isIntegerBetween(skills[skill], 0, 100)) {
      return `Skill ${skill} must be an integer from 0 to 100.`
    }
  }
  if (!isIntegerBetween(employment.shiftsCompleted, 0, Number.MAX_SAFE_INTEGER)
    || (employment.status !== 'unemployed' && employment.status !== 'employed')
    || (employment.status === 'unemployed' && employment.role !== null)
    || (employment.status === 'employed' && !isNonEmptyString(employment.role))) {
    return 'Employment state is invalid.'
  }
  if (!isIntegerBetween(clock.day, 1, Number.MAX_SAFE_INTEGER)
    || !isIntegerBetween(clock.minuteOfDay, 0, 1_439)) {
    return 'Simulation clock is invalid.'
  }
  if (!isValidDate(value.startDate) || !isValidDate(value.currentDate)
    || !isValidDate(value.birthDate) || value.currentDate < value.startDate) {
    return 'Simulation dates must be valid ISO calendar dates.'
  }
  if (daysBetween(value.startDate, value.currentDate) !== clock.day - 1) {
    return 'Simulation day does not match its calendar date.'
  }
  if (ageOnDate(value.birthDate, value.currentDate) !== player.age) {
    return 'Player age does not match the birth date and current date.'
  }
  if (!isIntegerBetween(value.randomSeed, 0, 0xffff_ffff)) {
    return 'Random seed must be an unsigned 32-bit integer.'
  }

  let previousBalance: number | null = null
  let previousDay = 0
  let previousDate = value.startDate
  for (const [index, transaction] of money.transactions.entries()) {
    if (!isRecord(transaction)
      || transaction.id !== index + 1
      || !isIntegerBetween(transaction.day, 1, clock.day)
      || !isValidDate(transaction.date)
      || transaction.date < previousDate
      || transaction.date > value.currentDate
      || transaction.day < previousDay
      || daysBetween(value.startDate, transaction.date) !== transaction.day - 1
      || !isNonEmptyString(transaction.description)
      || !isIntegerBetween(transaction.amount, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)
      || !isIntegerBetween(transaction.balanceAfter, 0, Number.MAX_SAFE_INTEGER)) {
      return `Transaction ${index + 1} is invalid.`
    }
    if (previousBalance !== null
      && previousBalance + transaction.amount !== transaction.balanceAfter) {
      return `Transaction ${index + 1} has an inconsistent balance.`
    }
    previousBalance = transaction.balanceAfter
    previousDay = transaction.day
    previousDate = transaction.date
  }
  if (previousBalance !== null && previousBalance !== money.balance) {
    return 'Money balance does not match the latest transaction.'
  }

  if (!Array.isArray(value.events)) return 'Life-event history must be a list.'
  previousDay = 0
  previousDate = value.startDate
  for (const [index, event] of value.events.entries()) {
    if (!isRecord(event)
      || event.id !== index + 1
      || !isIntegerBetween(event.day, 1, clock.day)
      || !isValidDate(event.date)
      || event.date < previousDate
      || event.date > value.currentDate
      || event.day < previousDay
      || daysBetween(value.startDate, event.date) !== event.day - 1
      || !isNonEmptyString(event.description)) {
      return `Life event ${index + 1} is invalid.`
    }
    previousDay = event.day
    previousDate = event.date
  }
  return null
}

export function isGameState(value: unknown): value is GameState {
  return gameStateError(value) === null
}
