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

const MAX_ITERATIONS      = 32;
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
        { re: /\bcrea\s+(?:una\s+)?cartella\s+(.+)/i,          tmpl: (m) => t.creatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bcrea\s+(?:una\s+)?cartella\s+(?:object\s+)?entry\s+(.+)/i, tmpl: (m) => t.creatingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\belimina\s+(?:la\s+)?cartella\s+(?:object\s+)?entry\s+(.+)/i, tmpl: (m) => t.deletingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\belimina\s+(?:la\s+)?cartella\s+(?:dei\s+contenuti\s+)?(.+)/i, tmpl: (m) => t.deletingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\belenca\s+(?:le\s+)?cartelle\s+(?:object\s+)?entry/i, tmpl: () => t.listingObjectEntryFolders },
        { re: /\belenca\s+(?:le\s+)?cartelle\s+(?:dei\s+)?contenuti/i, tmpl: () => t.listingContentFolders },
        { re: /\brinomina\s+(?:la\s+)?cartella\s+(?:object\s+)?entry\s+(.+)/i, tmpl: (m) => t.updatingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\brinomina\s+(?:la\s+)?cartella\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bmodifica\s+(?:la\s+)?cartella\s+(?:object\s+)?entry\s+(.+)/i, tmpl: (m) => t.updatingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\bmodifica\s+(?:la\s+)?cartella\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        // English patterns
        { re: /\bsearch\s+(?:for\s+)?(.+)/i,                    tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bfind\s+(.+)/i,                                  tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bshow\s+(?:me\s+)?(.+)/i,                       tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\bget\s+(.+)/i,                                   tmpl: (m) => t.retrieving.replace('{query}', m[1].trim()) },
        { re: /\blist\s+(.+)/i,                                  tmpl: (m) => t.listing.replace('{query}', m[1].trim()) },
        { re: /\bhow\s+many\s+(.+)/i,                           tmpl: (m) => t.searchingFor.replace('{query}', m[1].trim()) },
        { re: /\bcreate\s+(?:a\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.creatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bcreate\s+(?:an?\s+)?(?:object\s+entry\s+)?folder\s+(.+)/i, tmpl: (m) => t.creatingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\bdelete\s+(?:the\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.deletingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bdelete\s+(?:the\s+)?(?:object\s+entry\s+)?folder\s+(.+)/i, tmpl: (m) => t.deletingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\blist\s+(?:the\s+)?(?:object\s+entry\s+)?folders/i, tmpl: () => t.listingObjectEntryFolders },
        { re: /\blist\s+(?:the\s+)?(?:content\s+)?folders/i, tmpl: () => t.listingContentFolders },
        { re: /\brename\s+(?:the\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\brename\s+(?:the\s+)?(?:object\s+entry\s+)?folder\s+(.+)/i, tmpl: (m) => t.updatingObjectEntryFolder.replace('{query}', m[1].trim()) },
        { re: /\bupdate\s+(?:the\s+)?(?:content\s+)?folder\s+(.+)/i, tmpl: (m) => t.updatingContentFolder.replace('{query}', m[1].trim()) },
        { re: /\bupdate\s+(?:the\s+)?(?:object\s+entry\s+)?folder\s+(.+)/i, tmpl: (m) => t.updatingObjectEntryFolder.replace('{query}', m[1].trim()) },
        // ── Document picker / folders ──
        { re: /\b(?:recupera|mostra|leggi|apri)\s+(?:il\s+)?documento\s+(.+)/i, tmpl: (m) => t.pickingDocument.replace('{query}', m[1].trim()) },
        { re: /\b(?:elenca|mostra|lista)\s+(?:le\s+)?cartelle\s+(?:dei\s+)?document/i, tmpl: () => t.listingDocumentFolders },
        { re: /\b(?:elenca|mostra|lista)\s+(?:i\s+)?documenti\s+(?:nella\s+)?cartella\s+(.+)/i, tmpl: (m) => t.listingFolderDocuments.replace('{query}', m[1].trim()) },
        { re: /\b(?:pick|retrieve|get|open|read|fetch)\s+(?:the\s+)?document\s+(.+)/i, tmpl: (m) => t.pickingDocument.replace('{query}', m[1].trim()) },
        { re: /\b(?:list|show)\s+(?:the\s+)?document\s+folders/i, tmpl: () => t.listingDocumentFolders },
        { re: /\b(?:list|show)\s+(?:the\s+)?documents\s+(?:in\s+)?(?:folder|cartella)\s+(.+)/i, tmpl: (m) => t.listingFolderDocuments.replace('{query}', m[1].trim()) },
        // ── Upload document ──
        { re: /\b(?:carica|upload|salva)\s+(?:il\s+)?(?:file|documento|immagine)/i, tmpl: () => t.uploadingDocument || 'Uploading document…' },
        { re: /\b(?:upload|save|store)\s+(?:the\s+)?(?:file|document|image)/i, tmpl: () => t.uploadingDocument || 'Uploading document…' },
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

    const runAgent = useCallback(async (userText, externalSetBusy, displayText, isExcelImport = false) => {
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

        // If displayText is provided, show that in the chat instead of the full LLM text
        // (useful for document attachments where we don't want to show extracted content)
        // If displayText is null, skip adding the user message (caller handles it)
        if (displayText !== null) {
            const chatText = displayText || userText;
            addMsg('user', chatText);
        }
        addThinking();

        let currentHistory = appendUserMessage(history, userText, p);

        // ── Batch progress tracking ──
        // Track creation tools during Excel batch processing to emit progress messages
        // Only show ImportProgressBubble when importing from an Excel file (isExcelImport param)
        const BATCH_CREATE_TOOLS = new Set([
            'create_content_structure', 'create_object', 'create_vocabulary',
            'create_category', 'create_site_page', 'create_role', 'create_user',
            'assign_role_to_user',
        ]);
        // Tools that should NOT trigger batch progress tracking even if called during a batch
        const NON_BATCH_TOOLS = new Set([
            'generate_excel_template',
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
        };
        // i18n key mapping for entity labels
        const BATCH_LABEL_KEYS = {
            structure: 'batchStructure',
            object: 'batchObject',
            vocabulary: 'batchVocabulary',
            category: 'batchCategory',
            page: 'batchPage',
            role: 'batchRole',
            user: 'batchUser',
            'role-assignment': 'batchRoleAssignment',
        };
        // Helper: get localized entity label
        const batchT = getDictionary(getLocale());
        function entityLabel(type) { return batchT[BATCH_LABEL_KEYS[type]] || type; }
        const batchCounters = {};   // { structure: 3, vocabulary: 2, ... }
        const batchErrors   = {};   // { structure: 0, ... }
        const batchSuccesses = [];  // [{ label: 'Struttura', name: 'Nome Entità' }, ...]
        let lastBatchProgressType = null;
        let importProgressMsgId = null; // ID of the import_progress message for in-place updates

        // Helper: extract a human-readable entity name from tool input/result
        function extractEntityName(toolName, input, result) {
            if (result?.error) return null; // skip errors
            // Try result fields first, then input fields
            const name = result?.title || result?.name || result?.objectName
                || input?.title || input?.name || input?.object_name
                || input?.emailAddress || null;
            return name;
        }

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

                    // ── Batch progress detection ──
                    // More specific pattern: requires ✅/🎉 AND a clear batch-progress keyword
                    const batchProgressPattern = /[✅🎉].*\b(prosegu|proceeding|continu|next|creating|creando|creazi|batch complete|all \d+|strutture create|vocabolar|categor|pagine create|ruoli creat|utenti creat|objects created|structures created)\b/i;
                    const isBatchProgress = batchProgressPattern.test(response.text || '');

                    // ── Batch final summary ──
                    // If we tracked batch creation, finalize the import_progress message
                    const batchTypes = Object.keys(batchCounters);
                    const llmHasSummary = /🎉.*batch|🎉.*complet|🎉.*creat/i.test(response.text || '');
                    let emittedOwnSummary = false;
                    if (batchTypes.length > 0) {
                        const totalProcessed = Object.values(batchCounters).reduce((s, c) => s + c, 0);
                        const totalErrors = batchTypes.reduce((sum, type) => sum + (batchErrors[type] || 0), 0);
                        const phaseParts = batchTypes.map((type) => {
                            const label = entityLabel(type);
                            const c = batchCounters[type];
                            const e = batchErrors[type] || 0;
                            return e > 0 ? `${label}: ${c - e}/${c}` : `${label}: ${c}`;
                        });

                        if (importProgressMsgId) {
                            // Update existing progress message to completed
                            setMessages((prev) => prev.map((m) =>
                                m.id === importProgressMsgId
                                    ? {
                                        ...m,
                                        importProgress: {
                                            ...m.importProgress,
                                            total: totalProcessed,
                                            processed: totalProcessed,
                                            phase: phaseParts.join(' · '),
                                            status: totalErrors > 0 ? 'error' : 'completed',
                                            successes: [...batchSuccesses],
                                            errors: totalErrors > 0 ? Object.entries(batchErrors).flatMap(([type, count]) =>
                                                Array.from({ length: count }, (_, i) => ({ row: '?', message: `${batchT.batchErrorIn || 'Error in'} ${entityLabel(type)}` }))
                                            ) : [],
                                        },
                                    }
                                    : m
                            ));
                            emittedOwnSummary = true;
                        } else if (!llmHasSummary) {
                            // Fallback: no progress message was created, emit text summary
                            const t = getDictionary(getLocale());
                            const summaryParts = batchTypes.map((type) => {
                                const c = batchCounters[type];
                                const e = batchErrors[type] || 0;
                                return e > 0 ? `${c} ${type} (⚠ ${e} errors)` : `${c} ${type}`;
                            });
                            const summaryMsg = totalErrors > 0
                                ? t.batchCompleteWithErrors.replace('{summary}', summaryParts.join(', ')).replace('{errors}', totalErrors)
                                : t.batchComplete.replace('{summary}', summaryParts.join(', '));
                            setMessages((prev) => [...prev, {
                                id: Date.now() + Math.random(), role: 'assistant',
                                text: summaryMsg, sourceQuery: userText,
                            }]);
                            emittedOwnSummary = true;
                        }
                    }

                    // Only emit the LLM's response text if we didn't already emit our own summary
                    // (if the LLM has a 🎉 summary, we skipped our own and should show the LLM's text instead)
                    if (!emittedOwnSummary) {
                        setMessages((prev) => [...prev, {
                            id: Date.now() + Math.random(), role: 'assistant',
                            text: response.text, sourceQuery: userText,
                        }]);
                    }
                    currentHistory = appendAssistantToHistory(currentHistory, response, p);

                    if (isBatchProgress && iterations < MAX_ITERATIONS) {
                        // Continue the batch: tell the LLM to keep going
                        dbg('[FP] Batch progress detected, continuing loop...');
                        addThinking();
                        const t = getDictionary(getLocale());
                        const continuePrompt = t.batchContinuePrompt;
                        currentHistory = appendUserMessage(currentHistory, continuePrompt, p);
                        continue;
                    }

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
                        // Lookup tools used during batch creation to resolve references
                        'search_pages', 'get_available_roles', 'get_vocabularies',
                        'get_users', 'get_custom_objects', 'get_navigation_menus',
                        'get_user_spaces', 'get_content_structure_fields',
                    ]);
                    const lastToolName        = toolUseBlocks[toolUseBlocks.length - 1]?.name;
                    const isIntermediateTool  = INTERMEDIATE_TOOLS.has(lastToolName);
                    const isBatchActive       = Object.keys(batchCounters).length > 0;
                    const isAggregativeIntent = /\b(mese|mesi|anno|quanti per|distribuzione|pi[uù] contenut|pi[uù] pubblicat|aggreg)\b/i.test(userText);
                    const wantsListIntent     = !isAggregativeIntent && /\b(titolo|titoli|elenca|mostra|mostrami|listare|lista|contenuti|trova|trovami|cerca|cercami)\b/i.test(userText);
                    const allItems            = toolResults.flatMap((tr) => tr.content?.items || []);
                    const totalCount          = toolResults[0]?.content?.totalCount ?? allItems.length;

                    // During an active batch, NEVER interrupt to show search results —
                    // lookup tools are used internally to resolve references
                    if (!isIntermediateTool && wantsListIntent && allItems.length > 0 && !isBatchActive) {
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

                    // ── Batch progress: track creation tools with in-place import_progress message ──
                    for (let i = 0; i < toolUseBlocks.length; i++) {
                        const tb = toolUseBlocks[i];
                        // Skip tools that should not trigger batch tracking
                        if (NON_BATCH_TOOLS.has(tb.name)) continue;
                        const entityKey = BATCH_ENTITY_LABELS[tb.name];
                        if (!entityKey) continue;

                        const result = toolResults[i]?.content;
                        const isError = result?.error;
                        batchCounters[entityKey] = (batchCounters[entityKey] || 0) + 1;
                        if (isError) batchErrors[entityKey] = (batchErrors[entityKey] || 0) + 1;

                        // Track success with entity name
                        const entityName = extractEntityName(tb.name, tb.input, result);
                        if (!isError && entityName) {
                            batchSuccesses.push({
                                label: entityLabel(entityKey),
                                name: entityName,
                            });
                        } else if (!isError) {
                            // No name extracted, still count as success
                            batchSuccesses.push({
                                label: entityLabel(entityKey),
                                name: `${entityLabel(entityKey)} #${batchCounters[entityKey]}`,
                            });
                        }

                        // Compute total processed and total expected
                        const totalProcessed = Object.values(batchCounters).reduce((s, c) => s + c, 0);
                        const totalErrors = Object.values(batchErrors).reduce((s, e) => s + e, 0);
                        const currentPhase = entityLabel(entityKey);

                        // Build phase description
                        const phaseParts = Object.entries(batchCounters).map(([type, count]) => {
                            const lbl = entityLabel(type);
                            const errs = batchErrors[type] || 0;
                            return errs > 0 ? `${lbl}: ${count - errs}/${count}` : `${lbl}: ${count}`;
                        });

                        // Create or update the import_progress message in-place
                        // NOTE: total is NOT estimated during import — we don't know
                        // how many tools the LLM will call in total. The progress bar
                        // will show an indeterminate state until completion.
                        const progressData = {
                            total: 0, // unknown until completion
                            processed: totalProcessed,
                            phase: `${batchT.batchCreating || 'Creating'} ${currentPhase}…`,
                            status: 'importing',
                            successes: [...batchSuccesses],
                            errors: isError ? [{ row: batchCounters[entityKey], message: result.error?.message || result.error || 'Error' }] : [],
                            fileName: '',
                            _phaseParts: phaseParts,
                        };

                        // Only show ImportProgressBubble for Excel imports
                        // For regular batch operations, just track counters silently
                        if (isExcelImport) {
                            if (!importProgressMsgId) {
                                // First batch tool: create the progress message
                                importProgressMsgId = 'import_progress_' + Date.now();
                                setMessages((prev) => [...prev, {
                                    id: importProgressMsgId,
                                    type: 'import_progress',
                                    importProgress: progressData,
                                }]);
                            } else {
                                // Update existing progress message in-place
                                setMessages((prev) => prev.map((m) =>
                                    m.id === importProgressMsgId
                                        ? { ...m, importProgress: { ...progressData, errors: [...(m.importProgress?.errors || []), ...(progressData.errors || [])] } }
                                        : m
                                ));
                            }
                        }

                        lastBatchProgressType = entityLabel;
                    }

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
