/**
 * components/ui/ConfigPanelFP.jsx
 * Pannello impostazioni fullpage — overlay sopra la chat.
 * Riusa la stessa logica di ConfigDrawer ma con layout a tutta larghezza.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { saveCfg }              from '../../lib/config.js';
import { fetchOllamaModels }    from '../../lib/llm/ollama.js';
import { fetchOpenAIModels }    from '../../lib/llm/openai.js';
import { fetchAnthropicModels } from '../../lib/llm/anthropic.js';
import { _apiSpecCache }     from '../../lib/cache.js';
import { ensureFeedbackObject } from '../../lib/feedbackTracker.js';
import EulaModalFP          from './EulaModalFP.jsx';

const PRESET_COLORS = [
    { label: 'Liferay Blue', primary: '#0054b1', accent: '#4f8ef7' },
    { label: 'Ocean',        primary: '#0369a1', accent: '#38bdf8' },
    { label: 'Emerald',      primary: '#065f46', accent: '#34d399' },
    { label: 'Violet',       primary: '#5b21b6', accent: '#a78bfa' },
    { label: 'Rose',         primary: '#9f1239', accent: '#fb7185' },
    { label: 'Slate',        primary: '#1e293b', accent: '#64748b' },
];

function ConfigPanelFP({ cfg, onSave, onBack, t }) {
    const [local,         setLocal]         = useState({ ...cfg });
    const [activeTab,     setActiveTab]     = useState('llm');
    const [ollamaModels,  setOllamaModels]  = useState([]);
    const [ollamaLoading, setOllamaLoading] = useState(false);
    const [ollamaError,   setOllamaError]   = useState('');
    const [openaiModels,  setOpenaiModels]  = useState([]);
    const [openaiLoading, setOpenaiLoading] = useState(false);
    const [openaiError,   setOpenaiError]   = useState('');
    const [anthropicModels, setAnthropicModels] = useState([]);
    const [anthropicLoading, setAnthropicLoading] = useState(false);
    const [anthropicError, setAnthropicError] = useState('');
    const [showEula,      setShowEula]      = useState(false);

    const set = useCallback((k, v) => setLocal((p) => ({ ...p, [k]: v })), []);

    const isAnthropic = local.llmProvider === 'anthropic';
    const isGemini    = local.llmProvider === 'gemini';
    const isOllama    = local.llmProvider === 'ollama';
    const isOpenAI    = local.llmProvider === 'openai';
    const isDeepSeek  = local.llmProvider === 'deepseek';
    const isMistral   = local.llmProvider === 'mistral';
    const isOpenAICompatible = isOpenAI || isDeepSeek || isMistral;

    const handleLoadOllamaModels = useCallback(async () => {
        setOllamaLoading(true);
        setOllamaError('');
        try {
            const models = await fetchOllamaModels(local);
            setOllamaModels(models);
            if (models.length > 0 && !local.ollamaModel)
                setLocal((p) => ({ ...p, ollamaModel: models[0] }));
            if (models.length === 0)
                setOllamaError('Nessun modello. Esegui "ollama pull <modello>".');
        } catch (e) {
            setOllamaError(e.message);
            setOllamaModels([]);
        } finally {
            setOllamaLoading(false);
        }
    }, [local]);

    const handleLoadOpenAIModels = useCallback(async () => {
        setOpenaiLoading(true);
        setOpenaiError('');
        try {
            const models = await fetchOpenAIModels(local);
            setOpenaiModels(models);
            if (models.length > 0 && !local.openaiModel)
                setLocal((p) => ({ ...p, openaiModel: models[0] }));
            if (models.length === 0)
                setOpenaiError(t.configOpenAINoModels || 'Nessun modello trovato. Verifica API Key e URL.');
        } catch (e) {
            setOpenaiError(e.message);
            setOpenaiModels([]);
        } finally {
            setOpenaiLoading(false);
        }
    }, [local]);

    const handleLoadAnthropicModels = useCallback(async () => {
        setAnthropicLoading(true);
        setAnthropicError('');
        try {
            const models = await fetchAnthropicModels(local);
            setAnthropicModels(models);
            if (models.length > 0 && !local.model)
                setLocal((p) => ({ ...p, model: models[0] }));
            if (models.length === 0)
                setAnthropicError(t.configAnthropicNoModels || 'Nessun modello trovato. Verifica API Key.');
        } catch (e) {
            setAnthropicError(e.message);
            setAnthropicModels([]);
        } finally {
            setAnthropicLoading(false);
        }
    }, [local, t]);

    useEffect(() => {
        if (isOllama && ollamaModels.length === 0 && !ollamaError)
            handleLoadOllamaModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOllama]);

    useEffect(() => {
        if (isOpenAICompatible && openaiModels.length === 0 && !openaiError && local.openaiApiKey)
            handleLoadOpenAIModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpenAICompatible]);

    useEffect(() => {
        if (isAnthropic && anthropicModels.length === 0 && !anthropicError && local.apiKey)
            handleLoadAnthropicModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAnthropic]);

    return (
        <div className="afp-config-overlay">
            {/* Header */}
            <div className="afp-config-header">
                <div className="afp-config-header-title">{t.configTitle}</div>
                <button className="afp-config-back" onClick={onBack}>{t.configBack}</button>
            </div>

            {/* Body */}
            <div className="afp-config-body">

                {/* Tab bar */}
                <div className="afp-config-tabs">
                    <button
                        className={`afp-config-tab${activeTab === 'llm' ? ' afp-config-tab-active' : ''}`}
                        onClick={() => setActiveTab('llm')}
                    >{t.configTabGeneral}</button>
                    <button
                        className={`afp-config-tab${activeTab === 'appearance' ? ' afp-config-tab-active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >{t.configTabAppearance}</button>
                </div>

                <div className="afp-config-content">

                    {/* ── TAB LLM ── */}
                    {activeTab === 'llm' && (<>
                        <div className="afp-config-row">
                            <label className="afp-config-label">{t.configProvider}</label>
                            <select className="afp-config-input" value={local.llmProvider}
                                onChange={(e) => set('llmProvider', e.target.value)}>
                                <option value="anthropic">{t.configProviderAnthropic}</option>
                                <option value="gemini">{t.configProviderGemini}</option>
                                <option value="ollama">{t.configProviderOllama}</option>
                                <option value="openai">{t.configProviderOpenAI}</option>
                                <option value="deepseek">{t.configProviderDeepSeek}</option>
                                <option value="mistral">{t.configProviderMistral}</option>
                            </select>
                        </div>

                        {isAnthropic && (<>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configAnthropicKey}</label>
                                <input type="password" className="afp-config-input"
                                    value={local.apiKey} placeholder="sk-ant-api03-..."
                                    onChange={(e) => set('apiKey', e.target.value)} />
                            </div>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configAnthropicProxy || 'Proxy URL'}</label>
                                <input type="text" className="afp-config-input"
                                    value={local.anthropicProxyUrl || ''} placeholder="https://your-server.com/o/anthropic-proxy"
                                    onChange={(e) => set('anthropicProxyUrl', e.target.value)} />
                                <div className="afp-config-hint">{t.configAnthropicProxyHint || 'Optional: leave empty for direct browser access. Set a proxy URL only if needed.'}</div>
                            </div>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configClaudeModel}</label>
                                <div className="afp-config-label-row">
                                    {anthropicModels.length > 0 ? (
                                        <select className="afp-config-input" value={local.model}
                                            onChange={(e) => set('model', e.target.value)}>
                                            <option value="">— {t.configAnthropicSelect || 'seleziona modello'} —</option>
                                            {anthropicModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    ) : (
                                        <input type="text" className="afp-config-input" value={local.model}
                                            placeholder={anthropicLoading ? '…' : 'claude-sonnet-4-20250514'}
                                            onChange={(e) => set('model', e.target.value)} />
                                    )}
                                    <button className="afp-config-refresh"
                                        onClick={handleLoadAnthropicModels} disabled={anthropicLoading || !local.apiKey}
                                        title={t.configAnthropicLoadModels || 'Carica modelli disponibili'}>
                                        {anthropicLoading ? '…' : '↻'}
                                    </button>
                                </div>
                                {anthropicError && <div className="afp-config-error">⚠ {anthropicError}</div>}
                            </div>
                        </>)}

                        {isGemini && (<>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configGeminiKey}</label>
                                <input type="password" className="afp-config-input"
                                    value={local.geminiApiKey} placeholder="AIzaSy..."
                                    onChange={(e) => set('geminiApiKey', e.target.value)} />
                            </div>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configGeminiModel}</label>
                                <select className="afp-config-input" value={local.geminiModel}
                                    onChange={(e) => set('geminiModel', e.target.value)}>
                                    <option value="gemini-2.5-flash">{t.configGeminiFlash}</option>
                                    <option value="gemini-2.5-pro">{t.configGeminiPro}</option>
                                    <option value="gemini-2.0-flash">{t.configGemini2Flash}</option>
                                </select>
                            </div>
                        </>)}

                        {isOllama && (<>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configOllamaUrl}</label>
                                <input type="text" className="afp-config-input"
                                    value={local.ollamaUrl} placeholder="http://localhost:11434"
                                    onChange={(e) => set('ollamaUrl', e.target.value)} />
                            </div>
                            <div className="afp-config-row">
                                <label className="afp-config-check">
                                    <input type="checkbox" checked={!!local.ollamaUseAuth}
                                        onChange={(e) => set('ollamaUseAuth', e.target.checked)} />
                                    {t.configOllamaAuth}
                                </label>
                            </div>
                            {local.ollamaUseAuth && (
                                <div className="afp-config-row">
                                    <label className="afp-config-label">{t.configOllamaKey}</label>
                                    <input type="password" className="afp-config-input"
                                        value={local.ollamaApiKey} placeholder="Bearer token"
                                        onChange={(e) => set('ollamaApiKey', e.target.value)} />
                                </div>
                            )}
                            <div className="afp-config-row">
                                <div className="afp-config-label-row">
                                    <label className="afp-config-label">{t.configOllamaModel}</label>
                                    <button className="afp-config-refresh"
                                        onClick={handleLoadOllamaModels} disabled={ollamaLoading}>
                                        {ollamaLoading ? '…' : '↻'}
                                    </button>
                                </div>
                                {ollamaModels.length > 0
                                    ? <select className="afp-config-input" value={local.ollamaModel}
                                        onChange={(e) => set('ollamaModel', e.target.value)}>
                                        <option value="">{t.configOllamaSelect}</option>
                                        {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                      </select>
                                    : <input type="text" className="afp-config-input"
                                        value={local.ollamaModel} placeholder="es. llama3.1:8b"
                                        onChange={(e) => set('ollamaModel', e.target.value)} />
                                }
                                {ollamaError && <div className="afp-config-error">⚠ {ollamaError}</div>}
                            </div>
                        </>)}

                        {isOpenAICompatible && (<>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configOpenAIKey}</label>
                                <input type="password" className="afp-config-input"
                                    value={local.openaiApiKey} placeholder={isOpenAI ? 'sk-...' : isDeepSeek ? 'sk-...' : '...'}
                                    onChange={(e) => set('openaiApiKey', e.target.value)} />
                            </div>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configOpenAIModel}</label>
                                <div className="afp-config-label-row">
                                    <select className="afp-config-input" value={local.openaiModel}
                                        onChange={(e) => set('openaiModel', e.target.value)}>
                                        {isOpenAI && (<>
                                            <option value="gpt-4o">gpt-4o</option>
                                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                                            <option value="gpt-4.1">gpt-4.1</option>
                                            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                                            <option value="gpt-4.1-nano">gpt-4.1-nano</option>
                                            <option value="o3">o3</option>
                                            <option value="o4-mini">o4-mini</option>
                                        </>)}
                                        {isDeepSeek && (<>
                                            <option value="deepseek-chat">deepseek-chat</option>
                                            <option value="deepseek-reasoner">deepseek-reasoner</option>
                                        </>)}
                                        {isMistral && (<>
                                            <option value="mistral-large-latest">mistral-large-latest</option>
                                            <option value="mistral-medium-latest">mistral-medium-latest</option>
                                            <option value="mistral-small-latest">mistral-small-latest</option>
                                            <option value="open-mistral-nemo">open-mistral-nemo</option>
                                            <option value="codestral-latest">codestral-latest</option>
                                        </>)}
                                    </select>
                                    <button className="afp-config-refresh"
                                        onClick={handleLoadOpenAIModels} disabled={openaiLoading}
                                        title={t.configOpenAILoadModels || 'Carica modelli disponibili'}>
                                        {openaiLoading ? '…' : '↻'}
                                    </button>
                                </div>
                                {openaiModels.length > 0 && (
                                    <select className="afp-config-input afp-config-input-secondary"
                                        value={local.openaiModel}
                                        onChange={(e) => set('openaiModel', e.target.value)}>
                                        <option value="">— {t.configOpenAISelect || 'seleziona dal server'} —</option>
                                        {openaiModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                )}
                                {openaiError && <div className="afp-config-error">⚠ {openaiError}</div>}
                            </div>
                            <div className="afp-config-row">
                                <label className="afp-config-label">{t.configOpenAIBaseUrl}</label>
                                <input type="text" className="afp-config-input"
                                    value={local.openaiBaseUrl}
                                    placeholder={isOpenAI ? 'https://api.openai.com/v1' : isDeepSeek ? 'https://api.deepseek.com/v1' : 'https://api.mistral.ai/v1'}
                                    onChange={(e) => set('openaiBaseUrl', e.target.value)} />
                            </div>
                        </>)}

                        {/* Liferay settings */}
                        <div className="afp-config-row">
                            <label className="afp-config-label">{t.configLiferayUrl}</label>
                            <input type="text" className="afp-config-input"
                                value={local.liferayUrl} placeholder="http://localhost:8080"
                                onChange={(e) => set('liferayUrl', e.target.value)} />
                            <div className="afp-config-hint">{t.configLiferayUrlHint}</div>
                        </div>
                        <div className="afp-config-row">
                            <label className="afp-config-label">{t.configSiteGroupId}</label>
                            <input type="text" className="afp-config-input"
                                value={local.siteGroupId} placeholder="12345"
                                onChange={(e) => set('siteGroupId', e.target.value)} />
                            <div className="afp-config-hint">{t.configSiteGroupIdHint}</div>
                        </div>

                        {/* ── Storico chat ── */}
                        <div className="afp-config-section-title">{t.configChatHistory}</div>
                        <div className="afp-config-row">
                            <label className="afp-config-check">
                                <input type="checkbox" checked={!!local.chatHistoryEnabled}
                                    onChange={(e) => set('chatHistoryEnabled', e.target.checked)} />
                                {t.configChatHistoryLabel}
                            </label>
                            <div className="afp-config-hint">
                                {t.configChatHistoryHint}
                            </div>
                        </div>

                        {/* ── Feedback ── */}
                        <div className="afp-config-row">
                            <label className="afp-config-check">
                                <input type="checkbox" checked={!!local.feedbackEnabled}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        if (checked) {
                                            // Ensure the Custom Object exists before enabling
                                            const ready = await ensureFeedbackObject();
                                            if (!ready) {
                                                alert(t.configFeedbackCreateError || 'Could not create the feedback object in Liferay. Make sure you have admin permissions.');
                                                return;
                                            }
                                        }
                                        set('feedbackEnabled', checked);
                                    }} />
                                {t.configFeedbackLabel || 'Show feedback buttons'}
                            </label>
                            <div className="afp-config-hint">
                                {t.configFeedbackHint || 'Allow users to rate responses with thumbs up/down'}
                            </div>
                        </div>
                    </>)}

                    {/* ── TAB ASPETTO ── */}
                    {activeTab === 'appearance' && (<>
                        <div className="afp-config-row">
                            <label className="afp-config-label">{t.configColorTheme}</label>
                            <div className="afp-color-presets">
                                {PRESET_COLORS.map((p) => (
                                    <button
                                        key={p.label}
                                        className={`afp-color-preset${local.colorPrimary === p.primary && !local._customColor ? ' afp-color-preset-active' : ''}`}
                                        title={p.label}
                                        style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                                        onClick={() => setLocal((prev) => ({
                                            ...prev,
                                            colorPrimary: p.primary, colorAccent: p.accent,
                                            colorUserBubble: p.primary, _customColor: false,
                                        }))}
                                    />
                                ))}
                                <label
                                    className={`afp-color-preset afp-color-preset-custom${local._customColor ? ' afp-color-preset-active' : ''}`}
                                    title={t.configCustomColor}
                                    style={{
                                        background: local._customColor
                                            ? `linear-gradient(135deg, ${local.colorPrimary}, ${local.colorAccent})`
                                            : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                                    }}
                                >
                                    <input type="color" value={local.colorPrimary}
                                        onChange={(e) => {
                                            const c = e.target.value;
                                            setLocal((prev) => ({
                                                ...prev,
                                                colorPrimary: c, colorAccent: c + 'aa',
                                                colorUserBubble: c, _customColor: true,
                                            }));
                                        }} />
                                </label>
                            </div>
                        </div>
                    </>)}

                    <button className="afp-config-save"
                        onClick={() => { saveCfg(local); onSave(local); }}>
                        {t.configSave}
                    </button>

                    <button className="afp-config-eula-link"
                        onClick={() => setShowEula(true)}
                        type="button">
                        {t.consentEulaLink}
                    </button>
                </div>
            </div>
            {showEula && <EulaModalFP t={t} onClose={() => setShowEula(false)} />}
        </div>
    );
}

export default React.memo(ConfigPanelFP);
