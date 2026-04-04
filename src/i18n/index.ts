/**
 * i18n setup using i18next
 * Provides translation functions for all user-facing strings
 */

import i18next from 'i18next';
import en from './locales/en.json' with { type: 'json' };

i18next.init({
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: en,
    },
  },
});

export const t = i18next.t.bind(i18next);
export default i18next;
