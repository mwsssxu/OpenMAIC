import { zh } from './zh';
import { en } from './en';

export type Locale = 'zh' | 'en';
export const defaultLocale: Locale = 'zh';
export const locales: Locale[] = ['zh', 'en'];

const translations = {
  zh,
  en,
} as const;

export type TranslationKeys = keyof typeof zh;

export function getTranslation(locale: Locale, key: TranslationKeys): string {
  return translations[locale][key] || key;
}

export function getTranslations(locale: Locale) {
  return translations[locale];
}