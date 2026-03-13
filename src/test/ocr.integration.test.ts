/**
 * OCR Integration Tests for sudojo_bot
 *
 * Uses the Node adapter to verify that @sudobility/sudojo_ocr produces
 * correct results with the test fixtures. These tests mirror the
 * integration tests in sudojo_ocr.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import path from 'path';
import { fileURLToPath } from 'url';
import Tesseract from 'tesseract.js';
import { extractSudokuFromImage } from '@sudobility/sudojo_ocr';
import { createNodeAdapter } from '@sudobility/sudojo_ocr/node';
import type { CanvasAdapter, TesseractModule } from '@sudobility/sudojo_ocr';

const tesseractModule = Tesseract as unknown as TesseractModule;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT = 120_000;

let adapter: CanvasAdapter;

beforeAll(async () => {
  adapter = await createNodeAdapter();
});

describe('OCR integration: digit recognition', () => {
  const TEST_CASES = [
    {
      name: 'Board-1',
      path: path.resolve(__dirname, 'fixtures/Sudoku-Board-1.jpg'),
      expected:
        '509000400708304900601000730462500000385720649107408200200100004003040087070053006',
    },
    {
      name: 'Board-2',
      path: path.resolve(__dirname, 'fixtures/Sudoku-Board-2.png'),
      expected:
        '700520008056098000040367050062780000801400002430019060000005000500602931007941500',
    },
    {
      name: 'Board-3',
      path: path.resolve(__dirname, 'fixtures/Sudoku-Board-3.jpg'),
      expected:
        '000150000000894062908070050050483020603010500800205309140008090280940005000607800',
    },
  ];

  for (const tc of TEST_CASES) {
    it(
      `should recognize digits in ${tc.name}`,
      async () => {
        const result = await extractSudokuFromImage(adapter, tc.path, tesseractModule, {
          skipBoardDetection: false,
        });

        expect(result.board.original).toHaveLength(81);
        expect(result.digitCount).toBeGreaterThan(0);

        let correct = 0;
        for (let i = 0; i < 81; i++) {
          if (result.board.original[i] === tc.expected[i]) correct++;
        }
        expect(correct).toBeGreaterThanOrEqual(77);
      },
      TIMEOUT
    );
  }
});

describe('OCR integration: pencilmark recognition', () => {
  const PENCILMARK_IMAGE = path.resolve(
    __dirname,
    'fixtures/Sudoku-Board-Pencilmarks.png'
  );

  const EXPECTED_DIGITS =
    '600320709' +
    '290003000' +
    '073869002' +
    '300604000' +
    '060200030' +
    '000503001' +
    '700932000' +
    '031006298' +
    '926000073';

  const EXPECTED_PENCILMARKS =
    ',1458,458,,,15,,1458,' +
    ',,,458,147,1457,157,,14568,456,' +
    '145,,,,,,145,145,,' +
    ',158,25789,,1789,,589,258,57,' +
    '1458,,45789,,1789,178,4589,,457,' +
    '48,48,24789,,789,,4689,2468,,' +
    ',458,458,,,,1456,1456,456,' +
    '45,,,47,457,,,,,' +
    ',,,14,1458,158,145,,';

  const expectedEntries = EXPECTED_PENCILMARKS.split(',');

  const PENCILMARK_CELL_INDICES = expectedEntries
    .map((e, i) => (e.length > 0 ? i : -1))
    .filter((i) => i >= 0);

  it(
    'should detect pencilmarks and set autopencil true',
    async () => {
      const result = await extractSudokuFromImage(adapter, PENCILMARK_IMAGE, tesseractModule, {
        recognizePencilmarks: true,
      });

      expect(result.board.pencilmark.autopencil).toBe(true);

      const entries = result.board.pencilmark.numbers.split(',');
      expect(entries).toHaveLength(81);

      const nonEmpty = entries.filter((e) => e.length > 0);
      expect(nonEmpty.length).toBeGreaterThanOrEqual(10);
    },
    TIMEOUT
  );

  it(
    'should recognize large digits correctly alongside pencilmarks',
    async () => {
      const result = await extractSudokuFromImage(adapter, PENCILMARK_IMAGE, tesseractModule, {
        recognizePencilmarks: true,
      });

      expect(result.digitCount).toBeGreaterThan(0);

      let correctGivens = 0;
      let totalGivens = 0;
      for (let i = 0; i < 81; i++) {
        if (EXPECTED_DIGITS[i] !== '0') {
          totalGivens++;
          if (result.board.original[i] === EXPECTED_DIGITS[i]) correctGivens++;
        }
      }
      expect(correctGivens).toBeGreaterThanOrEqual(Math.floor(totalGivens * 0.9));
    },
    TIMEOUT
  );

  it(
    'should detect pencilmarks in expected cells',
    async () => {
      const result = await extractSudokuFromImage(adapter, PENCILMARK_IMAGE, tesseractModule, {
        recognizePencilmarks: true,
      });

      const entries = result.board.pencilmark.numbers.split(',');

      let detected = 0;
      for (const idx of PENCILMARK_CELL_INDICES) {
        if (entries[idx] && entries[idx].length > 0) {
          detected++;
        }
      }

      expect(detected).toBeGreaterThanOrEqual(
        Math.floor(PENCILMARK_CELL_INDICES.length * 0.5)
      );
    },
    TIMEOUT
  );

  it(
    'should detect correct pencilmark digits per cell',
    async () => {
      const result = await extractSudokuFromImage(adapter, PENCILMARK_IMAGE, tesseractModule, {
        recognizePencilmarks: true,
      });

      const entries = result.board.pencilmark.numbers.split(',');

      let correctSubsetCount = 0;
      let detectedCells = 0;
      for (const idx of PENCILMARK_CELL_INDICES) {
        if (!entries[idx] || entries[idx].length === 0) continue;
        detectedCells++;
        const detectedDigits = new Set(entries[idx].split(''));
        const expectedDigits = new Set(expectedEntries[idx].split(''));
        const allCorrect = [...detectedDigits].every((d) => expectedDigits.has(d));
        if (allCorrect) correctSubsetCount++;
      }

      expect(correctSubsetCount).toBeGreaterThanOrEqual(Math.floor(detectedCells * 0.5));
    },
    TIMEOUT
  );
});
