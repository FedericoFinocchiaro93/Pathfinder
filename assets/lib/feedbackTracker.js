/**
 * lib/feedbackTracker.js — ai-chatbot-fullpage
 *
 * Tracks user feedback (thumbs up/down) on assistant messages.
 * Stores feedback in localStorage and optionally syncs to a Liferay Custom Object.
 */

import { dbg } from './utils.js';
import { getBaseUrl, getLiferayToken } from './liferay.js';

const STORAGE_KEY = 'acfp_feedback';

// ── Liferay Custom Object definition ──────────────────────────────────────
// Object definition name:  ACFPFeedback
// Fields:
//   messageId   — String (required): unique message identifier
//   rating      — String (required): 'up' or 'down'
//   query       — String: the user query that generated this response
//   response    — String (truncated to 2000 chars): the assistant response
//   comment     — String: optional user comment
//   provider    — String: LLM provider name
//   model       — String: LLM model name
//   timestamp   — String: ISO timestamp

const OBJECT_NAME = 'acfpfeedbacks'; // REST context path (Liferay adds trailing 's')

// ── Local storage ─────────────────────────────────────────────────────────

function _load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : { records: [] };
    } catch {
        return { records: [] };
    }
}

function _save(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        dbg('feedbackTracker: save error', e);
    }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Record a feedback vote for a message.
 * @param {object} params
 * @param {string} params.messageId — unique message ID
 * @param {string} params.rating — 'up' or 'down'
 * @param {string} [params.query] — the user query
 * @param {string} [params.response] — the assistant response (truncated)
 * @param {string} [params.comment] — optional user comment
 * @param {string} [params.provider] — LLM provider
 * @param {string} [params.model] — LLM model
 * @param {string} [params.toolCalls] — JSON string of tool calls made
 */
export function trackFeedback({ messageId, rating, query, response, comment, provider, model, toolCalls }) {
    const data = _load();
    const normalizedQuery = (query || '').trim().toLowerCase().substring(0, 500);

    // Extract significant words for similarity matching
    const queryWords = normalizedQuery
        .replace(/[^\w\sàèéìòù]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3);

    // Find the most similar existing record (by word overlap)
    let bestMatch = -1;
    let bestOverlap = 0;
    for (let i = 0; i < data.records.length; i++) {
        const r = data.records[i];
        if (!r.query) continue;
        const existingWords = r.query
            .replace(/[^\w\sàèéìòù]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3);
        const overlap = queryWords.filter(w => existingWords.includes(w)).length;
        // Need at least 60% of the shorter query's significant words to match
        const minWords = Math.min(queryWords.length, existingWords.length);
        const threshold = minWords > 0 ? Math.ceil(minWords * 0.6) : 999;
        if (overlap >= threshold && overlap > bestOverlap) {
            bestMatch = i;
            bestOverlap = overlap;
        }
    }

    if (bestMatch >= 0) {
        // Update existing record: increment score for thumbs up, decrement for thumbs down
        const existing = data.records[bestMatch];
        const currentScore = existing.score || 0;
        const newScore = rating === 'up' ? currentScore + 1 : currentScore - 1;

        existing.messageId = messageId;
        existing.rating = rating;
        existing.response = (response || '').substring(0, 2000);
        existing.comment = comment || existing.comment || '';
        existing.provider = provider || existing.provider || '';
        existing.model = model || existing.model || '';
        existing.score = newScore;
        existing.toolCalls = toolCalls || existing.toolCalls || '';
        existing.timestamp = new Date().toISOString();

        _save(data);
        dbg('feedbackTracker: updated existing record for similar query, score=', newScore, 'overlap=', bestOverlap, 'query=', normalizedQuery.substring(0, 50));

        // Sync update to Liferay
        _syncToLiferay(existing);
    } else {
        // New record
        const record = {
            messageId,
            rating,
            query: normalizedQuery,
            response: (response || '').substring(0, 2000),
            comment: comment || '',
            provider: provider || '',
            model: model || '',
            score: rating === 'up' ? 1 : -1,
            toolCalls: toolCalls || '',
            timestamp: new Date().toISOString(),
            _liferayId: null, // will be set after first sync
        };
        data.records.push(record);
        _save(data);
        dbg('feedbackTracker: recorded', rating, 'for message', messageId);

        // Try to sync to Liferay Custom Object
        _syncToLiferay(record);
    }
}

/**
 * Get the current feedback for a specific message.
 * @param {string} messageId
 * @returns {'up'|'down'|null}
 */
