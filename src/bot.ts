/**
 * Sudoku Hint Bot
 * Main bot class that handles incoming activities and routes to dialogs
 */

import {
  ActivityHandler,
  ConversationState,
  UserState,
  TurnContext,
  type StatePropertyAccessor,
} from 'botbuilder';
import { MainDialog } from './dialogs/mainDialog.js';
import {
  type SudokuConversationData,
  createEmptyConversationData,
} from './state/conversationState.js';
import { createWelcomeCard } from './cards/welcomeCard.js';

export class SudokuHintBot extends ActivityHandler {
  private conversationState: ConversationState;
  private userState: UserState;
  private mainDialog: MainDialog;
  private conversationDataAccessor: StatePropertyAccessor<SudokuConversationData>;

  constructor(conversationState: ConversationState, userState: UserState, mainDialog: MainDialog) {
    super();

    this.conversationState = conversationState;
    this.userState = userState;
    this.mainDialog = mainDialog;

    // Create state property accessors
    this.conversationDataAccessor =
      this.conversationState.createProperty<SudokuConversationData>('SudokuConversationData');

    // Handle incoming messages
    this.onMessage(async (context, next) => {
      await this.handleMessage(context);
      await next();
    });

    // Handle new members joining
    this.onMembersAdded(async (context, next) => {
      await this.handleMembersAdded(context);
      await next();
    });

    // Handle conversation updates
    this.onConversationUpdate(async (_context, next) => {
      await next();
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(context: TurnContext): Promise<void> {
    // Get conversation data
    let conversationData = await this.conversationDataAccessor.get(context);
    if (!conversationData) {
      conversationData = createEmptyConversationData();
    }

    // Process message through main dialog
    conversationData = await this.mainDialog.onMessageActivity(context, conversationData);

    // Save updated conversation data
    await this.conversationDataAccessor.set(context, conversationData);
  }

  /**
   * Handle new members added to conversation
   */
  private async handleMembersAdded(context: TurnContext): Promise<void> {
    const membersAdded = context.activity.membersAdded || [];
    const botId = context.activity.recipient?.id;

    for (const member of membersAdded) {
      // Skip if it's the bot itself
      if (member.id === botId) {
        continue;
      }

      // Send welcome message to new users
      await context.sendActivity({ attachments: [createWelcomeCard()] });
    }
  }

  /**
   * Override run to save state at the end of each turn
   */
  async run(context: TurnContext): Promise<void> {
    await super.run(context);

    // Save any state changes
    await this.conversationState.saveChanges(context, false);
    await this.userState.saveChanges(context, false);
  }
}
