/**
 * Hint Card - Display hint steps with grid visualization
 */

import { CardFactory, type Attachment } from 'botbuilder';
import type { SolverHintStep, SolverHintCell } from '@sudobility/sudojo_types';

/**
 * Format cells to highlight in the grid
 */
function formatHintGrid(original: string, user: string, cells: SolverHintCell[]): string {
  // Build a map of highlighted cells
  const highlightMap = new Map<number, SolverHintCell>();
  for (const cell of cells) {
    const index = cell.row * 9 + cell.column;
    highlightMap.set(index, cell);
  }

  const lines: string[] = [];

  for (let row = 0; row < 9; row++) {
    const rowCells: string[] = [];
    for (let col = 0; col < 9; col++) {
      const index = row * 9 + col;
      const orig = original[index];
      const usr = user[index];
      const digit = usr !== '0' ? usr : orig !== '0' ? orig : '·';

      const highlight = highlightMap.get(index);
      if (highlight) {
        // Mark highlighted cells with brackets
        if (highlight.actions.select) {
          rowCells.push(`[${highlight.actions.select}]`);
        } else if (highlight.actions.remove) {
          rowCells.push(`(${digit})`);
        } else {
          rowCells.push(`*${digit}*`);
        }
      } else {
        rowCells.push(` ${digit} `);
      }

      // Add separator after columns 3 and 6
      if (col === 2 || col === 5) {
        rowCells.push('|');
      }
    }
    lines.push(rowCells.join(''));

    // Add separator after rows 3 and 6
    if (row === 2 || row === 5) {
      lines.push('-----------+-----------+-----------');
    }
  }

  return lines.join('\n');
}

/**
 * Create a card showing a single hint step
 */
export function createHintStepCard(
  step: SolverHintStep,
  stepIndex: number,
  totalSteps: number,
  original: string,
  user: string,
  technique: string,
  level: number
): Attachment {
  const grid = formatHintGrid(original, user, step.cells);

  const body: unknown[] = [
    {
      type: 'TextBlock',
      text: `${technique} (Level ${level})`,
      weight: 'Bolder',
      size: 'Large',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: `Step ${stepIndex + 1} of ${totalSteps}`,
      weight: 'Bolder',
      size: 'Small',
      color: 'Accent',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: step.title,
      weight: 'Bolder',
      spacing: 'Medium',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: step.text,
      wrap: true,
      spacing: 'Small',
    },
  ];

  // Add grid visualization if there are cells to highlight
  if (step.cells.length > 0) {
    body.push({
      type: 'TextBlock',
      text: grid,
      fontType: 'Monospace',
      wrap: false,
      spacing: 'Medium',
    });

    // Add legend
    body.push({
      type: 'TextBlock',
      text: '[n] = place digit | (n) = remove candidate | *n* = highlight',
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'Small',
    });
  }

  // Build actions based on step position
  const actions: unknown[] = [];

  if (stepIndex < totalSteps - 1) {
    actions.push({
      type: 'Action.Submit',
      title: 'Next Step',
      data: { action: 'next_step' },
    });
  }

  if (stepIndex === totalSteps - 1) {
    actions.push({
      type: 'Action.Submit',
      title: 'Apply Hint',
      data: { action: 'apply_hint' },
    });
  }

  actions.push({
    type: 'Action.Submit',
    title: 'New Puzzle',
    data: { action: 'new_puzzle' },
  });

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
 * Create a summary card after applying a hint
 */
export function createHintAppliedCard(
  original: string,
  user: string,
  technique: string
): Attachment {
  // Count remaining empty cells
  let remaining = 0;
  for (let i = 0; i < 81; i++) {
    const orig = original[i];
    const usr = user[i];
    if (orig === '0' && usr === '0') {
      remaining++;
    }
  }

  const isPuzzleComplete = remaining === 0;

  const body: unknown[] = [
    {
      type: 'TextBlock',
      text: 'Hint Applied',
      weight: 'Bolder',
      size: 'Large',
      color: 'Good',
      wrap: true,
    },
    {
      type: 'TextBlock',
      text: `Applied: ${technique}`,
      wrap: true,
    },
  ];

  if (isPuzzleComplete) {
    body.push({
      type: 'TextBlock',
      text: 'Congratulations! The puzzle is complete!',
      weight: 'Bolder',
      size: 'Medium',
      color: 'Good',
      wrap: true,
      spacing: 'Medium',
    });
  } else {
    body.push({
      type: 'TextBlock',
      text: `${remaining} cells remaining`,
      wrap: true,
      spacing: 'Small',
    });
  }

  const actions = isPuzzleComplete
    ? [
        {
          type: 'Action.Submit',
          title: 'New Puzzle',
          data: { action: 'new_puzzle' },
        },
      ]
    : [
        {
          type: 'Action.Submit',
          title: 'Get Next Hint',
          data: { action: 'get_hint' },
        },
        {
          type: 'Action.Submit',
          title: 'Show Progress',
          data: { action: 'show_progress' },
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
 * Create an error card when no hint is available
 */
export function createNoHintCard(reason: string): Attachment {
  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'No Hint Available',
        weight: 'Bolder',
        size: 'Large',
        color: 'Warning',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: reason,
        wrap: true,
        spacing: 'Medium',
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'New Puzzle',
        data: { action: 'new_puzzle' },
      },
    ],
  };

  return CardFactory.adaptiveCard(card);
}
