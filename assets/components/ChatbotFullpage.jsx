/**
 * ChatbotFullpage.jsx
 *
 * Layout a tutta pagina con:
 *   - Sidebar sinistra: brand, nuova chat, chip suggerimenti
 *   - Area principale destra: header, messaggi, input bar
 *   - Config panel come overlay
 *
 * Riusa hook/lib dell'ai-chatbot-widget tramite import relativi
 * puntando alla directory gemella.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { loadCfg }       from '../lib/config.js';
import { getLocale, setLocale, getDictionary, getSupportedLocales } from '../lib/i18n.js';
import { useAgentFP }    from '../hooks/useAgentFP.js';
import { useChatHistory} from '../hooks/useChatHistory.js';
import MessageBubbleFP   from './ui/MessageBubbleFP.jsx';
import ConfigPanelFP     from './ui/ConfigPanelFP.jsx';
import UsagePanelFP     from './ui/UsagePanelFP.jsx';
import ConsentScreenFP, { hasConsented } from './ui/ConsentScreenFP.jsx';
import EulaModalFP      from './ui/EulaModalFP.jsx';
import { resetSession as resetUsageSession } from '../lib/llmUsageTracker.js';
import botIcon           from '../img/Copilot_20260516_162708.png';

// Chips are now dynamic based on locale — see t.chips inside the component

export default function ChatbotFullpage() {
    const [showConfig,   setShowConfig]   = useState(false);
    const [showUsage,    setShowUsage]    = useState(false);
    const [sidebarOpen,  setSidebarOpen]  = useState(false);
    const [consentGiven, setConsentGiven] = useState(hasConsented);
    const [showEula,     setShowEula]     = useState(false);
    const [cfg,          setCfg]          = useState(loadCfg);
    const [messages,     setMessages]     = useState([]);
    const [history,      setHistory]      = useState([]);
    const [busy,         setBusy]         = useState(false);
    const [input,        setInput]        = useState('');
    const [locale,       setLocaleState]  = useState(getLocale);
    const t = getDictionary(locale);
    const supportedLocales = getSupportedLocales();
    // tiene traccia se la sessione corrente è già stata creata su Liferay
    const sessionCreatedRef = useRef(false);

    const messagesEndRef = useRef(null);
    const textareaRef    = useRef(null);

    // ── storico chat ──────────────────────────────────────────────────────────
    const chatHistory = useChatHistory(cfg.chatHistoryEnabled ? cfg : null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus on mount
    useEffect(() => {
        setTimeout(() => textareaRef.current?.focus(), 200);
    }, []);

    // Listen for locale changes from other components
    useEffect(() => {
        const handler = (e) => setLocaleState(e.detail.locale);
        window.addEventListener('chatbot-locale-change', handler);
        return () => window.removeEventListener('chatbot-locale-change', handler);
    }, []);

    const { runAgent } = useAgentFP({
        cfg, history, setHistory, setMessages,
    });

    const providerLabel = useMemo(() => {
        if (cfg.llmProvider === 'gemini') return 'Gemini';
        if (cfg.llmProvider === 'ollama') return `Ollama${cfg.ollamaModel ? ' · ' + cfg.ollamaModel : ''}`;
        if (cfg.llmProvider === 'openai') return `OpenAI${cfg.openaiModel ? ' · ' + cfg.openaiModel : ''}`;
        if (cfg.llmProvider === 'deepseek') return `DeepSeek${cfg.openaiModel ? ' · ' + cfg.openaiModel : ''}`;
        if (cfg.llmProvider === 'mistral') return `Mistral${cfg.openaiModel ? ' · ' + cfg.openaiModel : ''}`;
        return 'Claude';
    }, [cfg.llmProvider, cfg.ollamaModel, cfg.openaiModel]);

    // CSS vars tema
    const themeStyle = useMemo(() => ({
        '--afp-primary':     cfg.colorPrimary    || '#0054b1',
        '--afp-accent':      cfg.colorAccent     || '#4f8ef7',
        '--afp-user-bubble': cfg.colorUserBubble || '#0054b1',
        '--afp-bot-bubble':  cfg.colorBotBubble  || '#ffffff',
    }), [cfg.colorPrimary, cfg.colorAccent, cfg.colorUserBubble, cfg.colorBotBubble]);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || busy) return;
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = '';

        // Prima esecuzione della sessione corrente: crea il record su Liferay
        if (!sessionCreatedRef.current && cfg.chatHistoryEnabled) {
            sessionCreatedRef.current = true;
            // La creiamo in modo asincrono non bloccante; passiamo i messaggi
            // correnti + quello che stiamo per aggiungere
            const pendingMessages = [...messages, { id: Date.now(), role: 'user', text }];
            chatHistory.createSession(text, pendingMessages, history);
        }

        runAgent(text, setBusy);
    }, [input, busy, runAgent, messages, history, chatHistory]);

    const handleKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }, [handleSend]);

    const handleTextareaChange = useCallback((e) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }, []);

    const handleChip = useCallback((text) => {
        setInput(text);
        setTimeout(() => textareaRef.current?.focus(), 0);
    }, []);

    const handleClear = useCallback(() => {
        setMessages([]);
        setHistory([]);
        sessionCreatedRef.current = false;
        chatHistory.resetCurrentSession();
        resetUsageSession();
    }, [chatHistory]);

    const handleRegenerate = useCallback((sourceQuery) => {
        if (!sourceQuery || busy) return;
        setMessages((prev) => {
            const lastUserIdx = [...prev].reverse().findIndex((m) => m.role === 'user');
            if (lastUserIdx === -1) return prev;
            return prev.slice(0, prev.length - lastUserIdx - 1);
        });
        setHistory((prev) => {
            const lastUserIdx = [...prev].reverse().findIndex((m) => m.role === 'user');
            if (lastUserIdx === -1) return prev;
            return prev.slice(0, prev.length - lastUserIdx - 1);
        });
        setTimeout(() => runAgent(sourceQuery, setBusy), 50);
    }, [busy, runAgent]);

    const handleConfigSave = useCallback((newCfg) => {
        setCfg(newCfg);
        setShowConfig(false);
        setMessages([]);
        setHistory([]);
        sessionCreatedRef.current = false;
        chatHistory.resetCurrentSession();
    }, [chatHistory]);

    // ── auto-save dopo ogni risposta completata ───────────────────────────────
    useEffect(() => {
        if (!cfg.chatHistoryEnabled) return;
        if (messages.length === 0) return;
        if (!sessionCreatedRef.current) return;
        // Aggiorna solo quando il bot ha finito (ultimo msg = assistant)
        const last = messages[messages.length - 1];
        if (last?.role === 'assistant') {
            chatHistory.updateSession(messages, history);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages]);

    // ── carica sessione dalla sidebar ─────────────────────────────────────────
    const handleLoadSession = useCallback(async (sessionId) => {
        if (busy) return;
        const result = await chatHistory.loadSession(sessionId);
        if (result) {
            setMessages(result.messages);
            setHistory(result.history);
            sessionCreatedRef.current = true;
        }
    }, [busy, chatHistory]);

    // ── elimina sessione dalla sidebar ────────────────────────────────────────
    const handleDeleteSession = useCallback((e, sessionId) => {
        e.stopPropagation();
        chatHistory.deleteSession(sessionId);
        // Se era quella corrente, pulisci la chat
        if (chatHistory.currentSessionId.current === sessionId) {
            setMessages([]);
            setHistory([]);
            sessionCreatedRef.current = false;
        }
    }, [chatHistory]);

    const hasMessages = messages.length > 0;

    // Iniziali dell'utente per l'avatar nel rail
    const userInitials = useMemo(() => {
        const td = window.Liferay?.ThemeDisplay;
        const name = td?.getUserName?.() || '';
        const parts = name.split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase() || 'U';
    }, []);

    return (
        <div className="afp-root" style={themeStyle}>

        {/* ── CONSENT SCREEN (primo accesso) ── */}
        {!consentGiven && (
            <ConsentScreenFP
                t={t}
                onAccept={() => setConsentGiven(true)}
                onShowEula={() => setShowEula(true)}
            />
        )}
        {showEula && <EulaModalFP t={t} onClose={() => setShowEula(false)} />}

        {/* ── RAIL (versione compatta della sidebar) ── */}
        {!sidebarOpen && (
            <nav className="afp-rail">
                <button className="afp-rail-icon afp-rail-icon-brand" onClick={() => setSidebarOpen(true)} title={t.railExpandMenu}>
                    <img src={botIcon} alt="" />
                </button>
                <button className="afp-rail-icon" onClick={handleClear} title={t.railNewConversation}>＋</button>
                {cfg.chatHistoryEnabled && (
                    <button className="afp-rail-icon" onClick={() => setSidebarOpen(true)} title={t.railRecentConversations}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </button>
                )}
                <button className="afp-rail-icon" onClick={() => setShowConfig(true)} title={t.railSettings}>⚙</button>
                <button className="afp-rail-icon" onClick={() => setShowUsage(true)} title={t.railUsage || 'Usage'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>
                </button>
                <div className="afp-rail-spacer"></div>
                <div className="afp-rail-avatar" title={window.Liferay?.ThemeDisplay?.getUserName?.() || t.sidebarUser}>
                    {userInitials}
                </div>
            </nav>
            )}

            {/* ── SIDEBAR SINISTRA ── */}
            <aside className={`afp-sidebar${sidebarOpen ? '' : ' afp-sidebar-collapsed'}`}>

                {/* Brand con pulsante per collassare */}
                <div className="afp-sidebar-brand" onClick={() => setSidebarOpen(false)} style={{ cursor: 'pointer' }} title={t.sidebarCollapseMenu}>
                    <div className="afp-sidebar-brand-icon"><img src={botIcon} alt="" /></div>
                </div>

                {/* Nuova chat */}
                <div className="afp-sidebar-new-chat">
                    <button className="afp-new-chat-btn" onClick={handleClear}>
                        <span>＋</span> {t.sidebarNewConversation}
                    </button>
                </div>

                {/* ── Storico sessioni (solo se abilitato) ── */}
                {cfg.chatHistoryEnabled && (<>
                <div className="afp-sidebar-history-title">
                    <span>{t.sidebarRecentConversations}</span>
                    {chatHistory.loading && <span className="afp-history-loading">…</span>}
                </div>

                {chatHistory.error && (
                    <div className="afp-history-error" title={chatHistory.error}>
                        {t.sidebarHistoryUnavailable}
                    </div>
                )}

                <div className="afp-sidebar-history">
                    {chatHistory.sessions.length === 0 && !chatHistory.loading && !chatHistory.error && (
                        <div className="afp-history-empty">{t.sidebarNoHistory}</div>
                    )}
                    {chatHistory.sessions.map((s) => (
                        <div
                            key={s.id}
                            className={`afp-history-item${
                                chatHistory.currentSessionId.current === s.id
                                    ? ' afp-history-item-active' : ''
                            }`}
                            onClick={() => handleLoadSession(s.id)}
                            title={s.title}
                        >
                            <div className="afp-history-item-body">
                                <div className="afp-history-item-title">{s.title}</div>
                                <div className="afp-history-item-date">{s.date}</div>
                            </div>
                            <button
                                className="afp-history-item-del"
                                onClick={(e) => handleDeleteSession(e, s.id)}
                                title={t.sidebarDeleteConversation}
                            >✕</button>
                        </div>
                    ))}
                </div>
                </>)}

                {/* Spacer per spingere il footer in basso */}
                <div className="afp-sidebar-spacer"></div>

                {/* Footer sidebar — Impostazioni + utente */}
                <div className="afp-sidebar-footer">
                    <button className="afp-sidebar-footer-btn"
                        onClick={() => setShowConfig(true)}>
                        {t.sidebarSettings}
                    </button>
                    <div className="afp-sidebar-user" title={window.Liferay?.ThemeDisplay?.getUserName?.() || t.sidebarUser}>
                        <div className="afp-sidebar-user-avatar">{userInitials}</div>
                        <span className="afp-sidebar-user-name">{window.Liferay?.ThemeDisplay?.getUserName?.() || t.sidebarUser}</span>
                    </div>
                </div>
            </aside>

            {/* ── AREA PRINCIPALE ── */}
            <main className="afp-main">

                {/* Header */}
                <div className="afp-header">
                    <div className="afp-header-info">
                        <div className="afp-header-title">{t.headerTitle}</div>
                        <div className="afp-header-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="afp-status-dot" />
                            {t.statusOnline} · {providerLabel}
                        </div>
                    </div>
                    <div className="afp-header-actions">
                        {/* Language selector */}
                        <select className="afp-lang-select" value={locale} onChange={(e) => { setLocale(e.target.value); setLocaleState(e.target.value); }} title="Language / Lingua">
                            {supportedLocales.map((loc) => (
                                <option key={loc.code} value={loc.code}>{loc.flag} {loc.label}</option>
                            ))}
                        </select>
                        <button className="afp-header-btn afp-header-btn-new" title={t.railNewConversation} onClick={handleClear}>＋</button>
                    </div>
                </div>

                {/* Messaggi o Welcome */}
                {!hasMessages ? (
                    /* Welcome screen */
                    <div className="afp-messages">
                        <div className="afp-welcome">
                            <h2>{t.welcomeTitle}</h2>
                            <p className="afp-welcome-sub">
                                {t.welcomeSubtitle}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="afp-messages">
                        {messages.map((msg) => (
                            <MessageBubbleFP
                                key={msg.id}
                                msg={msg}
                                onRegenerate={handleRegenerate}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}

                {/* Input bar */}
                <div className="afp-input-area">
                    <div className="afp-input-bar">
                        <textarea
                            ref={textareaRef}
                            className="afp-textarea"
                            value={input}
                            placeholder={t.inputPlaceholder}
                            rows={1}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKey}
                            disabled={busy}
                        />
                        <button
                            className="afp-send-btn"
                            onClick={handleSend}
                            disabled={busy || !input.trim()}
                            title={t.sendButton}
                        >➤</button>
                    </div>
                    <div className="afp-input-hint">{t.inputHint}</div>
                </div>

                {/* Config overlay */}
                {showConfig && (
                    <ConfigPanelFP
                        cfg={cfg}
                        onSave={handleConfigSave}
                        onBack={() => setShowConfig(false)}
                        t={t}
                    />
                )}

                {/* Usage overlay */}
                {showUsage && (
                    <UsagePanelFP
                        cfg={cfg}
                        onBack={() => setShowUsage(false)}
                        t={t}
                    />
                )}
            </main>
        </div>
    );
}
