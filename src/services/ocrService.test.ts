import { describe, it, expect } from 'bun:test';
import { OCRService } from './ocrService.js';

describe('OCRService', () => {
  describe('validatePuzzle', () => {
    const service = new OCRService();

    it('accepts valid 81-char puzzle with sufficient clues', () => {
      // Valid puzzle with 25 clues
      const puzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects puzzle shorter than 81 characters', () => {
      const puzzle = '53007000060019500009800006080006000340080300170002000606000028000041900500008007';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
      expect(result.error).toContain('80');
    });

    it('rejects puzzle longer than 81 characters', () => {
      const puzzle = '5300700006001950000980000608000600034008030017000200060600002800004190050000800790';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
      expect(result.error).toContain('82');
    });

    it('rejects puzzle with non-digit characters', () => {
      const puzzle = '53007000060019500009800006080006000340080300170002000606000028000041900500008007X';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-digit');
    });

    it('rejects puzzle with fewer than 17 clues', () => {
      // Puzzle with only 16 clues (16 non-zero digits)
      const puzzle = '123456789000000000000000000000000000000000000000000000000000000000000001234567000';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too few clues');
      expect(result.error).toContain('16');
    });

    it('accepts puzzle with exactly 17 clues (minimum valid)', () => {
      // Puzzle with exactly 17 clues (17 non-zero digits)
      const puzzle = '123456789000000000000000000000000000000000000000000000000000000000000001234567800';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
