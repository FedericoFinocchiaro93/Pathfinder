/**
 * lib/liferay.js — ai-chatbot-fullpage (identico al widget)
 */

import { dbg } from './utils.js';
import { _apiSpecCache, getCachedResponse, setCachedResponse } from './cache.js';

export function getLiferayToken() {
    return (window.Liferay && window.Liferay.authToken) || '';
}

export function getBaseUrl(cfgUrl) {
    if (cfgUrl) return cfgUrl.replace(/\/$/, '');
    if (window.Liferay && window.Liferay.ThemeDisplay) {
        return window.location.origin + (window.Liferay.ThemeDisplay.getPathContext() || '');
    }
    return window.location.origin;
}

export function getSiteId(cfgId) {
    if (cfgId) return cfgId;
    if (window.Liferay && window.Liferay.ThemeDisplay) {
        return String(window.Liferay.ThemeDisplay.getSiteGroupId());
    }
    return '';
}

export async function liferayGet(baseUrl, path, user, pass) {
    const headers = { 'Content-Type': 'application/json' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else {
        const token = getLiferayToken();
        if (token) headers['x-csrf-token'] = token;
    }
    const url = baseUrl + path;
    dbg('GET', url);
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url} — ${body.substring(0, 200)}`);
    }
    return res.json();
}

export async function liferayPost(baseUrl, path, body, user, pass) {
    const headers = { 'Content-Type': 'application/json' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else {
        const token = getLiferayToken();
        if (token) headers['x-csrf-token'] = token;
    }
    const url = baseUrl + path;
    dbg('POST', url, body);
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url} — ${bodyText.substring(0, 200)}`);
    }
    return res.json();
}

export function buildKeywordFilter(tag) {
    return `keywords/any(k:k eq '${String(tag).replace(/'/g, "''")}')`;
}

export function encodeFilter(filter) {
    return encodeURIComponent(filter);
}

export function parseStructuredContentItem(item) {
    const briefs = item.taxonomyCategoryBriefs || [];
    const categories = briefs.map((b) => ({ id: b.taxonomyCategoryId, name: b.taxonomyCategoryName }));
    const legacyIds  = item.taxonomyCategoriesIds || item.taxonomyCategoryIds || [];
    const legacyCats = item.taxonomyCategories || [];
    return {
        id:                   item.id,
        title:                item.title,
        friendlyUrlPath:      item.friendlyUrlPath,
        siteFriendlyUrl:      item.siteFriendlyUrl || item.siteGroupFriendlyUrl || null,
        datePublished:        item.datePublished,
        dateModified:         item.dateModified,
        description:          item.description,
        contentStructureId:   item.contentStructureId,
        contentStructureName: item.contentStructureName,
        taxonomyCategories:   categories.length > 0 ? categories : legacyCats,
        taxonomyCategoryIds:  categories.length > 0 ? categories.map((c) => c.id) : legacyIds,
        keywords:             item.keywords || [],
        contentFields:        item.contentFields || [],
        siteId:               item.siteId,
        uuid:                 item.uuid,
        _taxonomyCategoryBriefs: briefs,
    };
}

const ENRICH_FRIENDLY_LIMIT = 5;

export async function fetchApiList(baseUrl, user, pass) {
    if (_apiSpecCache['__list__']) return _apiSpecCache['__list__'];
    const data = await liferayGet(baseUrl, '/o/api', user, pass);
    const list = data.apis || data || [];
    _apiSpecCache['__list__'] = list;
    return list;
}

export async function fetchApiSpec(specUrl, user, pass) {
    if (_apiSpecCache[specUrl]) return _apiSpecCache[specUrl];
    if (!specUrl || !specUrl.startsWith('http')) return null;
    const res = await fetch(specUrl, {
        headers: user && pass ? { 'Authorization': 'Basic ' + btoa(user + ':' + pass) } : {},
        credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const spec = await res.json();
    const slim = {
        info: spec.info,
        paths: Object.fromEntries(
            Object.entries(spec.paths || {}).map(([path, methods]) => [
                path,
                Object.fromEntries(
                    Object.entries(methods).map(([method, op]) => [
                        method,
                        {
                            summary:     op.summary || '',
                            operationId: op.operationId || '',
                            parameters:  (op.parameters || []).map((p) => ({
                                name: p.name, in: p.in, required: p.required || false, schema: p.schema,
                            })),
                        },
                    ])
                ),
            ])
        ),
    };
    _apiSpecCache[specUrl] = slim;
    return slim;
}

export async function liferayPut(baseUrl, path, body, user, pass) {
    const headers = { 'Content-Type': 'application/json' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else {
        const token = getLiferayToken();
        if (token) headers['x-csrf-token'] = token;
    }
    const url = baseUrl + path;
    dbg('PUT', url, body);
    const res = await fetch(url, { method: 'PUT', credentials: 'same-origin', headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url} — ${bodyText.substring(0, 200)}`);
    }
    return res.json();
}

export async function liferayPatch(baseUrl, path, body, user, pass, extraHeaders) {
    const headers = { 'Content-Type': 'application/json' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else {
        const token = getLiferayToken();
        if (token) headers['x-csrf-token'] = token;
    }
    if (extraHeaders) Object.assign(headers, extraHeaders);
    const url = baseUrl + path;
    dbg('PATCH', url, body, extraHeaders);
    const res = await fetch(url, { method: 'PATCH', credentials: 'same-origin', headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url} — ${bodyText.substring(0, 200)}`);
    }
    return res.json();
}

export async function liferayDelete(baseUrl, path, user, pass) {
    const headers = { 'Content-Type': 'application/json' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else {
        const token = getLiferayToken();
        if (token) headers['x-csrf-token'] = token;
    }
    const url = baseUrl + path;
    dbg('DELETE', url);
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin', headers });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url} — ${bodyText.substring(0, 200)}`);
    }
    // 204 No Content — nessun JSON
    if (res.status === 204) return { deleted: true };
    return res.json().catch(() => ({ deleted: true }));
}

export { ENRICH_FRIENDLY_LIMIT, getCachedResponse, setCachedResponse };
