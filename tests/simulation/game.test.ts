import { describe, expect, it } from 'vitest'
import {
  advanceSimulationTime,
  createGame,
  GAME_BALANCE,
  isEligibleForEmployment,
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
    expect(result.dailySummaries).toEqual([])
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

  it('records a partially unpaid living expense without rejecting the action', () => {
    const game = createGame()
    game.clock.minuteOfDay = 23 * 60
    game.money.balance = 1_000
    const result = performAction(game, { type: 'rest' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.clock).toEqual({ day: 2, minuteOfDay: 420 })
    expect(result.state.money.balance).toBe(0)
    expect(result.state.money.unpaidLivingCostsTotal).toBe(500)
    expect(result.state.money.transactions[0]).toMatchObject({
      amount: -1_000,
      date: '2026-01-01',
      day: 1,
      balanceAfter: 0,
    })
    expect(result.dailySummaries[0]).toMatchObject({
      dateCompleted: '2026-01-01',
      dateNowCurrent: '2026-01-02',
      openingBalance: 1_000,
      closingBalance: 0,
      expensesPaid: 1_000,
      expenseUnpaid: 500,
    })
    expect(result.dailySummaries[0]?.events).toHaveLength(1)
    expect(result.dailySummaries[0]?.events[0]?.date).toBe('2026-01-01')
  })

  it('charges expenses against the completed date and returns its summary at midnight', () => {
    const game = createGame()
    game.clock.minuteOfDay = 16 * 60
    const result = performAction(game, { type: 'rest' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.clock).toEqual({ day: 2, minuteOfDay: 0 })
    expect(result.state.currentDate).toBe('2026-01-02')
    expect(result.state.money.balance).toBe(game.money.balance - GAME_BALANCE.dailyExpense)
    expect(result.state.money.transactions[0]).toMatchObject({
      amount: -GAME_BALANCE.dailyExpense,
      date: '2026-01-01',
      day: 1,
      balanceAfter: result.state.money.balance,
    })
    expect(result.state.events).toHaveLength(1)
    expect(result.dailySummaries).toHaveLength(1)
    expect(result.dailySummaries[0]).toMatchObject({
      dateCompleted: '2026-01-01',
      dateNowCurrent: '2026-01-02',
      openingBalance: game.money.balance,
      closingBalance: result.state.money.balance,
      expensesPaid: GAME_BALANCE.dailyExpense,
      expenseUnpaid: 0,
      needsChange: {
        hunger: GAME_BALANCE.action.rest.hungerIncrease,
        energy: 100 - game.player.energy,
        health: GAME_BALANCE.action.rest.healthGain,
      },
    })
    expect(result.dailySummaries[0]?.transactions[0]?.date).toBe('2026-01-01')
  })

  it('returns no daily summary before a day is closed', () => {
    const result = performAction(createGame(), { type: 'eat' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.dailySummaries).toEqual([])
  })

  it('reconciles action income, expenses, and balances in the closing-day summary', () => {
    const game = createGame(42)
    game.clock.minuteOfDay = 20 * 60
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const summary = result.dailySummaries[0]
    expect(summary).toBeDefined()
    expect(summary?.dateCompleted).toBe('2026-01-01')
    expect(summary?.earnings).toBe(summary?.transactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((total, transaction) => total + transaction.amount, 0))
    expect(summary?.expensesPaid).toBe(summary?.transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((total, transaction) => total - transaction.amount, 0))
    expect(summary?.openingBalance).toBe(game.money.balance)
    expect(summary?.closingBalance).toBe(
      summary!.openingBalance + summary!.earnings - summary!.expensesPaid,
    )
    expect(summary?.closingBalance).toBe(result.state.money.balance)
  })

  it('summarizes an action that ends after midnight against the date it started', () => {
    const game = createGame(42)
    game.clock.minuteOfDay = 21 * 60
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.currentDate).toBe('2026-01-02')
    expect(result.state.clock.minuteOfDay).toBe(60)
    expect(result.dailySummaries).toHaveLength(1)
    expect(result.dailySummaries[0]).toMatchObject({
      dateCompleted: '2026-01-01',
      dateNowCurrent: '2026-01-02',
    })
    expect(result.dailySummaries[0]?.transactions.every((transaction) =>
      transaction.date === '2026-01-01',
    )).toBe(true)
  })

  it('keeps unpaid costs cumulative without creating negative balances over multiple days', () => {
    const game = createGame()
    game.money.balance = 0
    const result = advanceSimulationTime(game, 2 * 24 * 60)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.money.balance).toBe(0)
    expect(result.state.money.unpaidLivingCostsTotal).toBe(2 * GAME_BALANCE.dailyExpense)
    expect(result.state.money.transactions).toEqual([])
    expect(result.state.events.filter((event) => event.description.includes('could not pay')))
      .toHaveLength(2)
    expect(result.dailySummaries.map((summary) => summary.expenseUnpaid))
      .toEqual([GAME_BALANCE.dailyExpense, GAME_BALANCE.dailyExpense])
    expect(result.dailySummaries.map((summary) => summary.closingBalance)).toEqual([0, 0])
  })

  it('isolates summary history from the returned game state', () => {
    const game = createGame()
    game.clock.minuteOfDay = 20 * 60
    game.player.hunger = 90
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const originalTransaction = structuredClone(result.state.money.transactions[0])
    const originalEvent = structuredClone(result.state.events[0])
    result.dailySummaries[0]!.transactions[0]!.description = 'changed summary'
    result.dailySummaries[0]!.events.push({
      id: 999,
      day: 1,
      date: '2026-01-01',
      description: 'summary-only event',
    })
    expect(result.state.money.transactions[0]).toEqual(originalTransaction)
    expect(result.state.events[0]).toEqual(originalEvent)
  })

  it('keeps the third shift casual and derives job eligibility from completed shifts', () => {
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
    expect(GAME_BALANCE.action.work).toMatchObject({
      casualWageMin: 4_000,
      casualWageMax: 7_000,
      employedWage: 8_000,
      durationMinutes: 240,
      energyCost: 28,
      hungerIncrease: 18,
    })
    expect(first.wages.every((wage) => wage >= 4_000 && wage <= 7_000)).toBe(true)
    expect(first.game.employment).toEqual({
      status: 'unemployed',
      role: null,
      shiftsCompleted: 3,
    })
    expect(isEligibleForEmployment(first.game)).toBe(true)
    expect(first.game.events).toHaveLength(1)
    expect(first.game.events.some((event) => event.description.includes('job'))).toBe(false)
  })

  it('accepts eligible employment atomically without advancing time or changing finances and needs', () => {
    let game = createGame(42)
    for (let shift = 0; shift < GAME_BALANCE.action.work.employmentAfterShifts; shift += 1) {
      const workResult = performAction(game, { type: 'work' })
      expect(workResult.ok).toBe(true)
      if (!workResult.ok) throw new Error(workResult.message)
      game = workResult.state
    }
    const before = structuredClone(game)
    const result = performAction(game, { type: 'acceptEmployment' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(game).toEqual(before)
    expect(result.state.employment).toEqual({
      status: 'employed',
      role: GAME_BALANCE.action.work.employmentRole,
      shiftsCompleted: GAME_BALANCE.action.work.employmentAfterShifts,
    })
    expect(result.state.clock).toEqual(before.clock)
    expect(result.state.currentDate).toBe(before.currentDate)
    expect(result.state.player).toEqual(before.player)
    expect(result.state.money).toEqual(before.money)
    expect(result.state.randomSeed).toBe(before.randomSeed)
    expect(result.dailySummaries).toEqual([])
    expect(result.state.events).toHaveLength(before.events.length + 1)
    expect(result.state.events.at(-1)).toMatchObject({
      id: before.events.length + 1,
      day: before.clock.day,
      date: before.currentDate,
      description: `You accepted a job as a ${GAME_BALANCE.action.work.employmentRole}.`,
    })

    const acceptedState = structuredClone(result.state)
    result.state.money.transactions[0]!.description = 'mutated accepted snapshot'
    result.state.events[0]!.description = 'mutated accepted snapshot'
    expect(game).toEqual(before)
    expect(game.money.transactions[0]).toEqual(before.money.transactions[0])
    expect(game.events[0]).toEqual(before.events[0])
    expect(result.state.employment.status).toBe(acceptedState.employment.status)
  })

  it('rejects ineligible, repeated, and malformed employment acceptance without mutation', () => {
    const ineligible = createGame()
    ineligible.employment.shiftsCompleted = GAME_BALANCE.action.work.employmentAfterShifts - 1
    const ineligibleBefore = structuredClone(ineligible)
    const ineligibleResult = performAction(ineligible, { type: 'acceptEmployment' })
    expect(ineligibleResult.ok).toBe(false)
    expect(ineligibleResult.state).toBe(ineligible)
    expect(ineligible).toEqual(ineligibleBefore)

    const eligible = createGame()
    eligible.employment.shiftsCompleted = GAME_BALANCE.action.work.employmentAfterShifts
    const accepted = performAction(eligible, { type: 'acceptEmployment' })
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    const employedBefore = structuredClone(accepted.state)
    const repeatedResult = performAction(accepted.state, { type: 'acceptEmployment' })
    expect(repeatedResult.ok).toBe(false)
    expect(repeatedResult.state).toBe(accepted.state)
    expect(accepted.state).toEqual(employedBefore)

    const malformedResult = performAction(
      eligible,
      { type: 'acceptEmployment', role: 'another job' } as Action,
    )
    expect(malformedResult.ok).toBe(false)
    expect(eligible.employment.status).toBe('unemployed')
    expect(eligible.employment.role).toBeNull()
  })

  it('preserves employment-state invariants for status, role, and shift count', () => {
    const invalidEmploymentStates = [
      { status: 'employed', role: null, shiftsCompleted: 3 },
      { status: 'employed', role: 'Another role', shiftsCompleted: 3 },
      { status: 'employed', role: GAME_BALANCE.action.work.employmentRole, shiftsCompleted: 2 },
      { status: 'on_leave', role: null, shiftsCompleted: 0 },
    ]
    for (const employment of invalidEmploymentStates) {
      const game = createGame()
      game.employment = employment as typeof game.employment
      const before = structuredClone(game)
      const result = performAction(game, { type: 'rest' })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('Invalid game state')
      expect(game).toEqual(before)
    }
  })

  it.each([69, 70, 89, 90])('preserves employed wage and hunger penalties at hunger %i', (hunger) => {
    const game = createGame(42)
    game.employment = {
      status: 'employed',
      role: GAME_BALANCE.action.work.employmentRole,
      shiftsCompleted: GAME_BALANCE.action.work.employmentAfterShifts,
    }
    game.player.energy = 100
    game.player.hunger = hunger
    const expectedSeed = (Math.imul(game.randomSeed, 1_664_525) + 1_013_904_223) >>> 0
    const initialHealth = game.player.health
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.money.transactions[0]?.amount).toBe(hunger < 70 ? 8_000 : 6_000)
    expect(result.state.randomSeed).toBe(expectedSeed)
    expect(result.state.player.health).toBe(hunger < 90
      ? initialHealth
      : initialHealth - GAME_BALANCE.action.work.hungerHealthPenalty)
    expect(result.state.employment.shiftsCompleted).toBe(
      GAME_BALANCE.action.work.employmentAfterShifts + 1,
    )
  })

  it('records employed work, daily costs, and summary totals through the shared accounting path', () => {
    const game = createGame(42)
    game.employment = {
      status: 'employed',
      role: GAME_BALANCE.action.work.employmentRole,
      shiftsCompleted: GAME_BALANCE.action.work.employmentAfterShifts,
    }
    game.clock.minuteOfDay = 20 * 60
    game.player.energy = 100
    game.player.hunger = 25
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.state.currentDate).toBe('2026-01-02')
    expect(result.state.money.transactions.map(({ amount, description }) => ({ amount, description })))
      .toEqual([
        { amount: 8_000, description: 'Work shift' },
        { amount: -GAME_BALANCE.dailyExpense, description: 'Daily living costs' },
      ])
    expect(result.dailySummaries).toHaveLength(1)
    expect(result.dailySummaries[0]).toMatchObject({
      dateCompleted: '2026-01-01',
      earnings: 8_000,
      expensesPaid: GAME_BALANCE.dailyExpense,
      expenseUnpaid: 0,
      closingBalance: game.money.balance + 8_000 - GAME_BALANCE.dailyExpense,
    })
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
    expect(validateConfiguration({
      ...GAME_BALANCE,
      education: { ...GAME_BALANCE.education, studySessionsForMilestone: 0 },
    })).toContain('Education milestone')
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
      .toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(result.dailySummaries.map((summary) => summary.dateCompleted))
      .toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(result.dailySummaries.map((summary) => summary.dateNowCurrent))
      .toEqual(['2026-01-02', '2026-01-03', '2026-01-04'])
    expect(result.dailySummaries.map((summary) => summary.expensesPaid))
      .toEqual([
        GAME_BALANCE.dailyExpense,
        GAME_BALANCE.dailyExpense,
        GAME_BALANCE.dailyExpense,
      ])
    expect(result.dailySummaries.map((summary) => summary.closingBalance))
      .toEqual([
        game.money.balance - GAME_BALANCE.dailyExpense,
        game.money.balance - 2 * GAME_BALANCE.dailyExpense,
        result.state.money.balance,
      ])
    expect(result.state.money.balance).toBe(game.money.balance - 3 * GAME_BALANCE.dailyExpense)
    expect(result.dailySummaries[1]?.needsChange).toEqual({ hunger: 0, energy: 0, health: 0 })
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

  it('advances education on the fifth successful study session exactly once', () => {
    let game = createGame()
    const milestoneEventsBefore = () => game.events.filter((event) =>
      event.description.includes('advanced your education'),
    ).length
    for (let session = 1; session <= GAME_BALANCE.education.studySessionsForMilestone; session += 1) {
      const result = performAction(game, { type: 'study', skill: 'business' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      game = result.state
      if (session < GAME_BALANCE.education.studySessionsForMilestone) {
        expect(game.education.level).toBe(STARTING_SCENARIO.education.level)
        expect(milestoneEventsBefore()).toBe(0)
      }
    }
    expect(game.education.studySessionsCompleted).toBe(5)
    expect(game.education.level).toBe(GAME_BALANCE.education.milestoneLevel)
    expect(milestoneEventsBefore()).toBe(1)

    const furtherStudy = performAction(game, { type: 'study', skill: 'business' })
    expect(furtherStudy.ok).toBe(true)
    if (furtherStudy.ok) {
      expect(furtherStudy.state.education.studySessionsCompleted).toBe(6)
      expect(furtherStudy.state.events.filter((event) =>
        event.description.includes('advanced your education'),
      )).toHaveLength(1)
    }
  })

  it('includes the education milestone event in a closing-day summary', () => {
    let game = createGame()
    for (let session = 0; session < GAME_BALANCE.education.studySessionsForMilestone - 1; session += 1) {
      const result = performAction(game, { type: 'study', skill: 'business' })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      game = result.state
    }
    game.clock.minuteOfDay = 22 * 60
    game.player.energy = 50
    const result = performAction(game, { type: 'study', skill: 'business' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.dailySummaries).toHaveLength(1)
    expect(result.dailySummaries[0]?.educationMilestoneReached).toBe(true)
    expect(result.dailySummaries[0]?.events.some((event) =>
      event.description.includes('advanced your education'),
    )).toBe(true)
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
    const livingCostTransactions = game.money.transactions.filter(
      (transaction) => transaction.description === 'Daily living costs',
    )
    expect(livingCostTransactions).toHaveLength(game.clock.day - 1)
    expect(new Set(livingCostTransactions.map((transaction) => transaction.date)).size)
      .toBe(livingCostTransactions.length)
  })
})
