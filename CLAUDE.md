# CLAUDE.md

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.

This file provides context for AI assistants working on this codebase.

## Project Overview

`sudojo_bot` (v1.0.48, `private`, BUSL-1.1) is a Microsoft Bot Framework chatbot. A user sends a
photo of a Sudoku; the bot OCRs it (`@sudobility/sudojo_ocr` + Tesseract.js), validates it through
the **sudojo_api** solver proxy, then walks through step-by-step hints rendered as PNG boards inside
Adaptive Cards. It ships as a Docker image only (no npm publish).

**Stack:** Bun · TypeScript 5 strict (ESM) · `botbuilder`/`botbuilder-dialogs` 4.23 · restify 11 ·
`@napi-rs/canvas` · `tesseract.js` 5.1 · i18next 26 · Adaptive Cards 1.5 · ESLint 9 + typescript-eslint 8 · Prettier 3.

## Commands

**Bun only** (Bun 1.3.x locally, `oven/bun:1` in Docker). Do not use npm, yarn, or pnpm.

| Command | What it does | Verified |
|---------|--------------|----------|
| `bun install` | Install deps | not run |
| `bun run dev` | `bun run --watch src/index.ts` on port 3978 | not run (long-running) |
| `bun run start` | `bun run src/index.ts` (same as Docker `CMD`) | not run |
| `bun run typecheck` | `tsc --noEmit` | passes |
| `bun run lint` | `eslint src` | passes |
| `bun run format` | `prettier --write src` | `prettier --check src` clean |
| `bun run build` | `tsc` → `dist/` (gitignored; runtime uses `src/`, so this is an emit check) | passes |
| `bun run clean` | `rm -rf dist` | |
| `bun test src/services src/cards src/state` | **Unit tests only** (74 tests, ~4s warm, offline) | 74 pass |
| `bun run test` | `bun test` = unit tests **+** `src/test/ocr.integration.test.ts` | 4 fail, see Gotchas |
| `bun run test:watch` | `bun test --watch` | |

No `verify` or `test:unit` script exists. Bun auto-loads `.env` (there is no dotenv dependency).

## Architecture

```
POST /api/messages ─► restify (src/index.ts) ─► CloudAdapter (ConfigurationBotFrameworkAuthentication)
                                                   │
                                     SudokuHintBot.run()  (src/bot.ts, ActivityHandler)
                                     ├─ onMembersAdded ─► createWelcomeCard()
                                     └─ onMessage ─► MainDialog.onMessageActivity(ctx, data) ─► new data
                                                        │ (plain method call, NOT the dialog stack)
          ┌─────────────────────────────────────────────┼──────────────────────────────┐
  attachment: ImageService.downloadAttachment   text / card action:              BoardRenderer.render()
            → OCRService.extractPuzzle            SolverService.solve()          (@napi-rs/canvas, 450px PNG,
            → OCRService.validatePuzzle            GET {SOLVER_API_URL}/api/v1/solver/solve     inlined as a
            → SolverService.validate()             GET {SOLVER_API_URL}/api/v1/solver/validate  data: URL)
GET /health ─► 200 { status, name } (strings from i18n)
State: MemoryStorage → ConversationState property "SudokuConversationData" (lost on restart)
```

- **Only `MainDialog.onMessageActivity()` is live.** `MainDialog.run()` is never called, so these
  are dormant code: `HintDialog`, `PuzzleUploadDialog` (both registered via `addDialog`), the intro
  waterfall, and the card builders that only they use (`createHintStepCard`, `createHintAppliedCard`,
  `createNoHintCard`). The live hint step, applied, and progress cards are built inline in
  `mainDialog.ts`. `createProgressCard` is unused.
- `UserState` is created and saved each turn but never written (`SudokuUserData` is unused).
- All user-facing strings go through i18next `t()` (`src/i18n/index.ts`; English only, `src/i18n/locales/en.json`).

### Message routing (`src/dialogs/mainDialog.ts`)

| Input (text is lowercased and trimmed) | Handler |
|-------|---------|
| any attachment | `handleImageUpload`: OCR → validate → puzzle card with confirm/reject |
| `help`, `?` | help card |
| `new`, `new puzzle`, `start` / action `new_puzzle`, `reject_puzzle` | reset state |
| `hint`, `get hint` / action `get_hint` | `solve()` → step 1 card (re-sends puzzle card if not yet confirmed) |
| `next`, `next step` / action `next_step` | next step |
| action `previous_step` (no text equivalent) | previous step |
| `apply`, `apply hint` / action `apply_hint` | re-`solve()`, take `board.user` + pencilmarks |
| `status`, `progress` / action `show_progress` | progress card |
| action `confirm_puzzle` / `upload` | set `puzzleConfirmed` / ask for a photo |
| anything else | welcome card (no puzzle) or default prompt |

