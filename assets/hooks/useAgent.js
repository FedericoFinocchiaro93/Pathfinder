/**
 * hooks/useAgent.js — ai-chatbot-fullpage (identico al widget)
 */

import { useCallback, useRef } from 'react';
import { dbg, makeAssistantResponse } from '../lib/utils.js';
import { executeTool }                from '../lib/toolExecutor.js';
import { getBaseUrl, getSiteId }      from '../lib/liferay.js';
import { getDictionary, getLocale }   from '../lib/i18n.js';
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
    const t = getDictionary(getLocale());
    const patterns = [
        // Italian patterns
        { re: /\bcerca[mi]*\s+(.+)/i, tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\btrova[mi]*\s+(.+)/i, tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bdammi\s+(.+)/i,      tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\bmostra[mi]*\s+(.+)/i,tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\bcrea\s+(?:una\s+)?cartella\s+(.+)/i, tmpl: (m) => t.creatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\belimina\s+(?:la\s+)?cartella\s+(.+)/i, tmpl: (m) => t.deletingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\belenca\s+(?:le\s+)?cartelle\s+(?:dei\s+)?contenuti/i, tmpl: () => t.listingContentFolders },
        { re: /\brinomina\s+(?:la\s+)?cartella\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bmodifica\s+(?:la\s+)?cartella\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        // English patterns
        { re: /\bsearch\s+(?:for\s+)?(.+)/i, tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bfind\s+(.+)/i,                 tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bshow\s+(?:me\s+)?(.+)/i,        tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\bget\s+(.+)/i,                   tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\blist\s+(.+)/i,                  tmpl: (m) => t.listing.replace('{query}', m[1].trim()) },
        { re: /\bhow\s+many\s+(.+)/i,            tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bcreate\s+(?:a\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.creatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bdelete\s+(?:the\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.deletingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\blist\s+(?:the\s+)?(?:content\s+)?folders/i, tmpl: () => t.listingContentFolders },
        { re: /\brename\s+(?:the\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bupdate\s+(?:the\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
    ];
    for (const { re, tmpl } of patterns) { const m = text.match(re); if (m) { let msg = tmpl(m); if (msg.length > 120) msg = msg.slice(0, 117) + '…'; return msg.charAt(0).toUpperCase() + msg.slice(1); } }
    const short = text.length > 80 ? text.slice(0, 77) + '…' : text;
    return t.processingRequest.replace('{query}', short);
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

    const runAgent = useCallback(async (userText, externalSetBusy, isExcelImport = false) => {
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

        // ── Batch progress tracking ──
        const BATCH_CREATE_TOOLS = new Set([
            'create_content_structure', 'create_object', 'create_vocabulary', 'create_ddm_template', 'delete_ddm_template',
            'create_category', 'create_site_page', 'create_role', 'create_user',
            'assign_role_to_user', 'create_keyword',
        ]);
        const BATCH_ENTITY_LABELS = {
            create_content_structure: 'structure',
            create_object: 'object',
            create_vocabulary: 'vocabulary',
            create_category: 'category',
            create_site_page: 'page',
            create_role: 'role',
            create_user: 'user',
            assign_role_to_user: 'role-assignment',
            create_keyword: 'keyword',
        };
        const batchCounters = {};
        const batchErrors   = {};
        let lastBatchProgressType = null;
        let lastExecutedToolName = null; // track last tool to detect intermediate-only stops

        try {
            let iterations = 0;
            while (iterations < MAX_ITERATIONS) {
                iterations++;
                const response = await callLLM(currentHistory, cfg);
                if (p === 'gemini') await new Promise((r) => setTimeout(r, 800));

                if (response.stop_reason === 'end_turn') {
                    removeThinking(); removeSearchingMsg();

                    // ── Intermediate tool followed by end_turn: force continuation ──
                    // If the last executed tool was an intermediate lookup (e.g. get_content_structure_fields)
                    // and the LLM responded with text instead of calling the next tool, force it to continue.
                    const INTERMEDIATE_CONTINUE_TOOLS = new Set(['get_content_structure_fields', 'get_content_structures', 'get_categories', 'get_vocabularies', 'get_available_languages', 'get_available_roles', 'get_users', 'get_custom_objects', 'get_user_spaces', 'get_object_fields']);
                    if (lastExecutedToolName && INTERMEDIATE_CONTINUE_TOOLS.has(lastExecutedToolName) && iterations < MAX_ITERATIONS) {
                        dbg('[Agent] Intermediate tool followed by end_turn, forcing continuation...');
                        // Remove the last assistant message (the intermediate text) from UI
                        setMessages((prev) => {
                            const last = prev[prev.length - 1];
                            if (last?.role === 'assistant' && last?.id === prev[prev.length - 1]?.id) return prev.slice(0, -1);
                            return prev;
                        });
                        addThinking();
                        const continuePrompt = 'You called a lookup tool but stopped before performing the action. Continue now — call the appropriate creation/modification tool using the information you obtained. Do NOT describe what you found, just proceed with the action.';
                        currentHistory = appendUserMessage(currentHistory, continuePrompt, p);
                        lastExecutedToolName = null;
                        continue;
                    }

                    // ── Batch progress detection ──
                    const batchProgressPattern = /[✅🎉].*\b(prosegu|proceed|continu|next|creating|creando|creazi|batch|struttur|vocabolar|categor|pagin|ruol|utent|object|structure)\b/i;
                    const isBatchProgress = batchProgressPattern.test(response.text || '');

                    // ── Batch final summary ──
                    // Only show batch summary when importing from an Excel file (isExcelImport)
                    const batchTypes = Object.keys(batchCounters);
                    if (batchTypes.length > 0 && isExcelImport) {
                        const summaryParts = batchTypes.map((type) => {
                            const c = batchCounters[type];
                            const e = batchErrors[type] || 0;
                            return e > 0 ? `${c} ${type}s (⚠ ${e} errors)` : `${c} ${type}`;
                        });
                        const summaryMsg = `🎉 Batch complete! Created: ${summaryParts.join(', ')}`;
                        setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'assistant', text: summaryMsg, sourceQuery: userText }]);
                    }

                    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'assistant', text: response.text, sourceQuery: userText }]);
                    currentHistory = appendAssistantToHistory(currentHistory, response, p);

                    if (isBatchProgress && iterations < MAX_ITERATIONS) {
                        dbg('[Agent] Batch progress detected, continuing loop...');
                        addThinking();
                        const continuePrompt = 'Continue with the next step of the batch. Do not repeat what you already said. Just proceed with the next creation.';
                        currentHistory = appendUserMessage(currentHistory, continuePrompt, p);
                        continue;
                    }

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
                    // Track last executed tool name for intermediate-continuation detection
                    lastExecutedToolName = toolUseBlocks[toolUseBlocks.length - 1]?.name || null;

                    if (/\b(json|mostra il json|mostrami il json|show json|raw json)\b/i.test(userText)) {
                        const jsonText = 'Risposta JSON:\n' + JSON.stringify(toolResults.map((tr) => tr.content), null, 2);
                        currentHistory = emitAssistant(jsonText, currentHistory, p, userText);
                        currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);
                        break;
                    }

                    const INTERMEDIATE_TOOLS = new Set(['get_categories','get_content_structures','get_taxonomy_categories_by_ids','get_tags','get_available_languages','list_available_apis','get_api_spec','find_relevant_endpoints','discover_endpoint','count_content_by_month','search_pages','get_available_roles','get_vocabularies','get_users','get_custom_objects','get_navigation_menus','get_user_spaces','get_content_structure_fields']);
                    const lastToolName = toolUseBlocks[toolUseBlocks.length - 1]?.name;
                    const isIntermediateTool = INTERMEDIATE_TOOLS.has(lastToolName);
                    const isBatchActive = Object.keys(batchCounters).length > 0;
                    const isAggregativeIntent = /\b(mese|mesi|anno|quanti per|distribuzione|pi[uù] contenut|pi[uù] pubblicat|aggreg)\b/i.test(userText);
                    const wantsListIntent = !isAggregativeIntent && /\b(titolo|titoli|elenca|mostra|mostrami|listare|lista|contenuti|trova|trovami|cerca|cercami)\b/i.test(userText);
                    const allItems = toolResults.flatMap((tr) => tr.content?.items || []);
                    const totalCount = toolResults[0]?.content?.totalCount ?? allItems.length;

                    // During an active batch, NEVER interrupt to show search results
                    if (!isIntermediateTool && wantsListIntent && allItems.length > 0 && !isBatchActive) {
                        const { text, hasMore, nextOffset } = formatItemsPage(allItems, totalCount, 0, base);
                        currentHistory = emitAssistant(text, currentHistory, p, userText);
                        if (hasMore) { paginationRef.current = { items: allItems, totalCount, offset: nextOffset, toolUseBlocks, toolResults, sourceQuery: userText, history: currentHistory }; }
                        else { currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p); }
                        break;
                    }

                    currentHistory = appendToolResultsToHistory(currentHistory, toolUseBlocks, toolResults, p);

                    // ── Batch progress: track creation tools silently, emit message only when entity type changes ──
                    for (let i = 0; i < toolUseBlocks.length; i++) {
                        const tb = toolUseBlocks[i];
                        const entityLabel = BATCH_ENTITY_LABELS[tb.name];
                        if (!entityLabel) continue;

                        const result = toolResults[i]?.content;
                        const isError = result?.error;
                        batchCounters[entityLabel] = (batchCounters[entityLabel] || 0) + 1;
                        if (isError) batchErrors[entityLabel] = (batchErrors[entityLabel] || 0) + 1;

                        // When entity type changes, emit a completion summary for the PREVIOUS type
                        if (lastBatchProgressType && lastBatchProgressType !== entityLabel) {
                            const prevCount = batchCounters[lastBatchProgressType] || 0;
                            const prevErr = batchErrors[lastBatchProgressType] || 0;
                            const prevSummary = prevErr > 0
                                ? `${prevCount - prevErr} of ${prevCount} (⚠ ${prevErr} errors)`
                                : `${prevCount}`;
                            const transitionMsg = `✅ All ${lastBatchProgressType}s done — proceeding with ${entityLabel}s…`;
                            setMessages((prev) => [...prev, { id: Date.now() + Math.random(), role: 'assistant', text: transitionMsg, sourceQuery: userText }]);
                        }
                        lastBatchProgressType = entityLabel;
                    }

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
