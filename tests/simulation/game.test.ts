import { describe, expect, it } from 'vitest'
import {
  advanceSimulationTime,
  createGame,
  GAME_BALANCE,
  performAction,
  STARTING_SCENARIO,
  validateConfiguration,
  type Action,
} from '../../src/simulation'

describe('life simulation', () => {
  it('initializes an independent 18-year-old in Molyko', () => {
    const game = createGame()
    expect(game.player.age).toBe(18)
    expect(game.money.balance).toBe(35_000)
    expect(game.clock).toEqual({ day: 1, minuteOfDay: 480 })
    expect(game.currentDate).toBe('2026-01-01')
    expect(game.birthDate).toBe('2008-01-01')
    expect(game.events[0]?.description).toContain('Molyko')
    expect(game.money.transactions).toEqual([])
  })

  it('applies study, skill, needs, and time changes', () => {
    const game = createGame()
    const result = performAction(game, { type: 'study', skill: 'business' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.skills.business).toBe(game.skills.business + GAME_BALANCE.action.study.skillGain)
    expect(result.state.player.energy).toBe(game.player.energy - GAME_BALANCE.action.study.energyCost)
    expect(result.state.education.studySessionsCompleted).toBe(1)
    expect(result.state.clock.minuteOfDay).toBe(600)
    expect(result.state.money.balance).toBe(game.money.balance)
    expect(result.state.events.at(-1)).toMatchObject({
      id: 2,
      date: result.state.currentDate,
      day: result.state.clock.day,
    })
    expect(result.state.events.at(-1)?.description).toContain('study session')
  })

  it('charges a meal in whole FCFA and improves hunger', () => {
    const game = createGame()
    const result = performAction(game, { type: 'eat' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.money.balance).toBe(game.money.balance - GAME_BALANCE.action.eat.cost)
    expect(result.state.money.transactions[0]?.amount).toBe(-GAME_BALANCE.action.eat.cost)
    expect(Number.isInteger(result.state.money.balance)).toBe(true)
    expect(result.state.player.hunger).toBeLessThan(game.player.hunger)
  })

  it('rejects unaffordable meals without mutating the input state', () => {
    const game = createGame()
    game.money.balance = GAME_BALANCE.action.eat.cost - 1
    const before = structuredClone(game)
    const result = performAction(game, { type: 'eat' })
    expect(result.ok).toBe(false)
    expect(result.state).toBe(game)
    expect(game).toEqual(before)
  })

  it('rejects an action if its elapsed time would cause unpaid living costs', () => {
    const game = createGame()
    game.clock.minuteOfDay = 23 * 60
    game.money.balance = GAME_BALANCE.dailyExpense - 1
    const before = structuredClone(game)
    const result = performAction(game, { type: 'rest' })
    expect(result.ok).toBe(false)
    expect(result.state).toBe(game)
    expect(game).toEqual(before)
  })

  it('charges exactly at midnight without logging routine expenses as life events', () => {
    const game = createGame()
    game.clock.minuteOfDay = 23 * 60
    const result = performAction(game, { type: 'rest' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.clock).toEqual({ day: 2, minuteOfDay: 420 })
    expect(result.state.currentDate).toBe('2026-01-02')
    expect(result.state.money.balance).toBe(game.money.balance - GAME_BALANCE.dailyExpense)
    expect(result.state.money.transactions[0]).toMatchObject({
      amount: -GAME_BALANCE.dailyExpense,
      date: '2026-01-02',
      day: 2,
      balanceAfter: result.state.money.balance,
    })
    expect(result.state.events).toHaveLength(1)
  })

  it('repeats work outcomes from the same seed and grants employment after three shifts', () => {
    const playThreeShifts = () => {
      let game = createGame(42)
      const wages: number[] = []
      for (let shift = 0; shift < 3; shift += 1) {
        const result = performAction(game, { type: 'work' })
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(result.message)
        game = result.state
        wages.push(game.money.transactions.at(-1)!.amount)
      }
      return { game, wages }
    }

    const first = playThreeShifts()
    const second = playThreeShifts()
    expect(first.wages).toEqual(second.wages)
    expect(first.game.employment).toEqual({
      status: 'employed',
      role: GAME_BALANCE.action.work.employmentRole,
      shiftsCompleted: GAME_BALANCE.action.work.employmentAfterShifts,
    })
    expect(first.game.events.at(-1)?.description).toContain('landed a job')
    expect(first.game.events.at(-1)?.date).toBe(first.game.currentDate)
    expect(first.game.events.at(-1)?.day).toBe(first.game.clock.day)
  })

  it('does not mutate state on rejected low-energy work', () => {
    const game = createGame()
    game.player.energy = 0
    const before = structuredClone(game)
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(false)
    expect(game).toEqual(before)
  })

  it('isolates nested history records between successful state snapshots', () => {
    const firstResult = performAction(createGame(), { type: 'eat' })
    expect(firstResult.ok).toBe(true)
    if (!firstResult.ok) return
    const olderSnapshot = structuredClone(firstResult.state)
    const secondResult = performAction(firstResult.state, { type: 'study', skill: 'business' })
    expect(secondResult.ok).toBe(true)
    if (!secondResult.ok) return

    secondResult.state.money.transactions[0]!.description = 'mutated later snapshot'
    secondResult.state.events[0]!.description = 'mutated later snapshot'
    expect(firstResult.state).toEqual(olderSnapshot)
  })

  it('rejects invalid state and malformed action payloads without changing the state', () => {
    const invalidGame = createGame()
    invalidGame.player.hunger = 101
    const invalidBefore = structuredClone(invalidGame)
    const invalidResult = performAction(invalidGame, { type: 'rest' })
    expect(invalidResult.ok).toBe(false)
    expect(invalidResult.message).toContain('Invalid game state')
    expect(invalidGame).toEqual(invalidBefore)

    for (const malformed of [null, {}, { type: 'teleport' }, { type: 'study' }]) {
      const game = createGame()
      const before = structuredClone(game)
      const result = performAction(game, malformed as Action)
      expect(result.ok).toBe(false)
      expect(game).toEqual(before)
    }
  })

  it('rejects invalid dates, non-integer FCFA, and invalid seeds', () => {
    const fractionalMoney = createGame()
    fractionalMoney.money.balance = 1_000.5
    expect(performAction(fractionalMoney, { type: 'eat' }).message).toContain('Invalid game state')

    const invalidDate = createGame()
    invalidDate.currentDate = '2026-02-30'
    expect(performAction(invalidDate, { type: 'rest' }).message).toContain('Invalid game state')

    expect(() => createGame(Number.NaN)).toThrow('Random seed must be a safe integer.')
  })

  it('rejects a successful-action result that would overflow integer FCFA', () => {
    const game = createGame()
    game.money.balance = Number.MAX_SAFE_INTEGER
    const before = structuredClone(game)
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('Invalid game state')
    expect(result.state).toBe(game)
    expect(game).toEqual(before)
  })

  it('validates configuration and freezes public balance/scenario objects', () => {
    const invalidConfiguration = {
      ...GAME_BALANCE,
      action: {
        ...GAME_BALANCE.action,
        work: { ...GAME_BALANCE.action.work, durationMinutes: 0 },
      },
    }
    expect(validateConfiguration(invalidConfiguration)).toContain('Duration for work')
    expect(validateConfiguration(GAME_BALANCE)).toBeNull()
    expect(Object.isFrozen(STARTING_SCENARIO)).toBe(true)
    expect(Object.isFrozen(STARTING_SCENARIO.player)).toBe(true)
    expect(Object.isFrozen(GAME_BALANCE.action.work)).toBe(true)
    expect(Reflect.set(STARTING_SCENARIO.player, 'age', 99)).toBe(false)
  })

  it('keeps needs and skills within configured attribute bounds', () => {
    const rested = createGame()
    rested.player.energy = 90
    rested.player.health = 99
    rested.player.hunger = 99
    rested.player.mood = 99
    const restResult = performAction(rested, { type: 'rest' })
    expect(restResult.ok).toBe(true)
    if (restResult.ok) {
      expect(restResult.state.player).toMatchObject({
        energy: 100,
        health: 100,
        hunger: 100,
        mood: 100,
      })
    }

    const studied = createGame()
    studied.player.energy = 50
    studied.player.hunger = 98
    studied.skills.business = 99
    const studyResult = performAction(studied, { type: 'study', skill: 'business' })
    expect(studyResult.ok).toBe(true)
    if (studyResult.ok) {
      expect(studyResult.state.skills.business).toBe(100)
      expect(studyResult.state.player.hunger).toBe(100)
    }

    const fed = createGame()
    fed.player.hunger = 10
    fed.player.energy = 99
    fed.player.mood = 99
    const eatResult = performAction(fed, { type: 'eat' })
    expect(eatResult.ok).toBe(true)
    if (eatResult.ok) {
      expect(eatResult.state.player).toMatchObject({ hunger: 0, energy: 100, mood: 100 })
    }
  })

  it.each([69, 70, 71])('applies the reduced-earnings boundary at starting hunger %i', (hunger) => {
    const game = createGame(42)
    game.player.hunger = hunger
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expectedBaseWage = 4_000 + Math.floor(
      ((Math.imul(42, 1_664_525) + 1_013_904_223) >>> 0) / 4_294_967_296
      * (GAME_BALANCE.action.work.casualWageMax - GAME_BALANCE.action.work.casualWageMin + 1),
    )
    const expected = hunger < 70 ? expectedBaseWage : Math.floor(expectedBaseWage * 0.75)
    expect(result.state.money.transactions[0]?.amount).toBe(expected)
    expect(Number.isInteger(result.state.money.transactions[0]?.amount)).toBe(true)
  })

  it.each([89, 90, 91])('applies the health penalty boundary at starting hunger %i', (hunger) => {
    const game = createGame(42)
    game.player.hunger = hunger
    const initialHealth = game.player.health
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expectedPenalty = hunger < 90 ? 0 : GAME_BALANCE.action.work.hungerHealthPenalty
    expect(result.state.player.health).toBe(initialHealth - expectedPenalty)
    expect(result.state.events.some((event) => event.description.includes('very hungry')))
      .toBe(expectedPenalty > 0)
  })

  it('charges every crossed midnight exactly once during multi-day advancement', () => {
    const game = createGame()
    const result = advanceSimulationTime(game, 3 * 24 * 60 + 5)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.currentDate).toBe('2026-01-04')
    expect(result.state.clock).toEqual({ day: 4, minuteOfDay: 8 * 60 + 5 })
    expect(result.state.money.transactions).toHaveLength(3)
    expect(result.state.money.transactions.map((transaction) => transaction.date))
      .toEqual(['2026-01-02', '2026-01-03', '2026-01-04'])
    expect(result.state.money.balance).toBe(game.money.balance - 3 * GAME_BALANCE.dailyExpense)
  })

  it('advances age at a year boundary and on leap-day birthdays', () => {
    const yearBoundary = createGame()
    yearBoundary.startDate = '2026-12-31'
    yearBoundary.currentDate = '2026-12-31'
    yearBoundary.birthDate = '2008-01-01'
    yearBoundary.player.age = 18
    yearBoundary.events[0]!.date = yearBoundary.currentDate
    const newYear = advanceSimulationTime(yearBoundary, 1_440)
    expect(newYear.ok).toBe(true)
    if (newYear.ok) {
      expect(newYear.state.currentDate).toBe('2027-01-01')
      expect(newYear.state.player.age).toBe(19)
      expect(newYear.state.events.at(-1)?.description).toContain('19th birthday')
    }

    const leapDay = createGame()
    leapDay.startDate = '2024-02-28'
    leapDay.currentDate = '2024-02-28'
    leapDay.birthDate = '2000-02-29'
    leapDay.player.age = 23
    leapDay.events[0]!.date = leapDay.currentDate
    const leapBirthday = advanceSimulationTime(leapDay, 1_440)
    expect(leapBirthday.ok).toBe(true)
    if (leapBirthday.ok) {
      expect(leapBirthday.state.currentDate).toBe('2024-02-29')
      expect(leapBirthday.state.player.age).toBe(24)
    }

    const nonLeapYear = createGame()
    nonLeapYear.startDate = '2025-02-27'
    nonLeapYear.currentDate = '2025-02-27'
    nonLeapYear.birthDate = '2000-02-29'
    nonLeapYear.player.age = 24
    nonLeapYear.events[0]!.date = nonLeapYear.currentDate
    const februaryBirthday = advanceSimulationTime(nonLeapYear, 1_440)
    expect(februaryBirthday.ok).toBe(true)
    if (februaryBirthday.ok) {
      expect(februaryBirthday.state.currentDate).toBe('2025-02-28')
      expect(februaryBirthday.state.player.age).toBe(25)
    }
  })

  it('rejects zero, negative, fractional, and excessive time advances unchanged', () => {
    const game = createGame()
    const before = structuredClone(game)
    for (const duration of [0, -1, 1.5, 366 * 24 * 60]) {
      const result = advanceSimulationTime(game, duration)
      expect(result.ok).toBe(false)
      expect(game).toEqual(before)
    }
  })

  it('produces the same complete state for identical seeds and action sequences', () => {
    const play = () => {
      let game = createGame(42)
      const actions: Action[] = [
        { type: 'study', skill: 'business' },
        { type: 'work' },
        { type: 'eat' },
        { type: 'rest' },
        { type: 'work' },
      ]
      for (const action of actions) {
        const result = performAction(game, action)
        expect(result.ok).toBe(true)
        if (!result.ok) throw new Error(result.message)
        game = result.state
      }
      return game
    }
    expect(play()).toEqual(play())
  })

  it('documents profitable behavior in a repeated work, rest, and eat loop', () => {
    let game = createGame(42)
    while (game.clock.day < 31) {
      const action: Action = game.player.energy < 35
        ? { type: 'rest' }
        : game.player.hunger >= 70
          ? { type: 'eat' }
          : { type: 'work' }
      const result = performAction(game, action)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(result.message)
      game = result.state
    }
    expect(Number.isInteger(game.money.balance)).toBe(true)
    expect(game.money.balance).toBeGreaterThan(35_000)
  })
})
