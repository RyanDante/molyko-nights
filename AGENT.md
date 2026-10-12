# Molyko Nights — Agent Instructions

## Project principles
- Build a browser-first life simulator inspired by Molyko, Buea, Cameroon.
- Prioritize a robust, testable life-simulation engine before building the isometric city.
- Use TypeScript strict mode and clear, modular architecture.
- Keep simulation rules independent of React, Phaser, rendering, and UI components.
- Represent money as integer FCFA amounts; do not use floating-point arithmetic for monetary balances.
- Keep gameplay configuration separate from simulation logic.
- Use deterministic simulation behavior where possible.

## Workflow and safety
- Work only in the current local project directory.
- Do not create Git worktrees or switch the project to another worktree.
- Never commit, push, publish, deploy, or open a pull request automatically.
- Never delete or overwrite unrelated files.
- Inspect files before editing them.
- Preserve existing instructions and user changes.
- Explain substantial changes and their rationale.
- Run relevant tests and report actual results.
- Stop after the requested task and wait for human review.

## Scope control
- Implement only the requested task.
- Avoid premature multiplayer, backend, cloud sync, and complex AI systems.
- Do not add features merely because they may be useful later.
- Report assumptions, limitations, changed files, test results, and the next recommended task.