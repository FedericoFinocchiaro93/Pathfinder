import { buildSystemPrompt } from '../prompts.js';
import { TOOLS_ANTHROPIC }   from '../tools.js';

export async function callClaude(messages, cfg, feedbackContext) {
    const apiKey = cfg.apiKey;
    const model  = cfg.model || 'claude-sonnet-4-20250514';
    if (!apiKey) throw new Error('API Key Anthropic non configurata. Apri le impostazioni ⚙');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 8192, system: buildSystemPrompt(cfg, feedbackContext), tools: TOOLS_ANTHROPIC, messages }),
    });
    if (!res.ok) throw new Error(`Errore Anthropic (${res.status}): ${(await res.text()).substring(0, 300)}`);
    const data = await res.json();
    const text = (data.content.find((b) => b.type === 'text') || {}).text || '';
    const usage = data.usage || {};
    return { stop_reason: data.stop_reason, text, toolUseBlocks: data.content.filter((b) => b.type === 'tool_use'), rawContent: data.content, usage: { inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0, cacheCreationInputTokens: usage.cache_creation_input_tokens || 0, cacheReadInputTokens: usage.cache_read_input_tokens || 0 } };
}
