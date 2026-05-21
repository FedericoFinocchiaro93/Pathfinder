/**
 * lib/utils.js — ai-chatbot-fullpage (identico al widget)
 */
export function dbg(...args) { console.log('[ACFP]', ...args); }

export function makeAssistantResponse(provider, text = '') {
    if (provider === 'gemini') return { modelContent: { parts: [{ text }] } };
    if (provider === 'ollama') return { assistantMessage: { content: text } };
    return { rawContent: [{ type: 'text', text }] };
}
