/**
 * hooks/useAgent.js — ai-chatbot-fullpage (identico al widget)
 */

import { useCallback, useRef } from 'react';
import { dbg, makeAssistantResponse } from '../lib/utils.js';
import { executeTool }                from '../lib/toolExecutor.js';
import { getBaseUrl, getSiteId }      from '../lib/liferay.js';
import {
    callLLM,
    appendUserMessage,
    appendAssistantToHistory,
    appendToolResultsToHistory,
} from '../lib/llm/router.js';

const MAX_ITERATIONS      = 16;
const PAGE_SIZE_THRESHOLD = 20;
const PAGE_SIZE_STEP      = 10;

function buildContentUrl(it, base) {
    const contentPath = it.friendlyUrlPath ? it.friendlyUrlPath.replace(/^\//, '') : null;
    if (!contentPath) return null;
    const apiPrefix = it.siteFriendlyUrl || it.siteGroupFriendlyUrl || null;
    if (apiPrefix) { const p = '/' + apiPrefix.replace(/^\//, '').replace(/\/$/, ''); return `${base}${p}/-/${contentPath}`; }
    try { const layoutUrl = window.Liferay?.ThemeDisplay?.getLayoutURL?.() || ''; const m = layoutUrl.match(/(\/web\/[^/?#]+)/); if (m) return `${base}${m[1]}/-/${contentPath}`; } catch (_) {}
    try { const ctx = window.Liferay?.ThemeDisplay?.getPathContext?.() || ''; if (ctx) return `${base}${ctx}/-/${contentPath}`; } catch (_) {}
    return `${base}/-/${contentPath}`;
}

function itemToLine(it, base) {
    const t   = it.title || it.name || `#${it.id || '?'}`;
    const url = buildContentUrl(it, base);
    return url ? `- ${t} — ${url}` : `- ${t}`;
}

function formatItemsPage(items, totalCount, offset, base) {
    const slice   = items.slice(offset, offset + PAGE_SIZE_STEP);
    const shown   = offset + slice.length;
    const lines   = slice.map((it) => itemToLine(it, base));
    const hasMore = shown < totalCount;
    let text = lines.join('\n');
    if (offset === 0 && totalCount > PAGE_SIZE_THRESHOLD) text = `Trovati **${totalCount}** risultati in totale. Ecco i primi ${slice.length}:\n${text}`;
    if (hasMore) text += `\n\n*Mostrati ${shown} di ${totalCount}. Vuoi vedere i prossimi ${Math.min(PAGE_SIZE_STEP, totalCount - shown)}?*`;
    else if (offset > 0) text += `\n\n*Fine risultati (${totalCount} totali).*`;
    return { text, hasMore, nextOffset: shown };
}

function buildSearchingMessage(userText) {
    const text = userText.trim();
    const patterns = [
        { re: /\bcerca[mi]*\s+(.+)/i, tmpl: (m) => `Sto cercando "${m[1].trim()}"…` },
        { re: /\btrova[mi]*\s+(.+)/i, tmpl: (m) => `Sto cercando "${m[1].trim()}"…` },
        { re: /\bdammi\s+(.+)/i,      tmpl: (m) => `Recupero "${m[1].trim()}"…` },
        { re: /\bmostra[mi]*\s+(.+)/i,tmpl: (m) => `Recupero "${m[1].trim()}"…` },
    ];
    for (const { re, tmpl } of patterns) { const m = text.match(re); if (m) { let msg = tmpl(m); if (msg.length > 120) msg = msg.slice(0, 117) + '…'; return msg.charAt(0).toUpperCase() + msg.slice(1); } }
    const short = text.length > 80 ? text.slice(0, 77) + '…' : text;
    return `Elaboro la tua richiesta: "${short}"…`;
}

export function useAgent({ cfg, history, setHistory, setMessages, open, setUnread }) {
    const busyRef       = useRef(false);
    const paginationRef = useRef(null);

    const addMsg = useCallback((role, text, toolCalls) => {
        setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text, toolCalls }]);
    }, [setMessages]);

    const addThinking = useCallback(() => {
        setMessages((prev) => [...prev, { id: 'thinking', type: 'thinking' }]);
    }, [setMessages]);

    const removeThinking = useCallback(() => {
        setMessages((prev) => prev.filter((m) => m.id !== 'thinking'));
    }, [setMessages]);

    const setSearchingMsg = useCallback((text) => {
        setMessages((prev) => { const exists = prev.find((m) => m.id === 'searching'); if (exists) return prev; return [...prev, { id: 'searching', type: 'searching', text }]; });
    }, [setMessages]);

    const removeSearchingMsg = useCallback(() => {
        setMessages((prev) => prev.filter((m) => m.id !== 'searching'));
    }, [setMessages]);

    const emitAssistant = useCallback((text, currentHistory, p, srcQuery) => {
        removeSearchingMsg();
        setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'assistant', text, sourceQuery: srcQuery }]);
        if (!open) setUnread((n) => n + 1);
        return appendAssistantToHistory(currentHistory, makeAssistantResponse(p, text), p);
    }, [removeSearchingMsg, setMessages, open, setUnread]);

    const runAgent = useCallback(async (userText, externalSetBusy) => {
        if (busyRef.current) return;
        const base = getBaseUrl(cfg.liferayUrl);
        const p    = cfg.llmProvider;

        const pg = paginationRef.current;
        const isContinue = pg && /^\s*(s[ìi]|si|continua|next|avanti|ancora|mostra ancora|altri|other|yes|ok|vai)/i.test(userText.trim());
        if (isContinue) {
            addMsg('user', userText);
            const { items, totalCount, offset, toolUseBlocks, toolResults, sourceQuery, history: pgHistory } = pg;
            const { text, hasMore, nextOffset } = formatItemsPage(items, totalCount, offset, base);
            let newHistory = emitAssistant(text, pgHistory, p, sourceQuery);
            if (hasMore) { paginationRef.current = { ...pg, offset: nextOffset, history: newHistory }; }
            else { paginationRef.current = null; newHistory = appendToolResultsToHistory(newHistory, toolUseBlocks, toolResults, p); }
            setHistory(newHistory);
            return;
        }

        paginationRef.current = null;
        busyRef.current = true;
        externalSetBusy(true);
        addMsg('user', userText);
        addThinking();

        let currentHistory = appendUserMessage(history, userText, p);

        try {
            let iterations = 0;
            while (iterations < MAX_ITERATIONS) {
                iterations++;
                const response = await callLLM(currentHistory, cfg);
                if (p === 'gemini') await new Promise((r) => setTimeout(r, 800));

                if (response.stop_reason === 'end_turn') {
                    removeThinking(); removeSearchingMsg();
                    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'assistant', text: response.text, sourceQuery: userText }]);
                    currentHistory = appendAssistantToHistory(currentHistory, response, p);
                    if (!open) setUnread((n) => n + 1);
                    break;
                }

                if (response.stop_reason === 'tool_use') {
                    const { toolUseBlocks } = response;
                    removeThinking();
                    setSearchingMsg(buildSearchingMessage(userText));
                    currentHistory = appendAssistantToHistory(currentHistory, response, p);

                    const toolResults = [];
                    for (const tb of toolUseBlocks) {
                        const result = await executeTool(tb.name, tb.input, cfg);
                        toolResults.push({ content: result });
                    }

                    if (/\b(json|mostra il json|mostrami il json|show json|raw json)\b/i.test(userText)) {
                        const jsonText = 'Risposta JSON:\n' + JSON.stringify(toolResults.map((tr) => tr.content), null, 2);
                        currentHistory = emitAssistant(jsonText, currentHistory, p, userText);
                        currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);
                        break;
                    }

                    const INTERMEDIATE_TOOLS = new Set(['get_categories','get_content_structures','get_taxonomy_categories_by_ids','get_tags','get_available_languages','list_available_apis','get_api_spec','find_relevant_endpoints','discover_endpoint','count_content_by_month']);
                    const lastToolName = toolUseBlocks[toolUseBlocks.length - 1]?.name;
                    const isIntermediateTool = INTERMEDIATE_TOOLS.has(lastToolName);
                    const isAggregativeIntent = /\b(mese|mesi|anno|quanti per|distribuzione|pi[uù] contenut|pi[uù] pubblicat|aggreg)\b/i.test(userText);
                    const wantsListIntent = !isAggregativeIntent && /\b(titolo|titoli|elenca|mostra|mostrami|listare|lista|contenuti|trova|trovami|cerca|cercami)\b/i.test(userText);
                    const allItems = toolResults.flatMap((tr) => tr.content?.items || []);
                    const totalCount = toolResults[0]?.content?.totalCount ?? allItems.length;

                    if (!isIntermediateTool && wantsListIntent && allItems.length > 0) {
                        const { text, hasMore, nextOffset } = formatItemsPage(allItems, totalCount, 0, base);
                        currentHistory = emitAssistant(text, currentHistory, p, userText);
                        if (hasMore) { paginationRef.current = { items: allItems, totalCount, offset: nextOffset, toolUseBlocks, toolResults, sourceQuery: userText, history: currentHistory }; }
                        else { currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p); }
                        break;
                    }

                    currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);
                    addThinking();
                    continue;
                }
                break;
            }
        } catch (e) {
            dbg('Errore runAgent:', e);
            removeThinking(); removeSearchingMsg();
            addMsg('system', '⚠ ' + e.message);
        } finally {
            busyRef.current = false;
            externalSetBusy(false);
            setHistory(currentHistory);
        }
    }, [cfg, history, open, addMsg, addThinking, removeThinking, setSearchingMsg, removeSearchingMsg, setMessages, setHistory, setUnread, emitAssistant]);

    return { runAgent, addMsg };
}