Card buttons are `Action.Submit` with `data: { action }`, read from `context.activity.value.action`.

### State (`src/state/conversationState.ts`)

- `SudokuConversationData { currentPuzzle: PuzzleState | null; currentHint: HintState | null; puzzleConfirmed }`
- `PuzzleState { original, user, solution?, confidence, pencilmarks?, autopencil? }`: 81-char strings
  with `'0'` = empty. `pencilmarks` is 81 comma-separated entries.
- `HintState { steps: SolverHintStep[], currentStepIndex, technique (name), level }`

Handlers return the conversation data (a new object when it changed); `bot.ts` stores it and `run()` saves state.

## Directory Map

```
src/
├── index.ts               # restify server, adapter, storage, DI wiring, /health
├── bot.ts                 # SudokuHintBot (ActivityHandler)
├── dialogs/               # mainDialog.ts (live); hintDialog.ts, puzzleUploadDialog.ts (dormant)
├── services/              # ocrService, solverService, imageService, boardRenderer (+ *.test.ts)
├── cards/                 # welcomeCard, puzzleCard, hintCard (+ *.test.ts)
├── state/                 # conversationState.ts (+ test)
├── i18n/                  # i18next init + locales/en.json
└── test/                  # ocr.integration.test.ts + fixtures/*.jpg|png
eng.traineddata            # Tesseract LSTM model (~5 MB, committed), read from CWD (see Gotchas)
Dockerfile                 # 3-stage oven/bun build; runs `bun run src/index.ts`
.github/workflows/ci-cd.yml# calls johnqh/workflows unified-cicd.yml
docs/DEPLOYMENT.md         # Azure Bot + channel setup, Docker, sudobility_dockerized/Traefik
plans/IMPROVEMENTS.md      # improvement backlog
```

## Environment Variables

See `.env.example`.

| Name | Code default | Notes |
|------|--------------|-------|
| `MICROSOFT_APP_ID` | none | Azure Bot app ID; leave blank for local Emulator |
| `MICROSOFT_APP_PASSWORD` | none | client secret; never log it |
| `MICROSOFT_APP_TYPE` | `SingleTenant` | |
| `MICROSOFT_APP_TENANT_ID` | none | required for `SingleTenant` |
| `SOLVER_API_URL` | `http://localhost:3000` | base URL of **sudojo_api**, not the C# solver |
| `PORT` | `3978` | |

The Docker image sets `NODE_ENV=production`, but the code never reads it.

## Sibling Repos & Contracts

| Sibling | Contract |
|---------|----------|
| `@sudobility/sudojo_ocr` `^1.1.42` | `extractSudokuFromImage`, `createNodeAdapter` (from the `/node` subpath). Options in `ocrService.ts`: `cellMargin: 0.03`, `minConfidence: 1`, `preprocess: true`, `recognizePencilmarks: true` |
| `@sudobility/sudojo_types` `^1.2.67` | `SolveData`, `ValidateData`, `SolverBoard`, `SolverHints`, `SolverHintStep`, `SolverColor`, `getTechniqueNameById` |
| `@sudobility/types` `^1.9.67` | `BaseResponse<T>` envelope `{ success, data, error }` |
| **sudojo_api** (runtime) | `GET /api/v1/solver/solve?original&user&autopencilmarks[&pencilmarks]`, `GET /api/v1/solver/validate?original`. sudojo_api proxies both to **sudojo_solver** `/api/solve` and `/api/validate`. It listens on port 3000 by default. The bot sends no `Authorization` or `X-API-Key` header, so sudojo_api treats it as an anonymous client |
| sudojo_app `scripts/push_all.sh` | releases `sudojo_bot` last in the sudojo family and bumps the `@sudobility/*` deps and the version. That produces the `chore: update @sudobility dependencies…` commits |

Nothing depends on this repo.

## CI/CD & Release

`.github/workflows/ci-cd.yml` calls `johnqh/workflows/.github/workflows/unified-cicd.yml@main` with
`docker-image-name: sudojo_bot` and `skip-npm-publish: true`. The workflow runs typecheck, lint,
`bun run test`, and build.

- **`develop`:** tests only.
- **`main`:** if the `package.json` version has no tag yet, it creates a GitHub release and pushes
  `$DOCKERHUB_USERNAME/sudojo_bot:<version>` and `:latest`.

Hosting goes through `sudobility_dockerized` (see docs/DEPLOYMENT.md).

## Conventions

