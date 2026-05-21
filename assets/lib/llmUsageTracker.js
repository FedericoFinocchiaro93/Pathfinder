/**
 * lib/llmUsageTracker.js — LLM Usage Tracker
 *
 * Tracks token usage, estimated cost, and context window consumption
 * for all LLM providers (Anthropic, Gemini, Ollama).
 * Data persisted in localStorage.
 */

import { dbg } from './utils.js';

const STORAGE_KEY = 'acfp_llm_usage';
const BUDGET_KEY  = 'acfp_llm_budget';

// ── Pricing tables (USD per 1M tokens) ──────────────────────────────────────
const PRICING = {
    anthropic: {
        'claude-sonnet-4-20250514':       { input: 3,    output: 15, context: 200000 },
        'claude-sonnet-4-20250514':       { input: 3,    output: 15, context: 200000 },
        'claude-sonnet-4.5':              { input: 3,    output: 15, context: 200000 },
        'claude-sonnet-4.6':              { input: 3,    output: 15, context: 1000000 },
        'claude-haiku-4.5':              { input: 1,    output: 5,  context: 200000 },
        'claude-haiku-3.5':              { input: 0.8,  output: 4,  context: 200000 },
        'claude-opus-4.5':                { input: 5,    output: 25, context: 1000000 },
        'claude-opus-4.6':                { input: 5,    output: 25, context: 1000000 },
        'claude-opus-4.7':                { input: 5,    output: 25, context: 1000000 },
        _default:                         { input: 3,    output: 15, context: 200000 },
    },
    gemini: {
        'gemini-2.5-flash':              { input: 0.15,  output: 0.60, context: 1000000 },
        'gemini-2.5-pro':                { input: 1.25,  output: 10,   context: 1000000 },
        'gemini-2.0-flash':              { input: 0.10,  output: 0.40, context: 1000000 },
        _default:                        { input: 0.15,  output: 0.60, context: 1000000 },
    },
    ollama: {
        // Ollama is free — context lengths fetched from /api/show
        _default:                        { input: 0, output: 0, context: 128000 },
    },
    openai: {
        'gpt-4o':                        { input: 2.5,  output: 10,   context: 128000 },
        'gpt-4o-mini':                   { input: 0.15, output: 0.60, context: 128000 },
        'gpt-4.1':                       { input: 2,    output: 8,    context: 1047576 },
        'gpt-4.1-mini':                  { input: 0.40, output: 1.60, context: 1047576 },
        'gpt-4.1-nano':                  { input: 0.10, output: 0.40, context: 1047576 },
        'o3':                            { input: 10,   output: 40,   context: 200000 },
        'o4-mini':                       { input: 1.10, output: 4.40, context: 200000 },
        _default:                        { input: 2.5,  output: 10,   context: 128000 },
    },
    deepseek: {
        'deepseek-chat':                 { input: 0.27, output: 1.10, context: 131072 },
        'deepseek-reasoner':             { input: 0.55, output: 2.19, context: 131072 },
        _default:                        { input: 0.27, output: 1.10, context: 131072 },
    },
    mistral: {
        'mistral-large-latest':          { input: 2,    output: 6,    context: 131072 },
        'mistral-medium-latest':         { input: 0.70, output: 2.10, context: 131072 },
        'mistral-small-latest':          { input: 0.20, output: 0.60, context: 131072 },
        'open-mistral-nemo':             { input: 0.15, output: 0.15, context: 131072 },
        'codestral-latest':              { input: 0.30, output: 0.90, context: 131072 },
        _default:                        { input: 2,    output: 6,    context: 131072 },
    },
};

// ── Internal state ─────────────────────────────────────────────────────────
let _sessionCalls = [];   // calls in current session (not persisted)
let _allTimeStats = null;  // loaded from localStorage

function _loadAllTime() {
    if (_allTimeStats) return _allTimeStats;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        _allTimeStats = raw ? JSON.parse(raw) : { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, totalCalls: 0, byProvider: {}, byModel: {} };
    } catch {
        _allTimeStats = { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, totalCalls: 0, byProvider: {}, byModel: {} };
    }
    return _allTimeStats;
}

function _saveAllTime() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_allTimeStats));
    } catch (e) {
        dbg('llmUsageTracker: save error', e.message);
    }
}

function _getPricing(provider, model) {
    const table = PRICING[provider] || PRICING.anthropic;
    return table[model] || table._default || PRICING.anthropic._default;
}

