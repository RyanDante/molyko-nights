import type { SkillName } from '../models/game'

export type Action =
  | { type: 'work' }
  | { type: 'study'; skill: SkillName }
  | { type: 'rest' }
  | { type: 'eat' }

export type ActionResult =
  | { ok: true; state: import('../models/game').GameState; message: string }
  | { ok: false; state: import('../models/game').GameState; message: string }
