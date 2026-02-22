/**
 * Main Dialog
 * Root component dialog that orchestrates the conversation flow
 */

import {
  ComponentDialog,
  WaterfallDialog,
  WaterfallStepContext,
  type DialogTurnResult,
  DialogSet,
  DialogTurnStatus,
} from 'botbuilder-dialogs';
import {
  type StatePropertyAccessor,
  type TurnContext,
  CardFactory,
  MessageFactory,
} from 'botbuilder';
import { OCRService } from '../services/ocrService.js';
import { SolverService } from '../services/solverService.js';
import { BoardRenderer } from '../services/boardRenderer.js';
import type { SolverHintStep } from '@sudobility/sudojo_types';
import { PuzzleUploadDialog } from './puzzleUploadDialog.js';
import { HintDialog } from './hintDialog.js';
import { createWelcomeCard, createHelpCard } from '../cards/welcomeCard.js';
import { createPuzzleCard } from '../cards/puzzleCard.js';
import type { SudokuConversationData } from '../state/conversationState.js';
import { ImageService } from '../services/imageService.js';

export const MAIN_DIALOG = 'mainDialog';
const MAIN_WATERFALL = 'mainWaterfall';

export class MainDialog extends ComponentDialog {
  private ocrService: OCRService;
  private solverService: SolverService;
  private boardRenderer: BoardRenderer;

  constructor(ocrService: OCRService, solverService: SolverService) {
    super(MAIN_DIALOG);

    this.ocrService = ocrService;
    this.solverService = solverService;
    this.boardRenderer = new BoardRenderer(450);

    // Add child dialogs
    this.addDialog(new PuzzleUploadDialog(ocrService, solverService));
    this.addDialog(new HintDialog(solverService));

    // Add main waterfall
    this.addDialog(
      new WaterfallDialog(MAIN_WATERFALL, [this.introStep.bind(this), this.processStep.bind(this)])
    );

    this.initialDialogId = MAIN_WATERFALL;
  }

  /**
   * Run the dialog
   */
  async run(
    context: TurnContext,
    accessor: StatePropertyAccessor<SudokuConversationData>
  ): Promise<void> {
    const dialogSet = new DialogSet(accessor as unknown as StatePropertyAccessor);
    dialogSet.add(this);

    const dialogContext = await dialogSet.createContext(context);
    const results = await dialogContext.continueDialog();

    if (results.status === DialogTurnStatus.empty) {
      await dialogContext.beginDialog(this.id);
    }
  }

  /**
   * Handle incoming messages outside of dialogs
   */
  async onMessageActivity(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    const text = (context.activity.text || '').toLowerCase().trim();
    const hasAttachment = (context.activity.attachments?.length || 0) > 0;

    // Check for image upload
    if (hasAttachment) {
      return this.handleImageUpload(context, conversationData);
    }

    // Check for action from Adaptive Card
    const action = context.activity.value?.action;
    if (action) {
      return this.handleCardAction(context, conversationData, action);
    }

    // Handle text commands
    if (text === 'help' || text === '?') {
      await context.sendActivity({ attachments: [createHelpCard()] });
      return conversationData;
    }

    if (text === 'new' || text === 'new puzzle' || text === 'start') {
      return this.handleNewPuzzle(context, conversationData);
    }

    if (text === 'hint' || text === 'get hint') {
      return this.handleGetHint(context, conversationData);
    }

    if (text === 'next' || text === 'next step') {
      return this.handleNextStep(context, conversationData);
    }

    if (text === 'apply' || text === 'apply hint') {
      return this.handleApplyHint(context, conversationData);
    }

    if (text === 'status' || text === 'progress') {
      return this.handleShowProgress(context, conversationData);
    }

    // Default: show welcome or hint based on state
    if (!conversationData.currentPuzzle) {
      await context.sendActivity({ attachments: [createWelcomeCard()] });
    } else {
      await context.sendActivity(
        "Send 'hint' to get a hint, 'status' to see progress, or 'new' to start a new puzzle."
      );
    }

    return conversationData;
  }

