/**
 * Puzzle Card - Display recognized Sudoku puzzle grid
 */

import { CardFactory, type Attachment } from 'botbuilder';
import type { PuzzleState } from '../state/conversationState.js';

/**
 * Format a puzzle string as a 9x9 grid for display
 */
function formatPuzzleGrid(puzzle: string): string {
  const lines: string[] = [];

  for (let row = 0; row < 9; row++) {
    const cells: string[] = [];
    for (let col = 0; col < 9; col++) {
      const index = row * 9 + col;
      const digit = puzzle[index];
      cells.push(digit === '0' ? '·' : digit);

      // Add separator after columns 3 and 6
      if (col === 2 || col === 5) {
        cells.push('|');
      }
    }
    lines.push(cells.join(' '));

    // Add separator after rows 3 and 6
    if (row === 2 || row === 5) {
      lines.push('------+-------+------');
    }
  }

  return lines.join('\n');
}

/**
 * Create an Adaptive Card showing the recognized Sudoku puzzle grid.
 * Displays the puzzle in monospace text with clue count and OCR confidence.
 * @param puzzle - The puzzle state containing the original puzzle string and confidence
 * @param showConfirmation - Whether to show confirm/reject buttons (default: true)
 * @returns Bot Framework Attachment containing the puzzle Adaptive Card
 */
export function createPuzzleCard(
  puzzle: PuzzleState,
  showConfirmation: boolean = true
): Attachment {
  const grid = formatPuzzleGrid(puzzle.original);
  const clueCount = puzzle.original.split('').filter(c => c !== '0').length;

  const body: unknown[] = [
    {
      type: 'TextBlock',
      text: 'Recognized Puzzle',
      weight: 'Bolder',
      size: 'Large',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: grid,
      fontType: 'Monospace',
      wrap: false,
      spacing: 'Medium',
    },
    {
      type: 'FactSet',
      facts: [
        { title: 'Clues', value: clueCount.toString() },
        { title: 'Confidence', value: `${puzzle.confidence.toFixed(1)}%` },
      ],
      spacing: 'Medium',
    },
  ];

  if (showConfirmation) {
    body.push({
      type: 'TextBlock',
      text: 'Is this correct?',
      wrap: true,
      spacing: 'Medium',
    });
  }

  const actions = showConfirmation
    ? [
        {
          type: 'Action.Submit',
          title: 'Yes, get hints',
          data: { action: 'confirm_puzzle' },
        },
        {
          type: 'Action.Submit',
          title: 'No, try again',
          data: { action: 'reject_puzzle' },
        },
      ]
    : [
        {
          type: 'Action.Submit',
          title: 'Get Hint',
          data: { action: 'get_hint' },
        },
        {
          type: 'Action.Submit',
          title: 'New Puzzle',
          data: { action: 'new_puzzle' },
        },
      ];

  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body,
    actions,
  };

  return CardFactory.adaptiveCard(card);
}

/**
 * Create an Adaptive Card showing the current puzzle progress.
 * Merges original clues with user input, displays fill count and remaining cells.
 * @param original - Original puzzle string (81 chars, '0' = empty)
 * @param user - User's progress string (81 chars, '0' = no input)
 * @param _solution - Solution string (unused, reserved for future validation)
 * @returns Bot Framework Attachment containing the progress Adaptive Card
 */
export function createProgressCard(original: string, user: string, _solution?: string): Attachment {
  // Merge original and user input
  let merged = '';
  let solvedCount = 0;
  let totalEmpty = 0;

  for (let i = 0; i < 81; i++) {
    const orig = original[i];
    const usr = user[i];

    if (orig !== '0') {
      merged += orig;
    } else {
      totalEmpty++;
      if (usr !== '0') {
        merged += usr;
        solvedCount++;
      } else {
        merged += '0';
      }
    }
  }

  const grid = formatPuzzleGrid(merged);
  const remaining = totalEmpty - solvedCount;

  const body: unknown[] = [
    {
      type: 'TextBlock',
      text: 'Current Progress',
      weight: 'Bolder',
      size: 'Large',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: grid,
      fontType: 'Monospace',
      wrap: false,
      spacing: 'Medium',
    },
    {
      type: 'FactSet',
      facts: [
        { title: 'Cells filled', value: `${solvedCount}/${totalEmpty}` },
        { title: 'Remaining', value: remaining.toString() },
      ],
      spacing: 'Medium',
    },
  ];

  if (remaining === 0) {
    body.push({
      type: 'TextBlock',
      text: 'Congratulations! Puzzle complete!',
      weight: 'Bolder',
      color: 'Good',
      wrap: true,
      spacing: 'Medium',
    });
  }

  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body,
    actions: [
      {
        type: 'Action.Submit',
        title: remaining > 0 ? 'Get Hint' : 'New Puzzle',
        data: { action: remaining > 0 ? 'get_hint' : 'new_puzzle' },
      },
    ],
  };

  return CardFactory.adaptiveCard(card);
}
