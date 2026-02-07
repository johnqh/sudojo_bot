import { describe, it, expect } from 'bun:test';
import { createHintStepCard, createHintAppliedCard, createNoHintCard } from './hintCard.js';
import type { SolverHintStep } from '@sudobility/sudojo_types';

describe('hintCard', () => {
  const original = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
  const user = '000000000000000000000000000000000000000000000000000000000000000000000000000000000';

  describe('createHintStepCard', () => {
    const step: SolverHintStep = {
      title: 'Found naked single',
      text: 'Cell R1C3 can only contain 4',
      areas: [],
      cells: [
        {
          row: 0,
          column: 2,
          color: 'green',
          fill: true,
          actions: { select: '4', unselect: '', add: '', remove: '', highlight: '' },
        },
      ],
    };

    it('shows "Next Step" for non-final steps', () => {
      const card = createHintStepCard(step, 0, 3, original, user, 'Naked Single', 1);
      const actions = card.content.actions;

      const nextStepAction = actions.find((a: { title: string }) => a.title === 'Next Step');
      expect(nextStepAction).toBeDefined();
      expect(nextStepAction.data.action).toBe('next_step');
    });

    it('shows "Apply Hint" on final step', () => {
      const card = createHintStepCard(step, 2, 3, original, user, 'Naked Single', 1);
      const actions = card.content.actions;

      const applyAction = actions.find((a: { title: string }) => a.title === 'Apply Hint');
      expect(applyAction).toBeDefined();
      expect(applyAction.data.action).toBe('apply_hint');

      const nextStepAction = actions.find((a: { title: string }) => a.title === 'Next Step');
      expect(nextStepAction).toBeUndefined();
    });

    it('displays technique and level', () => {
      const card = createHintStepCard(step, 0, 1, original, user, 'Hidden Pair', 3);
      const body = card.content.body;

      const techniqueBlock = body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text?.includes('Hidden Pair')
      );
      expect(techniqueBlock).toBeDefined();
      expect(techniqueBlock.text).toContain('Level 3');
    });

    it('displays step counter', () => {
      const card = createHintStepCard(step, 1, 4, original, user, 'Naked Single', 1);
      const body = card.content.body;

      const stepBlock = body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text?.includes('Step 2 of 4')
      );
      expect(stepBlock).toBeDefined();
    });

    it('always includes New Puzzle action', () => {
      const card = createHintStepCard(step, 0, 1, original, user, 'Naked Single', 1);
      const actions = card.content.actions;

      const newPuzzleAction = actions.find((a: { title: string }) => a.title === 'New Puzzle');
      expect(newPuzzleAction).toBeDefined();
      expect(newPuzzleAction.data.action).toBe('new_puzzle');
    });
  });

  describe('createHintAppliedCard', () => {
    it('shows remaining count when incomplete', () => {
      const userWithProgress = '004000000000000000000000000000000000000000000000000000000000000000000000000000000';
      const card = createHintAppliedCard(original, userWithProgress, 'Naked Single');
      const body = card.content.body;

      const remainingBlock = body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text?.includes('cells remaining')
      );
      expect(remainingBlock).toBeDefined();
    });

    it('shows congratulations when complete', () => {
      const completedUser = '004608912072000348100342507059701420026050790013904850901537204287000630345206100';
      const card = createHintAppliedCard(original, completedUser, 'Naked Single');
      const body = card.content.body;

      const congratsBlock = body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text?.includes('Congratulations')
      );
      expect(congratsBlock).toBeDefined();
    });

    it('shows Get Next Hint when incomplete', () => {
      const userWithProgress = '004000000000000000000000000000000000000000000000000000000000000000000000000000000';
      const card = createHintAppliedCard(original, userWithProgress, 'Naked Single');
      const actions = card.content.actions;

      const hintAction = actions.find((a: { title: string }) => a.title === 'Get Next Hint');
      expect(hintAction).toBeDefined();
    });

    it('only shows New Puzzle when complete', () => {
      const completedUser = '004608912072000348100342507059701420026050790013904850901537204287000630345206100';
      const card = createHintAppliedCard(original, completedUser, 'Naked Single');
      const actions = card.content.actions;

      expect(actions).toHaveLength(1);
      expect(actions[0].title).toBe('New Puzzle');
    });
  });

  describe('createNoHintCard', () => {
    it('displays reason message', () => {
      const reason = 'The puzzle appears to be invalid or unsolvable.';
      const card = createNoHintCard(reason);
      const body = card.content.body;

      const reasonBlock = body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text === reason
      );
      expect(reasonBlock).toBeDefined();
    });

    it('shows No Hint Available title', () => {
      const card = createNoHintCard('Some reason');
      const body = card.content.body;

      const titleBlock = body.find(
        (b: { type: string; text?: string }) => b.type === 'TextBlock' && b.text === 'No Hint Available'
      );
      expect(titleBlock).toBeDefined();
    });

    it('includes New Puzzle action', () => {
      const card = createNoHintCard('Some reason');
      const actions = card.content.actions;

      expect(actions).toHaveLength(1);
      expect(actions[0].title).toBe('New Puzzle');
      expect(actions[0].data.action).toBe('new_puzzle');
    });
  });
});
