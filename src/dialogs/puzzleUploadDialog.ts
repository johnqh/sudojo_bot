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
import { t } from '../i18n/index.js';

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

/**
 * Dialog for handling image upload, OCR extraction, and puzzle confirmation.
 * Implements a 4-step waterfall: prompt for image, process OCR, confirm puzzle, finalize.
 * Returns PuzzleUploadResult with the extracted puzzle state and confirmation status.
 */
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
      await promptContext.context.sendActivity(t('dialog.uploadImage'));
      return false;
    }

    const hasImage = attachments.some(a => this.imageService.isImageAttachment(a));

    if (!hasImage) {
      await promptContext.context.sendActivity(t('dialog.notAnImage'));
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
      prompt: t('dialog.uploadPhotoPrompt'),
      retryPrompt: t('dialog.retryPrompt'),
    });
  }

  /**
   * Step 2: Process the uploaded image with OCR
   */
  private async processImage(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    const attachments = stepContext.result as Attachment[];
    const imageAttachment = attachments.find(a => this.imageService.isImageAttachment(a));

    if (!imageAttachment) {
      await stepContext.context.sendActivity(t('dialog.couldNotFindImage'));
      return stepContext.endDialog({ puzzle: null, confirmed: false });
    }

    await stepContext.context.sendActivity(t('dialog.processingImage'));

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
          t('dialog.invalidPuzzleExtraction', { error: validation.error })
        );
        return stepContext.endDialog({ puzzle: null, confirmed: false });
      }

      // Validate with solver (check for unique solution)
      const solverValidation = await this.solverService.validate(ocrResult.puzzle);
      if (!solverValidation.valid) {
        await stepContext.context.sendActivity(t('dialog.noUniqueSolution'));
        return stepContext.endDialog({ puzzle: null, confirmed: false });
      }

      // Store puzzle state for next step
      const puzzleState: PuzzleState = {
        original: ocrResult.puzzle,
        user: '0'.repeat(81),
        solution: solverValidation.solution,
        confidence: ocrResult.confidence,
        pencilmarks: ocrResult.pencilmarks,
        autopencil: ocrResult.autopencil,
      };

      (stepContext.values as DialogValues).puzzle = puzzleState;

      // Show puzzle card
      const card = createPuzzleCard(puzzleState, true);
      await stepContext.context.sendActivity({ attachments: [card] });

      return stepContext.next();
    } catch (error) {
      console.error('Error processing image:', error);
      await stepContext.context.sendActivity(t('dialog.imageProcessErrorClearer'));
      return stepContext.endDialog({ puzzle: null, confirmed: false });
    }
  }

  /**
   * Step 3: Confirm the puzzle
   */
  private async confirmPuzzle(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    return stepContext.prompt(CONFIRMATION_PROMPT, {
      prompt: t('dialog.isPuzzleCorrect'),
      choices: ChoiceFactory.toChoices([t('puzzle.yesGetHints'), t('puzzle.noTryAgain')]),
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

    await stepContext.context.sendActivity(t('dialog.uploadAnother'));
    return stepContext.endDialog({
      puzzle: null,
      confirmed: false,
    } as PuzzleUploadResult);
  }
}
