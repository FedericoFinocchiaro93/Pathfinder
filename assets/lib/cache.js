/**
 * lib/cache.js — ai-chatbot-fullpage
 * Storage key diversa per non condividere cache con il widget.
 */

export const _apiSpecCache = {};

const API_RESPONSE_CACHE_KEY = 'acfp_api_cache_v1';
const _apiResponseCache = {};

function loadApiResponseCache() {
    try {
        const raw = localStorage.getItem(API_RESPONSE_CACHE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const k of Object.keys(parsed)) {
            const v = parsed[k];
            if (v.expiresAt && v.expiresAt > now) _apiResponseCache[k] = v;
        }
    } catch (e) { console.log('[ACFP] loadApiResponseCache error', e.message || e); }
}

function persistApiResponseCache() {
    try { localStorage.setItem(API_RESPONSE_CACHE_KEY, JSON.stringify(_apiResponseCache)); }
    catch (_) { /* storage pieno */ }
}

export function getCachedResponse(key) {
    const e = _apiResponseCache[key];
    if (!e) return null;
    if (e.expiresAt && e.expiresAt < Date.now()) { delete _apiResponseCache[key]; persistApiResponseCache(); return null; }
    return e.value;
}

export function setCachedResponse(key, value, ttlMs = 5 * 60 * 1000) {
    _apiResponseCache[key] = { value, expiresAt: Date.now() + ttlMs };
    persistApiResponseCache();
}

try { loadApiResponseCache(); } catch (_) { /* ignore */ }