- ESM (`"type": "module"`). Relative imports use a `.js` suffix (`'./bot.js'`).
- `verbatimModuleSyntax` + `erasableSyntaxOnly`: use `import type` or inline `type` specifiers. No
  enums, namespaces, or constructor parameter properties.
- Prefix unused params/vars with `_` (tsc `noUnusedParameters` + the ESLint `no-unused-vars` rule).
- Prettier: single quotes, 100 columns, 2 spaces, `arrowParens: avoid`, LF.
- Tests use `bun:test` and sit next to the source as `*.test.ts`. Solver tests stub `globalThis.fetch`.
- User-facing text goes in `en.json`. Read it with `t('section.key', { vars })`.

## Gotchas

- **`bun run test` is slow and fails locally.** It includes the OCR integration test: the 3 digit
  tests pass, but each of the 4 pencilmark tests times out at 120s (~9.5 min total). CI runs the
  same `bun run test`. For a fast loop, use `bun test src/services src/cards src/state`.
- **Tesseract model:** tesseract.js loads `./eng.traineddata` from the **process CWD**. If the file is
  missing, it downloads the model from cdn.jsdelivr.net and writes it to the CWD. The Dockerfile does
  not copy `eng.traineddata`, so the container fetches it on its first OCR and needs outbound network.
- **`SOLVER_API_URL` must point at sudojo_api.** Pointing it straight at sudojo_solver returns 404s,
  because the solver serves `/api/solve`, not `/api/v1/solver/solve`.
- **"Apply" doesn't replay the stored hint.** It re-runs `solve()` on the same state and uses the
  solver's `board.user`. `SolverService.applyHint()` ignores its `_user` argument.
- `validate()` maps any non-success response to `{ valid: false }`, which the user sees as "no unique
  solution". `solve()` throws instead. Network errors throw from both.
- An upload uses the first attachment whose `contentType` is `image/*` or `application/octet-stream`,
  or a Teams file upload (`application/vnd.microsoft.teams.file.download.info`) with an image
  `fileType`. The file upload is fetched from its pre-authenticated `content.downloadUrl`.
- **Attachment auth (`imageService.ts`):** on `msteams` only, a `contentUrl` on the activity's
  `serviceUrl` origin, `smba.trafficmanager.net`, `*.teams.microsoft.com`, or `*.asm.skype.com` gets
  the bot's connector token. The token comes from `connectorClient.credentials.signRequest()`, where
  `connectorClient` is the ConnectorClient that CloudAdapter puts in `turnState` under
  `adapter.ConnectorClientKey`. Hosts are matched on the parsed hostname. Every other URL is fetched
  without auth.
- Board text uses `system-ui`/`sans-serif`. `oven/bun:1-slim` installs no font packages, so digits
  may not render in the container (unverified).
- `BoardRenderer` supports `darkMode`, but no caller sets it.
- **"Solved" is judged from the grid, not the solution.** `SolverService.isPuzzleSolved(original, user)`
  returns true when the merged grid is full and every row, column and box holds 1-9 once. Don't compare
  against `PuzzleState.solution`: sudojo_api encrypts it (`enc:` + base64 AES-256-GCM, fresh nonce per
  response) whenever `SOLUTION_ENCRYPTION_KEY` is set.

## Known Issues (reported, not fixed)

- `HintDialog` (dormant) calls `solve()` without pencilmarks, unlike `MainDialog`.
- `plans/IMPROVEMENTS.md` has the backlog: persistent storage, rate limiting, extracting the inline
  cards from `mainDialog.ts`, and more.

## Common Tasks

- **New command or action:** add a branch in `onMessageActivity()` and/or a `case` in
  `handleCardAction()`. Return the updated `SudokuConversationData`, and put the strings in `en.json`.
- **New card:** write a builder in `src/cards/` that returns
  `CardFactory.adaptiveCard({ ..., version: '1.5' })`. Send it with
  `context.sendActivity({ attachments: [card] })`.
- **Hint visuals:** edit `src/services/boardRenderer.ts`. The entry point is
  `render(original, user, { hintStep })`, and the helpers are `buildHintCellMap`, `drawHintGroups`,
  and `drawHintLinks`. `getHintColor()` maps `SolverColor` to the palette.
- **Solver params:** edit `src/services/solverService.ts` and keep it in sync with sudojo_api
  `src/routes/solver.ts`.

## Local Debugging

1. Start sudojo_api on `:3000`.
2. Run `bun run dev`.
3. Open the [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator) and connect
   to `http://localhost:3978/api/messages`. Leave the App ID/password blank, and keep the
   `MICROSOFT_APP_*` env vars empty.

## Git Workflow

- Do not use feature branches for code changes. Always stay on the current branch.
