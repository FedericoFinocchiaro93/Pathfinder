/**
 * lib/config.js — ai-chatbot-fullpage
 * Stessa logica del widget, storage key diversa per non condividere stato.
 */

export const DEFAULT_CFG = {
    llmProvider:   'anthropic',
    apiKey:        '',
    anthropicProxyUrl: '',
    model:         '',
    geminiApiKey:  '',
    geminiModel:   'gemini-2.5-flash',
    ollamaUrl:     'http://localhost:11434',
    ollamaModel:   '',
    ollamaUseAuth: false,
    ollamaApiKey:  '',
    openaiApiKey:   '',
    openaiModel:    '',
    openaiBaseUrl:  '',
    chatHistoryEnabled: true,
    feedbackEnabled: false,
    budgetUsd:       0,
    colorPrimary:  '#0054b1',
    colorAccent:   '#4f8ef7',
    colorUserBubble: '#0054b1',
    colorBotBubble:  '#ffffff',
};

const STORAGE_KEY = 'acfp_cfg_v1';

export function loadCfg() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const merged = { ...DEFAULT_CFG, ...saved };
        // Migrazione: sostituisci il vecchio endpoint Ollama locale con quello remoto
        if (merged.ollamaUrl === 'http://localhost:11434') {
            merged.ollamaUrl = DEFAULT_CFG.ollamaUrl;
        }
        return merged;
    } catch {
        return { ...DEFAULT_CFG };
    }
}

export function saveCfg(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}
