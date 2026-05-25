/**
 * hooks/useAgentFP.js
 * Loop agentico per la versione fullpage.
 * Logica identica a useAgent.js, import puntano alla lib condivisa
 * tramite percorso relativo alla CE gemella (ai-chatbot-widget).
 *
 * NOTA: i file lib/ (toolExecutor, prompts, tools, llm/*) sono condivisi
 * con il widget floating tramite import relativi cross-CE. Questo significa
 * che la fullpage CE usa esattamente gli stessi tool, prompt e logica.
 */

import { useCallback, useRef } from 'react';
import { dbg, makeAssistantResponse } from '../lib/utils.js';
import { executeTool }                from '../lib/toolExecutor.js';
import { getBaseUrl, getSiteId }      from '../lib/liferay.js';
import { getDictionary, getLocale }   from '../lib/i18n.js';
import { trackCall, setOllamaContextLength, setGeminiContextLength } from '../lib/llmUsageTracker.js';
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
    const contentPath = it.friendlyUrlPath
        ? it.friendlyUrlPath.replace(/^\//, '')
        : null;
    if (!contentPath) return null;

    const apiPrefix = it.siteFriendlyUrl || it.siteGroupFriendlyUrl || null;
    if (apiPrefix) {
        const p = '/' + apiPrefix.replace(/^\//, '').replace(/\/$/, '');
        return `${base}${p}/-/${contentPath}`;
    }

    try {
        const layoutUrl = window.Liferay?.ThemeDisplay?.getLayoutURL?.() || '';
        const m = layoutUrl.match(/(\/web\/[^/?#]+)/);
        if (m) return `${base}${m[1]}/-/${contentPath}`;
    } catch (_) {}

    try {
        const ctx = window.Liferay?.ThemeDisplay?.getPathContext?.() || '';
        if (ctx) return `${base}${ctx}/-/${contentPath}`;
    } catch (_) {}

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
    if (offset === 0 && totalCount > PAGE_SIZE_THRESHOLD) {
        text = `Trovati **${totalCount}** risultati in totale. Ecco i primi ${slice.length}:\n${text}`;
    }
    if (hasMore) {
        text += `\n\n*Mostrati ${shown} di ${totalCount}. Vuoi vedere i prossimi ${Math.min(PAGE_SIZE_STEP, totalCount - shown)}?*`;
    } else if (offset > 0) {
        text += `\n\n*Fine risultati (${totalCount} totali).*`;
    }
    return { text, hasMore, nextOffset: shown };
}

function buildSearchingMessage(userText) {
    const text = userText.trim();
    const t = getDictionary(getLocale());
    const patterns = [
        // Italian patterns
        { re: /\bcontenut[io]\s+web\b.*?\bstruttura\s+(.+)/i,   tmpl: (m) => t.searchingContentStructure.replace('{query}', m[1]) },
        { re: /\bcerca[mi]*\s+(.+)/i,                           tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\btrova[mi]*\s+(.+)/i,                           tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bdammi\s+(.+)/i,                                tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\bmostra[mi]*\s+(.+)/i,                          tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\belenca\s+(.+)/i,                               tmpl: (m) => t.listing.replace('{query}', m[1].trim()) },
        // English patterns
        { re: /\bsearch\s+(?:for\s+)?(.+)/i,                    tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bfind\s+(.+)/i,                                  tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bshow\s+(?:me\s+)?(.+)/i,                       tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\bget\s+(.+)/i,                                   tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\blist\s+(.+)/i,                                  tmpl: (m) => t.listing.replace('{query}', m[1].trim()) },
        { re: /\bhow\s+many\s+(.+)/i,                           tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
    ];

    for (const { re, tmpl } of patterns) {
        const m = text.match(re);
        if (m) {
            let msg = tmpl(m);
            if (msg.length > 120) msg = msg.slice(0, 117) + '…';
            return msg.charAt(0).toUpperCase() + msg.slice(1);
        }
    }

    const short = text.length > 80 ? text.slice(0, 77) + '…' : text;
    return t.processingRequest.replace('{query}', short);
}

export function useAgentFP({ cfg, history, setHistory, setMessages }) {
    const busyRef       = useRef(false);
    const paginationRef = useRef(null);

    const addMsg = useCallback((role, text) => {
        setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role, text }]);
    }, [setMessages]);

    const addThinking = useCallback(() => {
        setMessages((prev) => [...prev, { id: 'thinking', type: 'thinking' }]);
    }, [setMessages]);

    const removeThinking = useCallback(() => {
        setMessages((prev) => prev.filter((m) => m.id !== 'thinking'));
    }, [setMessages]);

    const setSearchingMsg = useCallback((text) => {
        setMessages((prev) => {
            if (prev.find((m) => m.id === 'searching')) return prev;
            return [...prev, { id: 'searching', type: 'searching', text }];
        });
    }, [setMessages]);

    const removeSearchingMsg = useCallback(() => {
        setMessages((prev) => prev.filter((m) => m.id !== 'searching'));
    }, [setMessages]);

    const emitAssistant = useCallback((text, currentHistory, p, srcQuery) => {
        removeSearchingMsg();
        setMessages((prev) => [...prev, {
            id: Date.now() + Math.random(), role: 'assistant', text, sourceQuery: srcQuery,
        }]);
        return appendAssistantToHistory(currentHistory, makeAssistantResponse(p, text), p);
    }, [removeSearchingMsg, setMessages]);

    const runAgent = useCallback(async (userText, externalSetBusy) => {
        if (busyRef.current) return;

        const base = getBaseUrl(cfg.liferayUrl);
        const p    = cfg.llmProvider;

        // Paginazione
        const pg = paginationRef.current;
        const isContinue = pg && /^\s*(s[ìi]|si|continua|next|avanti|ancora|mostra ancora|altri|other|yes|ok|vai)/i.test(userText.trim());
        if (isContinue) {
            addMsg('user', userText);
            const { items, totalCount, offset, toolUseBlocks, toolResults, sourceQuery, history: pgHistory } = pg;
            const { text, hasMore, nextOffset } = formatItemsPage(items, totalCount, offset, base);
            let newHistory = emitAssistant(text, pgHistory, p, sourceQuery);
            if (hasMore) {
                paginationRef.current = { ...pg, offset: nextOffset, history: newHistory };
            } else {
                paginationRef.current = null;
                newHistory = appendToolResultsToHistory(newHistory, toolUseBlocks, toolResults, p);
            }
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
                dbg(`[FP] Iterazione ${iterations}, history len:`, currentHistory.length);

                const response = await callLLM(currentHistory, cfg);

                // ── Track LLM usage ──────────────────────────────────────────
                if (response.usage) {
                    const modelName = p === 'anthropic' ? cfg.model : p === 'gemini' ? cfg.geminiModel : p === 'ollama' ? cfg.ollamaModel : cfg.openaiModel;
                    const toolNames = (response.toolUseBlocks || []).map((tb) => tb.name);
                    trackCall({
                        provider: p,
                        model: modelName,
                        inputTokens: response.usage.inputTokens || 0,
                        outputTokens: response.usage.outputTokens || 0,
                        toolCalls: toolNames,
                        serviceTier: response.usage.serviceTier || '',
                    });
                }

                if (p === 'gemini') await new Promise((r) => setTimeout(r, 800));

                if (response.stop_reason === 'end_turn') {
                    removeThinking();
                    removeSearchingMsg();
                    setMessages((prev) => [...prev, {
                        id: Date.now() + Math.random(), role: 'assistant',
                        text: response.text, sourceQuery: userText,
                    }]);
                    currentHistory = appendAssistantToHistory(currentHistory, response, p);
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
                        const count  = result?.totalCount ?? result?.items?.length
                            ?? result?.categories?.length ?? (result?.error ? 0 : '?');
                        dbg(`[FP] Tool ${tb.name}:`, count, 'items');
                        toolResults.push({ content: result });
                    }

                    if (/\b(json|mostra il json|mostrami il json|show json|raw json)\b/i.test(userText)) {
                        const jsonText = 'Risposta JSON:\n' + JSON.stringify(toolResults.map((tr) => tr.content), null, 2);
                        currentHistory = emitAssistant(jsonText, currentHistory, p, userText);
                        currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);
                        break;
                    }

                    const INTERMEDIATE_TOOLS = new Set([
                        'get_categories', 'get_content_structures',
                        'get_taxonomy_categories_by_ids', 'get_tags',
                        'get_available_languages', 'list_available_apis',
                        'get_api_spec', 'find_relevant_endpoints', 'discover_endpoint',
                        'count_content_by_month',
                    ]);
                    const lastToolName        = toolUseBlocks[toolUseBlocks.length - 1]?.name;
                    const isIntermediateTool  = INTERMEDIATE_TOOLS.has(lastToolName);
                    const isAggregativeIntent = /\b(mese|mesi|anno|quanti per|distribuzione|pi[uù] contenut|pi[uù] pubblicat|aggreg)\b/i.test(userText);
                    const wantsListIntent     = !isAggregativeIntent && /\b(titolo|titoli|elenca|mostra|mostrami|listare|lista|contenuti|trova|trovami|cerca|cercami)\b/i.test(userText);
                    const allItems            = toolResults.flatMap((tr) => tr.content?.items || []);
                    const totalCount          = toolResults[0]?.content?.totalCount ?? allItems.length;

                    if (!isIntermediateTool && wantsListIntent && allItems.length > 0) {
                        const { text, hasMore, nextOffset } = formatItemsPage(allItems, totalCount, 0, base);
                        currentHistory = emitAssistant(text, currentHistory, p, userText);

                        if (hasMore) {
                            paginationRef.current = {
                                items: allItems, totalCount, offset: nextOffset,
                                toolUseBlocks, toolResults, sourceQuery: userText,
                                history: currentHistory,
                            };
                        } else {
                            currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);
                        }
                        break;
                    }

                    currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);
                    addThinking();
                    continue;
                }

                break;
            }
        } catch (e) {
            dbg('[FP] Errore runAgent:', e);
            removeThinking();
            removeSearchingMsg();
            addMsg('system', '⚠ ' + e.message);
        } finally {
            busyRef.current = false;
            externalSetBusy(false);
            setHistory(currentHistory);
        }
    }, [cfg, history, addMsg, addThinking, removeThinking, setSearchingMsg,
        removeSearchingMsg, setMessages, setHistory, emitAssistant]);

    return { runAgent };
}