  /**
   * Handle image upload
   */
  private async handleImageUpload(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    // Process image through OCR
    const service = new ImageService();
    const attachment = service.getFirstImageAttachment(context);

    if (!attachment) {
      await context.sendActivity('Please upload an image of your Sudoku puzzle.');
      return conversationData;
    }

    await context.sendActivity('Processing your puzzle image...');

    try {
      const imageBuffer = await service.downloadAttachment(context, attachment);
      const ocrResult = await this.ocrService.extractPuzzle(imageBuffer);

      const validation = this.ocrService.validatePuzzle(ocrResult.puzzle);
      if (!validation.valid) {
        await context.sendActivity(
          `I couldn't extract a valid puzzle: ${validation.error}. Please try a clearer image.`
        );
        return conversationData;
      }

      const solverValidation = await this.solverService.validate(ocrResult.puzzle);
      if (!solverValidation.valid) {
        await context.sendActivity(
          "This puzzle doesn't appear to have a unique solution. Please check the image and try again."
        );
        return conversationData;
      }

      const puzzleState = {
        original: ocrResult.puzzle,
        user: '0'.repeat(81),
        solution: solverValidation.solution,
        confidence: ocrResult.confidence,
      };

      const card = createPuzzleCard(puzzleState, true);
      await context.sendActivity({ attachments: [card] });

      return {
        ...conversationData,
        currentPuzzle: puzzleState,
        currentHint: null,
        puzzleConfirmed: false,
      };
    } catch (error) {
      console.error('Error processing image:', error);
      await context.sendActivity('Sorry, I had trouble processing that image. Please try again.');
      return conversationData;
    }
  }

  /**
   * Handle Adaptive Card action
   */
  private async handleCardAction(
    context: TurnContext,
    conversationData: SudokuConversationData,
    action: string
  ): Promise<SudokuConversationData> {
    switch (action) {
      case 'confirm_puzzle':
        return this.handleConfirmPuzzle(context, conversationData);
      case 'reject_puzzle':
        return this.handleNewPuzzle(context, conversationData);
      case 'get_hint':
        return this.handleGetHint(context, conversationData);
      case 'next_step':
        return this.handleNextStep(context, conversationData);
      case 'previous_step':
        return this.handlePreviousStep(context, conversationData);
      case 'apply_hint':
        return this.handleApplyHint(context, conversationData);
      case 'new_puzzle':
        return this.handleNewPuzzle(context, conversationData);
      case 'show_progress':
        return this.handleShowProgress(context, conversationData);
      case 'upload':
        await context.sendActivity('Please upload a photo of your Sudoku puzzle.');
        return conversationData;
      default:
        return conversationData;
    }
  }

  /**
   * Handle puzzle confirmation
   */
  private async handleConfirmPuzzle(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    if (!conversationData.currentPuzzle) {
      await context.sendActivity('No puzzle to confirm. Please upload an image.');
      return conversationData;
    }

    await context.sendActivity(
      "Great! The puzzle is confirmed. Send 'hint' to get your first hint."
    );

    return {
      ...conversationData,
      puzzleConfirmed: true,
    };
  }

  /**
   * Handle new puzzle request
   */
  private async handleNewPuzzle(
    context: TurnContext,
    _conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    await context.sendActivity('Starting fresh! Please upload a photo of your new Sudoku puzzle.');

    return {
      currentPuzzle: null,
      currentHint: null,
      puzzleConfirmed: false,
    };
  }

  /**
   * Handle get hint request
   */
  private async handleGetHint(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    if (!conversationData.currentPuzzle) {
      await context.sendActivity(
        'No puzzle loaded. Please upload an image of your Sudoku puzzle first.'
      );
      return conversationData;
    }

    if (!conversationData.puzzleConfirmed) {
      const card = createPuzzleCard(conversationData.currentPuzzle, true);
      await context.sendActivity({ attachments: [card] });
      return conversationData;
    }

    try {
      const result = await this.solverService.solve(
        conversationData.currentPuzzle.original,
        conversationData.currentPuzzle.user
      );

      if (!result.hints || result.hints.steps.length === 0) {
        await context.sendActivity(
          "I couldn't find a hint. The puzzle may be complete or invalid."
        );
        return conversationData;
      }

      const { getTechniqueNameById } = await import('@sudobility/sudojo_types');
      const hintState = {
        steps: result.hints.steps,
        currentStepIndex: 0,
        technique: getTechniqueNameById(result.hints.technique),
        level: result.hints.level,
      };

      const step = hintState.steps[0];
      if (step) {
        await this.sendHintStepWithImage(
          context,
          step,
          0,
          hintState.steps.length,
          conversationData.currentPuzzle.original,
          conversationData.currentPuzzle.user,
          hintState.technique,
          hintState.level
        );
      }

      return {
        ...conversationData,
        currentHint: hintState,
      };
    } catch (error) {
      console.error('Error getting hint:', error);
      await context.sendActivity('Sorry, I had trouble getting a hint. Please try again.');
      return conversationData;
    }
  }

