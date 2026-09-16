/**
 * OCR Service for extracting Sudoku puzzles from images
 *
 * OCR runs server-side: this calls sudojo_api's POST /api/v1/ocr/extract
 * (which runs the sudojo_ocr_ml model service and falls back to its own
 * Tesseract pipeline) through @sudobility/sudojo_client. Nothing is
 * recognized locally, so the bot bundles no OCR engine or model file.
 */

import { SudojoClient } from '@sudobility/sudojo_client/network';
import { FetchNetworkClient } from './networkClient.js';

export interface OCRExtractResult {
  /** 81-char puzzle string (0 = empty) */
  puzzle: string;
  /** Average confidence score (0-100) */
  confidence: number;
  /** Number of digits recognized */
  digitCount: number;
  /** Comma-separated pencilmark string (81 entries) */
  pencilmarks: string;
  /** Whether OCR detected pencilmarks in the image */
  autopencil: boolean;
}

/**
 * OCR service backed by the sudojo_api OCR endpoint.
 * Stateless: every extraction is a single HTTP request.
 */
export class OCRService {
  private client: SudojoClient;
  private token: string;

  /**
   * @param baseUrl - Base URL of sudojo_api (the same value the solver uses)
   * @param token - Auth token; the OCR endpoint is unauthenticated, so '' is fine
   */
  constructor(baseUrl: string, token: string = '') {
    this.client = new SudojoClient(new FetchNetworkClient(), baseUrl.replace(/\/$/, ''));
    this.token = token;
  }

  /**
   * Extract a Sudoku puzzle from an image buffer
   * @param imageBuffer - Image data as Buffer
   * @returns Extracted puzzle data
   * @throws when the request fails or the API reports an error
   */
  async extractPuzzle(imageBuffer: Buffer): Promise<OCRExtractResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('OCR failed: empty image');
    }

    // Images arrive as chat attachments, so the whole-board model is preferred.
    const response = await this.client.extractOcr(this.token, imageBuffer.toString('base64'), {
      source: 'library',
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'OCR extraction failed');
    }

    const { board, confidence, digitCount } = response.data;

    return {
      puzzle: board.original,
      confidence,
      digitCount,
      pencilmarks: board.pencilmark?.numbers ?? '',
      autopencil: board.pencilmark?.autopencil ?? false,
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
