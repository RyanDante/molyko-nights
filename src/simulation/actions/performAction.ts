import { configurationError, GAME_BALANCE, STUDY_SKILLS } from '../config/balance'
import { copyGameState } from '../models/copy'
import { gameStateError } from '../models/validation'
import type { Action, ActionResult } from './types'
import type { GameState } from '../models/game'
import { nextRandom } from '../systems/random'
import { advanceSimulationTime } from '../systems/time'

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
    date: state.currentDate,
    description,
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

function reduceIntegerAmount(amount: number, reductionPercent: number): number {
  return Number((BigInt(amount) * BigInt(100 - reductionPercent)) / 100n)
}

function validateAction(state: GameState, action: unknown): string | null {
  if (typeof action !== 'object' || action === null || Array.isArray(action)) {
    return 'Invalid action.'
  }
  const payload = action as Record<string, unknown>
  const keys = Object.keys(payload)
  const isStudy = payload.type === 'study'
  if (
    (isStudy && (keys.length !== 2 || !keys.includes('skill')))
    || (!isStudy && (keys.length !== 1 || !keys.includes('type')))
  ) {
    return 'Action contains unexpected or missing fields.'
  }
  switch (payload.type) {
    case 'work':
      if (state.player.energy < GAME_BALANCE.action.work.minimumEnergy) {
        return 'You need more energy before you can work.'
      }
      break
    case 'study':
      if (!STUDY_SKILLS.includes(payload.skill as (typeof STUDY_SKILLS)[number])) {
        return 'That skill cannot be studied.'
      }
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
    default:
      return 'Unknown or malformed action.'
  }
  return null
}

export function performAction(state: GameState, action: Action): ActionResult {
  const stateError = gameStateError(state)
  if (stateError) return reject(state, `Invalid game state: ${stateError}`)
  const configError = configurationError(GAME_BALANCE)
  if (configError) return reject(state, `Invalid game configuration: ${configError}`)
  const validationMessage = validateAction(state, action)
  if (validationMessage) return reject(state, validationMessage)

  const next = copyGameState(state)
  let duration: number
  let message: string
  let progressionEvent: string | null = null
  let healthPenaltyEvent = false

  switch (action.type) {
    case 'work': {
      const config = GAME_BALANCE.action.work
      const hungerAtStart = next.player.hunger
      const random = nextRandom(next.randomSeed)
      next.randomSeed = random.seed
      const baseWage = next.employment.status === 'employed'
        ? config.employedWage
        : config.casualWageMin
          + Math.floor(random.value * (config.casualWageMax - config.casualWageMin + 1))
      const wage = hungerAtStart >= config.reducedEarningsAtHunger
        ? reduceIntegerAmount(baseWage, config.earningsReductionPercent)
        : baseWage
      addTransaction(next, 'Work shift', wage)
      next.employment.shiftsCompleted += 1
      next.player.energy = Math.max(0, next.player.energy - config.energyCost)
      next.player.hunger = Math.min(100, next.player.hunger + config.hungerIncrease)
      if (hungerAtStart >= config.healthPenaltyAtHunger) {
        next.player.health = Math.max(0, next.player.health - config.hungerHealthPenalty)
        healthPenaltyEvent = config.hungerHealthPenalty > 0
      }
      duration = config.durationMinutes
      message = `You earned ${wage.toLocaleString('en-US')} FCFA from a work shift.`
      if (healthPenaltyEvent) message += ' Working while very hungry affected your health.'
      if (
        next.employment.status === 'unemployed'
        && next.employment.shiftsCompleted >= config.employmentAfterShifts
      ) {
        next.employment.status = 'employed'
        next.employment.role = config.employmentRole
        progressionEvent = `You landed a job as a ${config.employmentRole}.`
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
      progressionEvent = `You completed a study session and improved your ${action.skill} skill.`
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

  const timeResult = advanceSimulationTime(next, duration)
  if (!timeResult.ok) return reject(state, timeResult.message)

  if (healthPenaltyEvent) {
    addEvent(timeResult.state, 'You lost health after working while very hungry.')
  }
  if (progressionEvent) addEvent(timeResult.state, progressionEvent)

  const resultStateError = gameStateError(timeResult.state)
  if (resultStateError) {
    return reject(state, `Action would create an invalid game state: ${resultStateError}`)
  }
  return { ok: true, state: timeResult.state, message }
}