  /**
   * Handle next step request
   */
  private async handleNextStep(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    if (!conversationData.currentPuzzle || !conversationData.currentHint) {
      return this.handleGetHint(context, conversationData);
    }

    const nextIndex = conversationData.currentHint.currentStepIndex + 1;
    if (nextIndex >= conversationData.currentHint.steps.length) {
      await context.sendActivity("You're at the last step. Send 'apply' to apply this hint.");
      return conversationData;
    }

    const updatedHint = {
      ...conversationData.currentHint,
      currentStepIndex: nextIndex,
    };

    const step = updatedHint.steps[nextIndex];
    if (step) {
      await this.sendHintStepWithImage(
        context,
        step,
        nextIndex,
        updatedHint.steps.length,
        conversationData.currentPuzzle.original,
        conversationData.currentPuzzle.user,
        updatedHint.technique,
        updatedHint.level
      );
    }

    return {
      ...conversationData,
      currentHint: updatedHint,
    };
  }

  /**
   * Handle previous step request
   */
  private async handlePreviousStep(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    if (!conversationData.currentPuzzle || !conversationData.currentHint) {
      return this.handleGetHint(context, conversationData);
    }

    const prevIndex = conversationData.currentHint.currentStepIndex - 1;
    if (prevIndex < 0) {
      await context.sendActivity("You're at the first step.");
      return conversationData;
    }

    const updatedHint = {
      ...conversationData.currentHint,
      currentStepIndex: prevIndex,
    };

    const step = updatedHint.steps[prevIndex];
    if (step) {
      await this.sendHintStepWithImage(
        context,
        step,
        prevIndex,
        updatedHint.steps.length,
        conversationData.currentPuzzle.original,
        conversationData.currentPuzzle.user,
        updatedHint.technique,
        updatedHint.level
      );
    }

    return {
      ...conversationData,
      currentHint: updatedHint,
    };
  }

  /**
   * Handle apply hint request
   */
  private async handleApplyHint(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    if (!conversationData.currentPuzzle) {
      await context.sendActivity('No puzzle loaded. Please upload an image first.');
      return conversationData;
    }

    if (!conversationData.currentHint) {
      return this.handleGetHint(context, conversationData);
    }

    try {
      const result = await this.solverService.solve(
        conversationData.currentPuzzle.original,
        conversationData.currentPuzzle.user
      );

      const updatedUser = this.solverService.applyHint(
        conversationData.currentPuzzle.user,
        result.board
      );

      // Render board with updated state
      const renderResult = this.boardRenderer.render(
        conversationData.currentPuzzle.original,
        updatedUser
      );
      const base64Image = renderResult.buffer.toString('base64');
      const imageDataUrl = `data:image/png;base64,${base64Image}`;

      // Check if puzzle is complete
      const isPuzzleComplete =
        conversationData.currentPuzzle.solution &&
        this.solverService.isPuzzleSolved(
          conversationData.currentPuzzle.original,
          updatedUser,
          conversationData.currentPuzzle.solution
        );

      // Send applied hint card with board image
      const message = MessageFactory.attachment(
        CardFactory.adaptiveCard({
          type: 'AdaptiveCard',
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.5',
          body: [
            {
              type: 'TextBlock',
              text: isPuzzleComplete
                ? '🎉 **Puzzle Complete!**'
                : `✓ **${conversationData.currentHint.technique}** applied`,
              wrap: true,
              weight: 'Bolder',
              size: 'Medium',
              color: isPuzzleComplete ? 'Good' : 'Default',
            },
            {
              type: 'Image',
              url: imageDataUrl,
              size: 'Large',
              horizontalAlignment: 'Center',
            },
            {
              type: 'TextBlock',
              text: isPuzzleComplete
                ? "Congratulations! You've solved the puzzle."
                : 'The hint has been applied to your board.',
              wrap: true,
            },
          ],
          actions: isPuzzleComplete
            ? [
                {
                  type: 'Action.Submit',
                  title: 'New Puzzle',
                  data: { action: 'new_puzzle' },
                },
              ]
            : [
                {
                  type: 'Action.Submit',
                  title: 'Get Another Hint',
                  data: { action: 'get_hint' },
                },
                {
                  type: 'Action.Submit',
                  title: 'New Puzzle',
                  data: { action: 'new_puzzle' },
                },
              ],
        })
      );
      await context.sendActivity(message);

      return {
        ...conversationData,
        currentPuzzle: {
          ...conversationData.currentPuzzle,
          user: updatedUser,
        },
        currentHint: null,
      };
    } catch (error) {
      console.error('Error applying hint:', error);
      await context.sendActivity('Sorry, I had trouble applying the hint. Please try again.');
      return conversationData;
    }
  }

