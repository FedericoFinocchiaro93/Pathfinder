/**
 * lib/llm/openai.js — OpenAI-compatible LLM provider
 *
 * Supports OpenAI, DeepSeek, Mistral, and any OpenAI-compatible API.
 * Uses configurable base URL so the same module works for all providers.
 */

import { buildSystemPrompt } from '../prompts.js';
import { TOOLS_OPENAI }      from '../tools.js';

function openaiBaseUrl(cfg) {
    const provider = cfg.llmProvider;
    // Default base URLs per provider
    const defaults = {
        openai:   'https://api.openai.com/v1',
        deepseek: 'https://api.deepseek.com/v1',
        mistral:  'https://api.mistral.ai/v1',
    };
    if (cfg.openaiBaseUrl && cfg.openaiBaseUrl.trim()) {
        return cfg.openaiBaseUrl.trim().replace(/\/$/, '');
    }
    return defaults[provider] || defaults.openai;
}

function openaiHeaders(cfg) {
    const apiKey = cfg.openaiApiKey;
    if (!apiKey) throw new Error('API Key non configurata. Apri le impostazioni ⚙');
    return {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
}

function openaiModel(cfg) {
    const provider = cfg.llmProvider;
    const defaults = {
        openai:  'gpt-4o',
        deepseek: 'deepseek-chat',
        mistral: 'mistral-large-latest',
    };
    return cfg.openaiModel || defaults[provider] || defaults.openai;
}

/**
 * Convert internal message history to OpenAI format.
 * OpenAI uses: { role: 'system'|'user'|'assistant'|'tool', content, tool_calls?, tool_call_id? }
 */
function toOpenAIMessages(history, systemPrompt) {
    const messages = [{ role: 'system', content: systemPrompt }];

    for (const msg of history) {
        // Anthropic format: { role, content: [{type:'text',...},{type:'tool_use',...}] }
        if (msg.role === 'user' && Array.isArray(msg.content)) {
            // Check if it contains tool_result blocks (Anthropic format)
            const toolResults = msg.content.filter(b => b.type === 'tool_result');
            const textParts   = msg.content.filter(b => b.type === 'text');

            if (toolResults.length > 0) {
                // Convert Anthropic tool_result blocks to OpenAI tool messages
                for (const tr of toolResults) {
                    let content = tr.content;
                    if (typeof content !== 'string') {
                        try { content = JSON.stringify(content); } catch { content = String(content); }
                    }
                    messages.push({ role: 'tool', tool_call_id: tr.tool_use_id, content });
                }
                // If there's also text, add it as a user message
                if (textParts.length > 0) {
                    const text = textParts.map(b => b.text || '').join('\n');
                    if (text.trim()) messages.push({ role: 'user', content: text });
                }
            } else {
                // Regular content blocks
                const text = msg.content.map(b => b.text || '').join('\n');
                if (text.trim()) messages.push({ role: 'user', content: text });
            }
        }
        // Ollama format: { role, content: string, tool_calls?: [...] }
        else if (msg.role === 'assistant' && msg.tool_calls) {
            const content = typeof msg.content === 'string' ? msg.content : '';
            const toolCalls = msg.tool_calls.map(tc => ({
                id:   tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                type: 'function',
                function: {
                    name:      tc.function?.name || tc.name,
                    arguments: typeof tc.function?.arguments === 'string'
                        ? tc.function.arguments
                        : JSON.stringify(tc.function?.arguments || tc.input || {}),
                },
            }));
            messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });
        }
        // Simple string content messages
        else if (typeof msg.content === 'string') {
            if (msg.role === 'tool') {
                messages.push({ role: 'tool', tool_call_id: msg.tool_call_id || msg.id || `call_${Date.now()}`, content: msg.content });
            } else {
                messages.push({ role: msg.role, content: msg.content });
            }
        }
        // Gemini format: { role: 'user'|'model', parts: [...] }
        else if (msg.parts) {
            const text = msg.parts.filter(p => p.text).map(p => p.text).join('\n');
            if (text.trim()) {
                messages.push({ role: msg.role === 'model' ? 'assistant' : msg.role, content: text });
            }
        }
    }

    return messages;
}

/**
 * Fetch available models from OpenAI-compatible API.
 */
export async function fetchOpenAIModels(cfg) {
    const baseUrl = openaiBaseUrl(cfg);
    const headers = openaiHeaders(cfg);
    try {
        const res = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
        if (!res.ok) return [];
        const data = await res.json();
        const models = (data.data || []).map(m => m.id).sort();
        return models;
    } catch {
        return [];
    }
}

/**
 * Call OpenAI-compatible LLM API.
 * Works with OpenAI, DeepSeek, Mistral, and any OpenAI-compatible endpoint.
 */
export async function callOpenAI(history, cfg, feedbackContext) {
    const model      = openaiModel(cfg);
    const baseUrl    = openaiBaseUrl(cfg);
    const headers    = openaiHeaders(cfg);
    const systemPrompt = buildSystemPrompt(cfg, feedbackContext);
    const messages   = toOpenAIMessages(history, systemPrompt);

    const body = {
        model,
        messages,
        tools: TOOLS_OPENAI,
        max_tokens: 8192,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Errore ${cfg.llmProvider === 'deepseek' ? 'DeepSeek' : cfg.llmProvider === 'mistral' ? 'Mistral' : 'OpenAI'} (${res.status}): ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    const choice = (data.choices || [])[0];
    if (!choice) throw new Error('Nessuna risposta valida dal modello.');

    const message = choice.message || {};
    const text     = message.content || '';
    const tcs      = Array.isArray(message.tool_calls) ? message.tool_calls : [];

    const usage = {
        inputTokens:  data.usage?.prompt_tokens     || 0,
        outputTokens: data.usage?.completion_tokens  || 0,
        totalTokens:  data.usage?.total_tokens       || 0,
    };

    if (tcs.length > 0) {
        const toolUseBlocks = tcs.map((tc) => {
            const fn = tc.function || {};
            let args = fn.arguments || {};
            if (typeof args === 'string') {
                try { args = JSON.parse(args); } catch { args = {}; }
            }
            return {
                id:   tc.id || `otc-${Date.now()}`,
                name: fn.name,
                input: args,
            };
        });
        return {
            stop_reason: 'tool_use',
            text,
            toolUseBlocks,
            assistantMessage: message,
            usage,
        };
    }

    return {
        stop_reason: choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
        text,
        toolUseBlocks: [],
        assistantMessage: message,
        usage,
    };
}