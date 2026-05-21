/**
 * i18n.js — Internationalization module
 *
 * Provides locale detection, dictionary loading, and a React hook.
 * The locale is stored in localStorage under 'chatbot-locale'.
 * Default: 'it'
 */

import IT from '../locales/it.js';
import EN from '../locales/en.js';

const DICTIONARIES = { it: IT, en: EN };
const SUPPORTED_LOCALES = Object.keys(DICTIONARIES);
const DEFAULT_LOCALE = 'it';
const STORAGE_KEY = 'chatbot-locale';

/**
 * Get the current locale from localStorage.
 * Falls back to DEFAULT_LOCALE if not set or invalid.
 */
export function getLocale() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
    return DEFAULT_LOCALE;
}

/**
 * Set the current locale in localStorage.
 * @param {string} locale — 'it' or 'en'
 */
export function setLocale(locale) {
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    localStorage.setItem(STORAGE_KEY, locale);
    // Dispatch a custom event so components can react
    window.dispatchEvent(new CustomEvent('chatbot-locale-change', { detail: { locale } }));
}

/**
 * Get the dictionary for the given locale (or current locale if omitted).
 * Falls back to Italian if the locale is not found.
 */
export function getDictionary(locale) {
    const loc = locale || getLocale();
    return DICTIONARIES[loc] || DICTIONARIES[DEFAULT_LOCALE];
}

/**
 * List of supported locales with labels.
 */
export function getSupportedLocales() {
    return SUPPORTED_LOCALES.map((code) => ({
        code,
        label: code === 'it' ? 'Italiano' : 'English',
        flag: code === 'it' ? '🇮🇹' : '🇬🇧',
    }));
}