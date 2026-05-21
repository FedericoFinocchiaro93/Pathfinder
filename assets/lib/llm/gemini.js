import { buildSystemPrompt } from '../prompts.js';
import { TOOLS_GEMINI }      from '../tools.js';

export async function callGemini(contents, cfg) {
    const apiKey = cfg.geminiApiKey;
    const model  = cfg.geminiModel || 'gemini-2.0-flash';
    if (!apiKey) throw new Error('API Key Gemini non configurata. Apri le impostazioni ⚙');
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: buildSystemPrompt(cfg) }] }, contents, tools: TOOLS_GEMINI, generationConfig: { maxOutputTokens: 8192 } }),
    });
    if (!res.ok) throw new Error(`Errore Gemini (${res.status}): ${(await res.text()).substring(0, 300)}`);
    const data = await res.json();
    const candidate = (data.candidates || [])[0];
    if (!candidate) throw new Error('Gemini: nessuna risposta valida.');
    const parts   = candidate.content?.parts || [];
    const fcParts = parts.filter((p) => p.functionCall);
    const text    = parts.filter((p) => p.text).map((p) => p.text).join('');
    const usageMeta = data.usageMetadata || {};
    const usage = { inputTokens: usageMeta.promptTokenCount || 0, outputTokens: usageMeta.candidatesTokenCount || 0, totalTokens: usageMeta.totalTokenCount || 0, thoughtsTokenCount: usageMeta.thoughtsTokenCount || 0, serviceTier: usageMeta.serviceTier || '' };
    if (fcParts.length > 0) {
        const toolUseBlocks = fcParts.map((p, i) => ({ id: `gfc-${Date.now()}-${i}`, name: p.functionCall.name, input: p.functionCall.args || {} }));
        return { stop_reason: 'tool_use', text, toolUseBlocks, modelContent: candidate.content, usage };
    }
    return { stop_reason: 'end_turn', text, toolUseBlocks: [], modelContent: candidate.content, usage };
}

/**
 * Fetch model info from Gemini API (inputTokenLimit, outputTokenLimit, etc.)
 */
export async function fetchGeminiModelInfo(cfg) {
    const apiKey = cfg.geminiApiKey;
    const model  = cfg.geminiModel || 'gemini-2.0-flash';
    if (!apiKey) return null;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            inputTokenLimit:  data.inputTokenLimit  || 0,
            outputTokenLimit: data.outputTokenLimit || 0,
            displayName:     data.displayName || model,
            description:     data.description || '',
        };
    } catch { return null; }
}
