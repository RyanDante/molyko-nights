# Molyko Nights

A browser-first life simulator inspired by Molyko and Buea, Cameroon. This
foundation focuses on a deterministic, headless life-simulation engine and a
small development screen for exercising it.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Commands

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
```

## Simulation

The simulation is independent of React and browser rendering. Import the
public API from `src/simulation`:

```ts
import { createGame, performAction } from './simulation'

const game = createGame(42)
const result = performAction(game, { type: 'study', skill: 'business' })
```

`createGame(seed)` starts the Molyko scenario. The same initial state, action
sequence, and seed produce the same complete resulting state. Work uses a
deterministic PRNG whose state is stored in the game.
`performAction` returns a success or rejection result; rejected actions return
the unchanged input state. Successful results are independent snapshots,
including their transaction and life-event records. Incoming state is checked
for valid ranges, dates, integer FCFA, and internally consistent history.

The clock stores an elapsed day/minute and ISO calendar dates. The starting
date is 2026-01-01 and the player's birth date is 2008-01-01. A day is 1,440
minutes. Every crossed midnight advances the date and charges that date's
living costs once; a transition is rejected if the costs cannot be paid.
Birthdays are observed on the birth month/day, with Feb 29 birthdays observed
on Feb 28 in non-leap years.

Transactions record routine financial changes, including income, meals, and
daily costs. Life events are reserved for meaningful progression or outcomes:
the start of a new life, study progress, employment, birthdays, health
consequences, and funds being depleted. Routine daily-cost transactions do not
create redundant life events.

Hunger is a 0–100 meter where higher values mean hungrier (the UI inverts its
displayed bar). Starting at hunger 70, work earnings are reduced by 25%; at
90+, work also costs health. These and action durations, needs changes, wages,
meal price, daily expenses, and the work-to-employment milestone are
provisional values in `src/simulation/config/balance.ts`. The current economy
remains a prototype: a repeated work/rest/eat loop can grow the balance over
time, so profitability is measured by a regression test rather than described
as balanced.
