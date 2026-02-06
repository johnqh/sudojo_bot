/**
 * Puzzle Upload Dialog
 * Handles image upload, OCR extraction, and puzzle confirmation
 */

import {
  ComponentDialog,
  WaterfallDialog,
  WaterfallStepContext,
  type DialogTurnResult,
  AttachmentPrompt,
  type PromptValidatorContext,
  ChoicePrompt,
  ChoiceFactory,
} from 'botbuilder-dialogs';
import type { Attachment } from 'botbuilder';
import { OCRService } from '../services/ocrService.js';
import { SolverService } from '../services/solverService.js';
import { ImageService } from '../services/imageService.js';
import { createPuzzleCard } from '../cards/puzzleCard.js';
import type { PuzzleState } from '../state/conversationState.js';

export const PUZZLE_UPLOAD_DIALOG = 'puzzleUploadDialog';
const ATTACHMENT_PROMPT = 'attachmentPrompt';
const CONFIRMATION_PROMPT = 'confirmationPrompt';

export interface PuzzleUploadResult {
  puzzle: PuzzleState | null;
  confirmed: boolean;
}

interface DialogValues {
  puzzle?: PuzzleState;
}

export class PuzzleUploadDialog extends ComponentDialog {
  private ocrService: OCRService;
  private solverService: SolverService;
  private imageService: ImageService;

  constructor(ocrService: OCRService, solverService: SolverService) {
    super(PUZZLE_UPLOAD_DIALOG);

    this.ocrService = ocrService;
    this.solverService = solverService;
    this.imageService = new ImageService();

    // Add prompts
    this.addDialog(new AttachmentPrompt(ATTACHMENT_PROMPT, this.imagePromptValidator.bind(this)));
    this.addDialog(new ChoicePrompt(CONFIRMATION_PROMPT));

    // Add waterfall
    this.addDialog(
      new WaterfallDialog('puzzleUploadWaterfall', [
        this.promptForImage.bind(this),
        this.processImage.bind(this),
        this.confirmPuzzle.bind(this),
        this.finalize.bind(this),
      ])
    );

    this.initialDialogId = 'puzzleUploadWaterfall';
  }

  /**
   * Validate that attachment is an image
   */
  private async imagePromptValidator(
    promptContext: PromptValidatorContext<Attachment[]>
  ): Promise<boolean> {
    if (!promptContext.recognized.succeeded) {
      return false;
    }

    const attachments = promptContext.recognized.value;
    if (!attachments || attachments.length === 0) {
      await promptContext.context.sendActivity('Please upload an image of your Sudoku puzzle.');
      return false;
    }

    const hasImage = attachments.some(a => this.imageService.isImageAttachment(a));

    if (!hasImage) {
      await promptContext.context.sendActivity(
        "That doesn't look like an image. Please upload a photo of your Sudoku puzzle."
      );
      return false;
    }

    return true;
  }

  /**
   * Step 1: Prompt for image upload
   */
  private async promptForImage(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    // Check if an image was already provided
    const existingImage = this.imageService.getFirstImageAttachment(stepContext.context);

    if (existingImage) {
      // Skip prompt, use existing image
      return stepContext.next([existingImage]);
    }

    return stepContext.prompt(ATTACHMENT_PROMPT, {
      prompt: 'Please upload a photo of your Sudoku puzzle.',
      retryPrompt: 'I need an image to extract the puzzle. Please upload a photo.',
    });
  }

  /**
   * Step 2: Process the uploaded image with OCR
   */
  private async processImage(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    const attachments = stepContext.result as Attachment[];
    const imageAttachment = attachments.find(a => this.imageService.isImageAttachment(a));

    if (!imageAttachment) {
      await stepContext.context.sendActivity(
        "I couldn't find an image in your message. Please try again."
      );
      return stepContext.endDialog({ puzzle: null, confirmed: false });
    }

    await stepContext.context.sendActivity('Processing your puzzle image...');

    try {
      // Download the image
      const imageBuffer = await this.imageService.downloadAttachment(
        stepContext.context,
        imageAttachment
      );

      // Run OCR
      const ocrResult = await this.ocrService.extractPuzzle(imageBuffer);

      // Validate puzzle
      const validation = this.ocrService.validatePuzzle(ocrResult.puzzle);
      if (!validation.valid) {
        await stepContext.context.sendActivity(
          `I couldn't extract a valid puzzle: ${validation.error}. Please try a clearer image.`
        );
        return stepContext.endDialog({ puzzle: null, confirmed: false });
      }

      // Validate with solver (check for unique solution)
      const solverValidation = await this.solverService.validate(ocrResult.puzzle);
      if (!solverValidation.valid) {
        await stepContext.context.sendActivity(
          "This puzzle doesn't appear to have a unique solution. Please check the image and try again."
        );
        return stepContext.endDialog({ puzzle: null, confirmed: false });
      }

      // Store puzzle state for next step
      const puzzleState: PuzzleState = {
        original: ocrResult.puzzle,
        user: '0'.repeat(81),
        solution: solverValidation.solution,
        confidence: ocrResult.confidence,
      };

      (stepContext.values as DialogValues).puzzle = puzzleState;

      // Show puzzle card
      const card = createPuzzleCard(puzzleState, true);
      await stepContext.context.sendActivity({ attachments: [card] });

      return stepContext.next();
    } catch (error) {
      console.error('Error processing image:', error);
      await stepContext.context.sendActivity(
        'Sorry, I had trouble processing that image. Please try again with a clearer photo.'
      );
      return stepContext.endDialog({ puzzle: null, confirmed: false });
    }
  }

  /**
   * Step 3: Confirm the puzzle
   */
  private async confirmPuzzle(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    return stepContext.prompt(CONFIRMATION_PROMPT, {
      prompt: 'Is this puzzle correct?',
      choices: ChoiceFactory.toChoices(['Yes, get hints', 'No, try again']),
    });
  }

  /**
   * Step 4: Finalize based on confirmation
   */
  private async finalize(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    const choice = stepContext.result?.value || '';
    const puzzle = (stepContext.values as DialogValues).puzzle;

    if (choice.toLowerCase().includes('yes') && puzzle) {
      return stepContext.endDialog({
        puzzle,
        confirmed: true,
      } as PuzzleUploadResult);
    }

    await stepContext.context.sendActivity(
      'No problem! Please upload another image of your puzzle.'
    );
    return stepContext.endDialog({
      puzzle: null,
      confirmed: false,
    } as PuzzleUploadResult);
  }
}
