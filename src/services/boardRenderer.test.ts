import { describe, it, expect } from 'bun:test';
import { BoardRenderer, createBoardRenderer } from './boardRenderer.js';
import type { SolverHintStep } from '@sudobility/sudojo_types';

describe('BoardRenderer', () => {
  const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const user = '000000000000000000000000000000000000000000000000000000000000000000000000000000000';

  describe('render', () => {
    it('returns PNG buffer with correct magic bytes', () => {
      const renderer = new BoardRenderer(450);
      const result = renderer.render(original, user);

      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      expect(result.buffer[0]).toBe(0x89);
      expect(result.buffer[1]).toBe(0x50); // P
      expect(result.buffer[2]).toBe(0x4e); // N
      expect(result.buffer[3]).toBe(0x47); // G
      expect(result.buffer[4]).toBe(0x0d);
      expect(result.buffer[5]).toBe(0x0a);
      expect(result.buffer[6]).toBe(0x1a);
      expect(result.buffer[7]).toBe(0x0a);
    });

    it('returns correct dimensions', () => {
      const renderer = new BoardRenderer(450);
      const result = renderer.render(original, user);

      expect(result.width).toBe(450);
      expect(result.height).toBe(450);
    });

    it('renders without error in dark mode', () => {
      const renderer = new BoardRenderer(450);
      const result = renderer.render(original, user, { darkMode: true });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.width).toBe(450);
      expect(result.height).toBe(450);
    });

    it('renders with hint step without error', () => {
      const hintStep: SolverHintStep = {
        title: 'Naked Single',
        text: 'Cell R1C3 can only be 4',
        areas: [],
        cells: [
          {
            row: 0,
            column: 2,
            color: 'green',
            fill: true,
            actions: {
              select: '4',
              unselect: '',
              add: '',
              remove: '',
              highlight: '',
            },
          },
        ],
      };

      const renderer = new BoardRenderer(450);
      const result = renderer.render(original, user, { hintStep });

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('createBoardRenderer', () => {
    it('creates renderer with default size', () => {
      const renderer = createBoardRenderer();
      const result = renderer.render(original, user);

      expect(result.width).toBe(450);
      expect(result.height).toBe(450);
    });

    it('creates renderer with custom size', () => {
      const renderer = createBoardRenderer(600);
      const result = renderer.render(original, user);

      expect(result.width).toBe(600);
      expect(result.height).toBe(600);
    });
  });
});
