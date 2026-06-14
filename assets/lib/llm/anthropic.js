import { buildSystemPrompt } from '../prompts.js';
import { TOOLS_ANTHROPIC }   from '../tools.js';

/**
 * Anthropic API supports direct browser calls via the
 * "anthropic-dangerous-direct-browser-access: true" header.
 * See: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/
 *
 * If cfg.anthropicProxyUrl is set, requests are routed through that proxy instead.
 */

const ANTHROPIC_BASE = 'https://api.anthropic.com';

/** Common headers for all Anthropic API calls (browser-access enabled). */
function anthropicHeaders(apiKey) {
    return {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
    };
}

function anthropicUrl(path, cfg) {
    const proxyUrl = cfg.anthropicProxyUrl;
    if (proxyUrl && proxyUrl.trim()) {
        return proxyUrl.replace(/\/+$/, '') + path;
    }
    return ANTHROPIC_BASE + path;
}

/**
 * Fetch available models from the Anthropic API.
 * Works directly from the browser thanks to the CORS header.
 * Returns an array of model ID strings sorted alphabetically.
 */
export async function fetchAnthropicModels(cfg) {
    const apiKey = cfg.apiKey;
    if (!apiKey) return [];
    try {
        const res = await fetch(anthropicUrl('/v1/models?limit=100', cfg), {
            method: 'GET',
            headers: anthropicHeaders(apiKey),
        });
        if (!res.ok) return [];
        const data = await res.json();
        const models = (data.data || []).map(m => m.id).sort();
        return models;
    } catch {
        return [];
    }
}

export async function callClaude(messages, cfg, feedbackContext) {
    const apiKey = cfg.apiKey;
    const model  = cfg.model || 'claude-sonnet-4-20250514';
    if (!apiKey) throw new Error('API Key Anthropic non configurata. Apri le impostazioni ⚙');

    const res = await fetch(anthropicUrl('/v1/messages', cfg), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...anthropicHeaders(apiKey) },
        body: JSON.stringify({ model, max_tokens: 8192, system: buildSystemPrompt(cfg, feedbackContext), tools: TOOLS_ANTHROPIC, messages }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Errore Anthropic (${res.status}): ${errText.substring(0, 300)}`);
    }
    const data = await res.json();
    const text = (data.content.find((b) => b.type === 'text') || {}).text || '';
    const usage = data.usage || {};
    return { stop_reason: data.stop_reason, text, toolUseBlocks: data.content.filter((b) => b.type === 'tool_use'), rawContent: data.content, usage: { inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0, cacheCreationInputTokens: usage.cache_creation_input_tokens || 0, cacheReadInputTokens: usage.cache_read_input_tokens || 0 } };
}
