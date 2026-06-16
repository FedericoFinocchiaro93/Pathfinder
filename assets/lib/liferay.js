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

/**
 * Get the structureKey of a DDM Structure via JSON-WS.
 * The structureKey is different from the structureId (e.g. structureId=36377, structureKey="36376").
 * The structureKey is needed for SXP Blueprint filters (ddmStructureKey field).
 */
export async function getStructureKeyViaJsonWS({ baseUrl, structureId, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('structureId', String(structureId));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/ddm.ddmstructure/get-structure';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS get-structure', url, { structureId });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS get-structure failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    const data = await res.json();
    return {
        structureId: data.structureId,
        structureKey: data.structureKey,
        name: data.nameCurrentValue || data.name,
        groupId: data.groupId,
    };
}

/**
 * List Fragment Collections via JSON-WS (GET /api/jsonws/fragment.fragmentcollection/get-fragment-collections)
 * Returns an array of fragment collection objects.
 */
export async function listFragmentCollections({ baseUrl, groupId, name, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('groupId', String(groupId));
    if (name) params.append('name', name);
    params.append('start', '-1');
    params.append('end', '-1');

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmentcollection/get-fragment-collections?' + params.toString();
    const headers = {};
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS get-fragment-collections', url, { groupId, name });
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS get-fragment-collections failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return res.json();
}

/**
 * List Fragment Entries in a collection via JSON-WS (GET /api/jsonws/fragment.fragmententry/get-fragment-entries)
 * Returns an array of fragment entry objects.
 */
export async function listFragments({ baseUrl, groupId, fragmentCollectionId, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('groupId', String(groupId));
    params.append('fragmentCollectionId', String(fragmentCollectionId));
    params.append('start', '-1');
    params.append('end', '-1');

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmententry/get-fragment-entries?' + params.toString();
    const headers = {};
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS get-fragment-entries', url, { groupId, fragmentCollectionId });
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS get-fragment-entries failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return res.json();
}

/**
 * Create a Fragment Collection via JSON-WS (POST /api/jsonws/fragment.fragmentcollection/add-fragment-collection)
 * Returns the created fragment collection object.
 */
export async function createFragmentCollection({ baseUrl, groupId, name, description = '', fragmentCollectionKey = '', user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('groupId', String(groupId));
    params.append('name', name);
    params.append('description', description);
    if (fragmentCollectionKey) params.append('fragmentCollectionKey', fragmentCollectionKey);
    else params.append('fragmentCollectionKey', '');
    params.append('externalReferenceCode', '');
    params.append('marketplace', 'false');
    params.append('serviceContext', JSON.stringify({ scopeGroupId: String(groupId) }));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmentcollection/add-fragment-collection';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS add-fragment-collection', url, { groupId, name });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS add-fragment-collection failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return res.json();
}

/**
 * Create a Fragment Entry via JSON-WS (POST /api/jsonws/fragment.fragmententry/add-fragment-entry)
 * Uses the 18-parameter signature: externalReferenceCode, groupId, fragmentCollectionId,
 * fragmentEntryKey, name, css, html, js, cacheable, configuration, icon,
 * previewFileEntryId, readOnly, marketplace, type, typeOptions, status, serviceContext
 * Returns the created fragment entry object.
 */
export async function createFragment({ baseUrl, groupId, fragmentCollectionId, name, html, css = '', js = '', cacheable = false, type = 0, configuration = '', fragmentEntryKey = '', user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    // 18-parameter signature — order matters for JSONWS matching
    params.append('externalReferenceCode', '');
    params.append('groupId', String(groupId));
    params.append('fragmentCollectionId', String(fragmentCollectionId));
    params.append('fragmentEntryKey', fragmentEntryKey || '');
    params.append('name', name);
    params.append('css', css);
    params.append('html', html);
    params.append('js', js);
    params.append('cacheable', String(cacheable));
    params.append('configuration', configuration || '');
    params.append('icon', '');
    params.append('previewFileEntryId', '0');
    params.append('readOnly', 'false');
    params.append('marketplace', 'false');
    params.append('type', String(type));
    params.append('typeOptions', '');
    params.append('status', '0');
    params.append('serviceContext', JSON.stringify({ scopeGroupId: String(groupId) }));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmententry/add-fragment-entry';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS add-fragment-entry', url, { groupId, fragmentCollectionId, name });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS add-fragment-entry failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return res.json();
}

/**
 * Delete a Fragment Collection via JSON-WS (POST /api/jsonws/fragment.fragmentcollection/delete-fragment-collection)
 */
export async function deleteFragmentCollection({ baseUrl, fragmentCollectionId, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('fragmentCollectionId', String(fragmentCollectionId));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmentcollection/delete-fragment-collection';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS delete-fragment-collection', url, { fragmentCollectionId });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS delete-fragment-collection failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return { deleted: true, fragmentCollectionId: Number(fragmentCollectionId) };
}

/**
 * Delete a Fragment Entry via JSON-WS (POST /api/jsonws/fragment.fragmententry/delete-fragment-entry)
 */
export async function deleteFragment({ baseUrl, fragmentEntryId, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('fragmentEntryId', String(fragmentEntryId));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmententry/delete-fragment-entry';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS delete-fragment-entry', url, { fragmentEntryId });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS delete-fragment-entry failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return { deleted: true, fragmentEntryId: Number(fragmentEntryId) };
}

/**
 * Get a single Fragment Entry by ID via JSON-WS (GET /api/jsonws/fragment.fragmententry/fetch-fragment-entry)
 * Returns the fragment entry object with html, css, js, configuration, etc.
 */
export async function getFragment({ baseUrl, fragmentEntryId, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    params.append('fragmentEntryId', String(fragmentEntryId));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmententry/fetch-fragment-entry?' + params.toString();
    const headers = {};
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS fetch-fragment-entry', url, { fragmentEntryId });
    const res = await fetch(url, { method: 'GET', credentials: 'same-origin', headers });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS fetch-fragment-entry failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return res.json();
}

/**
 * Update a Fragment Entry via JSON-WS (POST /api/jsonws/fragment.fragmententry/update-fragment-entry)
 * Uses the 13-parameter signature: fragmentEntryId, fragmentCollectionId, name, css, html, js,
 * cacheable, configuration, icon, previewFileEntryId, readOnly, typeOptions, status
 * All parameters are required by JSONWS — for fields you don't want to change, pass the current values.
 * Returns the updated fragment entry object.
 */
export async function updateFragment({ baseUrl, fragmentEntryId, fragmentCollectionId, name, html, css, js, cacheable, configuration, icon, previewFileEntryId, readOnly, typeOptions, status, user, pass }) {
    const token = getLiferayToken();
    const params = new URLSearchParams();
    if (token) params.append('p_auth', token);
    // 13-parameter signature — all params required by JSONWS
    params.append('fragmentEntryId', String(fragmentEntryId));
    params.append('fragmentCollectionId', String(fragmentCollectionId || 0));
    params.append('name', name !== undefined ? name : '');
    params.append('css', css !== undefined ? css : '');
    params.append('html', html !== undefined ? html : '');
    params.append('js', js !== undefined ? js : '');
    params.append('cacheable', String(cacheable || false));
    params.append('configuration', configuration !== undefined ? configuration : '');
    params.append('icon', icon !== undefined ? icon : '');
    params.append('previewFileEntryId', String(previewFileEntryId || 0));
    params.append('readOnly', String(readOnly || false));
    params.append('typeOptions', typeOptions !== undefined ? typeOptions : '');
    params.append('status', String(status !== undefined ? status : 0));

    const url = baseUrl.replace(/\/$/, '') + '/api/jsonws/fragment.fragmententry/update-fragment-entry';
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (user && pass) {
        headers['Authorization'] = 'Basic ' + btoa(user + ':' + pass);
    } else if (token) {
        headers['x-csrf-token'] = token;
    }

    dbg('JSONWS update-fragment-entry', url, { fragmentEntryId, name });

    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers, body: params.toString() });
    if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        throw new Error(`JSONWS update-fragment-entry failed: HTTP ${res.status} ${res.statusText} — ${bodyText.substring(0, 2000)}`);
    }
    return res.json();
}

