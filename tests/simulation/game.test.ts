import { describe, expect, it } from 'vitest'
import { createGame, GAME_BALANCE, performAction } from '../../src/simulation'

describe('life simulation', () => {
  it('initializes an independent 18-year-old in Molyko', () => {
    const game = createGame()
    expect(game.player.age).toBe(18)
    expect(game.money.balance).toBe(35_000)
    expect(game.clock).toEqual({ day: 1, minuteOfDay: 480 })
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

  it('advances the day and records daily costs at midnight', () => {
    const game = createGame()
    game.clock.minuteOfDay = 23 * 60
    const result = performAction(game, { type: 'rest' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.clock).toEqual({ day: 2, minuteOfDay: 420 })
    expect(result.state.money.balance).toBe(game.money.balance - GAME_BALANCE.dailyExpense)
    expect(result.state.money.transactions[0]?.amount).toBe(-GAME_BALANCE.dailyExpense)
    expect(result.state.events.some((event) => event.description.includes('daily living costs'))).toBe(true)
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
  })

  it('does not mutate state on rejected low-energy work', () => {
    const game = createGame()
    game.player.energy = 0
    const before = structuredClone(game)
    const result = performAction(game, { type: 'work' })
    expect(result.ok).toBe(false)
    expect(game).toEqual(before)
  })
})
