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

// XLSX is loaded from CDN (SheetJS CE 0.20.3+) to avoid the npm xlsx
// Prototype Pollution vulnerability (CVE in all versions < 0.19.3, npm pkg unmaintained).
// See: https://github.com/advisories/GHSA-4r6h-8v4j-7f4v
let _XLSX = null;
async function loadXLSX() {
    if (_XLSX) return _XLSX;
    // Load from CDN — the npm package is unmaintained and vulnerable
    return new Promise((resolve, reject) => {
        if (window.XLSX) { _XLSX = window.XLSX; return resolve(_XLSX); }
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
        script.onload = () => { _XLSX = window.XLSX; resolve(_XLSX); };
        script.onerror = () => reject(new Error('Failed to load xlsx from CDN'));
        document.head.appendChild(script);
    });
}

import { loadCfg, saveCfg } from '../lib/config.js';
import { getLocale, setLocale, getDictionary, getSupportedLocales } from '../lib/i18n.js';
import { useAgentFP }    from '../hooks/useAgentFP.js';
import { useChatHistory} from '../hooks/useChatHistory.js';
import MessageBubbleFP   from './ui/MessageBubbleFP.jsx';
import ConfigPanelFP     from './ui/ConfigPanelFP.jsx';
import UsagePanelFP     from './ui/UsagePanelFP.jsx';
import ContentStatsPanelFP from './ui/ContentStatsPanelFP.jsx';
import ConsentScreenFP, { hasConsented } from './ui/ConsentScreenFP.jsx';
import EulaModalFP      from './ui/EulaModalFP.jsx';
import DocumentPicker    from './ui/DocumentPicker.jsx';
import CodePanelFP      from './ui/CodePanelFP.jsx';
import { fetchOllamaModels } from '../lib/llm/ollama.js';
import { fetchOpenAIModels } from '../lib/llm/openai.js';
import { resetSession as resetUsageSession } from '../lib/llmUsageTracker.js';
import botIcon           from '../img/PathfinderLogo.png';

// Chips are now dynamic based on locale — see t.chips inside the component

