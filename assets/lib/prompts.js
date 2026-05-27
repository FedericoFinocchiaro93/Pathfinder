/**
 * lib/prompts.js — ai-chatbot-fullpage (identico al widget)
 */

import { getBaseUrl, getSiteId } from './liferay.js';
import { getDictionary, getLocale } from './i18n.js';

export function buildSystemPrompt(cfg) {
    const base   = getBaseUrl(cfg.liferayUrl);
    const siteId = getSiteId(cfg.siteGroupId);
    const locale = getLocale();
    const t = getDictionary(locale);
    let siteName = 'guest';
    try {
        const pageURL = window.Liferay?.ThemeDisplay?.getLayoutURL?.() || window.location.href;
        const match = pageURL.match(/\/web\/([^/]+)/);
        if (match && isNaN(Number(match[1]))) siteName = match[1];
    } catch (_) {}
    // Ollama uses a shorter prompt; all other providers (Anthropic, Gemini, OpenAI, DeepSeek, Mistral) use the full prompt
    return cfg.llmProvider === 'ollama'
        ? buildOllamaPrompt(base, siteId, siteName, t)
        : buildFullPrompt(base, siteId, siteName, t);
}

const TOOL_RULES = (siteId, t) => {
    const p = t.prompt;
    // Collect all rule* keys dynamically — works regardless of how many rules exist
    // Matches rule1, rule2, rule7b, rule7c, etc.
    const rules = Object.keys(p)
        .filter(k => /^rule\d+[a-z]?$/.test(k))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            if (numA !== numB) return numA - numB;
            const subA = (a.match(/[a-z]$/) || [''])[0];
            const subB = (b.match(/[a-z]$/) || [''])[0];
            return subA.localeCompare(subB);
        })
        .map(k => p[k].replace(/\$\{siteId\}/g, siteId));
    return `FUNDAMENTAL TOOL RULES:\n${rules.join('\n\n')}`;
};

function buildOllamaPrompt(baseUrl, siteId, siteName, t) {
    const p = t.prompt;
    return `${p.systemRole}\nPORTALE: ${baseUrl}\nSITE ID: ${siteId} — SITE NAME: ${siteName}\n\n${p.alwaysLanguage}\n${TOOL_RULES(siteId, t)}`;
}

function buildFullPrompt(baseUrl, siteId, siteName, t) {
    const p = t.prompt;
    return `${p.systemRole}\nPORTALE: ${baseUrl} — SITE ID: ${siteId} — OGGI: ${new Date().toISOString().slice(0, 10)}\n\n${p.alwaysLanguage} Usa i tool disponibili per rispondere alle domande dell'utente sul portale Liferay.\n${TOOL_RULES(siteId, t)}`;
}
