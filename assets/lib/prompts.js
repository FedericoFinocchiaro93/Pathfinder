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
    // Replace ${siteId} placeholder in rules
    const rules = [p.rule1, p.rule2, p.rule3, p.rule4, p.rule5, p.rule6, p.rule7, p.rule8, p.rule9, p.rule10, p.rule11, p.rule12, p.rule13, p.rule14, p.rule15, p.rule16, p.rule17, p.rule18, p.rule19, p.rule20, p.rule21, p.rule22]
        .map(r => r.replace(/\$\{siteId\}/g, siteId));
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
