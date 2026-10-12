import type { DailySummary, GameState, SkillName } from '../models/game'

export type Action =
  | { type: 'work' }
  | { type: 'study'; skill: SkillName }
  | { type: 'rest' }
  | { type: 'eat' }
  | { type: 'acceptEmployment' }

export type ActionResult =
  | { ok: true; state: GameState; message: string; dailySummaries: DailySummary[] }
  | { ok: false; state: GameState; message: string }