/**
 * List all SXP Blueprints via Search Experiences REST API.
 */
export async function listSxpBlueprints({ baseUrl, pageSize = 20, user, pass }) {
    return await liferayGet(baseUrl, `/o/search-experiences-rest/v1.0/sxp-blueprints?pageSize=${pageSize}`, user, pass);
}

/**
 * Get a single SXP Blueprint by ID.
 */
export async function getSxpBlueprint({ baseUrl, blueprintId, user, pass }) {
    return await liferayGet(baseUrl, `/o/search-experiences-rest/v1.0/sxp-blueprints/${blueprintId}`, user, pass);
}

/**
 * Create an SXP Blueprint via Search Experiences REST API.
 * Uses a 2-step process: POST to create without elementInstances, then PUT to add elementInstances.
 * This avoids a 500 error when creating with elementInstances directly.
 */
export async function createSxpBlueprint({ baseUrl, title, description = '', filterDdmStructureKeys = [], filterCategoryIds = [], customFilterClauses = [], searchableAssetTypes = [], collectionProvider = false, collectionProviderType = 'com.liferay.asset.kernel.model.AssetEntry', scopeGroupIds = [], sortConfiguration, aggregationConfiguration, highlightConfiguration, parameterConfiguration, user, pass }) {
    dbg('createSxpBlueprint — title received:', JSON.stringify(title), 'type:', typeof title);
    // Step 1: Create blueprint WITHOUT elementInstances (causes 500 if included in POST)
    const createBody = {
        title,
        title_i18n: { 'en-US': title, 'it-IT': title },
        description,
        description_i18n: { 'en-US': description, 'it-IT': description },
        schemaVersion: '1.2',
        configuration: {
            generalConfiguration: {
                clauseContributorsIncludes: ['*'],
                clauseContributorsExcludes: [],
                collectionProvider,
                collectionProviderType,
                scope: scopeGroupIds.map(id => ({ groupId: id })),
                searchableAssetTypes,
            },
            queryConfiguration: { applyIndexerClauses: true },
            aggregationConfiguration: aggregationConfiguration || {},
            sortConfiguration: sortConfiguration || {},
            highlightConfiguration: highlightConfiguration || {},
            advancedConfiguration: {},
            parameterConfiguration: parameterConfiguration || {},
        },
    };

    const created = await liferayPost(baseUrl, '/o/search-experiences-rest/v1.0/sxp-blueprints', createBody, user, pass);

    // Step 2: If we have filter criteria, update with elementInstances via PUT
    // IMPORTANT: All filter criteria go into ONE element with multiple clauses.
    // ddmStructureKeys use "terms" filter, categoryNames use "terms" filter on assetCategoryNames.
    // Multiple clauses with occur="filter" are ANDed together.
    const hasFilters = filterDdmStructureKeys.length > 0 || filterCategoryIds.length > 0 || customFilterClauses.length > 0;
    if (hasFilters) {
        const filterParts = [];
        if (filterDdmStructureKeys.length > 0) filterParts.push(`DDM ${filterDdmStructureKeys.join(', ')}`);
        if (filterCategoryIds.length > 0) filterParts.push(`Category ${filterCategoryIds.join(', ')}`);
        if (customFilterClauses.length > 0) filterParts.push(`Custom (${customFilterClauses.length} clauses)`);
        const keysLabel = filterParts.join(' + ');

        // Build clauses for all filters
        const clauses = [];
        if (filterDdmStructureKeys.length > 0) {
            clauses.push({
                occur: 'filter',
                query: { terms: { ddmStructureKey: filterDdmStructureKeys } },
                context: 'query',
            });
        }
        if (filterCategoryIds.length > 0) {
            clauses.push({
                occur: 'filter',
                query: { terms: { assetCategoryIds: filterCategoryIds } },
                context: 'query',
            });
        }
        // Add custom filter clauses
        for (const clause of customFilterClauses) {
            clauses.push({
                occur: clause.occur || 'filter',
                query: clause.query,
                context: clause.context || 'query',
            });
        }

        const elementInstance = {
            sxpElement: {
                schemaVersion: '1.0',
                title: `Filter by ${keysLabel}`,
                title_i18n: { 'en-US': `Filter by ${keysLabel}`, 'it-IT': `Filtro per ${keysLabel}` },
                description: `Filters search results by: ${keysLabel}`,
                description_i18n: { 'en-US': `Filters search results by: ${keysLabel}`, 'it-IT': `Filtra i risultati di ricerca per: ${keysLabel}` },
                readOnly: false,
                type: 0,
                version: '1,0',
                externalReferenceCode: `FILTER_${filterDdmStructureKeys.length > 0 ? 'DDM_' + filterDdmStructureKeys.join('_') : ''}${filterCategoryIds.length > 0 ? '_CAT_' + filterCategoryIds.join('_') : ''}`,
                elementDefinition: {
                    uiConfiguration: {},
                    configuration: {
                        queryConfiguration: {
                            queryEntries: [{ clauses }],
                        },
                    },
                    icon: 'filter',
                    category: 'filter',
                },
            },
            configurationEntry: {
                queryConfiguration: {
                    queryEntries: [{ clauses }],
                },
            },
            uiConfigurationValues: {},
        };

        const updateBody = {
            ...created,
            title,
            title_i18n: { 'en-US': title, 'it-IT': title },
            elementInstances: [elementInstance],
        };

        const updated = await liferayPut(baseUrl, `/o/search-experiences-rest/v1.0/sxp-blueprints/${created.id}`, updateBody, user, pass);
        return updated;
    }

    return created;
}