export function getFeedback(messageId) {
    const data = _load();
    const record = data.records.find(r => r.messageId === messageId);
    return record ? record.rating : null;
}

/**
 * Get all feedback records.
 * @returns {Array}
 */
export function getAllFeedback() {
    return _load().records;
}

/**
 * Get feedback statistics.
 * @returns {{ total: number, positive: number, negative: number }}
 */
export function getFeedbackStats() {
    const records = _load().records;
    return {
        total: records.length,
        positive: records.filter(r => r.rating === 'up').length,
        negative: records.filter(r => r.rating === 'down').length,
    };
}

/**
 * Remove feedback for a specific message (local + Liferay).
 * @param {string} messageId
 */
export function removeFeedback(messageId) {
    const data = _load();
    const idx = data.records.findIndex(r => r.messageId === messageId);
    if (idx >= 0) {
        data.records.splice(idx, 1);
        _save(data);
        dbg('feedbackTracker: removed feedback for message', messageId);
        // Try to delete from Liferay (find by messageId filter)
        _deleteFromLiferay(messageId);
    }
}

/**
 * Clear all feedback data.
 */
export function resetFeedback() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Ensure the ACFPFeedback Custom Object exists in Liferay.
 * If it doesn't exist, creates it with all required fields and publishes it.
 * @returns {Promise<boolean>} true if the object is ready (existed or created)
 */
