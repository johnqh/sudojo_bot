import { describe, it, expect, mock, afterEach } from 'bun:test';
import { SolverService } from './solverService.js';
import type { SolverBoard } from '@sudobility/sudojo_types';

describe('SolverService', () => {
  // Completion is judged from the grid alone (full + no repeated digit in any row, column or
  // box). The solution from sudojo_api can't be used: it arrives AES-encrypted ("enc:...").
  describe('isPuzzleSolved', () => {
    const service = new SolverService('http://localhost:3000');
    const original =
      '530070000600195000098000060800060003400803001700020006060000280000419005000080079';

    it('returns true when the merged grid is full and valid', () => {
      const user =
        '004608912072000348100342507059701420026050790013904850901537204287000630345206100';
      expect(service.isPuzzleSolved(original, user)).toBe(true);
    });

    it('returns false when puzzle is incomplete', () => {
      const user =
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      expect(service.isPuzzleSolved(original, user)).toBe(false);
    });

    it('returns false when a user digit overrides a given with a wrong value', () => {
      // First user digit is 1 where the given is 5, so row 1 contains two 1s
      const user =
        '100608912072000348100342507059701420026050790013904850901537204287000630345206100';
      expect(service.isPuzzleSolved(original, user)).toBe(false);
    });

    it('returns false for a full grid that repeats a digit in a box', () => {
      // Valid rows and columns are not enough: this is a shifted Latin square
      // (every row and column is a permutation of 1-9) whose boxes repeat digits.
      const latinSquare = Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => String(((r + c) % 9) + 1)).join('')
      ).join('');
      const empty = '0'.repeat(81);
      expect(service.isPuzzleSolved(empty, latinSquare)).toBe(false);
    });

    it('treats "." as an empty cell', () => {
      const user = '.'.repeat(81);
      expect(service.isPuzzleSolved(original, user)).toBe(false);
    });
  });

  describe('applyHint', () => {
    const service = new SolverService('http://localhost:3000');

    it('returns board.user from the solver response', () => {
      const user =
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      const board: SolverBoard = {
        original:
          '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
        user: '004000000000000000000000000000000000000000000000000000000000000000000000000000000',
        pencilmark: {
          autopencil: false,
          numbers: '',
        },
      };

      const result = service.applyHint(user, board);
      expect(result).toBe(board.user);
    });
  });

  describe('solve', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('calls correct URL with parameters', async () => {
      let calledUrl = '';
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        calledUrl = url.toString();
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              board: {
                original: 'test',
                user: 'test',
                pencilmark: { autopencil: false, numbers: '' },
              },
              hints: {
                technique: 1,
                level: 1,
                steps: [],
              },
            },
          })
        );
      }) as unknown as typeof fetch;

      const service = new SolverService('http://localhost:3000');
      await service.solve('original123', 'user456', undefined, false);

      expect(calledUrl).toContain('http://localhost:3000/api/v1/solver/solve');
      expect(calledUrl).toContain('original=original123');
      expect(calledUrl).toContain('user=user456');
      expect(calledUrl).toContain('autopencilmarks=false');
    });

    it('returns board and hints on success', async () => {
      const mockBoard = {
        original: 'orig',
        user: 'usr',
        pencilmark: { autopencil: false, numbers: '' },
      };
      const mockHints = {
        technique: 1,
        level: 1,
        steps: [{ title: 'Step 1', text: 'Description', areas: [], cells: [] }],
      };

      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            data: { board: mockBoard, hints: mockHints },
          })
        );
      }) as unknown as typeof fetch;

      const service = new SolverService('http://localhost:3000');
      const result = await service.solve('orig', 'usr');

      expect(result.board).toEqual(mockBoard);
      expect(result.hints).toEqual(mockHints);
    });

    it('throws error on failure response', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid puzzle',
          }),
          { status: 400 }
        );
      }) as unknown as typeof fetch;

      const service = new SolverService('http://localhost:3000');
      expect(service.solve('bad', 'puzzle')).rejects.toThrow('Invalid puzzle');
    });
  });

  describe('validate', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('returns valid with level and solution on success', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              board: {
                level: 3,
                solution:
                  '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
              },
            },
          })
        );
      }) as unknown as typeof fetch;

      const service = new SolverService('http://localhost:3000');
      const result = await service.validate(
        '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
      );

      expect(result.valid).toBe(true);
      expect(result.level).toBe(3);
      expect(result.solution).toBe(
        '534678912672195348198342567859761423426853791713924856961537284287419635345286179'
      );
    });

    it('returns invalid on failure', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No unique solution',
          }),
          { status: 400 }
        );
      }) as unknown as typeof fetch;

      const service = new SolverService('http://localhost:3000');
      const result = await service.validate(
        '000000000000000000000000000000000000000000000000000000000000000000000000000000000'
      );

      expect(result.valid).toBe(false);
      expect(result.level).toBeUndefined();
      expect(result.solution).toBeUndefined();
    });
  });
});