/**
 * Update an SXP Blueprint via Search Experiences REST API (PUT).
 * Replaces elementInstances completely — provide all desired elements.
 */
export async function updateSxpBlueprint({ baseUrl, blueprintId, title, description, filterDdmStructureKeys, filterCategoryIds, customFilterClauses, searchableAssetTypes, collectionProvider, collectionProviderType, scopeGroupIds, sortConfiguration, aggregationConfiguration, highlightConfiguration, parameterConfiguration, user, pass }) {
    // First get current blueprint
    const current = await getSxpBlueprint({ baseUrl, blueprintId, user, pass });

    const updateBody = { ...current };

    if (title !== undefined) {
        updateBody.title = title;
        updateBody.title_i18n = { 'en-US': title, 'it-IT': title };
    }
    if (description !== undefined) {
        updateBody.description = description;
        updateBody.description_i18n = { 'en-US': description, 'it-IT': description };
    }

    // Update configuration
    if (!updateBody.configuration) {
        updateBody.configuration = {
            generalConfiguration: {},
            queryConfiguration: { applyIndexerClauses: true },
            aggregationConfiguration: {},
            sortConfiguration: {},
            highlightConfiguration: {},
            advancedConfiguration: {},
            parameterConfiguration: {},
        };
    }
    if (!updateBody.configuration.generalConfiguration) {
        updateBody.configuration.generalConfiguration = {};
    }

    if (collectionProvider !== undefined) {
        updateBody.configuration.generalConfiguration.collectionProvider = collectionProvider;
    }
    if (collectionProviderType !== undefined) {
        updateBody.configuration.generalConfiguration.collectionProviderType = collectionProviderType;
    }
    if (searchableAssetTypes !== undefined) {
        updateBody.configuration.generalConfiguration.searchableAssetTypes = searchableAssetTypes;
    }
    if (scopeGroupIds !== undefined) {
        updateBody.configuration.generalConfiguration.scope = scopeGroupIds.map(id => ({ groupId: id }));
    }

    // Update sortConfiguration if provided
    if (sortConfiguration !== undefined) {
        updateBody.configuration.sortConfiguration = sortConfiguration;
    }
    // Update aggregationConfiguration if provided
    if (aggregationConfiguration !== undefined) {
        updateBody.configuration.aggregationConfiguration = aggregationConfiguration;
    }
    // Update highlightConfiguration if provided
    if (highlightConfiguration !== undefined) {
        updateBody.configuration.highlightConfiguration = highlightConfiguration;
    }
    // Update parameterConfiguration if provided
    if (parameterConfiguration !== undefined) {
        updateBody.configuration.parameterConfiguration = parameterConfiguration;
    }

    // Update elementInstances if filter criteria provided
    // IMPORTANT: All filter criteria go into ONE element with multiple clauses.
    // ddmStructureKeys use "terms" filter, categoryIds use "terms" filter on assetCategoryIds.
    // customFilterClauses allow arbitrary Elasticsearch queries.
    // Multiple clauses with occur="filter" are ANDed together.
    const hasFilterDdm = filterDdmStructureKeys !== undefined;
    const hasFilterCat = filterCategoryIds !== undefined;
    const hasCustomClauses = customFilterClauses !== undefined;
    if (hasFilterDdm || hasFilterCat || hasCustomClauses) {
        const ddmKeys = filterDdmStructureKeys || [];
        const catIds = filterCategoryIds || [];
        const customClauses = customFilterClauses || [];
        if (ddmKeys.length === 0 && catIds.length === 0 && customClauses.length === 0) {
            updateBody.elementInstances = [];
        } else {
            const filterParts = [];
            if (ddmKeys.length > 0) filterParts.push(`DDM ${ddmKeys.join(', ')}`);
            if (catIds.length > 0) filterParts.push(`Category ${catIds.join(', ')}`);
            if (customClauses.length > 0) filterParts.push(`Custom (${customClauses.length} clauses)`);
            const keysLabel = filterParts.join(' + ');

            // Build clauses for all filters
            const clauses = [];
            if (ddmKeys.length > 0) {
                clauses.push({
                    occur: 'filter',
                    query: { terms: { ddmStructureKey: ddmKeys } },
                    context: 'query',
                });
            }
            if (catIds.length > 0) {
                clauses.push({
                    occur: 'filter',
                    query: { terms: { assetCategoryIds: catIds } },
                    context: 'query',
                });
            }
            // Add custom filter clauses
            for (const clause of customClauses) {
                clauses.push({
                    occur: clause.occur || 'filter',
                    query: clause.query,
                    context: clause.context || 'query',
                });
            }

            updateBody.elementInstances = [{
                sxpElement: {
                    schemaVersion: '1.0',
                    title: `Filter by ${keysLabel}`,
                    title_i18n: { 'en-US': `Filter by ${keysLabel}`, 'it-IT': `Filtro per ${keysLabel}` },
                    description: `Filters search results by: ${keysLabel}`,
                    description_i18n: { 'en-US': `Filters search results by: ${keysLabel}`, 'it-IT': `Filtra i risultati di ricerca per: ${keysLabel}` },
                    readOnly: false,
                    type: 0,
                    version: '1,0',
                    externalReferenceCode: `FILTER_${ddmKeys.length > 0 ? 'DDM_' + ddmKeys.join('_') : ''}${catIds.length > 0 ? '_CAT_' + catIds.join('_') : ''}`,
                    elementDefinition: {
                        uiConfiguration: {},
                        configuration: {
                            queryConfiguration: {
                                queryEntries: [{ clauses }],
                            },
                        },
                        icon: 'filter',
                        category: 'filter',
                    },
                },
                configurationEntry: {
                    queryConfiguration: {
                        queryEntries: [{ clauses }],
                    },
                },
                uiConfigurationValues: {},
            }];
        }
    }

    return await liferayPut(baseUrl, `/o/search-experiences-rest/v1.0/sxp-blueprints/${blueprintId}`, updateBody, user, pass);
}