  /**
   * Handle show progress request
   */
  private async handleShowProgress(
    context: TurnContext,
    conversationData: SudokuConversationData
  ): Promise<SudokuConversationData> {
    if (!conversationData.currentPuzzle) {
      await context.sendActivity('No puzzle loaded. Please upload an image first.');
      return conversationData;
    }

    // Render current board state
    const renderResult = this.boardRenderer.render(
      conversationData.currentPuzzle.original,
      conversationData.currentPuzzle.user
    );
    const base64Image = renderResult.buffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;

    // Calculate progress
    const original = conversationData.currentPuzzle.original;
    const user = conversationData.currentPuzzle.user;
    let filledCells = 0;
    for (let i = 0; i < 81; i++) {
      if ((original[i] !== '0' && original[i] !== '.') || (user[i] !== '0' && user[i] !== '.')) {
        filledCells++;
      }
    }
    const progress = Math.round((filledCells / 81) * 100);

    const message = MessageFactory.attachment(
      CardFactory.adaptiveCard({
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body: [
          {
            type: 'TextBlock',
            text: `**Progress: ${progress}%** (${filledCells}/81 cells)`,
            wrap: true,
            weight: 'Bolder',
            size: 'Medium',
          },
          {
            type: 'Image',
            url: imageDataUrl,
            size: 'Large',
            horizontalAlignment: 'Center',
          },
        ],
        actions: [
          {
            type: 'Action.Submit',
            title: 'Get Hint',
            data: { action: 'get_hint' },
          },
          {
            type: 'Action.Submit',
            title: 'New Puzzle',
            data: { action: 'new_puzzle' },
          },
        ],
      })
    );
    await context.sendActivity(message);

    return conversationData;
  }

  /**
   * Send a hint step with rendered board image
   */
  private async sendHintStepWithImage(
    context: TurnContext,
    step: SolverHintStep,
    stepIndex: number,
    totalSteps: number,
    original: string,
    user: string,
    technique: string,
    level: number
  ): Promise<void> {
    // Render board with hint visualization
    const renderResult = this.boardRenderer.render(original, user, {
      hintStep: step,
    });

    // Convert to base64 for inline image
    const base64Image = renderResult.buffer.toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64Image}`;

    // Build hint text (use step.text as the explanation)
    const stepText = step.text || 'Follow the highlighted cells.';
    const stepProgress = `Step ${stepIndex + 1} of ${totalSteps}`;
    const isLastStep = stepIndex === totalSteps - 1;

    // Create message with image and text
    const message = MessageFactory.attachment(
      CardFactory.adaptiveCard({
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.5',
        body: [
          {
            type: 'TextBlock',
            text: `**${technique}** (Level ${level})`,
            wrap: true,
            weight: 'Bolder',
            size: 'Medium',
          },
          {
            type: 'TextBlock',
            text: stepProgress,
            wrap: true,
            size: 'Small',
            isSubtle: true,
          },
          {
            type: 'Image',
            url: imageDataUrl,
            size: 'Large',
            horizontalAlignment: 'Center',
          },
          {
            type: 'TextBlock',
            text: stepText,
            wrap: true,
          },
        ],
        actions: [
          ...(stepIndex > 0
            ? [
                {
                  type: 'Action.Submit',
                  title: '← Previous',
                  data: { action: 'previous_step' },
                },
              ]
            : []),
          ...(isLastStep
            ? [
                {
                  type: 'Action.Submit',
                  title: 'Apply Hint ✓',
                  data: { action: 'apply_hint' },
                },
              ]
            : [
                {
                  type: 'Action.Submit',
                  title: 'Next Step →',
                  data: { action: 'next_step' },
                },
              ]),
          {
            type: 'Action.Submit',
            title: 'New Puzzle',
            data: { action: 'new_puzzle' },
          },
        ],
      })
    );

    await context.sendActivity(message);
  }

  /**
   * Intro step - show welcome
   */
  private async introStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    await stepContext.context.sendActivity({ attachments: [createWelcomeCard()] });
    return stepContext.next();
  }

  /**
   * Process step
   */
  private async processStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    return stepContext.endDialog();
  }
}
