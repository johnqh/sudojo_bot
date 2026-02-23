# CLAUDE.md

This file provides context for AI assistants working on this codebase.

## Project Overview

`sudojo_bot` is a Microsoft Bot Framework application (v1.0.10) that provides interactive Sudoku puzzle assistance. Users can upload images of Sudoku puzzles, and the bot extracts puzzles via OCR, validates them, and provides step-by-step hints using a solver API.

**Key Capabilities:**
- Image upload and OCR puzzle extraction (via `@sudobility/sudojo_ocr`)
- Puzzle validation against solver API (unique solution check)
- Step-by-step hint navigation with visual board rendering
- Multi-channel support (Teams, Web Chat, etc.)
- Adaptive Card UI for rich interactions

## Runtime & Package Manager

**This project uses Bun.** Do not use npm, yarn, or pnpm.

```bash
bun install           # Install dependencies
bun run dev           # Start with watch mode (bun run --watch)
bun run start         # Production start
bun run build         # TypeScript compilation (tsc)
bun run typecheck     # Type checking only (tsc --noEmit)
bun run lint          # ESLint (src/)
bun run format        # Prettier formatting (src/)
bun run test          # Run tests (bun test)
bun run test:watch    # Run tests in watch mode
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: Microsoft Bot Framework 4.23.x (`botbuilder`, `botbuilder-dialogs`)
- **HTTP Server**: Restify 11.x
- **Language**: TypeScript 5.7+ (strict mode, `erasableSyntaxOnly`)
- **OCR**: `@sudobility/sudojo_ocr` ^1.1.1 + Tesseract.js 5.x
- **Rendering**: `@napi-rs/canvas` ^0.1.68 (native bindings for board images)
- **UI**: Adaptive Cards 1.5
- **Linting**: ESLint 9.x + `typescript-eslint` 8.x
- **Formatting**: Prettier 3.x

## Project Structure

```
src/
├── index.ts                     # Entry point - Restify server, adapter, DI wiring
├── bot.ts                       # SudokuHintBot class (ActivityHandler)
├── dialogs/                     # Bot Framework dialog flow
│   ├── mainDialog.ts            # Root dialog - message routing and all hint/upload logic
│   ├── hintDialog.ts            # Hint fetching and step navigation (ComponentDialog)
│   └── puzzleUploadDialog.ts    # Image upload, OCR, validation (WaterfallDialog)
├── services/                    # Business logic services
│   ├── ocrService.ts            # Wraps @sudobility/sudojo_ocr for Node.js
│   ├── solverService.ts         # HTTP client for sudojo_solver API
│   ├── boardRenderer.ts         # Canvas rendering of boards with hint visualization
│   └── imageService.ts          # Attachment download (Teams auth, direct download)
├── cards/                       # Adaptive Card template builders
│   ├── welcomeCard.ts           # Welcome + help cards
│   ├── puzzleCard.ts            # Puzzle display + progress cards
│   └── hintCard.ts              # Hint step, applied, and no-hint cards
├── state/                       # State management types
│   └── conversationState.ts     # PuzzleState, HintState, SudokuConversationData
├── services/*.test.ts           # Unit tests (bun test)
├── cards/*.test.ts              # Card tests
└── state/*.test.ts              # State tests
```

## Key Dependencies

### Sudobility Packages
- `@sudobility/sudojo_ocr` ^1.1.1 - Sudoku OCR extraction from images
- `@sudobility/sudojo_types` ^1.2.34 - Solver types (SolverHintStep, SolverHints, SolverBoard, SolverColor, etc.)
- `@sudobility/types` ^1.9.53 - Generic type definitions (BaseResponse)

### External
- `botbuilder` ^4.23.1 / `botbuilder-dialogs` ^4.23.1 - Microsoft Bot Framework
- `restify` ^11.1.0 - HTTP server
- `@napi-rs/canvas` ^0.1.68 - Native canvas for server-side image rendering
- `tesseract.js` ^5.1.1 - OCR engine

### Dev Dependencies
- `@types/bun` latest, `@types/node` ^22.10.0, `@types/restify` ^8.5.12
- `eslint` ^9.39.2, `typescript-eslint` ^8.54.0
- `prettier` ^3.8.1, `typescript` ^5.7.2

## Architecture

```
HTTP Request -> Restify Server (index.ts)
                    |
              CloudAdapter (Bot Framework auth)
                    |
             SudokuHintBot.run() (bot.ts)
                    |
              MainDialog.onMessageActivity() handles:
              |-- Image Upload -> ImageService + OCRService -> SolverService.validate()
              |-- Confirm Puzzle -> Update conversation state
              |-- Get Hint -> SolverService.solve() -> BoardRenderer.render()
              |-- Next/Previous Step -> Navigate hint steps
              |-- Apply Hint -> SolverService.solve() + applyHint() -> BoardRenderer
              |-- Show Progress -> BoardRenderer.render()
              +-- State Management -> ConversationState (MemoryStorage)
```

### Dialog Architecture

The bot uses **two dialog patterns**:
1. **MainDialog** (primary) - Handles most interactions directly via `onMessageActivity()`, bypassing the traditional waterfall dialog flow for responsiveness. Routes text commands, card actions, and image uploads.
2. **HintDialog** / **PuzzleUploadDialog** - ComponentDialogs registered as children but primarily used for structured multi-step flows (waterfall pattern with prompts).

### State Structure

```typescript
interface SudokuConversationData {
  currentPuzzle: PuzzleState | null;  // Active puzzle
  currentHint: HintState | null;      // Active hint session
  puzzleConfirmed: boolean;           // Whether user confirmed OCR result
}

interface PuzzleState {
  original: string;      // 81-char original puzzle ('0' = empty)
  user: string;          // 81-char user progress ('0' = no input)
  solution?: string;     // 81-char solution from solver
  confidence: number;    // OCR confidence (0-100)
}

interface HintState {
  steps: SolverHintStep[];    // Hint steps from solver
  currentStepIndex: number;   // Currently displayed step
  technique: string;          // Human-readable technique name
  level: number;              // Difficulty level
}
```

### Board Rendering

`BoardRenderer` renders Sudoku boards to PNG using `@napi-rs/canvas`:
- Default size: 450x450 pixels
- Supports light/dark color palettes
- Hint visualization: cell backgrounds, borders, pencilmarks, group outlines, chain links
- Outputs base64-encoded PNG for inline Adaptive Card images

## Environment Variables

Required variables (see `.env.example`):

```bash
# Bot Framework (from Azure Bot Registration)
MICROSOFT_APP_ID=           # Azure Bot app ID
MICROSOFT_APP_PASSWORD=     # Azure Bot app secret
MICROSOFT_APP_TYPE=SingleTenant  # Default: SingleTenant
MICROSOFT_APP_TENANT_ID=    # Azure AD tenant ID

# Solver API
SOLVER_API_URL=http://localhost:3000  # Sudojo solver endpoint

# Server
PORT=3978                   # HTTP server port (default: 3978)
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | POST | Bot Framework messaging endpoint |
| `/health` | GET | Health check (returns 200 OK with name) |

## TypeScript Configuration

- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode with all linting flags enabled
- `verbatimModuleSyntax` and `erasableSyntaxOnly` enabled
- Output: `./dist` with declarations and source maps

## Code Patterns

### Type-Only Imports (Required by `verbatimModuleSyntax`)
```typescript
import { ComponentDialog, type DialogTurnResult } from 'botbuilder-dialogs';
```

### Unused Parameters
```typescript
// Prefix with underscore (required by noUnusedParameters)
private async handleAction(_context: TurnContext): Promise<void> { }
```

### Error Handling
```typescript
try {
  const result = await this.solverService.solve(puzzle);
} catch (error) {
  console.error('Error getting hint:', error);
  await context.sendActivity('Sorry, I had trouble. Please try again.');
  return conversationData;
}
```

### Adaptive Card Actions
Card buttons use `Action.Submit` with `data: { action: 'action_name' }`, routed through `handleCardAction()` in MainDialog.

## Testing

Tests use Bun's built-in test runner (`bun test`). Test files are colocated with source:
- `src/services/ocrService.test.ts`
- `src/services/solverService.test.ts`
- `src/services/boardRenderer.test.ts`
- `src/services/imageService.test.ts`
- `src/cards/puzzleCard.test.ts`
- `src/cards/hintCard.test.ts`
- `src/state/conversationState.test.ts`

## Common Tasks

### Add New Dialog
1. Create dialog class in `src/dialogs/`
2. Extend `ComponentDialog`
3. Register in `MainDialog` with `this.addDialog()`
4. Add routing logic in `MainDialog.onMessageActivity()`

### Add New Card
1. Create function in `src/cards/`
2. Use `CardFactory.adaptiveCard()` for Adaptive Cards
3. Return `Attachment` type
4. Send via `context.sendActivity({ attachments: [card] })`

### Modify Hint Visualization
- Edit `src/services/boardRenderer.ts`
- Key methods: `render()`, `drawHintGroups()`, `drawHintLinks()`
- Color palette mapping: `getHintColor()` maps SolverColor to palette colors

### Add New Service Integration
1. Create service class in `src/services/`
2. Inject via constructor in dialogs/bot
3. Handle errors gracefully with user feedback messages

## Docker Deployment

```bash
docker build -t sudojo_bot .
docker run -p 3978:3978 --env-file .env sudojo_bot
```

## Debugging

### Bot Framework Emulator
1. Download from https://github.com/Microsoft/BotFramework-Emulator
2. Connect to `http://localhost:3978/api/messages`
3. Leave App ID/Password blank for local testing

### Common Issues

**OCR not extracting correctly:**
- Ensure clear, well-lit image with puzzle filling most of the frame
- Check `ocrService.ts` default config: `cellMargin: 0.154`, `minConfidence: 1`
- OCR retries with dilation for thin strokes (8s, 9s)

**Hints not loading:**
- Verify `SOLVER_API_URL` is correct and solver is running
- API path: `/api/v1/solver/solve?original=...&user=...`
- Check `solverService.ts` error handling

**Teams images not downloading:**
- Ensure `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD` are set
- Check `imageService.ts` Teams authentication (uses `BotAccessToken` from turn state)

## Performance Notes

- `@napi-rs/canvas` requires native bindings (platform-specific)
- Tesseract.js loads ~15MB model on first use (lazy-loaded in `OCRService.init()`)
- Board rendering is CPU-intensive (~50-100ms per render)
- State stored in `MemoryStorage` (lost on restart - not persistent)

## Security Considerations

- Never log `MICROSOFT_APP_PASSWORD`
- Validate all image uploads before processing
- Sanitize puzzle strings (81 chars, digits 0-9 only)
- Rate limit API calls to solver service