/**
 * Delete an SXP Blueprint via Search Experiences REST API.
 */
export async function deleteSxpBlueprint({ baseUrl, blueprintId, user, pass }) {
    return await liferayDelete(baseUrl, `/o/search-experiences-rest/v1.0/sxp-blueprints/${blueprintId}`, user, pass);
}

/**
 * List all SXP Elements via Search Experiences REST API.
 */
export async function listSxpElements({ baseUrl, pageSize = 50, user, pass }) {
    return await liferayGet(baseUrl, `/o/search-experiences-rest/v1.0/sxp-elements?pageSize=${pageSize}`, user, pass);
}

/**
 * Get a single SXP Element by ID.
 */
export async function getSxpElement({ baseUrl, elementId, user, pass }) {
    return await liferayGet(baseUrl, `/o/search-experiences-rest/v1.0/sxp-elements/${elementId}`, user, pass);
}

/**
 * Create an SXP Element via Search Experiences REST API.
 *
 * Supports multiple creation modes:
 * 1. Simple filter: filterField + filterValues (backward compatible)
 * 2. Custom query: customQuery with optional occur, condition, boost
 * 3. Full elementDefinition: elementDefinition object (full control)
 *
 * uiConfiguration field types:
 *   - "text": free text input
 *   - "number": numeric input (typeOptions: {min, max})
 *   - "multiselect": multi-value selector
 *   - "select": dropdown (typeOptions: {options: [{label, value}]})
 *   - "json": JSON editor
 *   - "fieldMapping": search field selector
 *
 * Condition types:
 *   - { equals: { parameterName: "user.is_signed_in", value: false } }
 *   - { contains: { parameterName: "keywords", value: "${configuration.keywords}" } }
 *
 * Category values: filter, boost, hide, conditional, sort, match, custom
 * Icon values: filter, thumbs-up, hidden, sort, custom-field
 *
 * IMPORTANT: boost goes INSIDE the terms/term query object, not as a separate clause property.
 * Example: { terms: { boost: "${configuration.boost}", field: "${configuration.values}" } }
 */
