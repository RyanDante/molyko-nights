import { GAME_BALANCE, STUDY_SKILLS } from '../config/balance'
import type { Action, ActionResult } from './types'
import type { GameState } from '../models/game'
import { nextRandom } from '../systems/random'

function reject(state: GameState, message: string): ActionResult {
  return { ok: false, state, message }
}

function addTransaction(
  state: GameState,
  description: string,
  amount: number,
): void {
  state.money.balance += amount
  state.money.transactions.push({
    id: state.money.transactions.length + 1,
    day: state.clock.day,
    description,
    amount,
    balanceAfter: state.money.balance,
  })
}

function addEvent(state: GameState, description: string): void {
  state.events.push({
    id: state.events.length + 1,
    day: state.clock.day,
    description,
  })
}

function advanceTime(state: GameState, durationMinutes: number): void {
  const totalMinutes = state.clock.minuteOfDay + durationMinutes
  const crossedDays = Math.floor(totalMinutes / (24 * 60))
  state.clock.day += crossedDays
  state.clock.minuteOfDay = totalMinutes % (24 * 60)

  for (let day = 0; day < crossedDays; day += 1) {
    const balanceBeforeExpense = state.money.balance
    addTransaction(state, 'Daily living costs', -GAME_BALANCE.dailyExpense)
    addEvent(state, `Paid ${GAME_BALANCE.dailyExpense.toLocaleString('en-US')} FCFA in daily living costs.`)
    if (balanceBeforeExpense === GAME_BALANCE.dailyExpense) {
      addEvent(state, 'Your money ran out after covering daily living costs.')
    }
  }
}

function validate(state: GameState, action: Action): string | null {
  switch (action.type) {
    case 'work':
      if (state.player.energy < GAME_BALANCE.action.work.minimumEnergy) {
        return 'You need more energy before you can work.'
      }
      break
    case 'study':
      if (!STUDY_SKILLS.includes(action.skill)) return 'That skill cannot be studied.'
      if (state.player.energy < GAME_BALANCE.action.study.energyCost) {
        return 'You need more energy before you can study.'
      }
      break
    case 'rest':
      break
    case 'eat':
      if (state.money.balance < GAME_BALANCE.action.eat.cost) {
        return 'You do not have enough money for a meal.'
      }
      break
    default: {
      const exhaustive: never = action
      return `Unknown action: ${String(exhaustive)}`
    }
  }
  return null
}

export function performAction(state: GameState, action: Action): ActionResult {
  const validationMessage = validate(state, action)
  if (validationMessage) return reject(state, validationMessage)

  const next: GameState = {
    ...state,
    player: { ...state.player },
    money: { ...state.money, transactions: [...state.money.transactions] },
    education: { ...state.education },
    skills: { ...state.skills },
    employment: { ...state.employment },
    clock: { ...state.clock },
    events: [...state.events],
  }
  let duration: number
  let message: string

  switch (action.type) {
    case 'work': {
      const config = GAME_BALANCE.action.work
      const random = nextRandom(next.randomSeed)
      next.randomSeed = random.seed
      const wage = next.employment.status === 'employed'
        ? config.employedWage
        : config.casualWageMin
          + Math.floor(random.value * (config.casualWageMax - config.casualWageMin + 1))
      addTransaction(next, 'Work shift', wage)
      next.employment.shiftsCompleted += 1
      next.player.energy = Math.max(0, next.player.energy - config.energyCost)
      next.player.hunger = Math.min(100, next.player.hunger + config.hungerIncrease)
      duration = config.durationMinutes
      message = `You earned ${wage.toLocaleString('en-US')} FCFA from a work shift.`
      if (
        next.employment.status === 'unemployed'
        && next.employment.shiftsCompleted >= config.employmentAfterShifts
      ) {
        next.employment.status = 'employed'
        next.employment.role = config.employmentRole
        addEvent(next, `You landed a job as a ${config.employmentRole}.`)
        message += ` You are now employed as a ${config.employmentRole}.`
      }
      break
    }
    case 'study': {
      const config = GAME_BALANCE.action.study
      next.player.energy = Math.max(0, next.player.energy - config.energyCost)
      next.player.hunger = Math.min(100, next.player.hunger + config.hungerIncrease)
      next.player.mood = Math.min(100, next.player.mood + config.moodGain)
      next.skills[action.skill] = Math.min(
        config.skillCap,
        next.skills[action.skill] + config.skillGain,
      )
      next.education.studySessionsCompleted += 1
      duration = config.durationMinutes
      message = `You studied ${action.skill} and improved your skill.`
      break
    }
    case 'rest': {
      const config = GAME_BALANCE.action.rest
      next.player.energy = Math.min(100, next.player.energy + config.energyGain)
      next.player.health = Math.min(100, next.player.health + config.healthGain)
      next.player.hunger = Math.min(100, next.player.hunger + config.hungerIncrease)
      next.player.mood = Math.min(100, next.player.mood + config.moodGain)
      duration = config.durationMinutes
      message = 'You rested and recovered some energy.'
      break
    }
    case 'eat': {
      const config = GAME_BALANCE.action.eat
      addTransaction(next, 'A meal', -config.cost)
      next.player.hunger = Math.max(0, next.player.hunger - config.hungerReduction)
      next.player.energy = Math.min(100, next.player.energy + config.energyGain)
      next.player.mood = Math.min(100, next.player.mood + config.moodGain)
      duration = config.durationMinutes
      message = 'You had a meal and feel a little better.'
      break
    }
  }

  advanceTime(next, duration)

  if (next.money.balance < 0) {
    return reject(
      state,
      'You cannot cover the daily living costs required before this action ends.',
    )
  }

  return { ok: true, state: next, message }
}
