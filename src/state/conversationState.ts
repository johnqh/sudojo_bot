/**
 * Conversation state for Sudoku Hint Bot
 * Tracks current puzzle and hint navigation state
 */

import type { SolverHintStep } from '@sudobility/sudojo_types';

/**
 * Current puzzle state
 */
export interface PuzzleState {
  /** Original puzzle string (81 chars, 0 = empty) */
  original: string;
  /** User's current progress (81 chars, 0 = no input) */
  user: string;
  /** Solution string (81 chars) */
  solution?: string;
  /** OCR confidence score (0-100) */
  confidence: number;
}

/**
 * Current hint state
 */
export interface HintState {
  /** Hint steps from solver */
  steps: SolverHintStep[];
  /** Current step index being shown */
  currentStepIndex: number;
  /** Technique name */
  technique: string;
  /** Technique level */
  level: number;
}

/**
 * Full conversation data stored in state
 */
export interface SudokuConversationData {
  /** Current puzzle being worked on */
  currentPuzzle: PuzzleState | null;
  /** Current hint being navigated */
  currentHint: HintState | null;
  /** Whether user has confirmed the puzzle */
  puzzleConfirmed: boolean;
}

/**
 * Create empty conversation data
 */
export function createEmptyConversationData(): SudokuConversationData {
  return {
    currentPuzzle: null,
    currentHint: null,
    puzzleConfirmed: false,
  };
}

/**
 * User profile data
 */
export interface SudokuUserData {
  /** User's preferred language */
  language?: string;
  /** Total puzzles solved */
  puzzlesSolved: number;
  /** Total hints used */
  hintsUsed: number;
}

/**
 * Create empty user data
 */
export function createEmptyUserData(): SudokuUserData {
  return {
    puzzlesSolved: 0,
    hintsUsed: 0,
  };
}
