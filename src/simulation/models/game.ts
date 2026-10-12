export type SkillName = 'business' | 'communication' | 'craft'

export interface Player {
  id: string
  name: string
  age: number
  health: number
  energy: number
  hunger: number
  mood: number
}

export interface Money {
  balance: number
  transactions: Transaction[]
}

export interface Transaction {
  id: number
  day: number
  date: string
  description: string
  amount: number
  balanceAfter: number
}

export interface Education {
  level: string
  studySessionsCompleted: number
}

export interface Employment {
  status: 'unemployed' | 'employed'
  role: string | null
  shiftsCompleted: number
}

export interface SimulationClock {
  day: number
  minuteOfDay: number
}

export interface LifeEvent {
  id: number
  day: number
  date: string
  description: string
}

export interface GameState {
  player: Player
  money: Money
  education: Education
  skills: Record<SkillName, number>
  employment: Employment
  clock: SimulationClock
  startDate: string
  currentDate: string
  birthDate: string
  events: LifeEvent[]
  randomSeed: number
}
