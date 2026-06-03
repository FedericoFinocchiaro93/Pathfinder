import { callClaude } from './anthropic.js';
import { callGemini } from './gemini.js';
import { callOllama } from './ollama.js';
import { callOpenAI } from './openai.js';

export function callLLM(history, cfg, feedbackContext) {
    if (cfg.llmProvider === 'gemini')   return callGemini(history, cfg, feedbackContext);
    if (cfg.llmProvider === 'ollama')   return callOllama(history, cfg, feedbackContext);
    if (cfg.llmProvider === 'openai')   return callOpenAI(history, cfg, feedbackContext);
    if (cfg.llmProvider === 'deepseek') return callOpenAI(history, cfg, feedbackContext);
    if (cfg.llmProvider === 'mistral')  return callOpenAI(history, cfg, feedbackContext);
    return callClaude(history, cfg, feedbackContext);
}

export function appendUserMessage(history, text, provider) {
    if (provider === 'gemini') return [...history, { role: 'user', parts: [{ text }] }];
    // OpenAI, DeepSeek, Mistral use the same format as Anthropic (role/content)
    return [...history, { role: 'user', content: text }];
}

export function appendAssistantToHistory(history, response, provider) {
    if (provider === 'gemini') return [...history, { role: 'model',     parts:   response.modelContent.parts }];
    if (provider === 'ollama') return [...history, response.assistantMessage];
    // OpenAI, DeepSeek, Mistral: store the raw assistant message (has content + optional tool_calls)
    if (provider === 'openai' || provider === 'deepseek' || provider === 'mistral') {
        return [...history, response.assistantMessage];
    }
    return [...history, { role: 'assistant', content: response.rawContent }];
}

export function appendToolResultsToHistory(history, toolUseBlocks, toolResults, provider) {
    const serialize = (content) => JSON.stringify(content);
    if (provider === 'gemini') {
        const parts = toolUseBlocks.map((tb, i) => ({ functionResponse: { name: tb.name, response: { result: toolResults[i].content } } }));
        return [...history, { role: 'user', parts }];
    }
    if (provider === 'ollama') {
        const msgs = toolUseBlocks.map((tb, i) => ({ role: 'tool', name: tb.name, content: serialize(toolResults[i].content) }));
        return [...history, ...msgs];
    }
    // OpenAI, DeepSeek, Mistral: tool results with tool_call_id
    if (provider === 'openai' || provider === 'deepseek' || provider === 'mistral') {
        const msgs = toolUseBlocks.map((tb, i) => ({
            role: 'tool',
            tool_call_id: tb.id,
            content: serialize(toolResults[i].content),
        }));
        return [...history, ...msgs];
    }
    // Anthropic format
    const blocks = toolUseBlocks.map((tb, i) => ({ type: 'tool_result', tool_use_id: tb.id, content: serialize(toolResults[i].content) }));
    return [...history, { role: 'user', content: blocks }];
}
