import { describe, it, expect, mock, afterEach } from 'bun:test';
import { OCRService } from './ocrService.js';

describe('OCRService', () => {
  describe('validatePuzzle', () => {
    const service = new OCRService('http://localhost:3000');

    it('accepts valid 81-char puzzle with sufficient clues', () => {
      // Valid puzzle with 25 clues
      const puzzle =
        '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects puzzle shorter than 81 characters', () => {
      const puzzle =
        '53007000060019500009800006080006000340080300170002000606000028000041900500008007';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
      expect(result.error).toContain('80');
    });

    it('rejects puzzle longer than 81 characters', () => {
      const puzzle =
        '5300700006001950000980000608000600034008030017000200060600002800004190050000800790';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
      expect(result.error).toContain('82');
    });

    it('rejects puzzle with non-digit characters', () => {
      const puzzle =
        '53007000060019500009800006080006000340080300170002000606000028000041900500008007X';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('non-digit');
    });

    it('rejects puzzle with fewer than 17 clues', () => {
      // Puzzle with only 16 clues (16 non-zero digits)
      const puzzle =
        '123456789000000000000000000000000000000000000000000000000000000000000001234567000';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Too few clues');
      expect(result.error).toContain('16');
    });

    it('accepts puzzle with exactly 17 clues (minimum valid)', () => {
      // Puzzle with exactly 17 clues (17 non-zero digits)
      const puzzle =
        '123456789000000000000000000000000000000000000000000000000000000000000001234567800';
      const result = service.validatePuzzle(puzzle);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('extractPuzzle', () => {
    const originalFetch = globalThis.fetch;
    const original =
      '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    const okResponse = () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            board: {
              original,
              user: '0'.repeat(81),
              pencilmark: { autopencil: true, numbers: '12,3,,' },
            },
            confidence: 92.5,
            digitCount: 30,
          },
        }),
        { headers: { 'content-type': 'application/json' } }
      );

    it('posts the base64 image to the API OCR endpoint', async () => {
      let calledUrl = '';
      let calledBody = '';
      let calledMethod = '';
      globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        calledUrl = url.toString();
        calledBody = String(init?.body ?? '');
        calledMethod = String(init?.method ?? '');
        return okResponse();
      }) as unknown as typeof fetch;

      const service = new OCRService('http://localhost:3000/');
      const result = await service.extractPuzzle(Buffer.from('image-bytes'));

      expect(calledUrl).toBe('http://localhost:3000/api/v1/ocr/extract');
      expect(calledMethod).toBe('POST');
      expect(JSON.parse(calledBody).image).toBe(Buffer.from('image-bytes').toString('base64'));
      expect(result.puzzle).toBe(original);
      expect(result.confidence).toBe(92.5);
      expect(result.digitCount).toBe(30);
      expect(result.autopencil).toBe(true);
      expect(result.pencilmarks).toBe('12,3,,');
    });

    it('throws when the API reports a failure', async () => {
      globalThis.fetch = mock(
        async () =>
          new Response(JSON.stringify({ success: false, error: 'no board found' }), {
            headers: { 'content-type': 'application/json' },
          })
      ) as unknown as typeof fetch;

      const service = new OCRService('http://localhost:3000');
      await expect(service.extractPuzzle(Buffer.from('x'))).rejects.toThrow('no board found');
    });

    it('throws on an empty image buffer without calling the API', async () => {
      let called = false;
      globalThis.fetch = mock(async () => {
        called = true;
        return okResponse();
      }) as unknown as typeof fetch;

      const service = new OCRService('http://localhost:3000');
      await expect(service.extractPuzzle(Buffer.alloc(0))).rejects.toThrow('empty image');
      expect(called).toBe(false);
    });
  });
});
