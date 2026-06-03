/**
 * lib/prompts.js — ai-chatbot-fullpage (identico al widget)
 */

import { getBaseUrl, getSiteId } from './liferay.js';
import { getDictionary, getLocale } from './i18n.js';

export function buildSystemPrompt(cfg, feedbackContext) {
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
        ? buildOllamaPrompt(base, siteId, siteName, t, feedbackContext)
        : buildFullPrompt(base, siteId, siteName, t, feedbackContext);
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

function buildOllamaPrompt(baseUrl, siteId, siteName, t, feedbackContext) {
    const p = t.prompt;
    let prompt = `${p.systemRole}\nPORTALE: ${baseUrl}\nSITE ID: ${siteId} — SITE NAME: ${siteName}\n\n${p.alwaysLanguage}\n${TOOL_RULES(siteId, t)}`;
    if (feedbackContext) prompt += `\n\n${feedbackContext}`;
    return prompt;
}

function buildFullPrompt(baseUrl, siteId, siteName, t, feedbackContext) {
    const p = t.prompt;
    let prompt = `${p.systemRole}\nPORTALE: ${baseUrl} — SITE ID: ${siteId} — OGGI: ${new Date().toISOString().slice(0, 10)}\n\n${p.alwaysLanguage} Usa i tool disponibili per rispondere alle domande dell'utente sul portale Liferay.\n${TOOL_RULES(siteId, t)}`;
    if (feedbackContext) prompt += `\n\n${feedbackContext}`;
    return prompt;
}

/**
 * Build a context block from positively-rated Q&A pairs.
 * @param {Array<{query: string, response: string, toolCalls: string, score: number}>} items
 * @returns {string}
 */
export function buildFeedbackContext(items) {
    if (!items || items.length === 0) return '';
    const entries = items.map((item, i) => {
        let entry = `DOMANDA: ${item.query}\nRISPOSTA APPROVATA (score: ${item.score || 1}): ${item.response}`;
        if (item.toolCalls) {
            try {
                const calls = typeof item.toolCalls === 'string' ? JSON.parse(item.toolCalls) : item.toolCalls;
                if (Array.isArray(calls) && calls.length > 0) {
                    const callNames = calls.map(c => `${c.name}(${Object.keys(c.input || {}).slice(0, 3).join(', ')}...)`).join(', ');
                    entry += `\nTOOL CHIAMATI: ${callNames}`;
                }
            } catch (_) { /* ignore parse errors */ }
        }
        return entry;
    }).join('\n\n---\n\n');
    return `═══ RISPOSTE APPROVATE DAGLI UTENTI ═══\nLe seguenti domande hanno ricevuto feedback positivo dagli utenti (ordinato per rilevanza e score). Usa queste risposte come riferimento privilegiato quando la domanda dell'utente è simile:\n\n${entries}\n═══ FINE RISPOSTE APPROVATE ═══`;
}