export async function createSxpElement({ baseUrl, title, titleI18n, description, descriptionI18n, externalReferenceCode, type = 0, category = 'filter', icon = 'filter', filterField, filterValues, customQuery, occur = 'filter', condition, uiConfiguration, boost, user, pass, elementDefinition }) {
    // If a full elementDefinition is provided, use it directly
    if (elementDefinition) {
        const body = {
            title,
            title_i18n: titleI18n || { 'en-US': title },
            description: description || '',
            description_i18n: descriptionI18n || { 'en-US': description || '' },
            externalReferenceCode,
            schemaVersion: '1.0',
            type,
            version: '1,0',
            readOnly: false,
            elementDefinition,
        };
        return await liferayPost(baseUrl, '/o/search-experiences-rest/v1.0/sxp-elements', body, user, pass);
    }

    // Build query from filter_field/filter_values or custom_query
    let queryConfig;
    if (customQuery) {
        queryConfig = customQuery;
    } else if (filterField && filterValues) {
        queryConfig = filterValues.length === 1
            ? { term: { [filterField]: filterValues[0] } }
            : { terms: { [filterField]: filterValues } };
    } else {
        queryConfig = { terms: { ddmStructureKey: [] } }; // empty default
    }

    // Build the queryEntry with optional condition
    const queryEntry = {
        clauses: [{
            occur,
            query: queryConfig,
            context: 'query',
        }],
    };
    if (condition) {
        queryEntry.condition = condition;
    }

    // Build uiConfiguration
    const uiConfig = uiConfiguration || {};

    const body = {
        title,
        title_i18n: titleI18n || { 'en-US': title },
        description: description || '',
        description_i18n: descriptionI18n || { 'en-US': description || '' },
        externalReferenceCode,
        schemaVersion: '1.0',
        type,
        version: '1,0',
        readOnly: false,
        elementDefinition: {
            uiConfiguration: uiConfig,
            configuration: {
                queryConfiguration: {
                    queryEntries: [queryEntry],
                },
            },
            icon,
            category,
        },
    };

    return await liferayPost(baseUrl, '/o/search-experiences-rest/v1.0/sxp-elements', body, user, pass);
}

