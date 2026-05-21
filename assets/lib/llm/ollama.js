import { buildSystemPrompt } from '../prompts.js';
import { TOOLS_OLLAMA }      from '../tools.js';

function ollamaBaseUrl(url) { return (url || '').trim().replace(/\/$/, '') || 'http://localhost:11434'; }
function ollamaHeaders(cfg) { const h = { 'Content-Type': 'application/json' }; if (cfg.ollamaUseAuth && cfg.ollamaApiKey) h['Authorization'] = 'Bearer ' + cfg.ollamaApiKey; return h; }

export async function fetchOllamaModels(cfg) {
    const res = await fetch(ollamaBaseUrl(cfg.ollamaUrl) + '/api/tags', { method: 'GET', headers: ollamaHeaders(cfg) });
    if (!res.ok) throw new Error(`Errore Ollama (${res.status})`);
    return ((await res.json()).models || []).map((m) => m.name);
}

export async function callOllama(messages, cfg) {
    if (!cfg.ollamaModel) throw new Error('Modello Ollama non configurato. Apri le impostazioni ⚙');
    const systemContent = buildSystemPrompt(cfg);
    const hasSystem     = messages.some((m) => m.role === 'system');
    const fullMessages  = hasSystem ? messages.map((m) => m.role === 'system' ? { ...m, content: systemContent } : m) : [{ role: 'system', content: systemContent }, ...messages];
    const res = await fetch(ollamaBaseUrl(cfg.ollamaUrl) + '/api/chat', {
        method: 'POST', headers: ollamaHeaders(cfg),
        body: JSON.stringify({ model: cfg.ollamaModel, messages: fullMessages, tools: TOOLS_OLLAMA, stream: false, options: { num_predict: 4096 } }),
    });
    if (!res.ok) throw new Error(`Errore Ollama (${res.status})`);
    const data    = await res.json();
    const message = data.message || {};
    const tcs     = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    let text = '';
    const mc = message.content;
    if (typeof mc === 'string') text = mc;
    else if (Array.isArray(mc)) text = mc.map((c) => (typeof c === 'string' ? c : (c.text || JSON.stringify(c)))).join('');
    else if (mc && typeof mc === 'object') { if (Array.isArray(mc.parts)) text = mc.parts.map((p) => p.text || '').join(''); else if (mc.text) text = mc.text; else text = JSON.stringify(mc); }
    const usage = { inputTokens: data.prompt_eval_count || 0, outputTokens: data.eval_count || 0, totalDurationNs: data.total_duration || 0 };
    if (tcs.length > 0) {
        const toolUseBlocks = tcs.map((tc, i) => { const fn = tc.function || {}; let args = fn.arguments || {}; if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } } return { id: `otc-${Date.now()}-${i}`, name: fn.name, input: args }; });
        return { stop_reason: 'tool_use', text, toolUseBlocks, assistantMessage: message, usage };
    }
    return { stop_reason: 'end_turn', text, toolUseBlocks: [], assistantMessage: message, usage };
}
