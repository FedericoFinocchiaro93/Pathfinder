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

/**
 * Upload a file to Liferay Document Library via Headless Delivery API.
 * @param {string} baseUrl - Liferay base URL
 * @param {string} siteId - Site ID
 * @param {File|Blob} file - The file to upload
 * @param {string} fileName - The file name
 * @param {string} title - Optional document title
 * @param {number} folderId - Optional parent folder ID (0 = root)
 * @param {string} user - Username
 * @param {string} pass - Password
 * @returns {Promise<Object>} The created document object
 */
export async function liferayUploadDocument(baseUrl, siteId, file, fileName, title, folderId, user, pass) {
    const url = folderId
        ? `${baseUrl}/o/headless-delivery/v1.0/document-folders/${folderId}/documents`
        : `${baseUrl}/o/headless-delivery/v1.0/sites/${siteId}/documents`;

    const formData = new FormData();
    formData.append('file', file, fileName || file.name || 'upload');

    if (title) {
        formData.append('document', JSON.stringify({ title }));
    } else if (fileName) {
        formData.append('document', JSON.stringify({ title: fileName }));
    }

    const headers = {};
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else {
        const token = getLiferayToken();
        if (token) headers['x-csrf-token'] = token;
    }

    dbg('UPLOAD', url, fileName);
    const res = await fetch(url, { method: 'POST', headers, body: formData, credentials: 'same-origin' });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`Upload failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 300)}`);
    }
    return res.json();
}

/**
 * Resolve DDM template creation parameters dynamically via JSON-WS.
 * Given a structureId (DDM Structure / Content Structure), fetches:
 *   - classNameId        → classNameId of com.liferay.dynamic.data.mapping.model.DDMStructure
 *   - classPK            → the structure ID itself (DDM Structure PK)
 *   - resourceClassNameId → classNameId of com.liferay.journal.model.JournalArticle
 *
 * These values are cached in memory after the first call.
 *
 * @param {string} baseUrl - Liferay base URL
 * @param {string|number} structureId - The DDM Structure ID (from get_content_structures)
 * @param {string} user - Optional username for Basic Auth
 * @param {string} pass - Optional password for Basic Auth
 * @returns {{ classNameId: number, classPK: number, resourceClassNameId: number }}
 */
const _ddmClassIdCache = {};

export async function resolveDDMTemplateParams({ baseUrl, structureId, user, pass }) {
    const token = getLiferayToken();
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    // Fetch classNameId for DDMStructure (cached)
    if (!_ddmClassIdCache.ddmStructure) {
        dbg('resolveDDMTemplateParams: fetching classNameId for DDMStructure');
        const cnUrl = baseUrl.replace(/\/$/, '') + '/api/jsonws/classname/fetch-class-name';
        const cnBody = new URLSearchParams({ value: 'com.liferay.dynamic.data.mapping.model.DDMStructure' });
        const cnRes = await fetch(cnUrl, { method: 'POST', credentials: 'same-origin', headers, body: cnBody.toString() });
        if (!cnRes.ok) {
            const errText = await cnRes.text().catch(() => '');
            throw new Error(`Failed to fetch DDMStructure classNameId: HTTP ${cnRes.status} — ${errText.substring(0, 500)}`);
        }
        const cnData = await cnRes.json();
        _ddmClassIdCache.ddmStructure = Number(cnData.classNameId);
        if (!_ddmClassIdCache.ddmStructure) throw new Error('classNameId not found in JSON-WS response for DDMStructure');
    }

    // Fetch classNameId for JournalArticle (cached)
    if (!_ddmClassIdCache.journalArticle) {
        dbg('resolveDDMTemplateParams: fetching classNameId for JournalArticle');
        const jaBody = new URLSearchParams({ value: 'com.liferay.journal.model.JournalArticle' });
        const jaRes = await fetch(baseUrl.replace(/\/$/, '') + '/api/jsonws/classname/fetch-class-name', { method: 'POST', credentials: 'same-origin', headers, body: jaBody.toString() });
        if (!jaRes.ok) {
            const errText = await jaRes.text().catch(() => '');
            throw new Error(`Failed to fetch JournalArticle classNameId: HTTP ${jaRes.status} — ${errText.substring(0, 500)}`);
        }
        const jaData = await jaRes.json();
        _ddmClassIdCache.journalArticle = Number(jaData.classNameId);
        if (!_ddmClassIdCache.journalArticle) throw new Error('classNameId not found in JSON-WS response for JournalArticle');
    }

    dbg('resolveDDMTemplateParams: resolved', { classNameId: _ddmClassIdCache.ddmStructure, classPK: structureId, resourceClassNameId: _ddmClassIdCache.journalArticle });

    return {
        classNameId: _ddmClassIdCache.ddmStructure,
        classPK: Number(structureId),
        resourceClassNameId: _ddmClassIdCache.journalArticle,
    };
}