export async function ensureFeedbackObject() {
    const base = getBaseUrl();
    const token = getLiferayToken();
    if (!base) return false;

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-csrf-token'] = token;

    // 1. Check if the object already exists (GET the REST endpoint)
    try {
        const checkRes = await fetch(
            `${base}/o/c/${OBJECT_NAME}/?pageSize=1`,
            { headers, credentials: 'same-origin' }
        );
        if (checkRes.ok) {
            dbg('feedbackTracker: ACFPFeedback object already exists');
            return true;
        }
    } catch {
        // Continue to creation
    }

    // 2. Create the Object Definition via object-admin API
    try {
        const adminHeaders = { 'Content-Type': 'application/json' };
        // object-admin requires Basic auth or admin session
        const token2 = getLiferayToken();
        if (token2) adminHeaders['x-csrf-token'] = token2;

        const createBody = JSON.stringify({
            externalReferenceCode: 'ACFPFeedback',
            name: 'ACFPFeedback',
            label: { en_US: 'ACFP Feedback', it_IT: 'ACFP Feedback' },
            pluralLabel: { en_US: 'ACFP Feedbacks', it_IT: 'ACFP Feedbacks' },
            panelCategoryKey: 'control_panel.object',
            system: false,
            active: true,
            scope: 'company',
            objectFields: [
                { name: 'messageId', businessType: 'Text', DBType: 'String', label: { en_US: 'Message ID', it_IT: 'ID Messaggio' }, required: true, indexed: true, indexedAsKeyword: true },
                { name: 'rating', businessType: 'Text', DBType: 'String', label: { en_US: 'Rating', it_IT: 'Valutazione' }, required: true, indexed: true, indexedAsKeyword: true },
                { name: 'query', businessType: 'LongText', DBType: 'String', label: { en_US: 'Query', it_IT: 'Query' }, required: false, indexed: false },
                { name: 'response', businessType: 'LongText', DBType: 'String', label: { en_US: 'Response', it_IT: 'Risposta' }, required: false, indexed: false },
                { name: 'comment', businessType: 'LongText', DBType: 'String', label: { en_US: 'Comment', it_IT: 'Commento' }, required: false, indexed: false },
                { name: 'provider', businessType: 'Text', DBType: 'String', label: { en_US: 'Provider', it_IT: 'Provider' }, required: false, indexed: true, indexedAsKeyword: true },
                { name: 'model', businessType: 'Text', DBType: 'String', label: { en_US: 'Model', it_IT: 'Modello' }, required: false, indexed: true, indexedAsKeyword: true },
                { name: 'timestamp', businessType: 'Text', DBType: 'String', label: { en_US: 'Timestamp', it_IT: 'Timestamp' }, required: false, indexed: true, indexedAsKeyword: false },
                { name: 'score', businessType: 'Integer', DBType: 'Integer', label: { en_US: 'Score', it_IT: 'Punteggio' }, required: false, indexed: true, indexedAsKeyword: false },
                { name: 'toolCalls', businessType: 'LongText', DBType: 'Clob', label: { en_US: 'Tool Calls', it_IT: 'Chiamate Tool' }, required: false, indexed: false },
            ],
        });

        const createRes = await fetch(`${base}/o/object-admin/v1.0/object-definitions`, {
            method: 'POST',
            headers: adminHeaders,
            credentials: 'same-origin',
            body: createBody,
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            dbg('feedbackTracker: failed to create ACFPFeedback object', createRes.status, errText);
            return false;
        }

        const created = await createRes.json();
        const objId = created.id;
        dbg('feedbackTracker: created ACFPFeedback object, id=', objId);

        // 3. Publish the object definition
        const publishRes = await fetch(`${base}/o/object-admin/v1.0/object-definitions/${objId}/publish`, {
            method: 'POST',
            headers: adminHeaders,
            credentials: 'same-origin',
        });

        if (!publishRes.ok) {
            const errText = await publishRes.text();
            dbg('feedbackTracker: failed to publish ACFPFeedback object', publishRes.status, errText);
            return false;
        }

        dbg('feedbackTracker: ACFPFeedback object published successfully');

        // Wait a moment for the REST endpoint to become available
        await new Promise(resolve => setTimeout(resolve, 3000));
        return true;
    } catch (e) {
        dbg('feedbackTracker: error creating ACFPFeedback object', e.message);
        return false;
    }
}

// ── Liferay sync ──────────────────────────────────────────────────────────

async function _syncToLiferay(record) {
    const base = getBaseUrl();
    const token = getLiferayToken();
    if (!base) {
        dbg('feedbackTracker: no base URL, skipping sync');
        return;
    }

    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['x-csrf-token'] = token;
        }

        const payload = {
            messageId: record.messageId,
            rating: record.rating,
            query: record.query,
            response: record.response,
            comment: record.comment,
            provider: record.provider,
            model: record.model,
            score: record.score || 0,
            toolCalls: record.toolCalls || '',
            timestamp: record.timestamp,
        };

        // If we have a Liferay record ID, update (PUT); otherwise search by query to find existing
        if (record._liferayId) {
            // Update existing record
            const res = await fetch(`${base}/o/c/${OBJECT_NAME}/${record._liferayId}`, {
                method: 'PUT',
                headers,
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                dbg('feedbackTracker: updated Liferay record', record._liferayId);
            } else {
                const err = await res.text();
                dbg('feedbackTracker: Liferay PUT failed', res.status, err);
            }
        } else {
            // Search for similar records in Liferay (fetch all positive ratings, then match by similarity)
            const filterUrl = `${base}/o/c/${OBJECT_NAME}/?filter=rating eq 'up'&pageSize=50&sort=score:desc`;
            const listRes = await fetch(filterUrl, { headers: { ...headers, 'Content-Type': undefined }, credentials: 'same-origin' });

            if (listRes.ok) {
                const listData = await listRes.json();
                const items = listData.items || [];

                // Find the most similar record by word overlap
                const queryWords = record.query
                    .replace(/[^\w\sàèéìòù]/g, ' ')
                    .split(/\s+/)
                    .filter(w => w.length > 3);
                let bestItem = null;
                let bestOverlap = 0;

                for (const item of items) {
                    const itemWords = (item.query || '')
                        .replace(/[^\w\sàèéìòù]/g, ' ')
                        .split(/\s+/)
                        .filter(w => w.length > 3);
                    const overlap = queryWords.filter(w => itemWords.includes(w)).length;
                    const minWords = Math.min(queryWords.length, itemWords.length);
                    const threshold = minWords > 0 ? Math.ceil(minWords * 0.6) : 999;
                    if (overlap >= threshold && overlap > bestOverlap) {
                        bestItem = item;
                        bestOverlap = overlap;
                    }
                }

                if (bestItem) {
                    // Update existing record
                    const existingId = bestItem.id;
                    record._liferayId = existingId;
                    _save(_load()); // persist the liferayId
                    const res = await fetch(`${base}/o/c/${OBJECT_NAME}/${existingId}`, {
                        method: 'PUT',
                        headers,
                        credentials: 'same-origin',
                        body: JSON.stringify(payload),
                    });
                    if (res.ok) {
                        dbg('feedbackTracker: updated similar Liferay record', existingId, 'overlap=', bestOverlap);
                    } else {
                        const err = await res.text();
                        dbg('feedbackTracker: Liferay PUT failed', res.status, err);
                    }
                } else {
                    // Create new record
                    const res = await fetch(`${base}/o/c/${OBJECT_NAME}/`, {
                        method: 'POST',
                        headers,
                        credentials: 'same-origin',
                        body: JSON.stringify(payload),
                    });
                    if (res.ok) {
                        const created = await res.json();
                        record._liferayId = created.id;
                        _save(_load()); // persist the liferayId
                        dbg('feedbackTracker: created Liferay record', created.id);
                    } else {
                        const err = await res.text();
                        dbg('feedbackTracker: Liferay POST failed', res.status, err);
                    }
                }
            } else {
                // Fallback: just create a new record
                const res = await fetch(`${base}/o/c/${OBJECT_NAME}/`, {
                    method: 'POST',
                    headers,
                    credentials: 'same-origin',
                    body: JSON.stringify(payload),
                });
                if (res.ok) {
                    const created = await res.json();
                    record._liferayId = created.id;
                    _save(_load());
                    dbg('feedbackTracker: synced to Liferay', record.messageId);
                } else {
                    const err = await res.text();
                    dbg('feedbackTracker: Liferay sync failed', res.status, err);
                }
            }
        }
    } catch (e) {
        dbg('feedbackTracker: Liferay sync error', e.message);
    }
}

