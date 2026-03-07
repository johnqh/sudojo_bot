# sudojo_bot

Microsoft Bot Framework chatbot that helps users solve Sudoku puzzles through image recognition and step-by-step hints.

## Setup

```bash
bun install
cp .env.example .env
# Configure MICROSOFT_APP_ID, MICROSOFT_APP_PASSWORD, SOLVER_API_URL
bun run dev          # Start with hot reload (port 3978)
```

## Features

- Upload a photo of any Sudoku puzzle
- Automatic OCR extraction via Tesseract
- Puzzle validation (unique solution check)
- Step-by-step hints teaching solving techniques
- Visual board rendering with highlighted cells
- Multi-platform: Teams, Web Chat, Slack, Telegram, and more

## Usage

1. Download [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator/releases)
2. Start the bot: `bun run dev`
3. Connect to `http://localhost:3978/api/messages`

## Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | POST | Bot Framework messaging |
| `/health` | GET | Health check |

## Development

```bash
bun run dev          # Start with hot reload
bun run build        # TypeScript compilation
bun run typecheck    # Type checking
bun run lint         # ESLint
bun run test         # Run tests (bun test)
```

## Docker

```bash
docker build -t sudojo_bot .
docker run -p 3978:3978 --env-file .env sudojo_bot
```

## Related Packages

- `@sudobility/sudojo_ocr` -- OCR library for puzzle extraction
- `@sudobility/sudojo_types` -- Solver types for hint data
- `sudojo_solver` -- Solver API for hints and validation

## License

BUSL-1.1