function _normalizeModelName(provider, model) {
    if (!model) return '';
    // Strip :cloud suffix from Ollama
    if (provider === 'ollama') return model.replace(/:cloud$/, '').replace(/:e4b$/, '').replace(/:26b$/, '');
    return model;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record a single LLM call.
 * @param {Object} params
 * @param {string} params.provider - 'anthropic' | 'gemini' | 'ollama'
 * @param {string} params.model - model name
 * @param {number} params.inputTokens - tokens sent
 * @param {number} params.outputTokens - tokens received
 * @param {number} [params.latencyMs] - response time in ms
 * @param {string[]} [params.toolCalls] - names of tools called
 * @param {number} [params.contextLength] - context window size (for Ollama, fetched separately)
 */
export function trackCall({ provider, model, inputTokens, outputTokens, latencyMs, toolCalls, contextLength, serviceTier }) {
    const pricing = _getPricing(provider, model);
    const costUsd = (inputTokens * pricing.input / 1000000) + (outputTokens * pricing.output / 1000000);
    const normModel = _normalizeModelName(provider, model);
    const ctxLen = contextLength || pricing.context;

    const record = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        provider,
        model: normModel,
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: latencyMs || 0,
        toolCalls: toolCalls || [],
        contextLength: ctxLen,
        contextUsedPct: ctxLen > 0 ? Math.round((inputTokens / ctxLen) * 1000) / 10 : 0,
        serviceTier: serviceTier || '',
    };

    _sessionCalls.push(record);

    // Update all-time stats
    const stats = _loadAllTime();
    stats.totalInputTokens += inputTokens;
    stats.totalOutputTokens += outputTokens;
    stats.totalCostUsd += costUsd;
    stats.totalCalls += 1;

    if (!stats.byProvider[provider]) stats.byProvider[provider] = { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
    stats.byProvider[provider].calls += 1;
    stats.byProvider[provider].costUsd += costUsd;
    stats.byProvider[provider].inputTokens += inputTokens;
    stats.byProvider[provider].outputTokens += outputTokens;

    const modelKey = `${provider}:${normModel}`;
    if (!stats.byModel[modelKey]) stats.byModel[modelKey] = { calls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0 };
    stats.byModel[modelKey].calls += 1;
    stats.byModel[modelKey].costUsd += costUsd;
    stats.byModel[modelKey].inputTokens += inputTokens;
    stats.byModel[modelKey].outputTokens += outputTokens;

    _saveAllTime();

    dbg(`llmUsageTracker: ${provider}/${normModel} in=${inputTokens} out=${outputTokens} cost=$${costUsd.toFixed(4)} ctx=${record.contextUsedPct}%`);

    return record;
}

/**
 * Get session stats (current conversation).
 */
export function getSessionStats() {
    const calls = _sessionCalls;
    if (calls.length === 0) {
        return { calls: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, currentContextUsedPct: 0, currentContextRemaining: 0, contextLength: 0, lastInputTokens: 0, calls: [] };
    }
    const last = calls[calls.length - 1];
    const totalInput  = calls.reduce((s, c) => s + c.inputTokens, 0);
    const totalOutput = calls.reduce((s, c) => s + c.outputTokens, 0);
    const totalCost   = calls.reduce((s, c) => s + c.costUsd, 0);
    const ctxLen      = last.contextLength || 0;
    const remaining  = ctxLen > 0 ? Math.max(0, ctxLen - last.inputTokens) : 0;

    return {
        calls,
        totalCalls: calls.length,
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        totalCostUsd: totalCost,
        currentContextUsedPct: last.contextUsedPct,
        currentContextRemaining: remaining,
        contextLength: ctxLen,
        lastInputTokens: last.inputTokens,
        lastOutputTokens: last.outputTokens,
        lastCostUsd: last.costUsd,
        lastLatencyMs: last.latencyMs,
        provider: last.provider,
        model: last.model,
        serviceTier: last.serviceTier || '',
    };
}

/**
 * Get all-time stats (persisted across sessions).
 */
export function getAllTimeStats() {
    return _loadAllTime();
}

/**
 * Reset session stats (new conversation).
 */
export function resetSession() {
    _sessionCalls = [];
}

/**
 * Reset all-time stats.
 */
export function resetAllTime() {
    _allTimeStats = { totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, totalCalls: 0, byProvider: {}, byModel: {} };
    _saveAllTime();
}

/**
 * Get/set budget (user-defined spending limit).
 */
export function getBudget() {
    try {
        const raw = localStorage.getItem(BUDGET_KEY);
        return raw ? parseFloat(raw) : 0;
    } catch { return 0; }
}

export function setBudget(amount) {
    localStorage.setItem(BUDGET_KEY, String(amount));
}

/**
 * Get pricing info for a specific provider/model.
 */
export function getPricing(provider, model) {
    return _getPricing(provider, model);
}

/**
 * Update context length for an Ollama model (fetched from /api/show).
 */
export function setOllamaContextLength(model, contextLength) {
    const normModel = _normalizeModelName('ollama', model);
    if (!PRICING.ollama[normModel]) {
        PRICING.ollama[normModel] = { input: 0, output: 0, context: contextLength };
    } else {
        PRICING.ollama[normModel].context = contextLength;
    }
}

/**
 * Update context length for a Gemini model (fetched from API).
 */
export function setGeminiContextLength(model, contextLength) {
    if (!PRICING.gemini[model]) {
        PRICING.gemini[model] = { input: 0.15, output: 0.60, context: contextLength };
    } else {
        PRICING.gemini[model].context = contextLength;
    }
}

/**
 * Format a USD amount for display.
 */
export function formatCost(usd) {
    if (usd < 0.01) return '<$0.01';
    if (usd < 1) return '$' + usd.toFixed(2);
    if (usd < 100) return '$' + usd.toFixed(2);
    return '$' + usd.toFixed(0);
}

/**
 * Format token count for display.
 */
export function formatTokens(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}