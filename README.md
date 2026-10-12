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
minutes. Every crossed midnight closes the date just completed and applies
that date's living cost once before advancing the calendar. A payment is
limited to the available balance; any remainder is added to the cumulative
`unpaidLivingCostsTotal`, and a dated missed-payment event records the day's
shortfall. Time still advances and the balance never becomes negative. This
counter records total unpaid living costs; it has no repayment or collection
mechanic. Birthdays are observed on the birth month/day, with Feb 29 birthdays
observed on Feb 28 in non-leap years.

Transactions record routine financial changes, including income, meals, and
daily costs actually paid. Life events are reserved for meaningful progression
or outcomes: the start of a new life, study progress, employment, birthdays,
health consequences, and missed payments. Routine daily-cost transactions do
not create redundant life events.

Successful actions return `dailySummaries`. The list is empty unless an action
closes one or more days; multi-day transitions return one chronological
summary per completed date. Summaries include that date's opening and closing
balances, earnings, expenses paid, unpaid amount, action-related need changes,
events, and any education milestone. Financial totals come from that date's
transactions. Summary history contains copies rather than references to game
state records. Since current actions apply their need effects before advancing
the clock, those changes are attributed to the action's starting date; further
dates closed by the same multi-day advance report no additional action-related
need changes.

Five successful study sessions advance the starting `Secondary school` level
to `Tertiary studies`, with a dated life event. The threshold and level are
provisional values in `src/simulation/config/balance.ts`; progress displayed
by the development screen is derived from the session count and configuration.

Hunger is a 0–100 meter where higher values mean hungrier (the UI inverts its
displayed bar). Starting at hunger 70, work earnings are reduced by 25%; at
90+, work also costs health. Three successful shifts make an unemployed player
eligible for the configured Cafe assistant role. Eligibility does not change
employment or wages: the third shift is still casual work, and the player must
accept the role explicitly. Accepting is time-free and records a dated life
event without changing money or needs. Until acceptance, work pays the casual
seeded wage of 4,000–7,000 FCFA; afterward, work pays 8,000 FCFA before hunger
penalties. These thresholds, wages, action durations, needs changes, meal
price, and daily expenses are provisional values in
`src/simulation/config/balance.ts`. The current economy remains a prototype: a
repeated work/rest/eat loop can grow the balance over time, so profitability is
measured by a regression test rather than described as balanced.
