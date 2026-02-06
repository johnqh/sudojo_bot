/**
 * OCR Service for extracting Sudoku puzzles from images
 * Wraps @sudobility/sudojo_ocr for use in the bot
 */

import { extractSudokuFromImage } from '@sudobility/sudojo_ocr';
import { createNodeAdapter } from '@sudobility/sudojo_ocr/node';
import type { CanvasAdapter, OCRResult, OCRProgress } from '@sudobility/sudojo_ocr';
import Tesseract from 'tesseract.js';

export interface OCRExtractResult {
  /** 81-char puzzle string (0 = empty) */
  puzzle: string;
  /** Average confidence score (0-100) */
  confidence: number;
  /** Number of digits recognized */
  digitCount: number;
}

export class OCRService {
  private adapter: CanvasAdapter | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the OCR service (loads canvas adapter)
   */
  async init(): Promise<void> {
    if (this.adapter) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      this.adapter = await createNodeAdapter();
    })();

    await this.initPromise;
  }

  /**
   * Extract a Sudoku puzzle from an image buffer
   * @param imageBuffer - Image data as Buffer
   * @param onProgress - Optional progress callback
   * @returns Extracted puzzle data
   */
  async extractPuzzle(
    imageBuffer: Buffer,
    onProgress?: (progress: OCRProgress) => void
  ): Promise<OCRExtractResult> {
    await this.init();

    if (!this.adapter) {
      throw new Error('OCR adapter not initialized');
    }

    const result: OCRResult = await extractSudokuFromImage(
      this.adapter,
      imageBuffer,
      Tesseract,
      {
        skipBoardDetection: false,
        preprocess: true,
        minConfidence: 1,
        cellMargin: 0.154,
      },
      onProgress
    );

    return {
      puzzle: result.puzzle,
      confidence: result.confidence,
      digitCount: result.digitCount,
    };
  }

  /**
   * Validate that a puzzle string is valid
   * - Must be 81 characters
   * - Must contain only digits 0-9
   * - Must have at least 17 clues (minimum for unique solution)
   */
  validatePuzzle(puzzle: string): { valid: boolean; error?: string } {
    if (puzzle.length !== 81) {
      return { valid: false, error: `Invalid length: ${puzzle.length}, expected 81` };
    }

    if (!/^[0-9]+$/.test(puzzle)) {
      return { valid: false, error: 'Puzzle contains non-digit characters' };
    }

    const clueCount = puzzle.split('').filter(c => c !== '0').length;
    if (clueCount < 17) {
      return { valid: false, error: `Too few clues: ${clueCount}, minimum is 17` };
    }

    return { valid: true };
  }
}
