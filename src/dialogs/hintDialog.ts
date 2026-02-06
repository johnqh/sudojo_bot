/**
 * Hint Dialog
 * Handles fetching hints and navigating through hint steps
 */

import {
  ComponentDialog,
  WaterfallDialog,
  WaterfallStepContext,
  type DialogTurnResult,
} from 'botbuilder-dialogs';
import { SolverService } from '../services/solverService.js';
import { createHintStepCard, createHintAppliedCard, createNoHintCard } from '../cards/hintCard.js';
import type { PuzzleState, HintState } from '../state/conversationState.js';
import type { SolverHints } from '@sudobility/sudojo_types';
import { getTechniqueNameById } from '@sudobility/sudojo_types';

export const HINT_DIALOG = 'hintDialog';

export interface HintDialogOptions {
  puzzle: PuzzleState;
  existingHint?: HintState;
  action: 'get_hint' | 'next_step' | 'apply_hint';
}

export interface HintDialogResult {
  puzzle: PuzzleState;
  hint: HintState | null;
  applied: boolean;
}

export class HintDialog extends ComponentDialog {
  private solverService: SolverService;

  constructor(solverService: SolverService) {
    super(HINT_DIALOG);

    this.solverService = solverService;

    this.addDialog(new WaterfallDialog('hintWaterfall', [this.handleAction.bind(this)]));

    this.initialDialogId = 'hintWaterfall';
  }

  /**
   * Main handler - routes based on action
   */
  private async handleAction(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
    const options = stepContext.options as HintDialogOptions;
    const { puzzle, existingHint, action } = options;

    switch (action) {
      case 'get_hint':
        return this.getNewHint(stepContext, puzzle);
      case 'next_step':
        return this.showNextStep(stepContext, puzzle, existingHint);
      case 'apply_hint':
        return this.applyHint(stepContext, puzzle, existingHint);
      default:
        return stepContext.endDialog({
          puzzle,
          hint: existingHint || null,
          applied: false,
        } as HintDialogResult);
    }
  }

  /**
   * Get a new hint from the solver
   */
  private async getNewHint(
    stepContext: WaterfallStepContext,
    puzzle: PuzzleState
  ): Promise<DialogTurnResult> {
    try {
      // Check if puzzle is already complete
      if (
        puzzle.solution &&
        this.solverService.isPuzzleSolved(puzzle.original, puzzle.user, puzzle.solution)
      ) {
        const card = createNoHintCard('The puzzle is already complete!');
        await stepContext.context.sendActivity({ attachments: [card] });
        return stepContext.endDialog({
          puzzle,
          hint: null,
          applied: false,
        } as HintDialogResult);
      }

      await stepContext.context.sendActivity('Analyzing puzzle...');

      const result = await this.solverService.solve(puzzle.original, puzzle.user);

      if (!result.hints || result.hints.steps.length === 0) {
        const card = createNoHintCard(
          "I couldn't find a hint for this puzzle state. The puzzle may be invalid or already complete."
        );
        await stepContext.context.sendActivity({ attachments: [card] });
        return stepContext.endDialog({
          puzzle,
          hint: null,
          applied: false,
        } as HintDialogResult);
      }

      const hint = this.createHintState(result.hints);
      const card = this.createHintCard(puzzle, hint);
      await stepContext.context.sendActivity({ attachments: [card] });

      return stepContext.endDialog({
        puzzle,
        hint,
        applied: false,
      } as HintDialogResult);
    } catch (error) {
      console.error('Error getting hint:', error);
      await stepContext.context.sendActivity(
        'Sorry, I had trouble getting a hint. Please try again.'
      );
      return stepContext.endDialog({
        puzzle,
        hint: null,
        applied: false,
      } as HintDialogResult);
    }
  }

  /**
   * Show the next step in the current hint
   */
  private async showNextStep(
    stepContext: WaterfallStepContext,
    puzzle: PuzzleState,
    existingHint?: HintState
  ): Promise<DialogTurnResult> {
    if (!existingHint) {
      await stepContext.context.sendActivity('No hint in progress. Let me get a new hint for you.');
      return this.getNewHint(stepContext, puzzle);
    }

    // Advance to next step
    const nextIndex = existingHint.currentStepIndex + 1;
    if (nextIndex >= existingHint.steps.length) {
      // Already at last step, show apply option
      await stepContext.context.sendActivity(
        "You're at the last step. Use 'apply' to apply this hint."
      );
      const card = this.createHintCard(puzzle, existingHint);
      await stepContext.context.sendActivity({ attachments: [card] });
      return stepContext.endDialog({
        puzzle,
        hint: existingHint,
        applied: false,
      } as HintDialogResult);
    }

    const updatedHint: HintState = {
      ...existingHint,
      currentStepIndex: nextIndex,
    };

    const card = this.createHintCard(puzzle, updatedHint);
    await stepContext.context.sendActivity({ attachments: [card] });

    return stepContext.endDialog({
      puzzle,
      hint: updatedHint,
      applied: false,
    } as HintDialogResult);
  }

  /**
   * Apply the current hint to the puzzle
   */
  private async applyHint(
    stepContext: WaterfallStepContext,
    puzzle: PuzzleState,
    existingHint?: HintState
  ): Promise<DialogTurnResult> {
    if (!existingHint) {
      await stepContext.context.sendActivity('No hint to apply. Let me get a new hint for you.');
      return this.getNewHint(stepContext, puzzle);
    }

    try {
      // Get fresh solve to apply
      const result = await this.solverService.solve(puzzle.original, puzzle.user);

      // Apply the hint
      const updatedUser = this.solverService.applyHint(puzzle.user, result.board);

      const updatedPuzzle: PuzzleState = {
        ...puzzle,
        user: updatedUser,
      };

      const card = createHintAppliedCard(puzzle.original, updatedUser, existingHint.technique);
      await stepContext.context.sendActivity({ attachments: [card] });

      return stepContext.endDialog({
        puzzle: updatedPuzzle,
        hint: null, // Clear hint after applying
        applied: true,
      } as HintDialogResult);
    } catch (error) {
      console.error('Error applying hint:', error);
      await stepContext.context.sendActivity(
        'Sorry, I had trouble applying the hint. Please try again.'
      );
      return stepContext.endDialog({
        puzzle,
        hint: existingHint,
        applied: false,
      } as HintDialogResult);
    }
  }

  /**
   * Create hint state from solver hints
   */
  private createHintState(hints: SolverHints): HintState {
    return {
      steps: hints.steps,
      currentStepIndex: 0,
      technique: getTechniqueNameById(hints.technique),
      level: hints.level,
    };
  }

  /**
   * Create hint step card
   */
  private createHintCard(puzzle: PuzzleState, hint: HintState) {
    const step = hint.steps[hint.currentStepIndex];
    if (!step) {
      return createNoHintCard('Hint step not found');
    }

    return createHintStepCard(
      step,
      hint.currentStepIndex,
      hint.steps.length,
      puzzle.original,
      puzzle.user,
      hint.technique,
      hint.level
    );
  }
}
