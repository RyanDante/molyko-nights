import type { GameState, SkillName } from '../models/game'

export const STARTING_SCENARIO: GameState = {
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
  events: [],
  randomSeed: 7_319,
}

export const GAME_BALANCE = {
  dailyExpense: 1_500,
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
} as const

export const STUDY_SKILLS: readonly SkillName[] = [
  'business',
  'communication',
  'craft',
]
