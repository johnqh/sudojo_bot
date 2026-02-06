/**
 * Entry point for Sudoku Hint Bot
 * Sets up restify HTTP server for Bot Framework
 */

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  MemoryStorage,
  ConversationState,
  UserState,
} from 'botbuilder';
import restify from 'restify';
import { SudokuHintBot } from './bot.js';
import { MainDialog } from './dialogs/mainDialog.js';
import { OCRService } from './services/ocrService.js';
import { SolverService } from './services/solverService.js';

// Load environment variables
const PORT = process.env.PORT || 3978;
const SOLVER_API_URL = process.env.SOLVER_API_URL || 'http://localhost:3000';

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

// Bot Framework authentication
const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: process.env.MICROSOFT_APP_ID,
  MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
  MicrosoftAppType: process.env.MICROSOFT_APP_TYPE || 'MultiTenant',
});

// Create adapter
const adapter = new CloudAdapter(botFrameworkAuth);

// Error handler
adapter.onTurnError = async (context, error) => {
  console.error(`[onTurnError] unhandled error: ${error}`);
  console.error(error.stack);

  // Send error message to user
  await context.sendActivity('Sorry, something went wrong. Please try again.');

  // Clear conversation state on error
  await conversationState.delete(context);
};

// Storage and state
const storage = new MemoryStorage();
const conversationState = new ConversationState(storage);
const userState = new UserState(storage);

// Services
const ocrService = new OCRService();
const solverService = new SolverService(SOLVER_API_URL);

// Main dialog
const mainDialog = new MainDialog(ocrService, solverService);

// Create bot
const bot = new SudokuHintBot(conversationState, userState, mainDialog);

// Listen for incoming requests
server.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, context => bot.run(context));
});

// Health check endpoint
server.get('/health', (_req, res, next) => {
  res.send(200, { status: 'healthy', name: 'Sudoku Hint Bot' });
  next();
});

// Start server
server.listen(PORT, () => {
  console.log(`Sudoku Hint Bot listening on http://localhost:${PORT}`);
  console.log(`Bot endpoint: http://localhost:${PORT}/api/messages`);
});
