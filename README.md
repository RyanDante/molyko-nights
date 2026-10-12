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

`createGame(seed)` starts the configurable Molyko scenario. The same initial
scenario, action sequence, and seed produce the same work earnings and state.
`performAction` returns a success or rejection result; rejected actions return
the unchanged input state. Action durations, needs changes, wages, meal price,
daily expenses, and the work-to-employment milestone are in
`src/simulation/config/balance.ts`.

Time is represented as a day and minute within that day. Each midnight crossed
charges daily living costs as an integer FCFA transaction. An action is
rejected if those costs would leave the player with a negative balance. The
current starting scenario, balance values, single study skill per session, and
three-shift job milestone are provisional.
