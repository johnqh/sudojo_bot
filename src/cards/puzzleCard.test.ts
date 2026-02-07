import { describe, it, expect } from 'bun:test';
import { createPuzzleCard, createProgressCard } from './puzzleCard.js';
import type { PuzzleState } from '../state/conversationState.js';

describe('puzzleCard', () => {
  describe('createPuzzleCard', () => {
    const puzzle: PuzzleState = {
      original: '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
      user: '000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      solution: '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
      confidence: 95.5,
    };

    it('returns valid AdaptiveCard attachment', () => {
      const card = createPuzzleCard(puzzle, true);

      expect(card.contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(card.content).toBeDefined();
      expect(card.content.type).toBe('AdaptiveCard');
      expect(card.content.version).toBe('1.5');
    });

    it('shows confirmation buttons when showConfirmation=true', () => {
      const card = createPuzzleCard(puzzle, true);
      const actions = card.content.actions;

      expect(actions).toHaveLength(2);
      expect(actions[0].title).toBe('Yes, get hints');
      expect(actions[0].data.action).toBe('confirm_puzzle');
      expect(actions[1].title).toBe('No, try again');
      expect(actions[1].data.action).toBe('reject_puzzle');
    });

    it('shows hint/new buttons when showConfirmation=false', () => {
      const card = createPuzzleCard(puzzle, false);
      const actions = card.content.actions;

      expect(actions).toHaveLength(2);
      expect(actions[0].title).toBe('Get Hint');
      expect(actions[0].data.action).toBe('get_hint');
      expect(actions[1].title).toBe('New Puzzle');
      expect(actions[1].data.action).toBe('new_puzzle');
    });

    it('displays correct clue count', () => {
      const card = createPuzzleCard(puzzle, true);
      const factSet = card.content.body.find((b: { type: string }) => b.type === 'FactSet');

      expect(factSet).toBeDefined();
      const cluesFact = factSet.facts.find((f: { title: string }) => f.title === 'Clues');
      expect(cluesFact.value).toBe('30'); // This puzzle has 30 clues
    });

    it('displays correct confidence', () => {
      const card = createPuzzleCard(puzzle, true);
      const factSet = card.content.body.find((b: { type: string }) => b.type === 'FactSet');

      expect(factSet).toBeDefined();
      const confidenceFact = factSet.facts.find((f: { title: string }) => f.title === 'Confidence');
      expect(confidenceFact.value).toBe('95.5%');
    });
  });

  describe('createProgressCard', () => {
    it('shows remaining cells count', () => {
      const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
      const user = '004608912072000348100342507059701420026050790013904850901537204287000630345206100';

      const card = createProgressCard(original, user);
      const factSet = card.content.body.find((b: { type: string }) => b.type === 'FactSet');

      expect(factSet).toBeDefined();
      const remainingFact = factSet.facts.find((f: { title: string }) => f.title === 'Remaining');
      expect(remainingFact.value).toBe('0');
    });

    it('shows congratulations when complete', () => {
      // All cells filled
      const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
      const user = '004608912072000348100342507059701420026050790013904850901537204287000630345206100';

      const card = createProgressCard(original, user);
      const congratsBlock = card.content.body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text?.includes('Congratulations')
      );

      expect(congratsBlock).toBeDefined();
    });

    it('shows Get Hint button when incomplete', () => {
      const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
      const user = '000000000000000000000000000000000000000000000000000000000000000000000000000000000';

      const card = createProgressCard(original, user);
      const actions = card.content.actions;

      expect(actions[0].title).toBe('Get Hint');
      expect(actions[0].data.action).toBe('get_hint');
    });

    it('shows New Puzzle button when complete', () => {
      const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
      const user = '004608912072000348100342507059701420026050790013904850901537204287000630345206100';

      const card = createProgressCard(original, user);
      const actions = card.content.actions;

      expect(actions[0].title).toBe('New Puzzle');
      expect(actions[0].data.action).toBe('new_puzzle');
    });
  });
});