async function _deleteFromLiferay(messageId) {
    const base = getBaseUrl();
    const token = getLiferayToken();
    if (!base) return;

    try {
        const headers = {};
        if (token) headers['x-csrf-token'] = token;

        // Find the record by filtering on messageId
        const filterUrl = `${base}/o/c/${OBJECT_NAME}/?filter=messageId eq '${messageId}'&pageSize=1`;
        const listRes = await fetch(filterUrl, { headers, credentials: 'same-origin' });
        if (!listRes.ok) return;

        const listData = await listRes.json();
        const items = listData.items || [];
        for (const item of items) {
            await fetch(`${base}/o/c/${OBJECT_NAME}/${item.id}`, {
                method: 'DELETE',
                headers,
                credentials: 'same-origin',
            });
            dbg('feedbackTracker: deleted from Liferay', item.id);
        }
    } catch (e) {
        dbg('feedbackTracker: Liferay delete error', e.message);
    }
}

// ── RAG: Fetch positive feedback for context ──────────────────────────────

/**
 * Fetch positively-rated Q&A pairs from Liferay Custom Object.
 * Used to inject proven-good answers into the LLM system prompt.
 * @param {string} query — the current user query (used for keyword matching)
 * @param {number} [maxResults=5] — maximum number of results to return
 * @returns {Promise<Array<{query: string, response: string}>>}
 */
export async function fetchPositiveFeedback(query, maxResults = 5) {
    const base = getBaseUrl();
    const token = getLiferayToken();
    if (!base) return [];

    try {
        const headers = {};
        if (token) headers['x-csrf-token'] = token;

        // Fetch only positive ratings, sorted by score descending (highest score first)
        const url = `${base}/o/c/${OBJECT_NAME}/?filter=rating eq 'up'&pageSize=${maxResults * 2}&sort=score:desc,dateCreated:desc`;
        const res = await fetch(url, { headers, credentials: 'same-origin' });
        if (!res.ok) {
            dbg('feedbackTracker: fetchPositiveFeedback failed', res.status);
            return [];
        }

        const data = await res.json();
        const items = data.items || [];

        // Simple keyword matching: extract significant words from the query
        const queryWords = (query || '').toLowerCase()
            .replace(/[^\w\sàèéìòù]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3); // skip short words

        // Score each item by word overlap with the query + use the stored score
        const scored = items.map(item => {
            const itemWords = (item.query || '').toLowerCase()
                .replace(/[^\w\sàèéìòù]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 3);
            const overlap = queryWords.filter(w => itemWords.includes(w)).length;
            // Combine word overlap with stored score: relevance = overlap * 10 + stored score
            const relevance = overlap * 10 + (item.score || 1);
            return { ...item, relevance };
        });

        // Sort by relevance (descending), then take top results
        scored.sort((a, b) => b.relevance - a.relevance);

        // Return items with at least 1 word overlap, or top items if no overlap found
        const relevant = scored.filter(s => s.relevance >= 10); // at least 1 word overlap
        const results = (relevant.length > 0 ? relevant : scored.slice(0, maxResults)).slice(0, maxResults);

        dbg('feedbackTracker: fetchPositiveFeedback found', results.length, 'relevant items for query:', query?.substring(0, 50));

        return results.map(item => ({
            query: item.query || '',
            response: item.response || '',
            toolCalls: item.toolCalls || '',
            score: item.score || 0,
        }));
    } catch (e) {
        dbg('feedbackTracker: fetchPositiveFeedback error', e.message);
        return [];
    }
}