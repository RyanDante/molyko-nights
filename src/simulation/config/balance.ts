import type { GameState, SkillName } from '../models/game'

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key))
    }
  }
  return value
}

export const STARTING_SCENARIO = deepFreeze<GameState>({
  player: {
    id: 'amara-001',
    name: 'Amara',
    age: 18,
    health: 90,
    energy: 85,
    hunger: 25,
    mood: 70,
  },
  money: {
    balance: 35_000,
    unpaidLivingCostsTotal: 0,
    transactions: [],
  },
  education: {
    level: 'Secondary school',
    studySessionsCompleted: 0,
  },
  skills: {
    business: 10,
    communication: 10,
    craft: 10,
  },
  employment: {
    status: 'unemployed',
    role: null,
    shiftsCompleted: 0,
  },
  clock: {
    day: 1,
    minuteOfDay: 8 * 60,
  },
  startDate: '2026-01-01',
  currentDate: '2026-01-01',
  birthDate: '2008-01-01',
  events: [],
  randomSeed: 7_319,
})

export const GAME_BALANCE = deepFreeze({
  dailyExpense: 1_500,
  education: {
    studySessionsForMilestone: 5,
    milestoneLevel: 'Tertiary studies',
  },
  action: {
    work: {
      durationMinutes: 240,
      energyCost: 28,
      hungerIncrease: 18,
      casualWageMin: 4_000,
      casualWageMax: 7_000,
      employedWage: 8_000,
      minimumEnergy: 20,
      employmentAfterShifts: 3,
      employmentRole: 'Cafe assistant',
      reducedEarningsAtHunger: 70,
      earningsReductionPercent: 25,
      healthPenaltyAtHunger: 90,
      hungerHealthPenalty: 2,
    },
    study: {
      durationMinutes: 120,
      energyCost: 12,
      hungerIncrease: 8,
      skillGain: 3,
      moodGain: 4,
      skillCap: 100,
    },
    rest: {
      durationMinutes: 480,
      energyGain: 45,
      healthGain: 2,
      hungerIncrease: 10,
      moodGain: 5,
    },
    eat: {
      durationMinutes: 30,
      cost: 1_000,
      hungerReduction: 35,
      energyGain: 5,
      moodGain: 3,
    },
  },
})

export const STUDY_SKILLS: readonly SkillName[] = Object.freeze([
  'business',
  'communication',
  'craft',
])

export function configurationError(configuration: unknown): string | null {
  if (typeof configuration !== 'object' || configuration === null) {
    return 'Game configuration must be an object.'
  }
  const value = configuration as Record<string, unknown>
  const action = value.action
  const education = value.education
  if (!Number.isSafeInteger(value.dailyExpense) || (value.dailyExpense as number) < 0
    || typeof action !== 'object' || action === null
    || typeof education !== 'object' || education === null) {
    return 'Daily expense or action configuration is invalid.'
  }
  const educationConfig = education as Record<string, unknown>
  if (!Number.isSafeInteger(educationConfig.studySessionsForMilestone)
    || (educationConfig.studySessionsForMilestone as number) <= 0
    || !isNonEmptyString(educationConfig.milestoneLevel)) {
    return 'Education milestone configuration is invalid.'
  }
  const actionConfig = action as Record<string, unknown>
  const numericFields: Record<string, string[]> = {
    work: [
      'durationMinutes', 'energyCost', 'hungerIncrease', 'casualWageMin',
      'casualWageMax', 'employedWage', 'minimumEnergy', 'employmentAfterShifts',
      'reducedEarningsAtHunger', 'earningsReductionPercent',
      'healthPenaltyAtHunger', 'hungerHealthPenalty',
    ],
    study: ['durationMinutes', 'energyCost', 'hungerIncrease', 'skillGain', 'moodGain', 'skillCap'],
    rest: ['durationMinutes', 'energyGain', 'healthGain', 'hungerIncrease', 'moodGain'],
    eat: ['durationMinutes', 'cost', 'hungerReduction', 'energyGain', 'moodGain'],
  }
  for (const name of ['work', 'study', 'rest', 'eat']) {
    const item = actionConfig[name]
    if (typeof item !== 'object' || item === null) return `Configuration for ${name} is invalid.`
    const fields = item as Record<string, unknown>
    for (const field of numericFields[name]) {
      if (!Number.isSafeInteger(fields[field]) || (fields[field] as number) < 0) {
        return `Configuration value ${name}.${field} must be a non-negative integer.`
      }
    }
    if (!Number.isSafeInteger(fields.durationMinutes)
      || (fields.durationMinutes as number) <= 0
      || (fields.durationMinutes as number) > 1_440) {
      return `Duration for ${name} must be from 1 to 1440 minutes.`
    }
  }
  const work = actionConfig.work as Record<string, unknown>
  const study = actionConfig.study as Record<string, unknown>
  const rest = actionConfig.rest as Record<string, unknown>
  const eat = actionConfig.eat as Record<string, unknown>
  if ((work.casualWageMin as number) < 0
    || (work.casualWageMax as number) < (work.casualWageMin as number)
    || (work.employedWage as number) < 0
    || (work.energyCost as number) < 0
    || (work.hungerIncrease as number) < 0
    || (work.minimumEnergy as number) < 0
    || (work.minimumEnergy as number) > 100
    || (work.employmentAfterShifts as number) <= 0
    || !isNonEmptyString(work.employmentRole)
    || (work.reducedEarningsAtHunger as number) < 0
    || (work.reducedEarningsAtHunger as number) > 100
    || (work.earningsReductionPercent as number) < 0
    || (work.earningsReductionPercent as number) > 100
    || (work.healthPenaltyAtHunger as number) < 0
    || (work.healthPenaltyAtHunger as number) > 100
    || (work.hungerHealthPenalty as number) < 0
    || (study.skillGain as number) < 0
    || (study.energyCost as number) > 100
    || (study.hungerIncrease as number) > 100
    || (study.moodGain as number) > 100
    || (study.skillCap as number) < 0
    || (study.skillCap as number) > 100
    || (rest.energyGain as number) < 0
    || (rest.energyGain as number) > 100
    || (rest.healthGain as number) < 0
    || (rest.healthGain as number) > 100
    || (rest.hungerIncrease as number) > 100
    || (rest.moodGain as number) > 100
    || (eat.cost as number) < 0
    || (eat.hungerReduction as number) < 0
    || (eat.hungerReduction as number) > 100
    || (eat.energyGain as number) > 100
    || (eat.moodGain as number) > 100
    || (work.energyCost as number) > 100
    || (work.hungerIncrease as number) > 100
    || (work.hungerHealthPenalty as number) > 100) {
    return 'Game balance contains an out-of-range action value.'
  }
  return null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