// ── Model lists per provider ───────────────────────────────────────────────────
const PROVIDER_MODELS = {
    anthropic: [
        { id: 'claude-sonnet-4-20250514', label: 'Sonnet 4' },
        { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    ],
    gemini: [
        { id: 'gemini-2.5-flash', label: '2.5 Flash' },
        { id: 'gemini-2.5-pro', label: '2.5 Pro' },
        { id: 'gemini-2.0-flash', label: '2.0 Flash' },
    ],
    openai: [
        { id: 'gpt-4o', label: 'GPT-4o' },
        { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
        { id: 'gpt-4.1', label: 'GPT-4.1' },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
        { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano' },
        { id: 'o3', label: 'o3' },
        { id: 'o4-mini', label: 'o4-mini' },
    ],
    deepseek: [
        { id: 'deepseek-chat', label: 'Chat' },
        { id: 'deepseek-reasoner', label: 'Reasoner' },
    ],
    mistral: [
        { id: 'mistral-large-latest', label: 'Large' },
        { id: 'mistral-medium-latest', label: 'Medium' },
        { id: 'mistral-small-latest', label: 'Small' },
        { id: 'open-mistral-nemo', label: 'Nemo' },
        { id: 'codestral-latest', label: 'Codestral' },
    ],
};

function getCurrentModelLabel(cfg) {
    const provider = cfg.llmProvider || 'anthropic';
    const models = PROVIDER_MODELS[provider] || [];
    let currentId;
    if (provider === 'anthropic') currentId = cfg.model;
    else if (provider === 'gemini') currentId = cfg.geminiModel;
    else if (provider === 'ollama') currentId = cfg.ollamaModel;
    else currentId = cfg.openaiModel;
    const found = models.find(m => m.id === currentId);
    if (found) return found.label;
    // Fallback: show raw model id truncated
    if (currentId) return currentId.length > 16 ? currentId.slice(0, 14) + '…' : currentId;
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function ChatbotFullpage() {
    const [showConfig,   setShowConfig]   = useState(false);
    const [showUsage,    setShowUsage]    = useState(false);
    const [showStats,    setShowStats]    = useState(false);
    const [sidebarOpen,  setSidebarOpen]  = useState(false);
    const [consentGiven, setConsentGiven] = useState(hasConsented);
    const [showEula,     setShowEula]     = useState(false);
    const [cfg,          setCfg]          = useState(loadCfg);
    const [messages,     setMessages]     = useState([]);
    const [history,      setHistory]      = useState([]);
    const [busy,         setBusy]         = useState(false);
    const [input,        setInput]        = useState('');
    const [locale,       setLocaleState]  = useState(getLocale);
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const fileInputRef = useRef(null);
    const [selectedDocs, setSelectedDocs] = useState([]); // [{id, title, fileName, mimeType, size, contentUrl, adaptedImages}]
    const [droppedFiles, setDroppedFiles] = useState([]); // [{file: File, preview: string}]
    const [isDragOver, setIsDragOver] = useState(false);
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [dynamicModels, setDynamicModels] = useState([]); // for Ollama / OpenAI-compat
    const [codePanelOpen, setCodePanelOpen] = useState(false);
    const [codePanelCode, setCodePanelCode] = useState('');
    const [codePanelLang, setCodePanelLang] = useState('');
    const [codePanelWidth, setCodePanelWidth] = useState(50); // percentage
    const modelMenuRef = useRef(null);
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

    // Close attach menu on outside click
    useEffect(() => {
        if (!showAttachMenu) return;
        const handler = (e) => {
            if (!e.target.closest('.afp-attach-wrapper')) {
                setShowAttachMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAttachMenu]);

    // Close model menu on outside click
    useEffect(() => {
        if (!showModelMenu) return;
        const handler = (e) => {
            if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) {
                setShowModelMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showModelMenu]);

    // Fetch dynamic models for Ollama / OpenAI-compat when menu opens
    useEffect(() => {
        if (!showModelMenu) return;
        const provider = cfg.llmProvider;
        if (provider === 'ollama') {
            fetchOllamaModels(cfg).then(models => setDynamicModels(models.map(m => ({ id: m, label: m }))))
                .catch(() => setDynamicModels([]));
        } else if (['openai', 'deepseek', 'mistral'].includes(provider)) {
            fetchOpenAIModels(cfg).then(models => setDynamicModels(models.map(m => ({ id: m, label: m }))))
                .catch(() => setDynamicModels([]));
        } else {
            setDynamicModels([]);
        }
    }, [showModelMenu, cfg.llmProvider]);

    const { runAgent } = useAgentFP({
        cfg, history, setHistory, setMessages,
    });

    const providerLabel = useMemo(() => {
        if (cfg.llmProvider === 'gemini') return 'Gemini';
        if (cfg.llmProvider === 'ollama') return 'Ollama';
        if (cfg.llmProvider === 'openai') return 'OpenAI';
        if (cfg.llmProvider === 'deepseek') return 'DeepSeek';
        if (cfg.llmProvider === 'mistral') return 'Mistral';
        return 'Claude';
    }, [cfg.llmProvider]);

    const handleModelChange = useCallback((modelId) => {
        const provider = cfg.llmProvider;
        let updated;
        if (provider === 'anthropic') updated = { ...cfg, model: modelId };
        else if (provider === 'gemini') updated = { ...cfg, geminiModel: modelId };
        else if (provider === 'ollama') updated = { ...cfg, ollamaModel: modelId };
        else updated = { ...cfg, openaiModel: modelId };
        setCfg(updated);
        saveCfg(updated);
        setShowModelMenu(false);
    }, [cfg]);

    // CSS vars tema
    const themeStyle = useMemo(() => ({
        '--afp-primary':     cfg.colorPrimary    || '#0054b1',
        '--afp-accent':      cfg.colorAccent     || '#4f8ef7',
        '--afp-user-bubble': cfg.colorUserBubble || '#0054b1',
        '--afp-bot-bubble':  cfg.colorBotBubble  || '#ffffff',
    }), [cfg.colorPrimary, cfg.colorAccent, cfg.colorUserBubble, cfg.colorBotBubble]);

    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (busy) return;

        // ── Se ci sono file droppati, passali al LLM come contesto ──────────
        // NON caricarli nella DML — sarà l'LLM a decidere se chiamare upload_document
        if (droppedFiles.length > 0) {
            setInput('');
            if (textareaRef.current) textareaRef.current.style.height = '';

            // Separa i file Excel da quelli normali
            const excelExts = ['.xlsx', '.xls', '.csv'];
            const excelFiles = droppedFiles.filter(f => excelExts.some(ext => f.file.name.toLowerCase().endsWith(ext)));
            const otherFiles = droppedFiles.filter(f => !excelExts.some(ext => f.file.name.toLowerCase().endsWith(ext)));

            // Converti i file non-Excel in base64 per il tool executor
            const pendingFiles = [];
            for (const fileObj of otherFiles) {
                try {
                    const data = await fileToBase64(fileObj.file);
                    pendingFiles.push({
                        name: fileObj.file.name,
                        type: fileObj.type || 'application/octet-stream',
                        size: fileObj.file.size,
                        data: data,
                    });
                } catch (e) {
                    console.error('Error reading file:', e);
                }
            }

            // Parsa i file Excel in testo strutturato
            let excelText = '';
            const excelNames = [];
            const failedExcelFiles = [];
            for (const f of excelFiles) {
                try {
                    const sheets = await parseExcelFile(f.file);
                    const formatted = formatExcelAsText(sheets);
                    console.log('[Excel] Parsed OK:', f.file.name, 'sheets:', sheets.map(s => s.sheet));
                    excelText += `\n\n${formatted}`;
                    excelNames.push(f.file.name);
                } catch (e) {
                    console.error('[Excel] Parse FAILED for', f.file.name, e);
                    failedExcelFiles.push(f);
                }
            }

            // Fallback: se il parsing Excel fallisce, trattali come file normali (base64)
            for (const f of failedExcelFiles) {
                try {
                    const data = await fileToBase64(f.file);
                    pendingFiles.push({
                        name: f.file.name,
                        type: f.file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        size: f.file.size,
                        data: data,
                    });
                    console.log('[Excel] Fallback: added', f.file.name, 'as base64 file');
                } catch (e2) {
                    console.error('[Excel] Fallback also failed for', f.file.name, e2);
                }
            }
            cfg._pendingFiles = pendingFiles;
            const isExcelImport = excelNames.length > 0;

            // Mostra anteprima nella chat
            const filePreviews = droppedFiles.map(f => ({
                name: f.file.name,
                type: f.file.type,
                size: f.file.size,
                preview: f.preview,
            }));
            const userText = text || (droppedFiles.length === 1 ? `📎 ${droppedFiles[0].file.name}` : `📎 ${droppedFiles.length} file allegati`);

            // Costruisci il contesto per il LLM
            let llmText = '';

            // Parte Excel (testo strutturato)
            if (excelText) {
                const excelHeader = excelNames.length === 1
                    ? `${t.excelAttachedSingle}\nFile: ${excelNames[0]}`
                    : `${t.excelAttachedMultiple}\nFiles: ${excelNames.join(', ')}`;
                llmText += `${excelHeader}\n${excelText}\n\n💡 ${t.excelDataHint}`;
            }

            // Parte file normali (base64)
            if (pendingFiles.length > 0) {
                const fileInfoList = pendingFiles.map((f, i) =>
                    `- File ${i}: "${f.name}" (${f.type}, ${formatDocSize(f.size)})`
                ).join('\n');
                const isImage = pendingFiles.some(f => f.type.startsWith('image/'));
                const uploadHint = isImage
                    ? `\n\n💡 Se l'utente chiede di caricare questa immagine nella Document Library, usa il tool upload_document. Se chiede di usarla in un contenuto web, carica prima il file con upload_document, poi usa l'ID restituito come value_document_id nel campo image.`
                    : `\n\n💡 Se l'utente chiede di caricare questo file nella Document Library, usa il tool upload_document.`;
                llmText += (llmText ? '\n\n' : '') + `📎 L'utente ha allegato ${pendingFiles.length === 1 ? 'il seguente file' : 'i seguenti file'}:\n\n${fileInfoList}${uploadHint}`;
            }

            // Aggiungi il testo dell'utente
            if (text) llmText += `\n\n${text}`;
            if (!text && !excelText && pendingFiles.length > 0) llmText += `\n\nAnalizza questo file e rispondi alle domande dell'utente.`;
            if (!text && excelText && pendingFiles.length === 0) llmText += `\n\n${t.excelAnalyzeHint}`;

            // Aggiungi messaggio utente con anteprima file
            setMessages(prev => [...prev, {
                id: Date.now() + Math.random(),
                role: 'user',
                text: userText,
                droppedFiles: filePreviews,
            }]);

            // Pulisci i file droppati (le anteprime URL vengono revocate)
            droppedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
            setDroppedFiles([]);

            if (!sessionCreatedRef.current && cfg.chatHistoryEnabled) {
                sessionCreatedRef.current = true;
                chatHistory.createSession(llmText, [...messages, { id: Date.now() + Math.random(), role: 'user', text: llmText }], history);
            }

            runAgent(llmText, setBusy, null, isExcelImport);
            return;
        }

        // Se ci sono documenti selezionati, includili nel messaggio
        if (selectedDocs.length > 0) {
            if (!text && selectedDocs.length === 0) return;
            setInput('');
            if (textareaRef.current) textareaRef.current.style.height = '';

            // Estrai il contenuto dei documenti per il LLM
            const docContents = await Promise.all(selectedDocs.map(doc => extractDocumentContent(doc)));
            const docInfo = selectedDocs.map((doc, i) => ({
                id: doc.id,
                title: doc.title,
                fileName: doc.fileName,
                mimeType: doc.mimeType,
                size: doc.size,
                contentUrl: doc.contentUrl,
                adaptedImages: doc.adaptedImages,
            }));

            // Testo visibile nella chat (solo anteprima, senza contenuto estratto)
            const userText = text || (selectedDocs.length === 1 ? '📎 Documento allegato' : `📎 ${selectedDocs.length} documenti allegati`);

            // Testo per il LLM (con contenuto estratto dei documenti)
            // Include explicit instructions on how to use document IDs with create_structured_content
            const docIds = selectedDocs.map(d => `- "${d.title}" (ID: ${d.id}, tipo: ${d.mimeType || 'sconosciuto'})`).join('\n');
            const docUsageHint = selectedDocs.some(d => d.mimeType && d.mimeType.startsWith('image/'))
                ? `\n\n⚠️ IMPORTANTE: Per usare un'immagine allegata in un contenuto web (campo image o document_library), devi usare value_document_id con l'ID numerico del documento. NON usare l'URL o il nome del file.\nEsempio: fields: [{ name: "nome_campo_immagine", value_document_id: ${selectedDocs.find(d => d.mimeType?.startsWith('image/'))?.id} }]`
                : selectedDocs.some(d => d.mimeType && !d.mimeType.startsWith('image/'))
                    ? `\n\n⚠️ IMPORTANTE: Per usare un documento allegato in un contenuto web (campo document_library), devi usare value_document_id con l'ID numerico del documento. NON usare l'URL o il nome del file.\nEsempio: fields: [{ name: "nome_campo_documento", value_document_id: ${selectedDocs.find(d => d.mimeType && !d.mimeType?.startsWith('image/'))?.id} }]`
                    : '';
            const docText = docContents.join('\n\n---\n\n');
            const llmText = selectedDocs.length === 1
                ? `📎 L'utente ha allegato il seguente documento:\n\n${docText}\n\nDocumento allegato: "${selectedDocs[0].title}" (ID: ${selectedDocs[0].id})${docUsageHint}\n\n${text ? text : 'Analizza questo documento e rispondi alle mie domande su di esso.'}`
                : `📎 L'utente ha allegato ${selectedDocs.length} documenti:\n\n${docIds}\n\n${docText}\n\n${docUsageHint}\n\n${text ? text : 'Analizza questi documenti e rispondi alle mie domande.'}`;

            // Aggiungi messaggio utente con anteprima documenti (solo info visibili, NO contenuto estratto)
            setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'user', text: userText, docs: docInfo }]);

            setSelectedDocs([]);

            // Prima esecuzione della sessione corrente: crea il record su Liferay
            if (!sessionCreatedRef.current && cfg.chatHistoryEnabled) {
                sessionCreatedRef.current = true;
                chatHistory.createSession(llmText, [...messages, { id: Date.now() + Math.random(), role: 'user', text: llmText }], history);
            }

            // Pass null as displayText because we already added the user message manually with docs preview
            runAgent(llmText, setBusy, null, false);
            return;
        }

        if (!text) return;
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

        runAgent(text, setBusy, undefined, false);
    }, [input, busy, runAgent, messages, history, chatHistory, selectedDocs, extractDocumentContent, droppedFiles]);

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
        setShowConfig(false);
        setShowUsage(false);
        setShowStats(false);
        setCodePanelOpen(false);
        setCodePanelCode('');
        setCodePanelLang('');
    }, [chatHistory]);

    const handleOpenCode = useCallback((code, lang) => {
        setCodePanelCode(code);
        setCodePanelLang(lang);
        setCodePanelOpen(true);
    }, []);

    const handleCloseCodePanel = useCallback(() => {
        setCodePanelOpen(false);
    }, []);

    // ── Draggable splitter for code panel ────────────────────────────────
    const splitDragRef = useRef(null);
    const handleSplitMouseDown = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = codePanelWidth;
        const container = e.currentTarget.parentElement;
        const containerRect = container.getBoundingClientRect();

        const handleMouseMove = (moveEvent) => {
            const dx = startX - moveEvent.clientX; // dragging left = panel gets wider
            const totalWidth = containerRect.width;
            const newPct = Math.min(70, Math.max(25, startWidth + (dx / totalWidth) * 100));
            setCodePanelWidth(newPct);
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [codePanelWidth]);

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
        setTimeout(() => runAgent(sourceQuery, setBusy, undefined, false), 50);
    }, [busy, runAgent]);

    const handleConfigSave = useCallback((newCfg) => {
        setCfg(newCfg);
        setShowConfig(false);
        setShowStats(false);
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

    // ── Document Picker: selezione documenti ──────────────────────────────────
    const handleDocPickerSelect = useCallback((docs) => {
        setSelectedDocs(prev => {
            // Evita duplicati
            const existingIds = new Set(prev.map(d => d.id));
            const newDocs = docs.filter(d => !existingIds.has(d.id));
            return [...prev, ...newDocs];
        });
    }, []);

    const handleRemoveDoc = useCallback((docId) => {
        setSelectedDocs(prev => prev.filter(d => d.id !== docId));
    }, []);

    const handleClearDocs = useCallback(() => {
        setSelectedDocs([]);
    }, []);

    // ── Drag & Drop file handling ────────────────────────────────────────────
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const fileEntries = files.map(file => ({
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        }));
        setDroppedFiles(prev => [...prev, ...fileEntries]);
    }, []);

    const handleRemoveDroppedFile = useCallback((index) => {
        setDroppedFiles(prev => {
            const removed = prev[index];
            if (removed?.preview) URL.revokeObjectURL(removed.preview);
            return prev.filter((_, i) => i !== index);
        });
    }, []);

    const handleClearDroppedFiles = useCallback(() => {
        droppedFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
        setDroppedFiles([]);
    }, [droppedFiles]);

    // ── Estrazione contenuto documento per LLM ───────────────────────────────
    const extractDocumentContent = useCallback(async (doc) => {
        const base = (cfg.liferayUrl || '').replace(/\/+$/, '');

        try {
            // Per le immagini, restituiamo i metadati con l'ID del documento
            // IMPORTANTE: l'ID è necessario per il tool create_structured_content (campo value_document_id)
            if (doc.mimeType && doc.mimeType.startsWith('image/')) {
                return `[Image: ${doc.title}] (ID: ${doc.id}, MIME: ${doc.mimeType}, Size: ${formatDocSize(doc.size)}) — URL: ${base}${doc.contentUrl}`;
            }

            // Per i PDF, restituiamo i metadati con il link per il download
            if (doc.mimeType === 'application/pdf') {
                return `[PDF: ${doc.title}] (ID: ${doc.id}, Size: ${formatDocSize(doc.size)}) — URL: ${base}${doc.contentUrl}`;
            }

            // Per documenti Office, restituiamo i metadati con il link
            if (doc.mimeType && (doc.mimeType.includes('officedocument') || doc.mimeType.includes('word') || doc.mimeType.includes('spreadsheet') || doc.mimeType.includes('presentation'))) {
                return `[Office Document: ${doc.title}] (ID: ${doc.id}, MIME: ${doc.mimeType}, Size: ${formatDocSize(doc.size)}) — URL: ${base}${doc.contentUrl}`;
            }

            // Per documenti di testo, usiamo liferayGet per ottenere i metadati via API
            // e poi fetch autenticato per il contenuto
            const contentUrl = doc.contentUrl.startsWith('http') ? doc.contentUrl : base + doc.contentUrl;
            const headers = {};
            if (cfg.lfUser && cfg.lfPass) {
                headers['Authorization'] = 'Basic ' + btoa(cfg.lfUser + ':' + cfg.lfPass);
            }
            const res = await fetch(contentUrl, { headers, credentials: 'same-origin' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('text/') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('csv')) {
                const text = await res.text();
                // Limita a 5000 caratteri per non sovraccaricare il contesto
                const truncated = text.length > 5000 ? text.substring(0, 5000) + '\n[...truncated]' : text;
                return `[Document: ${doc.title}] (ID: ${doc.id}, MIME: ${doc.mimeType}, Size: ${formatDocSize(doc.size)})\n\n${truncated}`;
            }

            // Per altri tipi, restituiamo solo i metadati
            return `[Document: ${doc.title}] (ID: ${doc.id}, MIME: ${doc.mimeType}, Size: ${formatDocSize(doc.size)}) — URL: ${base}${doc.contentUrl}`;
        } catch (e) {
            console.error('Error extracting document content:', e);
            return `[Document: ${doc.title}] (ID: ${doc.id}, MIME: ${doc.mimeType}, Size: ${formatDocSize(doc.size)}) — URL: ${base}${doc.contentUrl}`;
        }
    }, [cfg.liferayUrl, cfg.lfUser, cfg.lfPass]);

    // ── Invio con documenti (rimosso — ora gestito da handleSend) ────────────

    function formatDocSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove data URL prefix (e.g. "data:image/png;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ── Parse Excel files into structured text for the LLM ──────────────────
    async function parseExcelFile(file) {
        const XLSX = await loadXLSX();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const result = [];
                    for (const sheetName of wb.SheetNames) {
                        const ws = wb.Sheets[sheetName];
                        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                        if (rows.length === 0) continue;
                        const cols = Object.keys(rows[0]);
                        result.push({ sheet: sheetName, columns: cols, rows });
                    }
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function formatExcelAsText(sheets) {
        const parts = [];
        for (const s of sheets) {
            parts.push(`[${t.excelSheetLabel}: "${s.sheet}"]`);
            parts.push(s.columns.join(' | '));
            for (const row of s.rows) {
                parts.push(s.columns.map(c => String(row[c] ?? '')).join(' | '));
            }
        }
        return parts.join('\n');
    }

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
                <button className="afp-rail-icon" onClick={() => { setShowConfig(true); setShowUsage(false); setShowStats(false); }} title={t.railSettings}>⚙</button>
                <button className="afp-rail-icon" onClick={() => { setShowUsage(true); setShowConfig(false); setShowStats(false); }} title={t.railUsage || 'Usage'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>
                </button>
                <button className="afp-rail-icon" onClick={() => { setShowStats(true); setShowConfig(false); setShowUsage(false); }} title={t.railContentStats || 'Content Analytics'}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>
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
                        onClick={() => { setShowConfig(true); setShowUsage(false); setShowStats(false); }}>
                        {t.sidebarSettings}
                    </button>
                    <div className="afp-sidebar-user" title={window.Liferay?.ThemeDisplay?.getUserName?.() || t.sidebarUser}>
                        <div className="afp-sidebar-user-avatar">{userInitials}</div>
                        <span className="afp-sidebar-user-name">{window.Liferay?.ThemeDisplay?.getUserName?.() || t.sidebarUser}</span>
                    </div>
                </div>
            </aside>

            {/* ── AREA PRINCIPALE ── */}
            <main className={`afp-main${!hasMessages ? ' afp-main--welcome' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Drag overlay — full page */}
                {isDragOver && (
                    <div className="afp-drop-overlay">
                        <div className="afp-drop-zone">
                            <div className="afp-drop-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
                            <div className="afp-drop-text">{t.dropFilesHere || 'Drop files here'}</div>
                        </div>
                    </div>
                )}

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
                        {/* Code Panel toggle */}
                        {codePanelCode && (
                            <button className={`afp-header-btn${codePanelOpen ? ' afp-header-btn-active' : ''}`} title={t.codePanelToggle || 'Code Panel'} onClick={() => setCodePanelOpen(v => !v)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                            </button>
                        )}
                        {/* Language selector */}
                        <select className="afp-lang-select" value={locale} onChange={(e) => { setLocale(e.target.value); setLocaleState(e.target.value); }} title="Language / Lingua">
                            {supportedLocales.map((loc) => (
                                <option key={loc.code} value={loc.code}>{loc.flag} {loc.label}</option>
                            ))}
                        </select>
                        <button className="afp-header-btn afp-header-btn-new" title={t.railNewConversation} onClick={handleClear}>＋</button>
                    </div>
                </div>

                {/* Split layout: Chat + Code Panel */}
                <div className={`afp-split-layout${codePanelOpen ? ' afp-split-layout-open' : ''}`}>
                    {/* Chat area */}
                    <div className="afp-chat-panel">
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
                                        cfg={cfg}
                                        onOpenCode={handleOpenCode}
                                    />
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Code Panel (right side) */}
                    {codePanelOpen && (
                        <>
                            <div className="afp-split-handle" onMouseDown={handleSplitMouseDown} title="Drag to resize" />
                            <div className="afp-code-panel-wrapper" style={{ flex: `0 0 ${codePanelWidth}%` }}>
                                <CodePanelFP
                                    code={codePanelCode}
                                    language={codePanelLang}
                                    onClose={handleCloseCodePanel}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Input bar */}
                <div className="afp-input-area">
                    {/* Dropped files preview */}
                    {/* Dropped files preview */}
                    {droppedFiles.length > 0 && (
                        <div className="afp-dropped-files">
                            {droppedFiles.map((f, i) => (
                                <span key={i} className="afp-dropped-file-chip">
                                    <span className="afp-dropped-file-chip-icon">
                                        {f.file.type.startsWith('image/') ? '🖼️' : '📄'}
                                    </span>
                                    {f.preview && (
                                        <img src={f.preview} alt="" className="afp-dropped-file-chip-thumb" />
                                    )}
                                    <span className="afp-dropped-file-chip-name">{f.file.name}</span>
                                    <span className="afp-dropped-file-chip-size">{formatDocSize(f.file.size)}</span>
                                    <button
                                        className="afp-dropped-file-chip-remove"
                                        onClick={() => handleRemoveDroppedFile(i)}
                                        title={t.docPickerClose || 'Remove'}
                                    >✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                    {/* Selected documents chips */}
                    {selectedDocs.length > 0 && (
                        <div className="afp-selected-docs">
                            {selectedDocs.map(doc => (
                                <span key={doc.id} className="afp-selected-doc-chip">
                                    <span className="afp-selected-doc-chip-icon">
                                        {doc.mimeType && doc.mimeType.startsWith('image/') ? '🖼️' : '📄'}
                                    </span>
                                    <span className="afp-selected-doc-chip-name">{doc.title}</span>
                                    <button
                                        className="afp-selected-doc-chip-remove"
                                        onClick={() => handleRemoveDoc(doc.id)}
                                        title={t.docPickerClose || 'Remove'}
                                    >✕</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="afp-input-bar">
                        <div className="afp-attach-wrapper">
                            <button
                                className="afp-attach-btn"
                                onClick={() => setShowAttachMenu(v => !v)}
                                disabled={busy}
                                title={t.docPickerAttachBtn || 'Attach document'}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            {showAttachMenu && (
                                <div className="afp-attach-menu">
                                    <button className="afp-attach-menu-item" onClick={() => { setShowAttachMenu(false); setShowDocPicker(true); }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                        <span>{t.attachFromDML || 'Carica file dalla DML'}</span>
                                    </button>
                                    <button className="afp-attach-menu-item" onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                        <span>{t.attachFromComputer || 'Carica dal computer'}</span>
                                    </button>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
n                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length === 0) return;
                                    const fileEntries = files.map(file => ({
                                        file,
                                        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
                                    }));
                                    setDroppedFiles(prev => [...prev, ...fileEntries]);
                                    e.target.value = '';
                                }}
                            />
                        </div>
                        <textarea
                            ref={textareaRef}
                            className="afp-textarea"
                            value={input}
                            placeholder={droppedFiles.length > 0 ? (t.droppedFilesPlaceholder || 'Add a message or press Enter to send') : selectedDocs.length > 0 ? (t.docPickerAddedToChat || 'Document selected — type your question or press Enter') : t.inputPlaceholder}
                            rows={1}
                            onChange={handleTextareaChange}
                            onKeyDown={handleKey}
                            disabled={busy}
                        />
                        <div className="afp-model-pill-wrapper" ref={modelMenuRef}>
                            <button
                                className="afp-model-pill"
                                onClick={() => setShowModelMenu(v => !v)}
                                title={providerLabel}
                            >
                                <span className="afp-model-pill-label">{getCurrentModelLabel(cfg)}</span>
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 3.75L5 6.25L7.5 3.75"/></svg>
                            </button>
                            {showModelMenu && (
                                <div className={`afp-model-menu${!hasMessages ? ' afp-model-menu--down' : ''}`}>
                                    {(PROVIDER_MODELS[cfg.llmProvider] || []).concat(dynamicModels).map(m => {
                                        let isActive;
                                        if (cfg.llmProvider === 'anthropic') isActive = cfg.model === m.id;
                                        else if (cfg.llmProvider === 'gemini') isActive = cfg.geminiModel === m.id;
                                        else if (cfg.llmProvider === 'ollama') isActive = cfg.ollamaModel === m.id;
                                        else isActive = cfg.openaiModel === m.id;
                                        return (
                                            <button key={m.id}
                                                className={`afp-model-menu-item${isActive ? ' afp-model-menu-item-active' : ''}`}
                                                onClick={() => handleModelChange(m.id)}
                                            >{m.label}</button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="afp-input-hint">{t.inputHint}</div>
                </div>

                {/* Document Picker Modal */}
                {showDocPicker && (
                    <DocumentPicker
                        cfg={cfg}
                        t={t}
                        onSelect={handleDocPickerSelect}
                        onClose={() => setShowDocPicker(false)}
                    />
                )}

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

                {/* Content Stats overlay */}
                {showStats && (
                    <ContentStatsPanelFP
                        cfg={cfg}
                        onBack={() => setShowStats(false)}
                        t={t}
                    />
                )}
            </main>
        </div>
    );
}