/**
 * Create a DDM template via JSON-WS (form-encoded POST to /api/jsonws/ddm.ddmtemplate/add-template)
 * Expects FreeMarker script in `script` and returns the created template object on success.
 *
 * Key parameter mapping (verified via testing):
 *   classNameId        = classNameId of DDMStructure (NOT JournalArticle)
 *   classPK            = structureId of the target DDM Structure
 *   resourceClassNameId = classNameId of JournalArticle
 */
export async function createDDMTemplateViaJsonWS({ baseUrl, groupId, classNameId, classPK, resourceClassNameId, name, description = '', script, type = 'display', language = 'ftl', user, pass }) {
    const token = getLiferayToken();
    const locale = (window.Liferay && window.Liferay.ThemeDisplay && window.Liferay.ThemeDisplay.getLanguageId && window.Liferay.ThemeDisplay.getLanguageId()) || 'en_US';

    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('externalReferenceCode', '');
    params.append('groupId', String(groupId));
    params.append('classNameId', String(classNameId));
    params.append('classPK', String(classPK));
    params.append('resourceClassNameId', String(resourceClassNameId));
    params.append('nameMap', JSON.stringify({ [locale]: name }));
    params.append('descriptionMap', JSON.stringify({ [locale]: description }));
    params.append('type', String(type));
    params.append('mode', '');
    params.append('language', String(language));
    params.append('script', script || '');
    params.append('serviceContext', '{}');

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/ddm.ddmtemplate/add-template';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS add-template', url, { groupId, classNameId, classPK, resourceClassNameId });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS add-template failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    // JSON-WS returns JSON
    return res.json();
}

/**
 * Delete a DDM template via JSON-WS (form-encoded POST to /api/jsonws/ddm.ddmtemplate/delete-template)
 * Uses templateId to identify the template to delete.
 * Returns { deleted: true, templateId } on success.
 */
export async function deleteDDMTemplateViaJsonWS({ baseUrl, templateId, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('templateId', String(templateId));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/ddm.ddmtemplate/delete-template';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS delete-template', url, { templateId });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS delete-template failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return { deleted: true, templateId: Number(templateId) };
}

/**
 * Find a document folder by name under a parent folder (or site root).
 * Returns the folder object or null if not found.
 */
export async function liferayFindFolderByName(baseUrl, siteId, folderName, parentFolderId, user, pass) {
    const path = parentFolderId
        ? `/o/headless-delivery/v1.0/document-folders/${parentFolderId}/document-folders`
        : `/o/headless-delivery/v1.0/sites/${siteId}/document-folders`;
    try {
        const result = await liferayGet(baseUrl, path, user, pass);
        const items = result?.items || [];
        const found = items.find(f => f.name === folderName);
        return found || null;
    } catch (e) {
        dbg('FindFolder error:', e.message);
        return null;
    }
}

/**
 * Create a document folder in the Document Library.
 * Returns the created folder object.
 */
export async function liferayCreateFolder(baseUrl, siteId, folderName, parentFolderId, user, pass) {
    const path = parentFolderId
        ? `/o/headless-delivery/v1.0/document-folders/${parentFolderId}/document-folders`
        : `/o/headless-delivery/v1.0/sites/${siteId}/document-folders`;
    const body = { name: folderName };
    return liferayPost(baseUrl, path, body, user, pass);
}

/**
 * Ensure a document folder exists: find it or create it.
 * Returns the folder object with id.
 */
export async function liferayEnsureFolder(baseUrl, siteId, folderName, parentFolderId, user, pass) {
    // Try to find existing
    const existing = await liferayFindFolderByName(baseUrl, siteId, folderName, parentFolderId, user, pass);
    if (existing) return existing;

    // Create it
    return liferayCreateFolder(baseUrl, siteId, folderName, parentFolderId, user, pass);
}

export { ENRICH_FRIENDLY_LIMIT, getCachedResponse, setCachedResponse };
