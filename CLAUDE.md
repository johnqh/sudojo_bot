# CLAUDE.md

This file provides context for AI assistants working on this codebase.

## Project Overview

`sudojo_bot` is a Microsoft Bot Framework application that provides interactive Sudoku puzzle assistance. Users can upload images of Sudoku puzzles, and the bot extracts puzzles via OCR, validates them, and provides step-by-step hints using a solver API.

**Key Capabilities:**
- Image upload and OCR puzzle extraction
- Puzzle validation against solver
- Step-by-step hint navigation with visual board rendering
- Multi-channel support (Teams, Web Chat, etc.)

## Runtime & Package Manager

**This project uses Bun.** Do not use npm, yarn, or pnpm.

```bash
bun install           # Install dependencies
bun run dev           # Start with watch mode
bun run start         # Production start
bun run build         # TypeScript compilation
bun run typecheck     # Type checking only
bun run lint          # ESLint
bun run format        # Prettier formatting
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: Microsoft Bot Framework 4.x
- **HTTP Server**: Restify
- **Language**: TypeScript (strict mode)
- **OCR**: Tesseract.js + @sudobility/sudojo_ocr
- **Rendering**: @napi-rs/canvas (native bindings)
- **UI**: Adaptive Cards

## Project Structure

```
src/
├── index.ts                 # Entry point - Restify server setup
├── bot.ts                   # Main bot class (ActivityHandler)
├── dialogs/                 # Conversation flow management
│   ├── mainDialog.ts        # Root dialog - orchestrates all interactions
│   ├── hintDialog.ts        # Hint fetching and navigation
│   └── puzzleUploadDialog.ts # Image upload and OCR workflow
├── services/                # Business logic
│   ├── ocrService.ts        # Tesseract OCR wrapper
│   ├── solverService.ts     # Solver API client
│   ├── boardRenderer.ts     # Canvas rendering for boards
│   └── imageService.ts      # Attachment handling
├── cards/                   # Adaptive Card templates
│   ├── welcomeCard.ts       # Welcome message
│   ├── puzzleCard.ts        # Puzzle display
│   └── hintCard.ts          # Hint visualization
└── state/                   # State management
    └── conversationState.ts # TypeScript interfaces for state
```

## Key Dependencies

### Sudobility Packages
- `@sudobility/sudojo_ocr` - Sudoku OCR extraction from images
- `@sudobility/sudojo_types` - Solver types and hint structures
- `@sudobility/types` - Generic type definitions

### External
- `botbuilder` / `botbuilder-dialogs` - Microsoft Bot Framework
- `restify` - HTTP server
- `@napi-rs/canvas` - Native canvas for image rendering
- `tesseract.js` - OCR engine

## Architecture

```
HTTP Request → Restify Server (index.ts)
                    ↓
              CloudAdapter (Bot Framework)
                    ↓
             SudokuHintBot.run()
                    ↓
              MainDialog handles:
              ├─ Image Upload → ImageService + OCRService
              ├─ Puzzle Validation → SolverService.validate()
              ├─ Get Hint → SolverService.solve()
              ├─ Render Board → BoardRenderer.render()
              └─ State Management → ConversationState
```

### Dialog Flow

1. **Welcome**: User joins → Welcome card with instructions
2. **Upload**: User sends image → OCR extraction → Validation → Confirmation
3. **Hints**: User requests hint → Solver API → Step-by-step navigation
4. **Apply**: User applies hint → Update puzzle state → Continue

### State Structure

```typescript
interface SudokuConversationData {
  currentPuzzle: PuzzleState | null;  // Active puzzle
  currentHint: HintState | null;      // Active hint session
  dialogState: object;                // Bot Framework dialog state
}

interface PuzzleState {
  original: string;      // 81-char original puzzle
  user: string;          // 81-char user input ('0' = empty)
  solution: string;      // 81-char solution
  confidence: number;    // OCR confidence (0-1)
}
```

## Environment Variables

Required variables (see `.env.example`):

```bash
# Bot Framework (from Azure Bot Registration)
MICROSOFT_APP_ID=           # Azure Bot app ID
MICROSOFT_APP_PASSWORD=     # Azure Bot app secret
MICROSOFT_APP_TYPE=MultiTenant

# Solver API
SOLVER_API_URL=http://localhost:3000  # Sudojo solver endpoint

# Server
PORT=3978                   # HTTP server port
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | POST | Bot Framework messaging endpoint |
| `/health` | GET | Health check (returns 200 OK) |

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
4. Call via `context.sendActivity({ attachments: [card] })`

### Modify Hint Visualization
- Edit `src/services/boardRenderer.ts`
- Key methods: `render()`, `drawHintGroups()`, `drawHintLinks()`
- Test with different hint types from solver

### Add New Service Integration
1. Create service class in `src/services/`
2. Inject via constructor in dialogs
3. Handle errors gracefully with user feedback

## Code Patterns

### Type-Only Imports (Required)
```typescript
// Use 'type' keyword for type-only imports
import { ComponentDialog, type DialogTurnResult } from 'botbuilder-dialogs';
```

### Unused Parameters
```typescript
// Prefix with underscore to indicate intentionally unused
private async handleAction(_context: TurnContext): Promise<void> { }
```

### Error Handling
```typescript
try {
  const result = await this.solverService.solve(puzzle);
} catch (error) {
  console.error('Error getting hint:', error);
  await context.sendActivity('Sorry, I had trouble. Please try again.');
  return stepContext.endDialog({ puzzle, hint: null, applied: false });
}
```

## Testing

Currently no test framework. To test manually:

1. Start the bot: `bun run dev`
2. Use Bot Framework Emulator
3. Or deploy to Azure and test via Teams

## Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t sudojo_bot .

# Run container
docker run -p 3978:3978 --env-file .env sudojo_bot
```

For production deployment with Traefik, see `docs/DEPLOYMENT.md`.

## Debugging

### Bot Framework Emulator
1. Download from https://github.com/Microsoft/BotFramework-Emulator
2. Connect to `http://localhost:3978/api/messages`
3. Leave App ID/Password blank for local testing

### Logs
- All errors logged via `console.error()`
- OCR processing logged via `console.log()`
- Check container logs: `docker logs sudojo_bot`

### Common Issues

**OCR not extracting correctly:**
- Ensure clear, well-lit image
- Puzzle should fill most of the frame
- Check `ocrService.ts` for validation rules

**Hints not loading:**
- Verify `SOLVER_API_URL` is correct
- Check solver service is running
- Review `solverService.ts` error handling

**Teams images not downloading:**
- Ensure `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD` are set
- Check `imageService.ts` Teams authentication

## Performance Notes

- `@napi-rs/canvas` requires native bindings (handled by Bun)
- Tesseract.js loads ~15MB model on first use
- Board rendering is CPU-intensive (~50-100ms per render)
- Consider caching rendered images for repeated hints

## Security Considerations

- Never log `MICROSOFT_APP_PASSWORD`
- Validate all image uploads before processing
- Sanitize puzzle strings (81 chars, digits 0-9 only)
- Rate limit API calls to solver service
