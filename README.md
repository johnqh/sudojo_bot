# Sudojo Bot

A Microsoft Bot Framework chatbot that helps users solve Sudoku puzzles through image recognition and intelligent hints.

## Features

- **Image Upload**: Upload a photo of any Sudoku puzzle
- **OCR Extraction**: Automatic puzzle recognition using Tesseract
- **Puzzle Validation**: Verifies the puzzle has a unique solution
- **Step-by-Step Hints**: Get hints that teach solving techniques
- **Visual Feedback**: See highlighted cells and explanations
- **Multi-Platform**: Works on Teams, Web Chat, Slack, and more

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- [Docker](https://docker.com) (for deployment)
- Azure Bot Service registration

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/sudojo_bot.git
cd sudojo_bot

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
# Edit .env with your credentials
```

### Development

```bash
# Start with hot reload
bun run dev

# Run type checking
bun run typecheck

# Run linting
bun run lint

# Format code
bun run format
```

### Testing Locally

1. Download [Bot Framework Emulator](https://github.com/Microsoft/BotFramework-Emulator/releases)
2. Start the bot: `bun run dev`
3. Connect to `http://localhost:3978/api/messages`

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# Bot Framework (from Azure Bot Registration)
MICROSOFT_APP_ID=your-app-id
MICROSOFT_APP_PASSWORD=your-app-secret
MICROSOFT_APP_TYPE=MultiTenant

# Solver API
SOLVER_API_URL=https://solver.sudojo.com

# Server
PORT=3978
```

## Docker Deployment

```bash
# Build the image
docker build -t sudojo_bot .

# Run the container
docker run -d \
  --name sudojo_bot \
  -p 3978:3978 \
  --env-file .env \
  sudojo_bot
```

For production deployment with SSL and Traefik, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project Structure

```
src/
├── index.ts              # Entry point - HTTP server
├── bot.ts                # Bot logic - ActivityHandler
├── dialogs/              # Conversation flows
│   ├── mainDialog.ts     # Root orchestrator
│   ├── hintDialog.ts     # Hint management
│   └── puzzleUploadDialog.ts  # Image processing
├── services/             # Business logic
│   ├── ocrService.ts     # Tesseract OCR
│   ├── solverService.ts  # Solver API client
│   ├── boardRenderer.ts  # Canvas rendering
│   └── imageService.ts   # Attachment handling
├── cards/                # Adaptive Cards
└── state/                # State management
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | POST | Bot Framework messaging |
| `/health` | GET | Health check |

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Microsoft Teams | Full | Primary target, best experience |
| Azure Web Chat | Full | Embed in websites |
| Slack | Full | Requires Slack App setup |
| Facebook Messenger | Full | Requires App Review |
| Telegram | Full | Simple setup via BotFather |
| Direct Line | Full | For custom integrations |

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for platform-specific setup instructions.

## How It Works

1. **User sends image** → Bot receives attachment
2. **OCR extraction** → Tesseract extracts 81-digit puzzle string
3. **Validation** → Solver API verifies unique solution exists
4. **User confirms** → Puzzle state saved to conversation
5. **User requests hint** → Solver analyzes and returns technique
6. **Bot shows hint** → Rendered board with highlights + explanation
7. **User navigates** → Step through hint or apply to puzzle

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Microsoft Bot Framework](https://dev.botframework.com) v4
- **Server**: [Restify](http://restify.com)
- **OCR**: [Tesseract.js](https://tesseract.projectnaptha.com)
- **Canvas**: [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas)
- **Language**: TypeScript (strict mode)

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start with hot reload |
| `bun run start` | Production start |
| `bun run build` | Compile TypeScript |
| `bun run typecheck` | Type checking only |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test locally
4. Run `bun run lint && bun run typecheck`
5. Commit: `git commit -m "Add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

## License

[BUSL-1.1](LICENSE) - Business Source License 1.1

## Related Projects

- [sudojo_app](https://github.com/your-org/sudojo_app) - Web application
- [sudojo_solver](https://github.com/your-org/sudojo_solver) - Solver API
- [sudojo_ocr](https://github.com/your-org/sudojo_ocr) - OCR library

## Support

- **Documentation**: [docs.sudojo.com](https://docs.sudojo.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/sudojo_bot/issues)
- **Email**: support@sudojo.com
