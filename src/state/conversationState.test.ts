import { describe, it, expect } from 'bun:test';
import { createEmptyConversationData, createEmptyUserData } from './conversationState.js';

describe('conversationState', () => {
  describe('createEmptyConversationData', () => {
    it('returns object with null puzzle', () => {
      const data = createEmptyConversationData();
      expect(data.currentPuzzle).toBeNull();
    });

    it('returns object with null hint', () => {
      const data = createEmptyConversationData();
      expect(data.currentHint).toBeNull();
    });

    it('returns object with puzzleConfirmed=false', () => {
      const data = createEmptyConversationData();
      expect(data.puzzleConfirmed).toBe(false);
    });

    it('returns new object each time', () => {
      const data1 = createEmptyConversationData();
      const data2 = createEmptyConversationData();
      expect(data1).not.toBe(data2);
    });
  });

  describe('createEmptyUserData', () => {
    it('returns object with puzzlesSolved=0', () => {
      const data = createEmptyUserData();
      expect(data.puzzlesSolved).toBe(0);
    });

    it('returns object with hintsUsed=0', () => {
      const data = createEmptyUserData();
      expect(data.hintsUsed).toBe(0);
    });

    it('returns object without language set', () => {
      const data = createEmptyUserData();
      expect(data.language).toBeUndefined();
    });

    it('returns new object each time', () => {
      const data1 = createEmptyUserData();
      const data2 = createEmptyUserData();
      expect(data1).not.toBe(data2);
    });
  });
});
