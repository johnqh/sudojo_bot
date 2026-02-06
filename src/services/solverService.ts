/**
 * Solver Service for getting Sudoku hints
 * Calls the Sudojo solver API
 */

import type { SolveData, ValidateData, SolverHints, SolverBoard } from '@sudobility/sudojo_types';
import type { BaseResponse } from '@sudobility/types';

export interface SolveResult {
  /** Updated board state after applying hint */
  board: SolverBoard;
  /** Hint information */
  hints: SolverHints;
}

export interface ValidateResult {
  /** Whether puzzle is valid and has unique solution */
  valid: boolean;
  /** Puzzle difficulty level */
  level?: number;
  /** Solution string (81 chars) */
  solution?: string;
}

export class SolverService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Get a hint for the current puzzle state
   * @param original - Original puzzle (81 chars)
   * @param user - User's current input (81 chars)
   * @param pencilmarks - Optional pencilmarks string
   * @param autoPencilmarks - Whether autopencilmarks is enabled
   */
  async solve(
    original: string,
    user: string,
    pencilmarks?: string,
    autoPencilmarks: boolean = false
  ): Promise<SolveResult> {
    const params = new URLSearchParams({
      original,
      user,
      autopencilmarks: autoPencilmarks.toString(),
    });

    if (pencilmarks) {
      params.set('pencilmarks', pencilmarks);
    }

    const url = `${this.baseUrl}/api/v1/solver/solve?${params.toString()}`;

    const response = await fetch(url);
    const json = (await response.json()) as BaseResponse<SolveData>;

    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.error || `Solver error: ${response.status}`);
    }

    return {
      board: json.data.board,
      hints: json.data.hints,
    };
  }

  /**
   * Validate a puzzle and get its solution
   * @param original - Puzzle to validate (81 chars)
   */
  async validate(original: string): Promise<ValidateResult> {
    const params = new URLSearchParams({ original });
    const url = `${this.baseUrl}/api/v1/solver/validate?${params.toString()}`;

    const response = await fetch(url);
    const json = (await response.json()) as BaseResponse<ValidateData>;

    if (!response.ok || !json.success || !json.data) {
      return { valid: false };
    }

    return {
      valid: true,
      level: json.data.board.level,
      solution: json.data.board.solution,
    };
  }

  /**
   * Check if a puzzle is completely solved
   * @param original - Original puzzle
   * @param user - User's current input
   * @param solution - Known solution
   */
  isPuzzleSolved(original: string, user: string, solution: string): boolean {
    for (let i = 0; i < 81; i++) {
      const actual = user[i] !== '0' ? user[i] : original[i];
      if (actual !== solution[i]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Apply a hint to the user's board
   * Updates the user string based on hint cell actions
   */
  applyHint(_user: string, board: SolverBoard): string {
    // The solver returns the updated board state
    return board.user;
  }
}