/**
 * Update an SXP Element via Search Experiences REST API.
 * NOTE: The SXP Elements PUT endpoint has known issues (returns 400).
 * This function uses a delete+recreate approach as a workaround.
 * The externalReferenceCode is preserved from the original element.
 */
export async function updateSxpElement({ baseUrl, elementId, title, description, filterField, filterValues, customQuery, occur, condition, uiConfiguration, elementDefinition, user, pass }) {
    // Get current element to preserve its externalReferenceCode and other fields
    const current = await getSxpElement({ baseUrl, elementId, user, pass });

    const erc = current.externalReferenceCode;
    const newTitle = title !== undefined ? title : current.title;
    const newDescription = description !== undefined ? description : current.description;

    // If full elementDefinition is provided, use it directly
    if (elementDefinition) {
        await deleteSxpElement({ baseUrl, elementId, user, pass });
        const newElement = await createSxpElement({
            baseUrl,
            title: newTitle,
            titleI18n: current.title_i18n,
            description: newDescription,
            descriptionI18n: current.description_i18n,
            externalReferenceCode: erc,
            type: current.type ?? 0,
            elementDefinition,
            user,
            pass,
        });
        return newElement;
    }

    // Build query config
    let queryConfig;
    if (customQuery) {
        queryConfig = customQuery;
    } else if (filterField && filterValues) {
        queryConfig = filterValues.length === 1
            ? { term: { [filterField]: filterValues[0] } }
            : { terms: { [filterField]: filterValues } };
    } else {
        // Preserve existing query if no new query provided
        queryConfig = current.elementDefinition?.configuration?.queryConfiguration?.queryEntries?.[0]?.clauses?.[0]?.query
            || { terms: { ddmStructureKey: [] } };
    }

    // Build the queryEntry with optional condition
    const currentOccur = occur || current.elementDefinition?.configuration?.queryConfiguration?.queryEntries?.[0]?.clauses?.[0]?.occur || 'filter';
    const currentCondition = condition || current.elementDefinition?.configuration?.queryConfiguration?.queryEntries?.[0]?.condition;
    const queryEntry = {
        clauses: [{
            occur: currentOccur,
            query: queryConfig,
            context: 'query',
        }],
    };
    if (currentCondition) {
        queryEntry.condition = currentCondition;
    }

    // Use provided uiConfiguration or preserve existing
    const uiConfig = uiConfiguration || current.elementDefinition?.uiConfiguration || {};
    const category = current.elementDefinition?.category || 'filter';
    const icon = current.elementDefinition?.icon || 'filter';

    // Delete the old element
    await deleteSxpElement({ baseUrl, elementId, user, pass });

    // Recreate with updated values
    const newElement = await createSxpElement({
        baseUrl,
        title: newTitle,
        titleI18n: current.title_i18n,
        description: newDescription,
        descriptionI18n: current.description_i18n,
        externalReferenceCode: erc,
        type: current.type ?? 0,
        category,
        icon,
        filterField,
        filterValues,
        customQuery: customQuery ? queryConfig : undefined,
        occur: currentOccur,
        condition: currentCondition,
        uiConfiguration: uiConfig,
        user,
        pass,
    });

    return newElement;
}

/**
 * Delete an SXP Element via Search Experiences REST API.
 */
export async function deleteSxpElement({ baseUrl, elementId, user, pass }) {
    return await liferayDelete(baseUrl, `/o/search-experiences-rest/v1.0/sxp-elements/${elementId}`, user, pass);
}

export { ENRICH_FRIENDLY_LIMIT, getCachedResponse, setCachedResponse };
