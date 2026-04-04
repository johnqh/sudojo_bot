/**
 * Welcome Card - Instructions for using the Sudoku Hint Bot
 */

import { CardFactory, type Attachment } from 'botbuilder';
import { t } from '../i18n/index.js';

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
        text: t('welcome.title'),
        weight: 'Bolder',
        size: 'Large',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: t('welcome.subtitle'),
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'TextBlock',
        text: t('welcome.howToUse'),
        weight: 'Bolder',
        spacing: 'Medium',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: t('welcome.instructions'),
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: t('welcome.commands'),
        weight: 'Bolder',
        spacing: 'Medium',
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'hint', value: t('welcome.commandHint') },
          { title: 'apply', value: t('welcome.commandApply') },
          { title: 'new', value: t('welcome.commandNew') },
          { title: 'help', value: t('welcome.commandHelp') },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: t('welcome.uploadPuzzle'),
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
        text: t('help.title'),
        weight: 'Bolder',
        size: 'Large',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: t('help.availableCommands'),
        wrap: true,
        spacing: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'hint', value: t('help.commandHint') },
          { title: 'next', value: t('help.commandNext') },
          { title: 'apply', value: t('help.commandApply') },
          { title: 'new', value: t('help.commandNew') },
          { title: 'status', value: t('help.commandStatus') },
          { title: 'help', value: t('help.commandHelp') },
        ],
      },
      {
        type: 'TextBlock',
        text: t('help.uploadAnytime'),
        wrap: true,
        spacing: 'Medium',
      },
    ],
  };

  return CardFactory.adaptiveCard(card);
}
