/**
 * Welcome Card - Instructions for using the Sudoku Hint Bot
 */

import { CardFactory, type Attachment } from 'botbuilder';

/**
 * Create an Adaptive Card with welcome message and usage instructions.
 * Displayed when a new user joins or when no puzzle is loaded.
 * @returns Bot Framework Attachment containing the welcome Adaptive Card
 */
export function createWelcomeCard(): Attachment {
  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'Sudoku Hint Bot',
        weight: 'Bolder',
        size: 'Large',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: 'I can help you solve Sudoku puzzles by providing step-by-step hints!',
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: 'How to use:',
        weight: 'Bolder',
        spacing: 'Medium',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: '1. Upload a photo of your Sudoku puzzle\n2. Confirm the recognized puzzle is correct\n3. Ask for hints to solve it step by step',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: 'Commands:',
        weight: 'Bolder',
        spacing: 'Medium',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'hint', value: 'Get the next hint' },
          { title: 'apply', value: 'Apply the current hint' },
          { title: 'new', value: 'Start with a new puzzle' },
          { title: 'help', value: 'Show this help message' },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Upload Puzzle',
        data: { action: 'upload' },
      },
    ],
  };

  return CardFactory.adaptiveCard(card);
}

/**
 * Create an Adaptive Card listing all available bot commands.
 * Displayed when user sends 'help' or '?'.
 * @returns Bot Framework Attachment containing the help Adaptive Card
 */
export function createHelpCard(): Attachment {
  const card = {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        text: 'Help',
        weight: 'Bolder',
        size: 'Large',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: 'Available commands:',
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'hint', value: 'Get the next solving hint' },
          { title: 'next', value: 'Show the next step in current hint' },
          { title: 'apply', value: 'Apply the hint to your puzzle' },
          { title: 'new', value: 'Start with a new puzzle' },
          { title: 'status', value: 'Show current puzzle status' },
          { title: 'help', value: 'Show this help message' },
        ],
      },
      {
        type: 'TextBlock',
        text: 'You can also upload a new puzzle image at any time.',
        wrap: true,
        spacing: 'Medium',
      },
    ],
  };

  return CardFactory.adaptiveCard(card);
}
