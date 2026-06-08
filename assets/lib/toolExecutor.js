/**
 * lib/toolExecutor.js — ai-chatbot-fullpage
 * Copia esatta dal widget. Import paths relativi alla stessa cartella lib/.
 */

import { dbg } from './utils.js';
import {
    liferayGet, liferayPost, liferayPut, liferayPatch, liferayDelete, liferayUploadDocument, createDDMTemplateViaJsonWS, getBaseUrl, getSiteId,
    buildKeywordFilter, encodeFilter,
    parseStructuredContentItem,
    fetchApiList, fetchApiSpec,
    liferayEnsureFolder,
    ENRICH_FRIENDLY_LIMIT,
    getCachedResponse, setCachedResponse,
} from './liferay.js';
import { generateTemplateBuffer, parseExcelFromBuffer } from './excelTemplate.js';
import { buildIndex, findBestUrl } from './pageIndex.js';

function _formatDocSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
import { _apiSpecCache } from './cache.js';
import { buildField, normalizeFieldType, buildI18nLabel, validateFields } from './objectFieldBuilder.js';
import { ensureObjectExists, findObjectDefinitionWithFields, updateObjectField, addObjectField, deleteObjectField } from './objectManager.js';

/**
 * Risolve il restContextPath corretto per un Object tramite l'API object-admin.
 * Liferay REST endpoints sono case-sensitive: non ci inventiamo nulla, cerchiamo sempre
 * il restContextPath reale dalla definizione Object.
 */
const _objectRestPathCache = {};
async function resolveObjectRestPath(base, objectName, user, pass) {
    // Cache hit
    if (_objectRestPathCache[objectName]) return _objectRestPathCache[objectName];

    // Cerca sempre il restContextPath reale tramite object-admin
    try {
        // Il filtro eq di Liferay è case-insensitive, quindi 'fattura' trova 'Fattura'
        const filter = encodeURIComponent(`name eq '${objectName}'`);
        const data = await liferayGet(base, `/o/object-admin/v1.0/object-definitions?filter=${filter}&pageSize=1`, user, pass);
        const found = (data.items || [])[0];
        if (found && found.restContextPath) {
            _objectRestPathCache[objectName] = found.restContextPath;
            // Cache anche con il nome reale per hit futuri
            if (found.name && found.name !== objectName) {
                _objectRestPathCache[found.name] = found.restContextPath;
            }
            dbg(`resolveObjectRestPath: risolto "${objectName}" → "${found.restContextPath}"`);
            return found.restContextPath;
        }
    } catch (e) {
        dbg(`resolveObjectRestPath: errore ricerca object-admin per "${objectName}":`, e.message);
    }
    // Fallback ultimo: formato standard lowercase + 's'
    const fallbackPath = `/o/c/${objectName.toLowerCase()}s`;
    dbg(`resolveObjectRestPath: fallback per "${objectName}" → "${fallbackPath}"`);
    return fallbackPath;
}

const SC_BASE_PARAMS = (page = 1, pageSize = 8) => `page=${page}&pageSize=${pageSize}`;

const NO_SITE_TOOLS = new Set([
    'list_available_apis', 'get_api_spec', 'call_liferay_api',
    'get_current_user', 'get_users',
    'create_user', 'update_user', 'delete_user', 'get_user_detail',
    'get_available_roles', 'get_available_organizations', 'get_available_user_groups',
    'user_management_help',
    'create_role', 'update_role', 'delete_role',
    'create_organization',
    'update_organization', 'delete_organization',
    'create_user_group', 'update_user_group', 'delete_user_group',
    'assign_user_to_site', 'assign_role_to_user', 'remove_role_from_user', 'get_site_details',
    'create_site', 'update_site', 'delete_site',
    'list_master_pages', 'create_master_page', 'update_master_page', 'delete_master_page',
    'list_utility_pages', 'create_utility_page', 'update_utility_page', 'delete_utility_page',
    'create_object_entry', 'update_object_entry', 'delete_object_entry',
    'get_object_fields', 'update_object_field', 'add_object_field', 'delete_object_field',
    'create_object', 'delete_object',
    'create_content_structure', 'create_content_folder', 'list_content_folders', 'delete_content_folder', 'update_content_folder', 'create_object_entry_folder', 'list_object_entry_folders', 'delete_object_entry_folder', 'update_object_entry_folder', 'create_structured_content', 'update_structured_content',
    'pick_document', 'list_document_folders', 'list_folder_documents', 'upload_document',
    'generate_excel_template',
    'get_content_structure_fields',
    'update_space', 'delete_space', 'create_space', 'connect_space_site', 'disconnect_space_site',
    'assign_user_to_space', 'remove_user_from_space',
]);

export async function executeTool(name, input, cfg) {
    const base   = getBaseUrl(cfg.liferayUrl);
    const siteId = getSiteId(cfg.siteGroupId);
    const user   = cfg.lfUser;
    const pass   = cfg.lfPass;

    dbg(`Tool: ${name}`, input);

    if (!siteId && !NO_SITE_TOOLS.has(name)) {
        return { error: '⚠️ Site Group ID non configurato. Apri le impostazioni ⚙ e inserisci il Site Group ID (es. 12345). Questo campo è fondamentale: senza di esso il chatbot non può accedere ai contenuti, alle pagine, alle categorie e a tutte le API del portale Liferay.' };
    }

    const q  = encodeURIComponent(input.query || '');
    const ps = input.page_size || 8;
    const pg = input.page      || 1;

    try {
        if (name === 'search_content_advanced') {
            const searchQ = input.search || ''; const ps2 = input.page_size || 50; const pg2 = input.page || 1; const doEmbed = input.embed || false;
            const entryClassNames = input.entry_class_names || 'com.liferay.journal.model.JournalArticle';
            const cleanFilter = (input.filter || '').replace(/\s*and\s+siteId\s+eq\s+\d+/gi,'').replace(/siteId\s+eq\s+\d+\s+and\s*/gi,'').replace(/^\s*siteId\s+eq\s+\d+\s*$/gi,'').trim();
            let qs = `scope=${siteId}&pageSize=${ps2}&page=${pg2}`;
            if (searchQ) qs += `&search=${encodeURIComponent(searchQ)}`; if (cleanFilter) qs += `&filter=${encodeFilter(cleanFilter)}`; if (input.sort) qs += `&sort=${encodeURIComponent(input.sort)}`; if (entryClassNames) qs += `&entryClassNames=${encodeURIComponent(entryClassNames)}`; if (doEmbed) qs += `&nestedFields=embedded`;
            const data = await liferayGet(base, `/o/search/v1.0/search?${qs}`, user, pass);
            if (data.items) {
                data.items = data.items.map((item) => { const emb = item.embedded || {}; const briefs = emb.taxonomyCategoryBriefs || []; const taxonomyCategories = briefs.length > 0 ? briefs.map((b) => ({ id: b.taxonomyCategoryId, name: b.taxonomyCategoryName })) : (emb.taxonomyCategories || []); let contentId = emb.id || item.id || item.entryClassPK || null; if (!contentId && item.itemURL) { const m = item.itemURL.match(/\/structured-contents\/(\d+)/); if (m) contentId = m[1]; } const fup = emb.friendlyUrlPath || null; return { id: contentId, title: item.title || emb.title || emb.headline || null, friendlyUrlPath: fup, url: buildContentUrl(fup), datePublished: emb.datePublished || item.dateModified || null, description: emb.description || item.description || null, contentStructureName: emb.contentStructureName || null, taxonomyCategories, keywords: emb.keywords || [], score: item.score || null, itemURL: item.itemURL || null, ...(doEmbed ? { _embedded: emb } : {}) }; });
                const tnc = (input.title_not_contains || '').toLowerCase(); const tc = (input.title_contains || '').toLowerCase(); const teq = (input.title_eq || '').toLowerCase(); const tsw = (input.title_startswith || '').toLowerCase();
                const beforeCount = data.items.length;
                if (tnc) data.items = data.items.filter((it) => !(it.title || '').toLowerCase().includes(tnc));
                if (tc) data.items = data.items.filter((it) => (it.title || '').toLowerCase().includes(tc));
                if (teq) data.items = data.items.filter((it) => (it.title || '').toLowerCase() === teq);
                if (tsw) data.items = data.items.filter((it) => (it.title || '').toLowerCase().startsWith(tsw));
                const filteredCount = data.items.length; if (filteredCount !== beforeCount) { data._clientFiltered = true; data._totalCountBeforeFilter = data.totalCount; data.totalCount = filteredCount; }
            }
            dbg('search_content_advanced totalCount:', data.totalCount, 'items:', data.items?.length);
            return data;
        }

        if (name === 'search_web_content') {
            let qs = SC_BASE_PARAMS(pg, ps); if (q) qs = `search=${q}&` + qs; if (input.filter) qs += `&filter=${encodeFilter(input.filter)}`; if (input.sort) qs += `&sort=${encodeURIComponent(input.sort)}`;
            let data = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?${qs}`, user, pass);
            if ((data.totalCount === 0 || !data.items?.length) && (q || input.filter)) {
                try {
                    const JA = 'com.liferay.journal.model.JournalArticle'; const cleanFilter = (input.filter || '').replace(/\s*and\s+siteId\s+eq\s+\d+/gi,'').replace(/siteId\s+eq\s+\d+\s+and\s*/gi,'').replace(/^\s*siteId\s+eq\s+\d+\s*$/gi,'').trim();
                    let sqs = `scope=${siteId}&pageSize=${ps}&page=${pg}&entryClassNames=${encodeURIComponent(JA)}&emptySearch=true`; if (q) sqs += `&search=${q}`; if (cleanFilter) sqs += `&filter=${encodeFilter(cleanFilter)}`; if (input.sort) sqs += `&sort=${encodeURIComponent(input.sort)}`;
                    const sd = await liferayGet(base, `/o/search/v1.0/search?${sqs}`, user, pass);
                    if ((sd.totalCount || 0) > 0) { sd.items = (sd.items || []).map((item) => { const emb = item.embedded || {}; let contentId = item.entryClassPK || emb.id || item.id || null; if (!contentId && item.itemURL) { const m = item.itemURL.match(/\/structured-contents\/(\d+)/); if (m) contentId = m[1]; } const fup = emb.friendlyUrlPath || null; return { id: contentId, title: item.title || emb.title || null, friendlyUrlPath: fup, url: buildContentUrl(fup), datePublished: item.dateCreated || emb.datePublished || null, description: item.description || emb.description || null, contentStructureName: emb.contentStructureName || null, taxonomyCategories: (emb.taxonomyCategoryBriefs || []).map((b) => ({ id: b.taxonomyCategoryId, name: b.taxonomyCategoryName })), keywords: emb.keywords || [], score: item.score || null, itemURL: item.itemURL || null, _source: 'search_api_fallback' }; }); sd._fallback = 'search_api'; data = sd; }
                } catch (eFb) { dbg('search_web_content fallback fallito:', eFb.message); }
            }
            if (data.items && !data._fallback) {
                data.items = data.items.map(parseStructuredContentItem);
                const missing = data.items.filter((it) => !it.friendlyUrlPath && it.id).slice(0, ENRICH_FRIENDLY_LIMIT);
                await Promise.all(missing.map(async (it) => { const ck = `/structured-contents/${it.id}?fields=friendlyUrlPath`; const cached = getCachedResponse(ck); if (cached?.friendlyUrlPath) { it.friendlyUrlPath = cached.friendlyUrlPath; return; } try { const det = await liferayGet(base, `/o/headless-delivery/v1.0/structured-contents/${it.id}?fields=friendlyUrlPath`, user, pass); if (det?.friendlyUrlPath) { it.friendlyUrlPath = det.friendlyUrlPath; setCachedResponse(ck, { friendlyUrlPath: det.friendlyUrlPath }); } } catch (_) {} }));
                data.items.forEach((it) => { if (!it.url) it.url = buildContentUrl(it.friendlyUrlPath); });
            }
            return data;
        }

        if (name === 'get_structured_content_by_id') {
            if (!input.content_id) return { error: 'content_id obbligatorio' };
            const data = await liferayGet(base, `/o/headless-delivery/v1.0/structured-contents/${input.content_id}`, user, pass);
            return parseStructuredContentItem(data);
        }

        if (name === 'get_taxonomy_categories_by_ids') {
            const ids = input.category_ids || []; if (ids.length === 0) return { categories: [], total: 0 };
            const results = await Promise.allSettled(ids.map((id) => liferayGet(base, `/o/headless-admin-taxonomy/v1.0/taxonomy-categories/${id}?fields=id,name,description,taxonomyVocabularyId,taxonomyVocabularyName`, user, pass)));
            return { categories: results.map((r, i) => r.status === 'fulfilled' ? { id: ids[i], name: r.value.name, vocabulary: r.value.taxonomyVocabularyName } : { id: ids[i], error: r.reason?.message }), total: ids.length };
        }

        if (name === 'search_documents') {
            let qs = `pageSize=${ps}&flatten=true`; if (q) qs = `search=${q}&` + qs; if (input.filter) qs += `&filter=${encodeFilter(input.filter)}`; if (input.sort) qs += `&sort=${encodeURIComponent(input.sort)}`;
            const data = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/documents?${qs}`, user, pass);
            if (data.items) data.items = data.items.map((doc) => ({ ...doc, taxonomyCategories: (doc.taxonomyCategoryBriefs || []).map((b) => ({ id: b.taxonomyCategoryId, name: b.taxonomyCategoryName })) }));
            return data;
        }

        if (name === 'search_blog_posts') {
            let qs = `pageSize=${ps}`; if (q) qs = `search=${q}&` + qs; if (input.filter) qs += `&filter=${encodeFilter(input.filter)}`; if (input.sort) qs += `&sort=${encodeURIComponent(input.sort)}`;
            const data = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/blog-postings?${qs}`, user, pass);
            if (data.items) data.items = data.items.map((post) => ({ ...post, taxonomyCategories: (post.taxonomyCategoryBriefs || []).map((b) => ({ id: b.taxonomyCategoryId, name: b.taxonomyCategoryName })) }));
            return data;
        }

        if (name === 'search_pages') {
            let siteName = 'guest';
            try { const pageURL = window.Liferay?.ThemeDisplay?.getLayoutURL?.() || window.location.href; const match = pageURL.match(/\/web\/([^/]+)/); if (match && isNaN(Number(match[1]))) siteName = match[1]; } catch (_) {}
            const buildPageUrl = (fp) => { if (!fp) return null; if (fp.startsWith('/web/')) return `${base}${fp}`; const slug = fp.replace(/^\/web\/[^/]+/, '') || fp; return `${base}/web/${siteName}${slug}`; };
            const buildContentUrl = (fp) => { if (!fp) return null; const slug = fp.replace(/^\//, ''); return `${base}/-/${slug}`; };
            const queryStr = input.query || ''; const titleExact = input.title_eq || null;
            try {
                const idxRes = await findBestUrl({ baseUrl: base, siteId, query: queryStr, topN: 5, minScore: 0.2 });
                if (idxRes?.candidates?.length) { const items = idxRes.candidates.map((c) => { const fp = c.path || null; const url = buildPageUrl(fp) || null; return { title: c.title || '', friendlyUrlPath: fp, uuid: null, url, score: c.score }; }).filter((p) => p.url); if (items.length) return { items, totalCount: items.length, source: 'pageIndex' }; }
            } catch (eIdx) { dbg('pageIndex lookup failed:', eIdx.message || eIdx); }
            let data;
            if (titleExact || (queryStr.length > 2 && !queryStr.includes('*'))) {
                const filterTitle = titleExact || queryStr;
                try { const oDataFilter = encodeURIComponent(`title eq '${filterTitle.replace(/'/g, "''")}'`); data = await liferayGet(base, `/o/search/v1.0/search?emptySearch=true&scope=${siteId}&pageSize=${ps}&entryClassNames=com.liferay.portal.kernel.model.Layout&filter=${oDataFilter}`, user, pass); } catch (eA) { data = null; }
            }
            if (!data?.items?.length) { try { data = await liferayGet(base, `/o/search/v1.0/search?scope=${siteId}&search=${encodeURIComponent(queryStr)}&pageSize=${ps}&entryClassNames=com.liferay.portal.kernel.model.Layout`, user, pass); } catch (eB) { data = null; } }
            if (!data?.items?.length) { try { data = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages?pageSize=200&fields=title,friendlyUrlPath,uuid`, user, pass); if (data?.items && queryStr) { const qLow = queryStr.toLowerCase(); data.items = data.items.filter((p) => (p.title || '').toLowerCase().includes(qLow) || (p.friendlyUrlPath || '').toLowerCase().includes(qLow)); data.totalCount = data.items.length; } } catch (eC) { data = { items: [], totalCount: 0 }; } }
            if (data?.items) {
                data.items = data.items.map((item) => { const emb = item.embedded || {}; let fp = item.friendlyUrlPath || emb.friendlyUrlPath || null; if (!fp && item.itemURL) { try { const u = new URL(item.itemURL); const pm = u.pathname.match(/\/web\/[^/]+(.*)$/); if (pm && pm[1]) fp = pm[1]; else fp = u.pathname; } catch (_) { fp = item.itemURL; } } const title = item.title || emb.title || emb.name || ''; const url = buildPageUrl(fp) || item.itemURL || null; return { title, friendlyUrlPath: fp, uuid: item.uuid || emb.uuid || item.id || null, url, score: item.score || null }; }).filter((p) => p.url);
                // Enrich: se i risultati non hanno uuid, arricchisci con la delivery API
                const needEnrich = data.items.some((p) => !p.uuid);
                if (needEnrich) {
                    try {
                        const allPages = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages?pageSize=200`, user, pass);
                        const pageMap = new Map();
                        for (const p of (allPages.items || [])) {
                            const key = (p.title || '').toLowerCase();
                            if (!pageMap.has(key)) pageMap.set(key, p);
                            if (p.friendlyUrlPath) pageMap.set(p.friendlyUrlPath.toLowerCase(), p);
                        }
                        for (const item of data.items) {
                            if (!item.uuid) {
                                const match = pageMap.get(item.title.toLowerCase()) || (item.friendlyUrlPath ? pageMap.get(item.friendlyUrlPath.toLowerCase()) : null);
                                if (match) { item.uuid = match.uuid; item.friendlyUrlPath = item.friendlyUrlPath || match.friendlyUrlPath; }
                            }
                        }
                    } catch (eEnrich) { dbg('search_pages: enrich uuid fallito:', eEnrich.message); }
                }
                data.totalCount = data.items.length;
            }
            return data;
        }

        if (name === 'get_content_structures') { return await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/content-structures?pageSize=${input.page_size || 20}&fields=id,name,description`, user, pass); }

        if (name === 'get_content_structure_fields') {
            if (!input?.structure_id) return { error: 'structure_id obbligatorio. Usa get_content_structures per trovarlo.' };
            const result = await liferayGet(base, `/o/headless-delivery/v1.0/content-structures/${input.structure_id}`, user, pass);
            if (result?.contentStructureFields) {
                return {
                    id: result.id,
                    name: result.name,
                    fields: result.contentStructureFields.map(f => ({
                        name: f.name,
                        dataType: f.dataType,
                        label: f.label,
                        localizable: f.localizable,
                        required: f.required,
                        repeatable: f.repeatable,
                        inputControl: f.inputControl || '',
                        options: f.options || [],
                        nestedContentStructureFields: f.nestedContentStructureFields || [],
                    })),
                };
            }
            return result;
        }

        if (name === 'search_by_structure') {
            if (!input.structure_id) return { error: 'structure_id obbligatorio' };
            const sq = input.query ? encodeURIComponent(input.query) : ''; let qs = `pageSize=${input.page_size || 10}`; if (sq) qs = `search=${sq}&` + qs; qs += `&sort=${input.sort ? encodeURIComponent(input.sort) : encodeURIComponent('datePublished:desc')}`;
            const result = await liferayGet(base, `/o/headless-delivery/v1.0/content-structures/${input.structure_id}/structured-contents?${qs}`, user, pass);
            if (result.items) result.items = result.items.map(parseStructuredContentItem); return result;
        }

        if (name === 'get_available_languages') {
            if (window.Liferay?.ThemeDisplay) { const td = window.Liferay.ThemeDisplay; const available = td.getAvailableLocales?.(); if (available?.length) return { currentLanguage: td.getLanguageId?.() || null, availableLanguages: available, source: 'ThemeDisplay' }; }
            const site = await liferayGet(base, `/o/headless-admin-user/v1.0/sites/${siteId}?fields=availableLanguages,defaultLanguageId,name`, user, pass);
            return { defaultLanguage: site.defaultLanguageId, availableLanguages: site.availableLanguages || [], siteName: site.name };
        }

        if (name === 'get_current_user') {
            const td = window.Liferay?.ThemeDisplay; const isSignedIn = td && typeof td.isSignedIn === 'function' ? td.isSignedIn() : false;
            if (!isSignedIn) return { isSignedIn: false, message: 'Utente non autenticato.' };
            const basic = { isSignedIn: true, userId: td.getUserId?.() || null, userName: td.getUserName?.() || null, userEmail: td.getUserEmailAddress?.() || null };
            try { const me = await liferayGet(base, '/o/headless-admin-user/v1.0/my-user-account?fields=id,name,givenName,familyName,emailAddress,alternateName,jobTitle,roleBriefs', user, pass); return { ...basic, fullName: me.name, screenName: me.alternateName, emailAddress: me.emailAddress || basic.userEmail, jobTitle: me.jobTitle, roles: (me.roleBriefs || []).map((r) => r.name) }; } catch { return basic; }
        }

        if (name === 'get_categories') {
            if (input.vocabulary_name) {
                try {
                    const vdata = await liferayGet(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/taxonomy-vocabularies?pageSize=200&fields=id,name,description`, user, pass);
                    const found = (vdata.items || []).find((v) => (v.name || '').toLowerCase().includes((input.vocabulary_name || '').toLowerCase().trim()));
                    if (found?.id) { return await liferayGet(base, `/o/headless-admin-taxonomy/v1.0/taxonomy-vocabularies/${found.id}/taxonomy-categories?pageSize=${input.page_size || 200}&fields=id,name,description,taxonomyVocabularyId,taxonomyVocabularyName`, user, pass); }
                } catch (e) { dbg('get_categories by vocabulary failed:', e.message || e); }
            }
            const data = await liferayGet(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/taxonomy-categories?pageSize=${input.page_size || 50}&fields=id,name,description,taxonomyVocabularyId,taxonomyVocabularyName`, user, pass);
            if (data.items) { const byVocab = {}; for (const cat of data.items) { const v = cat.taxonomyVocabularyName || 'Default'; if (!byVocab[v]) byVocab[v] = []; byVocab[v].push({ id: cat.id, name: cat.name }); } data._groupedByVocabulary = byVocab; if (input.vocabulary_name) { const vn = input.vocabulary_name.toLowerCase(); data.items = data.items.filter((c) => (c.taxonomyVocabularyName || '').toLowerCase().includes(vn)); } }
            return data;
        }

        if (name === 'get_vocabularies') { try { return await liferayGet(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/taxonomy-vocabularies?pageSize=${input.page_size || 50}&fields=id,name,description,siteId`, user, pass); } catch (e) { return { error: e.message || String(e), items: [] }; } }

        if (name === 'get_tags') { return await liferayGet(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/keywords?pageSize=${input.page_size || 50}&fields=id,name`, user, pass); }

        // create_category, create_vocabulary, create_site_page — logica completa
        if (name === 'create_category' || name === 'create_vocabulary' || name === 'create_site_page') {
            // Recupera lingue
            let langsInfo = null;
            try { langsInfo = await executeTool('get_available_languages', {}, cfg); } catch (e) { /* ignore */ }
            const available = (langsInfo?.availableLanguages) || [];
            const rawDefault = langsInfo?.defaultLanguage || langsInfo?.defaultLanguageId || langsInfo?.currentLanguage || null;
            const mapToAvail = (raw) => { if (!raw) return available[0] || null; if (available.includes(raw)) return raw; const lower = raw.toLowerCase(); if (raw.length === 2) { const f = available.find((a) => a.toLowerCase().startsWith(lower)); if (f) return f; } const v1 = raw.includes('-') ? raw.replace(/-/g,'_') : null; const v2 = raw.includes('_') ? raw.replace(/_/g,'-') : null; for (const v of [v1,v2].filter(Boolean)) { const m = available.find((a) => a.toLowerCase() === v.toLowerCase()); if (m) return m; } return available[0] || raw; };
            const defaultLang = mapToAvail(rawDefault);
            const normalizeI18n = (src) => { if (!src || typeof src !== 'object') return src; const out = {}; for (const k of Object.keys(src)) { if (available.includes(k)) { out[k] = src[k]; continue; } const lower = k.toLowerCase(); const found = available.find((a) => a.toLowerCase().startsWith(lower)); if (found) { out[found] = src[k]; continue; } if (k.length === 2) { const candidate = `${k}_${k.toUpperCase()}`; const match = available.find((a) => a.toLowerCase() === candidate.toLowerCase()); if (match) { out[match] = src[k]; continue; } } if (defaultLang) { out[defaultLang] = out[defaultLang] || src[k]; } } return out; };

            if (name === 'create_category') {
                if (!input?.name) return { error: 'name obbligatorio' };
                const body = {}; ['name','description','externalReferenceCode','viewableBy'].forEach((k) => { if (input[k] !== undefined) body[k] = input[k]; });
                body.name_i18n = input.name_i18n ? normalizeI18n(input.name_i18n) : (defaultLang ? { [defaultLang]: input.name } : undefined);
                if (input.description_i18n) body.description_i18n = normalizeI18n(input.description_i18n); else if (input.description && defaultLang) body.description_i18n = { [defaultLang]: input.description };
                if (input.parentTaxonomyCategory) body.parentTaxonomyCategory = input.parentTaxonomyCategory; if (input.parentTaxonomyVocabulary) body.parentTaxonomyVocabulary = input.parentTaxonomyVocabulary; if (input.taxonomyVocabularyId !== undefined) body.taxonomyVocabularyId = Number(input.taxonomyVocabularyId); if (Array.isArray(input.permissions)) body.permissions = input.permissions; if (Array.isArray(input.taxonomyCategoryProperties)) body.taxonomyCategoryProperties = input.taxonomyCategoryProperties;
                try { return await liferayPost(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/taxonomy-categories`, body, user, pass); } catch (e) { return { error: e.message || String(e) }; }
            }

            if (name === 'create_vocabulary') {
                if (!input?.name) return { error: 'name obbligatorio' };
                const body = {}; ['name','description','externalReferenceCode','viewableBy','visibilityType'].forEach((k) => { if (input[k] !== undefined) body[k] = input[k]; });
                body.name_i18n = input.name_i18n ? normalizeI18n(input.name_i18n) : (defaultLang ? { [defaultLang]: input.name } : undefined);
                if (input.description_i18n) body.description_i18n = normalizeI18n(input.description_i18n); else if (input.description && defaultLang) body.description_i18n = { [defaultLang]: input.description };
                if (typeof input.multiValued !== 'undefined') body.multiValued = Boolean(input.multiValued); if (Array.isArray(input.assetLibraries)) body.assetLibraries = input.assetLibraries; if (Array.isArray(input.assetTypes)) body.assetTypes = input.assetTypes; if (Array.isArray(input.permissions)) body.permissions = input.permissions;
                try { return await liferayPost(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/taxonomy-vocabularies`, body, user, pass); } catch (e) { return { error: e.message || String(e) }; }
            }

            if (name === 'create_site_page') {
                if (!input?.title) return { error: 'title obbligatorio', missing_fields: ['title'] };
                const PAGE_TYPE_MAP = { 'contentpage':'Pagina contenuto','content page':'Pagina contenuto','content':'Pagina contenuto','pagina contenuto':'Pagina contenuto','widgetpage':'Pagina widget','widget page':'Pagina widget','widget':'Pagina widget','pagina widget':'Pagina widget' };
                if (input.pageType) { const mapped = PAGE_TYPE_MAP[input.pageType.toLowerCase().trim()]; input.pageType = mapped || input.pageType; }
                const body = {}; ['pageType','viewableBy','datePublished'].forEach((k) => { if (input[k] !== undefined) body[k] = input[k]; });
                body.title_i18n = input.title_i18n ? normalizeI18n(input.title_i18n) : (defaultLang ? { [defaultLang]: input.title } : undefined);
                if (!body.title_i18n) body.title = input.title;
                if (input.friendlyUrlPath_i18n) body.friendlyUrlPath_i18n = normalizeI18n(input.friendlyUrlPath_i18n); else if (input.friendlyUrlPath) body.friendlyUrlPath = input.friendlyUrlPath.startsWith('/') ? input.friendlyUrlPath : '/' + input.friendlyUrlPath;
                if (Array.isArray(input.keywords)) body.keywords = input.keywords; if (Array.isArray(input.taxonomyCategoryIds)) body.taxonomyCategoryIds = input.taxonomyCategoryIds.map(Number); if (input.pageDefinition) body.pageDefinition = input.pageDefinition; if (input.pageSettings) body.pageSettings = input.pageSettings; if (input.parentSitePage) body.parentSitePage = input.parentSitePage;
                // When creating a child page (parentSitePage is set), Liferay does not accept friendlyUrlPath — it generates it from the title
                if (body.parentSitePage && body.friendlyUrlPath) {
                    dbg('create_site_page: removing friendlyUrlPath because parentSitePage is set — Liferay generates it from title');
                    delete body.friendlyUrlPath;
                }
                if (!body.title) { if (body.title_i18n) { const v = defaultLang && body.title_i18n[defaultLang] ? body.title_i18n[defaultLang] : Object.values(body.title_i18n).find((v) => v?.trim()); if (v) body.title = v; } if (!body.title) body.title = input.title; }
                if (!body.title_i18n && body.title && defaultLang) body.title_i18n = { [defaultLang]: body.title };
                // resolve parent
                let parentName = null; if (input.parentSitePage && typeof input.parentSitePage === 'string') parentName = input.parentSitePage; if (!parentName && input.parentTitle) parentName = input.parentTitle; if (!parentName && input.parentName) parentName = input.parentName;
                if (parentName && !input.parentSitePage?.friendlyUrlPath) { try { const sp = await executeTool('search_pages', { query: parentName, title_eq: parentName, page_size: 5 }, cfg); const found = sp?.items?.[0]; if (found?.friendlyUrlPath) body.parentSitePage = { friendlyUrlPath: found.friendlyUrlPath }; } catch (e) { /* ignore */ } }
                if (body.parentSitePage?.friendlyUrlPath === '/') { try { const sp = await executeTool('search_pages', { query: 'Home', title_eq: 'Home', page_size: 5 }, cfg); const found = sp?.items?.[0]; if (found?.friendlyUrlPath && found.friendlyUrlPath !== '/') { dbg('create_site_page: risolto parentSitePage / →', found.friendlyUrlPath); body.parentSitePage = { friendlyUrlPath: found.friendlyUrlPath }; } } catch (e) { /* ignore */ } }
                if (!body.title_i18n && !body.title) return { error: 'Campi mancanti per creare la pagina', missing_fields: ['title'] };
                // Master Page association: if masterPageKey is provided, inject it into pageDefinition.settings.masterPage
                if (input.masterPageKey) {
                    if (!body.pageDefinition) body.pageDefinition = {};
                    if (!body.pageDefinition.settings) body.pageDefinition.settings = {};
                    body.pageDefinition.settings.masterPage = { key: input.masterPageKey };
                }
                try { return await liferayPost(base, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages`, body, user, pass); } catch (e) { return { error: e.message || String(e) }; }
            }
        }

        if (name === 'search_by_category') {
            if (!input.category_id && input.category_name) { try { const cats = await executeTool('get_categories', { page_size: 200 }, cfg); const found = (cats.items || []).find((c) => (c.name || '').toLowerCase().includes((input.category_name || '').toLowerCase().trim())); if (found) input.category_id = found.id; else return { error: `Nessuna categoria trovata: ${input.category_name}`, totalCount: 0, items: [] }; } catch (e) { return { error: e.message, totalCount: 0, items: [] }; } }
            if (!input.category_id) return { error: 'category_id obbligatorio' };
            const cq = input.query ? encodeURIComponent(input.query) : ''; const catPs = input.page_size || 10;
            try { let qs = `pageSize=${catPs}`; if (cq) qs = `search=${cq}&` + qs; const result = await liferayGet(base, `/o/headless-delivery/v1.0/taxonomy-categories/${input.category_id}/structured-contents?${qs}`, user, pass); if (result.items) result.items = result.items.map(parseStructuredContentItem); if ((result.totalCount || 0) > 0) return result; throw new Error('zero results'); } catch (_) { /* fallback */ }
            try { const catFilter = `taxonomyCategoryIds/any(c:c eq ${input.category_id})`; let qs = `filter=${encodeFilter(catFilter)}&pageSize=${catPs}`; if (cq) qs = `search=${cq}&` + qs; const result = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?${qs}`, user, pass); if (result.items) result.items = result.items.map(parseStructuredContentItem); return result; } catch (e2) { return { error: e2.message, totalCount: 0, items: [] }; }
        }

        if (name === 'search_by_tag') { if (!input.tag) return { error: 'tag obbligatorio' }; const filter = buildKeywordFilter(input.tag); const result = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?filter=${encodeFilter(filter)}&pageSize=${input.page_size || 10}`, user, pass); if (result.items) result.items = result.items.map(parseStructuredContentItem); return result; }

        if (name === 'create_keyword') {
            if (!input?.name) return { error: 'name obbligatorio' };
            const body = { name: input.name };
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (Array.isArray(input.assetLibraries)) body.assetLibraries = input.assetLibraries;
            if (input.creator && typeof input.creator === 'object') body.creator = input.creator;
            try { return await liferayPost(base, `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/keywords`, body, user, pass); } catch (e) { return { error: e.message || String(e) }; }
        }

        // Create a DDM FreeMarker template via JSON-WS
        if (name === 'create_ddm_template') {
            const templateName = input?.name;
            const script = input?.script;
            const groupId = input?.groupId || siteId;
            const classNameId = input?.classNameId;
            const classPK = input?.classPK;
            const resourceClassNameId = input?.resourceClassNameId;

            if (!templateName || !script || !classNameId || !classPK || !resourceClassNameId) {
                return { error: 'Missing required fields: name, script, classNameId, classPK, resourceClassNameId' };
            }

            try {
                const tpl = await createDDMTemplateViaJsonWS({ baseUrl: base, groupId, classNameId, classPK, resourceClassNameId, name: templateName, description: input?.description || '', script, user, pass });
                return { success: true, template: tpl };
            } catch (e) {
                return { error: e.message || String(e) };
            }
        }

        // ── CATEGORY UPDATE / DELETE ──────────────────────────────────────────

        if (name === 'update_category') {
            if (!input?.category_id) return { error: 'category_id obbligatorio' };
            const body = {};
            if (input.name) body.name = input.name;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description !== undefined) body.description = input.description;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.parentTaxonomyCategoryId !== undefined) body.parentTaxonomyCategoryId = input.parentTaxonomyCategoryId;
            if (Array.isArray(input.taxonomyCategoryProperties)) body.taxonomyCategoryProperties = input.taxonomyCategoryProperties;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (name, description, ecc.)' };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-taxonomy/v1.0/taxonomy-categories/${input.category_id}`, body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Categoria "${result.name || input.category_id}" aggiornata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_category') {
            if (!input?.category_id) return { error: 'category_id obbligatorio' };
            try {
                await liferayDelete(base, `/o/headless-admin-taxonomy/v1.0/taxonomy-categories/${input.category_id}`, user, pass);
                return { success: true, message: `Categoria con ID ${input.category_id} eliminata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── VOCABULARY UPDATE / DELETE ─────────────────────────────────────────

        if (name === 'update_vocabulary') {
            if (!input?.vocabulary_id) return { error: 'vocabulary_id obbligatorio' };
            const body = {};
            if (input.name) body.name = input.name;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description !== undefined) body.description = input.description;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.multiValued !== undefined) body.multiValued = Boolean(input.multiValued);
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (name, description, ecc.)' };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-taxonomy/v1.0/taxonomy-vocabularies/${input.vocabulary_id}`, body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Vocabolario "${result.name || input.vocabulary_id}" aggiornato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_vocabulary') {
            if (!input?.vocabulary_id) return { error: 'vocabulary_id obbligatorio' };
            try {
                await liferayDelete(base, `/o/headless-admin-taxonomy/v1.0/taxonomy-vocabularies/${input.vocabulary_id}`, user, pass);
                return { success: true, message: `Vocabolario con ID ${input.vocabulary_id} eliminato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── KEYWORD (TAG) UPDATE / DELETE ───────────────────────────────────────

        if (name === 'update_keyword') {
            if (!input?.keyword_id) return { error: 'keyword_id obbligatorio' };
            if (!input?.name) return { error: 'name obbligatorio' };
            const body = { name: input.name };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-taxonomy/v1.0/keywords/${input.keyword_id}`, body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Tag "${result.name}" aggiornato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_keyword') {
            if (!input?.keyword_id) return { error: 'keyword_id obbligatorio' };
            try {
                await liferayDelete(base, `/o/headless-admin-taxonomy/v1.0/keywords/${input.keyword_id}`, user, pass);
                return { success: true, message: `Tag con ID ${input.keyword_id} eliminato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── SITE PAGE UPDATE / DELETE ──────────────────────────────────────────

        if (name === 'update_site_page') {
            if (!input?.page_id) return { error: 'page_id obbligatorio' };
            const body = {};
            if (input.title) body.title = input.title;
            if (input.title_i18n) body.title_i18n = input.title_i18n;
            if (input.friendlyUrlPath) body.friendlyUrlPath = input.friendlyUrlPath;
            if (input.friendlyUrlPath_i18n) body.friendlyUrlPath_i18n = input.friendlyUrlPath_i18n;
            if (Array.isArray(input.keywords)) body.keywords = input.keywords;
            if (Array.isArray(input.taxonomyCategoryIds)) body.taxonomyCategoryIds = input.taxonomyCategoryIds.map(Number);
            if (input.pageDefinition) body.pageDefinition = input.pageDefinition;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            if (input.datePublished) body.datePublished = input.datePublished;
            // Master Page association: if masterPageKey is provided, inject it into pageDefinition.settings.masterPage
            if (input.masterPageKey) {
                if (!body.pageDefinition) body.pageDefinition = {};
                if (!body.pageDefinition.settings) body.pageDefinition.settings = {};
                body.pageDefinition.settings.masterPage = { key: input.masterPageKey };
            }
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (title, friendlyUrlPath, ecc.)' };
            // Se title è fornito senza title_i18n, genera title_i18n
            if (body.title && !body.title_i18n) {
                try {
                    const langsInfo = await executeTool('get_available_languages', {}, cfg);
                    const defaultLang = langsInfo?.defaultLanguage || langsInfo?.currentLanguage || 'it_IT';
                    body.title_i18n = { [defaultLang]: body.title };
                } catch (_) { /* ignore */ }
            }
            try {
                const result = await liferayPatch(base, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages/${input.page_id}`, body, user, pass);
                return { success: true, id: result.id, title: result.title, friendlyUrlPath: result.friendlyUrlPath, message: `Pagina "${result.title || input.page_id}" aggiornata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_site_page') {
            if (!input?.page_id) return { error: 'page_id obbligatorio. Puoi fornire l\'ID numerico, il titolo o il friendlyUrlPath della pagina.' };

            // STEP 1: Recupera siteExternalReferenceCode
            let siteERC = siteId;
            try {
                const sitesData = await liferayGet(base, '/o/headless-admin-site/v1.0/sites?fields=id,externalReferenceCode,name', user, pass);
                const site = (sitesData.items || []).find((s) => String(s.id) === String(siteId));
                if (site?.externalReferenceCode) siteERC = site.externalReferenceCode;
            } catch (e) { dbg('delete_site_page: recupero siteERC fallito, uso siteId:', e.message); }

            // Helper: estrai valore localizzato da name_i18n o friendlyUrlPath_i18n
            const getLocalizedValue = (i18nObj) => {
                if (!i18nObj || typeof i18nObj !== 'object') return '';
                return i18nObj['it-IT'] || i18nObj['en-US'] || Object.values(i18nObj)[0] || '';
            };

            // STEP 2: Cerca la pagina e recupera il suo externalReferenceCode
            let pageERC = null;
            let pageInfo = null;
            const pageIdInput = String(input.page_id);
            try {
                const pagesData = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteERC}/site-pages`, user, pass);
                const page = (pagesData.items || []).find((p) => {
                    const pName = getLocalizedValue(p.name_i18n);
                    const pPath = getLocalizedValue(p.friendlyUrlPath_i18n);
                    return String(p.id) === pageIdInput ||
                        p.externalReferenceCode === pageIdInput ||
                        p.uuid === pageIdInput ||
                        pPath === pageIdInput ||
                        pPath.replace(/^\//, '') === pageIdInput ||
                        (pName && pName.toLowerCase() === pageIdInput.toLowerCase()) ||
                        (p.title && p.title.toLowerCase() === pageIdInput.toLowerCase());
                });
                if (page) {
                    pageERC = page.externalReferenceCode;
                    pageInfo = { ...page, title: page.title || getLocalizedValue(page.name_i18n), friendlyUrlPath: page.friendlyUrlPath || getLocalizedValue(page.friendlyUrlPath_i18n) };
                }
            } catch (e) { dbg('delete_site_page: ricerca pagina fallita:', e.message); }

            // Fallback: cerca nella delivery API se non trovata nella admin API
            if (!pageERC) {
                try {
                    const deliveryData = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages?pageSize=200`, user, pass);
                    const page = (deliveryData.items || []).find((p) =>
                        String(p.id) === pageIdInput ||
                        p.uuid === pageIdInput ||
                        (p.friendlyUrlPath && (p.friendlyUrlPath === pageIdInput || p.friendlyUrlPath.replace(/^\//, '') === pageIdInput)) ||
                        (p.title && p.title.toLowerCase() === pageIdInput.toLowerCase())
                    );
                    if (page) {
                        pageERC = page.uuid;
                        pageInfo = page;
                    }
                } catch (e2) { dbg('delete_site_page: fallback delivery API fallito:', e2.message); }
            }

            if (!pageERC) {
                return { error: `Pagina "${input.page_id}" non trovata. Verifica l'ID, il titolo o il friendlyUrlPath.`, page_id: input.page_id };
            }

            // STEP 3: Elimina la pagina usando gli external reference code
            try {
                await liferayDelete(base, `/o/headless-admin-site/v1.0/sites/${siteERC}/site-pages/${pageERC}`, user, pass);
                return { success: true, message: `Pagina "${pageInfo.title || pageERC}" eliminata con successo`, pageId: pageInfo.id, pageERC };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'create_object') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            if (!input?.label_en) return { error: 'label_en obbligatorio' };
            if (!input?.label_it) return { error: 'label_it obbligatorio' };
            if (!Array.isArray(input?.fields) || input.fields.length === 0) return { error: 'fields deve essere un array non vuoto' };

            try {
                // Costruisci field definitions
                const fields = input.fields.map((f) => {
                    const fType = normalizeFieldType(f.type || 'TEXT');
                    return buildField(
                        f.name,
                        buildI18nLabel(f.label_en || f.name, f.label_it || f.name),
                        fType,
                        { required: Boolean(f.required), indexed: Boolean(f.indexed) }
                    );
                });

                validateFields(fields);

                const labels = buildI18nLabel(input.label_en, input.label_it);
                const scope = input.scope || 'company';
                const restPath = `/o/c/${input.object_name.toLowerCase()}s`;
                const folderErc = input.objectFolderExternalReferenceCode || null;
                const titleField = input.title_field || null;

                // Crea Object
                await ensureObjectExists(base, input.object_name, labels, fields, restPath, scope, user, pass, folderErc, titleField);

                return {
                    success: true,
                    message: `Object ${input.object_name} creato con successo.`,
                    objectName: input.object_name,
                    restEndpoint: restPath,
                    fieldsCount: fields.length,
                    scope: scope,
                    titleObjectFieldName: titleField || (fields.find((f) => f.type === 'String' && f.indexed)?.name) || null,
                    objectFolderExternalReferenceCode: folderErc || (scope === 'depot' ? 'L_CMS_CONTENT_STRUCTURES' : undefined),
                };
            } catch (e) {
                return { error: e.message || String(e), object_name: input.object_name };
            }
        }

        // ── DELETE OBJECT ──────────────────────────────────────────────────────
        if (name === 'delete_object') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            try {
                // Cerca l'Object per name per ottenere l'ID
                const filter = encodeURIComponent(`name eq '${input.object_name}'`);
                const data = await liferayGet(base, `/o/object-admin/v1.0/object-definitions?filter=${filter}&pageSize=1`, user, pass);
                const found = (data.items || [])[0];
                if (!found) return { error: `Object "${input.object_name}" non trovato.` };
                const objId = found.id;
                await liferayDelete(base, `/o/object-admin/v1.0/object-definitions/${objId}`, user, pass);
                return { success: true, message: `Object "${input.object_name}" (ID: ${objId}) eliminato con successo` };
            } catch (e) { return { error: e.message || String(e), object_name: input.object_name }; }
        }

        // ── CREATE CONTENT STRUCTURE ──────────────────────────────────────────
        if (name === 'create_content_structure') {
            if (!input?.name) return { error: 'name obbligatorio per creare una struttura di contenuto.' };
            if (!Array.isArray(input?.fields) || input.fields.length === 0) return { error: 'fields deve essere un array non vuoto.' };

            // Usa la lingua default del portale e le lingue disponibili
            const lang = window.Liferay?.ThemeDisplay?.getDefaultLanguageId?.() || 'en_US';
            const rawLangs = window.Liferay?.ThemeDisplay?.getAvailableLocales?.() || [lang];
            const allLangs = rawLangs.map((l) => l.replace(/-/g, '_'));
            dbg(`create_content_structure: defaultLang=${lang}, allLangs=${allLangs.join(',')}`);
            const fieldTypes = input.fields;

            // Build customProperties per ogni tipo di campo
            function buildCustomProperties(field) {
                const ft = field.fieldType;
                const ref = field.name;
                const base = {
                    fieldNamespace: '',
                    requiredErrorMessage: { [lang]: '' },
                    visibilityExpression: '',
                    objectFieldName: '',
                    fieldReference: ref,
                };

                switch (ft) {
                    case 'text':
                        return { ...base, labelAtStructureLevel: true, hideField: false, confirmationErrorMessage: { [lang]: '' }, dataType: 'string', tooltip: { [lang]: '' }, requireConfirmation: false, displayStyle: 'singleline', options: {}, nativeField: false, confirmationLabel: { [lang]: '' }, placeholder: { [lang]: '' }, htmlAutocompleteAttribute: '', direction: ['vertical'] };
                    case 'rich_text':
                        return { ...base, editorConfig: '{}', dataType: 'string' };
                    case 'numeric':
                        return { ...base, dataType: 'number' };
                    case 'date':
                        return { ...base, labelAtStructureLevel: true, dataType: 'date', nativeField: false, htmlAutocompleteAttribute: '' };
                    case 'date_time':
                        return { rulesActionDisabled: true, requiredErrorMessage: { [lang]: '' }, objectFieldName: '', rulesConditionDisabled: true, dataType: 'datetime', fieldReference: ref };
                    case 'checkbox':
                        return { ...base, labelAtStructureLevel: true, dataType: 'boolean', options: {}, showAsSwitcher: false };
                    case 'select':
                        return { ...base, labelAtStructureLevel: true, ddmDataProviderInstanceId: [], dataType: 'string', multiple: false, alphabeticalOrder: false, ddmDataProviderInstanceOutput: [], options: { [lang]: (field.options || []).map((o) => ({ reference: o.value, label: o.label, value: o.value })) }, nativeField: false, dataSourceType: ['manual'] };
                    case 'color':
                        return { ...base, dataType: 'string' };
                    case 'geolocation':
                        return { dataType: 'geolocation', fieldReference: ref };
                    case 'image':
                        return { ...base, dataType: 'image', requiredDescription: true };
                    case 'document_library':
                        return { ...base, labelAtStructureLevel: true, allowGuestUsers: false, dataType: 'document-library' };
                    case 'link_to_layout':
                        return { fieldNamespace: '', visibilityExpression: '', dataType: 'link-to-page', fieldReference: ref };
                    case 'journal_article':
                        return { fieldNamespace: '', visibilityExpression: '', dataType: 'journal-article', fieldReference: ref };
                    case 'separator':
                        return { rulesConditionDisabled: true, dataType: '', fieldReference: ref, style: { [lang]: '' } };
                    case 'checkbox_multiple':
                        return { ...base, labelAtStructureLevel: true, inline: false, dataType: 'string', options: { [lang]: (field.options || []).map((o) => ({ reference: o.value, label: o.label, value: o.value })) }, nativeField: false, showAsSwitcher: false };
                    case 'grid':
                        return { ...base, columns: { [lang]: (field.grid_columns || []).map((c) => ({ reference: c.value, label: c.label, value: c.value })) }, dataType: 'string', rows: { [lang]: (field.grid_rows || []).map((r) => ({ reference: r.value, label: r.label, value: r.value })) } };
                    default:
                        return { ...base, dataType: 'string' };
                }
            }

            // Build defaultValue per tipo
            function buildDefaultValue(ft) {
                switch (ft) {
                    case 'checkbox': return { [lang]: ['false'] };
                    case 'select': case 'checkbox_multiple': return { [lang]: [] };
                    case 'image': return { [lang]: {} };
                    default: return { [lang]: '' };
                }
            }

            // Build indexType per tipo
            function getIndexType(ft) {
                const textTypes = ['text', 'select', 'checkbox', 'color', 'date', 'date_time', 'link_to_layout', 'geolocation', 'journal_article', 'document_library', 'checkbox_multiple', 'grid', 'numeric'];
                if (ft === 'rich_text' || ft === 'image') return 'text';
                if (textTypes.includes(ft)) return 'keyword';
                return '';
            }

            try {
                const dataDefinitionFields = fieldTypes.map((f) => {
                    // Build label for all available languages
                    const label = {};
                    allLangs.forEach((l) => { label[l] = f.label_it || f.name; });
                    // Override with specific language labels if provided
                    if (f.label_en) { allLangs.forEach((l) => { if (l.startsWith('en') || l === 'en_US' || l === 'en-GB') label[l] = f.label_en; }); }
                    if (f.label_it) { allLangs.forEach((l) => { if (l.startsWith('it') || l === 'it_IT' || l === 'it-IT') label[l] = f.label_it; }); }

                    return {
                    name: f.name,
                    fieldType: f.fieldType,
                    indexType: getIndexType(f.fieldType),
                    indexable: f.fieldType !== 'separator',
                    label,
                    localizable: !['date_time', 'separator'].includes(f.fieldType),
                    readOnly: false,
                    repeatable: false,
                    required: false,
                    showLabel: true,
                    tip: { [lang]: '' },
                    defaultValue: buildDefaultValue(f.fieldType),
                    nestedDataDefinitionFields: [],
                    customProperties: buildCustomProperties(f),
                }; });

                const layoutRows = fieldTypes.map((f) => ({
                    dataLayoutColumns: [{ columnSize: 12, fieldNames: [f.name] }],
                }));

                // Build name/description for all available languages
                const nameI18n = {}; allLangs.forEach((l) => { nameI18n[l] = input.name; });
                const descI18n = {}; allLangs.forEach((l) => { descI18n[l] = input.description || ''; });

                const body = {
                    availableLanguageIds: allLangs,
                    defaultLanguageId: lang,
                    name: nameI18n,
                    description: descI18n,
                    dataDefinitionFields,
                    defaultDataLayout: {
                        dataLayoutPages: [{
                            dataLayoutRows: layoutRows,
                            description: { [lang]: '' },
                            title: { [lang]: '' },
                        }],
                        dataRules: [],
                        paginationMode: 'single-page',
                        name: { [lang]: input.name },
                    },
                };

                const result = await liferayPost(base, `/o/data-engine/v2.0/sites/${siteId}/data-definitions/by-content-type/journal`, body, user, pass);

                return {
                    success: true,
                    message: `Struttura di contenuto "${input.name}" creata con successo`,
                    structureId: result.id,
                    structureName: input.name,
                    fieldsCount: dataDefinitionFields.length,
                    fieldNames: dataDefinitionFields.map((f) => `${f.name} [${f.fieldType}]`),
                };
            } catch (e) {
                return { error: e.message || String(e), structureName: input.name };
            }
        }

        // ── Helper: convert field values to the correct format based on dataType ──
        // Used by both create_structured_content and update_structured_content
        // - date fields: Liferay requires ISO-8601 (e.g. "2026-04-20T00:00:00Z")
        // - date_time fields: Liferay requires "yyyy-MM-dd HH:mm" (e.g. "2026-04-20 22:30")
        //   ISO-8601 with T causes "Invalid date" in the UI
        // - grid fields: Liferay requires JSON with lowercase value keys/values
        //   e.g. {"organizzazione":"ottimo","contenuti":"sufficiente"}
        //   Using labels with uppercase causes 400 error "valori inseriti non sono validi"
        // - other fields: pass through as-is
        const convertFieldValue = (val, dataType) => {
            if (!val || typeof val !== 'string') return val || '';
            if (dataType === 'date') {
                // date field: ensure ISO-8601 format
                // If it's just "yyyy-MM-dd", convert to ISO-8601
                const dateOnlyMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (dateOnlyMatch) {
                    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T00:00:00Z`;
                }
                return val; // already ISO-8601 or other format, pass through
            }
            if (dataType === 'datetime') {
                // date_time field: convert ISO-8601 to "yyyy-MM-dd HH:mm"
                const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                if (isoMatch) {
                    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]} ${isoMatch[4]}:${isoMatch[5]}`;
                }
                return val; // already in correct format or other, pass through
            }
            if (dataType === 'grid') {
                // grid field: force all keys and values to lowercase
                // Liferay only accepts lowercase value references, not labels
                try {
                    const gridObj = JSON.parse(val);
                    const lowercased = {};
                    for (const [k, v] of Object.entries(gridObj)) {
                        lowercased[String(k).toLowerCase()] = String(v).toLowerCase();
                    }
                    return JSON.stringify(lowercased);
                } catch (e) {
                    dbg(`convertFieldValue: grid value is not valid JSON, passing through: ${val}`);
                    return val;
                }
            }
            // Fallback: if dataType is 'string' and value looks like a JSON object,
            // it's likely a grid field — force lowercase keys/values
            if (dataType === 'string' && val.trim().startsWith('{') && val.trim().endsWith('}')) {
                try {
                    const parsed = JSON.parse(val);
                    if (typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
                        const lowercased = {};
                        for (const [k, v] of Object.entries(parsed)) {
                            lowercased[String(k).toLowerCase()] = String(v).toLowerCase();
                        }
                        return JSON.stringify(lowercased);
                    }
                } catch (e) {
                    // Not valid JSON, pass through as-is
                }
            }
            return val; // other field types, pass through
        };

        // ── CREATE STRUCTURED CONTENT (Journal Article) ────────────────────────
        if (name === 'create_content_folder') {
            if (!input?.name) return { error: 'name obbligatorio per creare una cartella.' };
            const folderBody = { name: input.name };
            if (input.description) folderBody.description = input.description;
            try {
                let url;
                if (input.parent_folder_id) {
                    url = `/o/headless-delivery/v1.0/structured-content-folders/${input.parent_folder_id}/structured-content-folders`;
                } else {
                    url = `/o/headless-delivery/v1.0/sites/${siteId}/structured-content-folders`;
                }
                const result = await liferayPost(base, url, folderBody, user, pass);
                return { id: result.id, name: result.name, description: result.description || '', parentFolderId: result.parentStructuredContentFolderId || 0, siteId: result.siteId, message: `Cartella "${result.name}" creata con successo (ID: ${result.id})` };
            } catch (e) {
                return { error: `Errore nella creazione della cartella: ${e.message}` };
            }
        }

        // ── CREATE OBJECT ENTRY FOLDER (in Space/Asset Library) ──────────────
        if (name === 'create_object_entry_folder') {
            if (!input?.label) return { error: 'label obbligatorio per creare una cartella Object Entry.' };
            const folderLabel = input.label;
            const folderTitle = input.title || folderLabel;
            const folderBody = { label: folderLabel, title: folderTitle };
            if (input.description) folderBody.description = input.description;

            try {
                // Resolve scopeKey: use provided one, or find first available Space
                let scopeKey = input.scope_key || null;
                if (!scopeKey) {
                    let assetLibraries = [];
                    try {
                        const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass);
                        assetLibraries = libData.items || [];
                    } catch (_) { /* ignore */ }
                    if (assetLibraries.length > 0) {
                        scopeKey = assetLibraries[0].name || assetLibraries[0].externalReferenceCode || String(assetLibraries[0].id);
                    } else {
                        return { error: 'Nessuno Space disponibile. Specifica scope_key o crea prima uno Space.' };
                    }
                }

                // Resolve parentObjectEntryFolderId
                let parentFolderId = input.parent_object_entry_folder_id || null;
                if (!parentFolderId) {
                    // Find the "Contents" root folder (ERC: L_CONTENTS) in the Space
                    try {
                        const foldersData = await liferayGet(base, `/o/headless-object/v1.0/scopes/${encodeURIComponent(scopeKey)}/object-entry-folders?flatten=true&pageSize=50`, user, pass);
                        const contentsFolder = (foldersData.items || []).find(f => f.externalReferenceCode === 'L_CONTENTS');
                        if (contentsFolder) {
                            parentFolderId = contentsFolder.id;
                        }
                    } catch (e) {
                        dbg('create_object_entry_folder: could not find L_CONTENTS folder:', e.message);
                    }
                }

                if (parentFolderId) {
                    folderBody.parentObjectEntryFolderId = parentFolderId;
                }

                const result = await liferayPost(base, `/o/headless-object/v1.0/scopes/${encodeURIComponent(scopeKey)}/object-entry-folders`, folderBody, user, pass);
                return {
                    id: result.id,
                    label: result.label,
                    title: result.title,
                    description: result.description || '',
                    parentObjectEntryFolderId: result.parentObjectEntryFolderId || 0,
                    scopeKey: result.scopeKey || scopeKey,
                    message: `Cartella Object Entry "${result.label}" creata con successo nello Space "${scopeKey}" (ID: ${result.id})`,
                };
            } catch (e) {
                return { error: `Errore nella creazione della cartella Object Entry: ${e.message}` };
            }
        }

        // ── LIST CONTENT FOLDERS ──────────────────────────────────────────────
        if (name === 'list_content_folders') {
            try {
                const ps = input.page_size || 50;
                let url;
                if (input.parent_folder_id) {
                    url = `/o/headless-delivery/v1.0/structured-content-folders/${input.parent_folder_id}/structured-content-folders?pageSize=${ps}`;
                } else {
                    url = `/o/headless-delivery/v1.0/sites/${siteId}/structured-content-folders?pageSize=${ps}`;
                }
                const data = await liferayGet(base, url, user, pass);
                const folders = (data.items || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    description: f.description || '',
                    parentFolderId: f.parentStructuredContentFolderId || 0,
                }));
                return { totalCount: data.totalCount || folders.length, folders };
            } catch (e) {
                return { error: `Errore nel listing delle cartelle contenuti: ${e.message}` };
            }
        }

        // ── LIST OBJECT ENTRY FOLDERS ────────────────────────────────────────
        if (name === 'list_object_entry_folders') {
            try {
                // Resolve scopeKey
                let scopeKey = input.scope_key || null;
                if (!scopeKey) {
                    let assetLibraries = [];
                    try {
                        const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass);
                        assetLibraries = libData.items || [];
                    } catch (_) { /* ignore */ }
                    if (assetLibraries.length > 0) {
                        scopeKey = assetLibraries[0].name || assetLibraries[0].externalReferenceCode || String(assetLibraries[0].id);
                    } else {
                        return { error: 'Nessuno Space disponibile. Specifica scope_key.' };
                    }
                }

                const ps = input.page_size || 50;
                let url;
                if (input.parent_folder_id) {
                    url = `/o/headless-object/v1.0/object-entry-folders/${input.parent_folder_id}/object-entry-folders?pageSize=${ps}`;
                } else {
                    url = `/o/headless-object/v1.0/scopes/${encodeURIComponent(scopeKey)}/object-entry-folders?flatten=true&pageSize=${ps}`;
                }
                const data = await liferayGet(base, url, user, pass);
                const folders = (data.items || []).map(f => ({
                    id: f.id,
                    label: f.label,
                    title: f.title || '',
                    description: f.description || '',
                    externalReferenceCode: f.externalReferenceCode || '',
                    parentObjectEntryFolderId: f.parentObjectEntryFolderId || 0,
                }));
                return { totalCount: data.totalCount || folders.length, folders, scopeKey };
            } catch (e) {
                return { error: `Errore nel listing delle cartelle Object Entry: ${e.message}` };
            }
        }

        // ── DELETE CONTENT FOLDER ──────────────────────────────────────────────
        if (name === 'delete_content_folder') {
            if (!input?.folder_id) return { error: 'folder_id obbligatorio per eliminare una cartella.' };
            try {
                await liferayDelete(base, `/o/headless-delivery/v1.0/structured-content-folders/${input.folder_id}`, user, pass);
                return { success: true, folderId: input.folder_id, message: `Cartella contenuti (ID: ${input.folder_id}) eliminata con successo.` };
            } catch (e) {
                return { error: `Errore nell'eliminazione della cartella contenuti: ${e.message}` };
            }
        }

        // ── DELETE OBJECT ENTRY FOLDER ───────────────────────────────────────
        if (name === 'delete_object_entry_folder') {
            if (!input?.folder_id) return { error: 'folder_id obbligatorio per eliminare una cartella Object Entry.' };
            try {
                await liferayDelete(base, `/o/headless-object/v1.0/object-entry-folders/${input.folder_id}`, user, pass);
                return { success: true, folderId: input.folder_id, message: `Cartella Object Entry (ID: ${input.folder_id}) eliminata con successo.` };
            } catch (e) {
                return { error: `Errore nell'eliminazione della cartella Object Entry: ${e.message}` };
            }
        }

        // ── UPDATE CONTENT FOLDER ─────────────────────────────────────────────
        if (name === 'update_content_folder') {
            if (!input?.folder_id) return { error: 'folder_id obbligatorio per aggiornare una cartella.' };
            const patchBody = {};
            if (input.name) patchBody.name = input.name;
            if (input.description !== undefined) patchBody.description = input.description;
            if (Object.keys(patchBody).length === 0) return { error: 'Nessun campo da aggiornare. Fornisci name o description.' };
            try {
                const result = await liferayPatch(base, `/o/headless-delivery/v1.0/structured-content-folders/${input.folder_id}`, patchBody, user, pass);
                return { id: result.id, name: result.name, description: result.description || '', message: `Cartella contenuti "${result.name}" aggiornata con successo (ID: ${result.id})` };
            } catch (e) {
                return { error: `Errore nell'aggiornamento della cartella contenuti: ${e.message}` };
            }
        }

        // ── UPDATE OBJECT ENTRY FOLDER ───────────────────────────────────────
        if (name === 'update_object_entry_folder') {
            if (!input?.folder_id) return { error: 'folder_id obbligatorio per aggiornare una cartella Object Entry.' };
            const patchBody = {};
            // When label is changed, also update title and label_i18n for all languages
            // so the CMS UI shows the correct name consistently
            if (input.label) {
                patchBody.label = input.label;
                patchBody.title = input.title || input.label;
                // Get available languages to update label_i18n
                let allLangs = ['en_US', 'it_IT'];
                try {
                    const rawLangs = window.Liferay?.ThemeDisplay?.getAvailableLocales?.();
                    if (Array.isArray(rawLangs) && rawLangs.length > 0) {
                        allLangs = rawLangs.map((l) => l.replace(/-/g, '_'));
                    }
                } catch (_) { /* ignore */ }
                const labelI18n = {};
                allLangs.forEach((l) => { labelI18n[l] = input.label; });
                patchBody.label_i18n = labelI18n;
            } else if (input.title) {
                patchBody.title = input.title;
            }
            if (input.description !== undefined) patchBody.description = input.description;
            if (Object.keys(patchBody).length === 0) return { error: 'Nessun campo da aggiornare. Fornisci label, title o description.' };
            try {
                const result = await liferayPatch(base, `/o/headless-object/v1.0/object-entry-folders/${input.folder_id}`, patchBody, user, pass);
                return { id: result.id, label: result.label, title: result.title, description: result.description || '', message: `Cartella Object Entry "${result.label}" aggiornata con successo (ID: ${result.id})` };
            } catch (e) {
                return { error: `Errore nell'aggiornamento della cartella Object Entry: ${e.message}` };
            }
        }

        if (name === 'create_structured_content') {
            if (!input?.title) return { error: 'title obbligatorio per creare un contenuto strutturato.' };
            if (!input?.content_structure_id) return { error: 'content_structure_id obbligatorio. Usa get_content_structures per trovarlo.' };

            // Usa la lingua default del portale e tutte le lingue disponibili
            const lang = window.Liferay?.ThemeDisplay?.getDefaultLanguageId?.() || 'en_US';
            // Get available languages: try ThemeDisplay first, then API, then fallback
            let allLangs = [];
            try {
                const rawLangs = window.Liferay?.ThemeDisplay?.getAvailableLocales?.();
                if (Array.isArray(rawLangs) && rawLangs.length > 0) {
                    allLangs = rawLangs.map((l) => l.replace(/-/g, '_'));
                }
            } catch (_) { /* ignore */ }
            if (allLangs.length === 0) {
                try {
                    const siteInfo = await liferayGet(base, `/o/headless-admin-user/v1.0/sites/${siteId}?fields=availableLanguages,defaultLanguageId`, user, pass);
                    if (Array.isArray(siteInfo?.availableLanguages) && siteInfo.availableLanguages.length > 0) {
                        allLangs = siteInfo.availableLanguages.map((l) => l.replace(/-/g, '_'));
                    }
                } catch (_) { /* ignore */ }
            }
            if (allLangs.length === 0) {
                allLangs = [lang]; // ultimate fallback: just the default language
            }
            dbg(`create_structured_content: defaultLang=${lang}, allLangs=${allLangs.join(',')}`);
            const structureId = input.content_structure_id;
            const title = input.title;
            const inputFields = input.fields || [];

            dbg(`create_structured_content: title="${title}", structureId=${structureId}, fields count=${inputFields.length}`);
            dbg(`create_structured_content: raw input=`, JSON.stringify(input).substring(0, 500));
            if (inputFields.length > 0) {
                dbg(`create_structured_content: fields detail=`, JSON.stringify(inputFields).substring(0, 1000));
                // Log document fields specifically for debugging
                const docFields = inputFields.filter(f => f.value_document_id);
                if (docFields.length > 0) {
                    dbg(`create_structured_content: DOCUMENT fields detected:`, docFields.map(f => `name=${f.name}, value_document_id=${f.value_document_id} (type=${typeof f.value_document_id})`).join(', '));
                }
            }

            try {
                // Step 1: POST to create the article (fields will be empty due to Liferay bug)
                // Build title_i18n with ALL available languages to avoid "Title is null" error
                const titleI18n = {};
                allLangs.forEach((l) => { titleI18n[l] = title; });

                // Fetch structure field types to convert values correctly per type
                // e.g. date fields need ISO-8601, date_time fields need "yyyy-MM-dd HH:mm", grid needs lowercase
                let fieldTypes = {}; // { fieldName: dataType }
                try {
                    const structInfo = await liferayGet(base, `/o/headless-delivery/v1.0/content-structures/${structureId}`, user, pass);
                    if (structInfo?.contentStructureFields) {
                        structInfo.contentStructureFields.forEach((sf) => {
                            fieldTypes[sf.name] = sf.dataType;
                        });
                    }
                    dbg(`create_structured_content: field types from structure: ${JSON.stringify(fieldTypes)}`);
                } catch (e) {
                    dbg(`create_structured_content: could not fetch structure types, proceeding without: ${e.message}`);
                }

                const postContentFields = inputFields.map((f) => {
                    const fieldValue = {};
                    if (f.value_geo && f.value_geo.latitude !== undefined) {
                        fieldValue.geo = { latitude: f.value_geo.latitude, longitude: f.value_geo.longitude };
                    } else if (f.value_document_id) {
                        // Determine if image or document based on field name convention
                        // We'll try both formats in the PATCH step
                        fieldValue.data = '';
                    } else {
                        fieldValue.data = convertFieldValue(f.value, fieldTypes[f.name]);
                    }
                    return { name: f.name, contentFieldValue: fieldValue };
                });

                const postBody = {
                    title,
                    title_i18n: titleI18n,
                    contentStructureId: structureId,
                    contentFields: postContentFields,
                };
                if (Array.isArray(input.taxonomy_category_ids) && input.taxonomy_category_ids.length > 0) {
                    postBody.taxonomyCategoryIds = input.taxonomy_category_ids.map(Number);
                }
                if (input.folder_id) {
                    postBody.structuredContentFolderId = input.folder_id;
                }

                const postResult = await liferayPost(base, `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents`, postBody, user, pass);
                const articleId = postResult.id;
                dbg(`create_structured_content: POST created articleId=${articleId}, availableLanguages=${postResult.availableLanguages?.join(',')}, fields after POST:`, postResult.contentFields?.map(f => `${f.name}=${f.contentFieldValue?.data || '(empty)'}`).join(', '));

                // Step 2: PATCH to set actual field values (workaround for Liferay bug)
                // Liferay POST always creates empty fields — PATCH is required to populate them
                // We must PATCH for EACH available locale using Accept-Language header
                // Use availableLanguages from POST response (e.g. ["en-US","it-IT"]) — most reliable source
                const patchLangs = postResult.availableLanguages?.map(l => l.replace(/-/g, '_')) || allLangs;
                dbg(`create_structured_content: available locales for PATCH: ${patchLangs.join(', ')}`);

                const patchContentFields = inputFields.map((f) => {
                    const fieldValue = {};
                    if (f.value_geo && f.value_geo.latitude !== undefined) {
                        fieldValue.geo = { latitude: f.value_geo.latitude, longitude: f.value_geo.longitude };
                    } else if (f.value_document_id) {
                        const docId = parseInt(f.value_document_id, 10);
                        // Use 'image' for image fields, 'document' for document_library fields
                        const fieldType = fieldTypes[f.name] || '';
                        if (fieldType === 'image') {
                            dbg(`create_structured_content: PATCH setting IMAGE field '${f.name}' to image ID=${docId}`);
                            fieldValue.image = { id: docId };
                        } else {
                            dbg(`create_structured_content: PATCH setting DOCUMENT field '${f.name}' to document ID=${docId}`);
                            fieldValue.document = { id: docId };
                        }
                    } else {
                        fieldValue.data = convertFieldValue(f.value, fieldTypes[f.name]);
                    }
                    return { name: f.name, contentFieldValue: fieldValue };
                });

                const patchBody = {
                    title,
                    title_i18n: titleI18n,
                    contentFields: patchContentFields,
                };
                if (Array.isArray(input.taxonomy_category_ids) && input.taxonomy_category_ids.length > 0) {
                    patchBody.taxonomyCategoryIds = input.taxonomy_category_ids.map(Number);
                }

                dbg(`create_structured_content: PATCH body=`, JSON.stringify(patchBody).substring(0, 800));

                let patchResult = null;
                let patchError = null;
                try {
                    // PATCH for EACH available locale using Accept-Language header
                    // Without Accept-Language, Liferay uses the browser locale which may not be the default
                    for (const locale of patchLangs) {
                        const localeDash = locale.replace(/_/g, '-');
                        const isDefault = locale === lang;
                        dbg(`create_structured_content: PATCH for locale ${localeDash} (default=${isDefault})`);
                        try {
                            const localeResult = await liferayPatch(
                                base,
                                `/o/headless-delivery/v1.0/structured-contents/${articleId}`,
                                patchBody,
                                user, pass,
                                { 'Accept-Language': localeDash }
                            );
                            if (isDefault) patchResult = localeResult;
                            dbg(`create_structured_content: PATCH locale ${localeDash} success, fields:`, localeResult.contentFields?.map(f => `${f.name}=${f.contentFieldValue?.data || f.contentFieldValue?.geo || '(empty)'}`).join(', '));
                        } catch (localeErr) {
                            dbg(`create_structured_content: PATCH locale ${localeDash} fallito:`, localeErr.message);
                            if (isDefault) patchError = localeErr;
                        }
                    }
                } catch (patchErr) {
                    patchError = patchErr;
                    dbg(`create_structured_content: PATCH fallito, provo senza document/image format:`, patchErr.message);
                    // Retry PATCH without document/image fields
                    const retryFields = inputFields.filter((f) => !f.value_document_id).map((f) => {
                        const fieldValue = {};
                        if (f.value_geo && f.value_geo.latitude !== undefined) {
                            fieldValue.geo = { latitude: f.value_geo.latitude, longitude: f.value_geo.longitude };
                        } else {
                            fieldValue.data = convertFieldValue(f.value, fieldTypes[f.name]);
                        }
                        return { name: f.name, contentFieldValue: fieldValue };
                    });

                    if (retryFields.length > 0) {
                        const retryBody = {
                            title,
                            title_i18n: titleI18n,
                            contentFields: retryFields,
                        };
                        try {
                            for (const locale of patchLangs) {
                                const localeDash = locale.replace(/_/g, '-');
                                try {
                                    const localeResult = await liferayPatch(base, `/o/headless-delivery/v1.0/structured-contents/${articleId}`, retryBody, user, pass, { 'Accept-Language': localeDash });
                                    if (locale === lang) { patchResult = localeResult; patchError = null; }
                                } catch (e) { /* ignore locale retry errors */ }
                            }
                            dbg(`create_structured_content: retry PATCH success for all locales`);
                        } catch (retryErr) {
                            dbg(`create_structured_content: retry PATCH fallito:`, retryErr.message);
                        }
                    }
                }

                // Verify fields were actually populated
                if (patchResult && inputFields.length > 0) {
                    const populatedFields = patchResult.contentFields?.filter(f => f.contentFieldValue?.data || f.contentFieldValue?.geo) || [];
                    const expectedCount = inputFields.filter(f => !f.value_document_id).length;
                    dbg(`create_structured_content: verification — populated=${populatedFields.length}, expected=${expectedCount}`);
                    if (populatedFields.length === 0 && expectedCount > 0) {
                        dbg(`create_structured_content: WARNING — PATCH returned empty fields, trying GET to verify`);
                        try {
                            const verifyResult = await liferayGet(base, `/o/headless-delivery/v1.0/structured-contents/${articleId}`, user, pass);
                            const verifyPopulated = verifyResult.contentFields?.filter(f => f.contentFieldValue?.data || f.contentFieldValue?.geo) || [];
                            dbg(`create_structured_content: GET verification — populated=${verifyPopulated.length}`);
                            if (verifyPopulated.length > 0) patchResult = verifyResult;
                        } catch (e) { dbg(`create_structured_content: GET verification failed:`, e.message); }
                    }
                }

                if (patchError && !patchResult) {
                    return {
                        success: false,
                        error: `Contenuto creato (ID=${articleId}) ma PATCH per popolare i campi fallito: ${patchError.message}. Prova a modificare il contenuto manualmente.`,
                        articleId,
                        title,
                        contentStructureId: structureId,
                    };
                }

                return {
                    success: true,
                    message: `Contenuto strutturato "${title}" creato con successo`,
                    articleId,
                    title,
                    contentStructureId: structureId,
                    populatedFields: patchResult?.contentFields?.filter(f => f.contentFieldValue?.data || f.contentFieldValue?.geo)?.map(f => f.name) || [],
                    note: 'A causa di un bug di Liferay, alcuni tipi di campo (link_to_layout, journal_article) non supportano l\'impostazione di valori via API.',
                };
            } catch (e) {
                return { error: e.message || String(e), title: input.title };
            }
        }

        // ── UPDATE STRUCTURED CONTENT ──────────────────────────────────────────
        if (name === 'update_structured_content') {
            if (!input?.content_id) return { error: 'content_id obbligatorio' };
            const contentId = input.content_id;
            const inputFields = input.fields || [];
            const patchBody = {};

            // Fetch available languages for PATCH
            let allLangs = [];
            let lang = null;
            try {
                const langsInfo = await executeTool('get_available_languages', {}, cfg);
                allLangs = (langsInfo?.availableLanguages || []).map((l) => l.replace(/-/g, '_'));
                lang = langsInfo?.defaultLanguage?.replace(/-/g, '_') || langsInfo?.currentLanguage?.replace(/-/g, '_') || allLangs[0];
            } catch (e) { dbg('update_structured_content: could not fetch languages:', e.message); }
            if (allLangs.length === 0) allLangs = [lang || 'it_IT'];
            if (!lang) lang = allLangs[0];

            // Title
            if (input.title) {
                patchBody.title = input.title;
                const titleI18n = {};
                allLangs.forEach((l) => { titleI18n[l] = input.title; });
                patchBody.title_i18n = titleI18n;
            }

            // Taxonomy categories
            if (Array.isArray(input.taxonomy_category_ids)) {
                patchBody.taxonomyCategoryIds = input.taxonomy_category_ids.map(Number);
            }

            // Fields
            if (inputFields.length > 0) {
                // Fetch structure field types for value conversion
                let fieldTypes = {};
                try {
                    const contentInfo = await liferayGet(base, `/o/headless-delivery/v1.0/structured-contents/${contentId}`, user, pass);
                    const structureId = contentInfo?.contentStructureId;
                    if (structureId) {
                        const structInfo = await liferayGet(base, `/o/headless-delivery/v1.0/content-structures/${structureId}`, user, pass);
                        if (structInfo?.contentStructureFields) {
                            structInfo.contentStructureFields.forEach((sf) => { fieldTypes[sf.name] = sf.dataType; });
                        }
                    }
                    dbg(`update_structured_content: field types: ${JSON.stringify(fieldTypes)}`);
                } catch (e) { dbg(`update_structured_content: could not fetch structure types: ${e.message}`); }

                const contentFields = inputFields.map((f) => {
                    const fieldValue = {};
                    if (f.value_geo && f.value_geo.latitude !== undefined) {
                        fieldValue.geo = { latitude: f.value_geo.latitude, longitude: f.value_geo.longitude };
                    } else if (f.value_document_id) {
                        const docId = parseInt(f.value_document_id, 10);
                        // Use 'image' for image fields, 'document' for document_library fields
                        const fieldType = fieldTypes[f.name] || '';
                        if (fieldType === 'image') {
                            dbg(`update_structured_content: setting IMAGE field '${f.name}' to image ID=${docId}`);
                            fieldValue.image = { id: docId };
                        } else {
                            dbg(`update_structured_content: setting DOCUMENT field '${f.name}' to document ID=${docId}`);
                            fieldValue.document = { id: docId };
                        }
                    } else {
                        fieldValue.data = convertFieldValue(f.value, fieldTypes[f.name]);
                    }
                    return { name: f.name, contentFieldValue: fieldValue };
                });
                patchBody.contentFields = contentFields;
            }

            // If nothing to update
            if (!patchBody.title && !patchBody.contentFields && !patchBody.taxonomyCategoryIds) {
                return { error: 'Nessun campo da aggiornare. Fornire title, fields e/o taxonomy_category_ids.' };
            }

            dbg(`update_structured_content: PATCH body=`, JSON.stringify(patchBody).substring(0, 800));

            try {
                let patchResult = null;
                // PATCH for each available locale if fields are present
                if (patchBody.contentFields) {
                    const patchLangs = allLangs;
                    for (const locale of patchLangs) {
                        const localeDash = locale.replace(/_/g, '-');
                        const isDefault = locale === lang;
                        dbg(`update_structured_content: PATCH for locale ${localeDash}`);
                        try {
                            const localeResult = await liferayPatch(base, `/o/headless-delivery/v1.0/structured-contents/${contentId}`, patchBody, user, pass, { 'Accept-Language': localeDash });
                            if (isDefault) patchResult = localeResult;
                            dbg(`update_structured_content: PATCH locale ${localeDash} success`);
                        } catch (localeErr) {
                            dbg(`update_structured_content: PATCH locale ${localeDash} fallito:`, localeErr.message);
                            if (isDefault) throw localeErr;
                        }
                    }
                } else {
                    // No fields, just PATCH once (categories or title only)
                    patchResult = await liferayPatch(base, `/o/headless-delivery/v1.0/structured-contents/${contentId}`, patchBody, user, pass);
                }

                return {
                    success: true,
                    message: `Contenuto ${contentId} aggiornato con successo`,
                    contentId,
                    updatedFields: patchResult?.contentFields?.filter(f => f.contentFieldValue?.data || f.contentFieldValue?.geo)?.map(f => f.name) || [],
                    categories: patchResult?.taxonomyCategoryBriefs?.map(c => ({ id: c.taxonomyCategoryId, name: c.taxonomyCategoryName })) || [],
                };
            } catch (e) {
                return { error: e.message || String(e), contentId };
            }
        }

        if (name === 'get_users') { let qs = `pageSize=${input.page_size || 20}&fields=id,name,givenName,familyName,emailAddress,alternateName,jobTitle`; if (input.search) qs += `&search=${encodeURIComponent(input.search)}`; return await liferayGet(base, `/o/headless-admin-user/v1.0/user-accounts?${qs}`, user, pass); }

        if (name === 'get_navigation_menus') { return await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/navigation-menus?pageSize=${input.page_size || 10}&fields=id,name,navigationType,navigationMenuItems`, user, pass); }

        if (name === 'get_user_spaces') {
            const td = window.Liferay?.ThemeDisplay; const currentId = td?.getUserId?.() || null; const currentEmail = td?.getUserEmailAddress?.() || null; const currentName = td?.getUserName?.() || null;
            let libraries = [];
            try { const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass); libraries = libData.items || []; } catch (e) { return { error: 'Impossibile recuperare la lista degli Spaces: ' + e.message, spaces: [] }; }
            if (libraries.length === 0) return { message: 'Non esistono Spaces nel portale.', spaces: [] };
            const accessibleSpaces = [];
            for (const lib of libraries) { const erc = lib.externalReferenceCode || lib.id; const libName = lib.name || String(lib.id); try { const usersData = await liferayGet(base, `/o/headless-asset-library/v1.0/asset-libraries/${erc}/user-accounts?pageSize=200`, user, pass); const users = usersData.items || []; const found = users.some((u) => (currentId && String(u.id) === String(currentId)) || (currentEmail && u.emailAddress === currentEmail) || (user && (u.alternateName === user || u.emailAddress === user))); if (found || users.length === 0) accessibleSpaces.push({ name: libName, externalReferenceCode: erc, type: lib.type || 'Space' }); } catch (eAcc) { dbg(`get_user_spaces: errore su space "${libName}": ${eAcc.message}`); } }
            return { user: { id: currentId, email: currentEmail, name: currentName }, totalSpaces: libraries.length, accessibleSpaces, hasAccess: accessibleSpaces.length > 0 };
        }

        if (name === 'get_object_entries') {
            const objName = input.object_name; const ps2 = input.page_size || 20; if (!objName) return { error: 'object_name obbligatorio' };
            const restPath = await resolveObjectRestPath(base, objName, user, pass);
            try { const data = await liferayGet(base, `${restPath}?pageSize=${ps2}`, user, pass); return { ...data, _scope: 'company', _endpoint: restPath }; } catch (e1) { dbg(`get_object_entries STEP1 fallito (${e1.message})`); }
            let assetLibraries = [];
            try { const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass); assetLibraries = libData.items || []; } catch (e2) { return { error: `L'oggetto "${objName}" non è accessibile.`, totalCount: 0, items: [] }; }
            if (assetLibraries.length === 0) return { error: `L'oggetto "${objName}" non trovato e non esistono Spaces.`, totalCount: 0, items: [] };
            const results = [];
            for (const lib of assetLibraries) { const libId = lib.externalReferenceCode || lib.id; const libName = lib.name || String(lib.id); const scopeKey = lib.name || lib.externalReferenceCode || String(libId); try { const data = await liferayGet(base, `${restPath}/scopes/${encodeURIComponent(scopeKey)}?pageSize=${ps2}`, user, pass); results.push({ ...data, _scope: 'space', _spaceName: scopeKey }); } catch (eScope) { /* ignore */ } }
            if (results.length === 0) return { error: `Nessun dato trovato per l'oggetto "${objName}" negli Spaces disponibili.`, totalCount: 0, items: [] };
            return { totalCount: results.reduce((acc, r) => acc + (r.totalCount || 0), 0), items: results.flatMap((r) => (r.items || []).map((it) => ({ ...it, _spaceName: r._spaceName }))), _spaces: results.map((r) => r._spaceName) };
        }

        if (name === 'get_custom_objects') {
            // Usa l'API object-admin per ottenere la lista con nomi corretti
            try {
                const data = await liferayGet(base, '/o/object-admin/v1.0/object-definitions?pageSize=200', user, pass);
                const customObjects = (data.items || [])
                    .filter((o) => !o.system) // esclude gli oggetti di sistema
                    .map((o) => ({
                        name: o.name,
                        label: o.label?.it_IT || o.label?.en_US || o.name,
                        scope: o.scope || 'company',
                        externalReferenceCode: o.externalReferenceCode,
                        restEndpoint: o.restContextPath || `/o/c/${o.name.toLowerCase()}s`,
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                return { totalCount: customObjects.length, items: customObjects };
            } catch (e) {
                // Fallback: usa /o/api come prima
                const apiData = await liferayGet(base, '/o/api', user, pass); let urlKeys = []; const topKeys = Object.keys(apiData);
                if (topKeys.some((k) => k.includes('/o/c/'))) { urlKeys = topKeys; } else { for (const prop of Object.values(apiData)) { if (prop && typeof prop === 'object' && !Array.isArray(prop)) { const subKeys = Object.keys(prop); if (subKeys.some((k) => k.includes('/o/c/'))) { urlKeys = subKeys; break; } } } }
                const customObjectNames = [...new Set(urlKeys.filter((url) => /\/o\/c\/[^/{]+/.test(url)).map((url) => { const match = url.match(/\/o\/c\/([^/{]+)/); return match ? match[1] : null; }).filter(Boolean))].sort();
                return { totalCount: customObjectNames.length, items: customObjectNames.map((objName) => ({ name: objName, restEndpoint: `/o/c/${objName}`, fullEndpoint: `${base}/o/c/${objName}` })) };
            }
        }

        if (name === 'list_available_apis') { const list = await fetchApiList(base, user, pass); const slim = Array.isArray(list) ? list.map((a) => ({ name: a.name || a.title, url: a.url })) : list; return { apis: slim, total: Array.isArray(slim) ? slim.length : '?' }; }

        if (name === 'get_api_spec') { if (!input.spec_url) return { error: 'spec_url obbligatorio' }; const specUrl = input.spec_url.startsWith('http') ? input.spec_url : base + input.spec_url; const spec = await fetchApiSpec(specUrl, user, pass); if (!spec) return { error: 'Impossibile scaricare la spec da: ' + specUrl }; const paths = Object.entries(spec.paths || {}); return { info: spec.info, paths: Object.fromEntries(paths.slice(0, 50)), totalPaths: paths.length }; }

        if (name === 'find_relevant_endpoints') { const qLow = (input.query || '').toLowerCase(); const max = input.max_results || 5; const tokens = qLow.split(/\s+/).filter(Boolean); const candidates = []; for (const [, spec] of Object.entries(_apiSpecCache)) { if (!spec?.paths) continue; for (const [path, methods] of Object.entries(spec.paths)) { for (const [method, op] of Object.entries(methods || {})) { const hay = `${op.summary || ''} ${op.operationId || ''} ${path}`.toLowerCase(); const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0); if (score > 0) candidates.push({ path, method, summary: op.summary || '', operationId: op.operationId || '', parameters: op.parameters || [], score }); } } } candidates.sort((a, b) => b.score - a.score); return { endpoints: candidates.slice(0, max), total: candidates.length }; }

        if (name === 'discover_endpoint') { const qLow = (input.query || '').toLowerCase(); const tokens = qLow.split(/\s+/).filter(Boolean); let best = null; for (const [, spec] of Object.entries(_apiSpecCache)) { if (!spec?.paths) continue; for (const [path, methods] of Object.entries(spec.paths)) { for (const [method, op] of Object.entries(methods || {})) { const hay = `${op.summary || ''} ${op.operationId || ''} ${path}`.toLowerCase(); const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0); if (!best || score > best.score) best = { path, method, summary: op.summary || '', operationId: op.operationId || '', parameters: op.parameters || [], score }; } } } if (!best) return { error: 'Nessun endpoint rilevante trovato.' }; const params = (best.parameters || []).map((p) => p.name).slice(0, 5); const qp = params.map((n) => n.toLowerCase().includes('search') ? `search=${encodeURIComponent(input.query || '')}` : n.toLowerCase().includes('page') ? 'page=1' : n.toLowerCase().includes('pagesize') ? 'pageSize=10' : `${n}=...`).join('&'); return { best: { ...best, example: { path: best.path, method: best.method, example_call: best.path + (qp ? `?${qp}` : '') } } }; }

        if (name === 'search_web_content_by_title') {
            const title = (input.title || '').trim(); const limit = input.page_size || 10; if (!title) return { error: 'title obbligatorio' };
            const JA = 'com.liferay.journal.model.JournalArticle';
            const normalizeSearchItems = (items) => items.filter((it) => it.entryClassName === JA).map((it) => ({ id: it.entryClassPK || null, title: it.title || null, friendlyUrlPath: it.friendlyUrlPath || null, itemURL: it.itemURL || null, datePublished: it.dateCreated || null, description: it.description || null, score: it.score || null }));
            try { const escaped = title.replace(/'/g, "''"); const f = encodeURIComponent(`title eq '${escaped}'`); const qs = `emptySearch=true&scope=${siteId}&pageSize=${limit}&entryClassNames=${encodeURIComponent(JA)}&filter=${f}`; const data = await liferayGet(base, `/o/search/v1.0/search?${qs}`, user, pass); const items = normalizeSearchItems(data.items || []); if (items.length > 0) return { totalCount: items.length, items, _strategy: 'title_eq' }; } catch (e1) { dbg('search_by_title S1 failed:', e1.message); }
            try { const words = title.split(/\s+/).filter((w) => w.length > 2).slice(0, 6).join(' '); const qs = `scope=${siteId}&pageSize=${limit}&entryClassNames=${encodeURIComponent(JA)}&search=${encodeURIComponent(words)}`; const data = await liferayGet(base, `/o/search/v1.0/search?${qs}`, user, pass); const items = normalizeSearchItems(data.items || []); if (items.length > 0) return { totalCount: data.totalCount || items.length, items, _strategy: 'search_api_fulltext' }; } catch (e2) { dbg('search_by_title S2 failed:', e2.message); }
            try { const words = title.split(/\s+/).filter((w) => w.length > 2).slice(0, 4).join(' '); const qs = `search=${encodeURIComponent(words)}&page=1&pageSize=${limit}`; const data = await liferayGet(base, `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?${qs}`, user, pass); const items = (data.items || []).map(parseStructuredContentItem); return { totalCount: data.totalCount || 0, items, _strategy: 'headless_fallback' }; } catch (e3) { return { totalCount: 0, items: [], error: e3.message }; }
        }

        if (name === 'count_content_by_month') {
            const year = input.year || new Date().getFullYear(); const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
            const monthFilter = (monthIdx) => { const m = monthIdx + 1; const pad = (n) => String(n).padStart(2, '0'); const start = `${year}-${pad(m)}-01T00:00:00Z`; const nextY = m === 12 ? year + 1 : year; const nextM = m === 12 ? 1 : m + 1; const end = `${nextY}-${pad(nextM)}-01T00:00:00Z`; let f = `displayDate ge ${start} and displayDate lt ${end}`; if (input.category_id) f += ` and taxonomyCategoryIds/any(c:c eq ${input.category_id})`; return f; };
            const counts = await Promise.all(MONTH_NAMES.map(async (monthName, idx) => { try { let qs = `page=1&pageSize=1&filter=${encodeFilter(monthFilter(idx))}`; let endpoint = `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?${qs}`; if (input.structure_id) endpoint = `/o/headless-delivery/v1.0/content-structures/${input.structure_id}/structured-contents?${qs}`; const data = await liferayGet(base, endpoint, user, pass); return { monthName, count: data.totalCount || 0 }; } catch (_) { return { monthName, count: 0 }; } }));
            const months = {}; let winner = MONTH_NAMES[0]; let winnerCount = 0; let totalYear = 0; for (const { monthName, count } of counts) { months[monthName] = count; totalYear += count; if (count > winnerCount) { winnerCount = count; winner = monthName; } }
            return { year, months, winner, winnerCount, totalYear };
        }

        if (name === 'call_liferay_api') {
            if (!input.path) return { error: 'path obbligatorio' };
            const safePath = input.path.startsWith('/o/') ? input.path : '/o/' + input.path.replace(/^\//, '');
            const qs = input.query_params ? '?' + input.query_params : ''; const cacheKey = safePath + qs; const cached = getCachedResponse(cacheKey); if (cached) return cached;
            const data = await liferayGet(base, safePath + qs, user, pass);
            if (data.items && safePath.includes('structured-contents')) data.items = data.items.map(parseStructuredContentItem);
            try { setCachedResponse(cacheKey, data, 2 * 60 * 1000); } catch (_) { /* ignore */ }
            return data;
        }

        // ── USER MANAGEMENT ──────────────────────────────────────────────────

        if (name === 'create_user') {
            if (!input?.alternateName && !input?.emailAddress) return { error: 'alternateName (screen name) o emailAddress obbligatorio' };
            const body = {};
            // Campi obbligatori
            if (input.alternateName) body.alternateName = input.alternateName;
            if (input.emailAddress) body.emailAddress = input.emailAddress;
            if (input.givenName) body.givenName = input.givenName;
            if (input.familyName) body.familyName = input.familyName;
            if (input.password) body.password = input.password;
            // Campi opzionali
            if (input.jobTitle) body.jobTitle = input.jobTitle;
            if (input.roleBriefs) body.roleBriefs = input.roleBriefs;
            if (input.siteBriefs) body.siteBriefs = input.siteBriefs;
            if (input.gender) body.gender = input.gender;
            if (input.birthday) body.birthday = input.birthday;
            if (input.comment) body.comment = input.comment;
            if (input.agreedToTermsOfUse !== undefined) body.agreedToTermsOfUse = Boolean(input.agreedToTermsOfUse);
            if (input.passwordNeverExpires !== undefined) body.passwordNeverExpires = Boolean(input.passwordNeverExpires);
            if (input.sendResetPasswordEmail !== undefined) body.sendResetPasswordEmail = Boolean(input.sendResetPasswordEmail);
            // i18n
            if (input.givenName_i18n) body.givenName_i18n = input.givenName_i18n;
            if (input.familyName_i18n) body.familyName_i18n = input.familyName_i18n;
            // Avviso per campi non supportati
            const warnings = [];
            if (input.organizationBriefs) warnings.push('organizationBriefs ignorato: le API Headless non supportano l\'associazione utente→organizzazione. Usare il pannello di controllo Liferay (Control Panel → Users → Edit User → Organizations).');
            if (input.userGroupBriefs) warnings.push('userGroupBriefs ignorato: le API Headless non supportano l\'associazione utente→gruppo utente. Usare il pannello di controllo Liferay (Control Panel → Users → Edit User → User Groups).');
            try {
                const result = await liferayPost(base, '/o/headless-admin-user/v1.0/user-accounts', body, user, pass);
                const msg = `Utente "${result.name || result.alternateName}" creato con successo (ID: ${result.id})`;
                const response = { success: true, id: result.id, alternateName: result.alternateName, emailAddress: result.emailAddress, name: result.name, message: msg };
                if (warnings.length > 0) response.warnings = warnings;

                // Liferay Headless API ignora roleBriefs nella creazione utente.
                // Assegnamo i ruoli separatamente dopo la creazione.
                if (input.roleBriefs && input.roleBriefs.length > 0) {
                    const roleResults = [];
                    for (const role of input.roleBriefs) {
                        try {
                            // Se manca l'ID del ruolo, cerchiamolo per nome
                            let roleId = role.id;
                            if (!roleId && role.name) {
                                const roleSearch = await liferayGet(base, `/o/headless-admin-user/v1.0/roles?filter=${encodeURIComponent(`name eq '${role.name.replace(/'/g, "''")}'`)}&pageSize=1`, user, pass);
                                const found = (roleSearch.items || [])[0];
                                if (found) roleId = found.id;
                            }
                            if (!roleId) {
                                roleResults.push({ role: role.name || role.id, success: false, error: 'Ruolo non trovato' });
                                continue;
                            }
                            // Recupera il tipo di ruolo per determinare l'endpoint corretto
                            const roleData = await liferayGet(base, `/o/headless-admin-user/v1.0/roles/${roleId}?fields=id,name,roleType`, user, pass);
                            const roleType = roleData.roleType;
                            const roleName = roleData.name || `ID ${roleId}`;

                            if (roleType === 'site') {
                                const sid = siteId;
                                if (!sid) { roleResults.push({ role: roleName, success: false, error: 'siteId mancante per ruolo site' }); continue; }
                                await liferayPost(base, `/o/headless-admin-user/v1.0/roles/${roleId}/association/user-account/${result.id}/site/${sid}`, {}, user, pass);
                                roleResults.push({ role: roleName, roleType, success: true });
                            } else if (roleType === 'organization') {
                                roleResults.push({ role: roleName, roleType, success: false, error: 'organizationId mancante — usare assign_role_to_user separatamente' });
                            } else {
                                await liferayPost(base, `/o/headless-admin-user/v1.0/roles/${roleId}/association/user-account/${result.id}`, {}, user, pass);
                                roleResults.push({ role: roleName, roleType, success: true });
                            }
                        } catch (roleErr) {
                            roleResults.push({ role: role.name || role.id, success: false, error: roleErr.message || String(roleErr) });
                        }
                    }
                    response.roleAssignment = roleResults;
                    const assigned = roleResults.filter((r) => r.success).map((r) => r.role);
                    const failed = roleResults.filter((r) => !r.success);
                    if (assigned.length > 0) response.message += ` — Ruoli assegnati: ${assigned.join(', ')}`;
                    if (failed.length > 0) response.message += ` — Ruoli non assegnati: ${failed.map((r) => `${r.role} (${r.error})`).join(', ')}`;
                }

                return response;
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'update_user') {
            if (!input?.userId) return { error: 'userId obbligatorio per aggiornare un utente' };
            const body = {};
            // Aggiorna solo i campi forniti
            if (input.alternateName) body.alternateName = input.alternateName;
            if (input.emailAddress) body.emailAddress = input.emailAddress;
            if (input.givenName) body.givenName = input.givenName;
            if (input.familyName) body.familyName = input.familyName;
            if (input.password) body.password = input.password;
            if (input.jobTitle !== undefined) body.jobTitle = input.jobTitle;
            if (input.roleBriefs) body.roleBriefs = input.roleBriefs;
            if (input.siteBriefs) body.siteBriefs = input.siteBriefs;
            if (input.gender) body.gender = input.gender;
            if (input.birthday) body.birthday = input.birthday;
            if (input.comment !== undefined) body.comment = input.comment;
            if (input.agreedToTermsOfUse !== undefined) body.agreedToTermsOfUse = Boolean(input.agreedToTermsOfUse);
            if (input.passwordNeverExpires !== undefined) body.passwordNeverExpires = Boolean(input.passwordNeverExpires);
            if (input.givenName_i18n) body.givenName_i18n = input.givenName_i18n;
            if (input.familyName_i18n) body.familyName_i18n = input.familyName_i18n;
            // Avviso per campi non supportati
            const warnings = [];
            if (input.organizationBriefs) warnings.push('organizationBriefs ignorato: le API Headless non supportano l\'associazione utente→organizzazione. Usare il pannello di controllo Liferay (Control Panel → Users → Edit User → Organizations).');
            if (input.userGroupBriefs) warnings.push('userGroupBriefs ignorato: le API Headless non supportano l\'associazione utente→gruppo utente. Usare il pannello di controllo Liferay (Control Panel → Users → Edit User → User Groups).');
            if (Object.keys(body).length === 0 && warnings.length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (givenName, familyName, emailAddress, roleBriefs, ecc.)' };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-user/v1.0/user-accounts/${input.userId}`, body, user, pass);
                const msg = `Utente "${result.name || result.alternateName}" aggiornato con successo`;
                const response = { success: true, id: result.id, alternateName: result.alternateName, emailAddress: result.emailAddress, name: result.name, message: msg };
                if (warnings.length > 0) response.warnings = warnings;
                return response;
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_user') {
            if (!input?.userId) return { error: 'userId obbligatorio per eliminare un utente' };
            try {
                await liferayDelete(base, `/o/headless-admin-user/v1.0/user-accounts/${input.userId}`, user, pass);
                return { success: true, message: `Utente con ID ${input.userId} eliminato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'get_user_detail') {
            if (!input?.userId) return { error: 'userId obbligatorio' };
            try {
                const result = await liferayGet(base, `/o/headless-admin-user/v1.0/user-accounts/${input.userId}?fields=id,name,alternateName,emailAddress,givenName,familyName,jobTitle,gender,birthday,comment,agreedToTermsOfUse,passwordNeverExpires,roleBriefs,organizationBriefs,userGroupBriefs,siteBriefs,dateCreated,dateModified,image`, user, pass);
                return result;
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'get_available_roles') {
            try {
                const data = await liferayGet(base, '/o/headless-admin-user/v1.0/roles?pageSize=200&fields=id,name,description,roleType', user, pass);
                return data;
            } catch (e) { return { error: e.message || String(e), items: [] }; }
        }

        if (name === 'get_available_organizations') {
            try {
                const data = await liferayGet(base, '/o/headless-admin-user/v1.0/organizations?pageSize=200&fields=id,name,description,parentOrganization', user, pass);
                return data;
            } catch (e) { return { error: e.message || String(e), items: [] }; }
        }

        if (name === 'get_available_user_groups') {
            try {
                const data = await liferayGet(base, '/o/headless-admin-user/v1.0/user-groups?pageSize=200&fields=id,name,description', user, pass);
                return data;
            } catch (e) { return { error: e.message || String(e), items: [] }; }
        }

        // ── ROLE CRUD ─────────────────────────────────────────────────

        if (name === 'create_role') {
            if (!input?.name) return { error: 'name obbligatorio per creare un ruolo' };
            const body = { name: input.name };
            if (input.description) body.description = input.description;
            if (input.roleType) body.roleType = input.roleType;
            else body.roleType = 'regular';
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (input.permissions) body.permissions = input.permissions;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            try {
                const result = await liferayPost(base, '/o/headless-admin-user/v1.0/roles', body, user, pass);
                return { success: true, id: result.id, name: result.name, roleType: result.roleType, message: `Ruolo "${result.name}" creato con successo (ID: ${result.id}, tipo: ${result.roleType})` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'update_role') {
            if (!input?.roleId) return { error: 'roleId obbligatorio per aggiornare un ruolo' };
            const body = {};
            if (input.name) body.name = input.name;
            if (input.description !== undefined) body.description = input.description;
            if (input.roleType) body.roleType = input.roleType;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.permissions) body.permissions = input.permissions;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (name, description, roleType, ecc.)' };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}`, body, user, pass);
                return { success: true, id: result.id, name: result.name, roleType: result.roleType, message: `Ruolo "${result.name}" aggiornato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_role') {
            if (!input?.roleId) return { error: 'roleId obbligatorio per eliminare un ruolo' };
            try {
                await liferayDelete(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}`, user, pass);
                return { success: true, message: `Ruolo con ID ${input.roleId} eliminato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── ORGANIZATION CREATE ──────────────────────────────────────────

        if (name === 'create_organization') {
            if (!input?.name) return { error: 'name obbligatorio per creare un\'organizzazione' };
            const body = { name: input.name };
            if (input.description) body.description = input.description;
            if (input.parentOrganizationId) body.parentOrganization = { id: input.parentOrganizationId };
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (input.status !== undefined) body.status = input.status;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            try {
                const result = await liferayPost(base, '/o/headless-admin-user/v1.0/organizations', body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Organizzazione "${result.name}" creata con successo (ID: ${result.id})` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'update_organization') {
            if (!input?.organizationId) return { error: 'organizationId obbligatorio per aggiornare un\'organizzazione' };
            const body = {};
            if (input.name) body.name = input.name;
            if (input.description !== undefined) body.description = input.description;
            if (input.parentOrganizationId) body.parentOrganization = { id: input.parentOrganizationId };
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.status !== undefined) body.status = input.status;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (name, description, parentOrganizationId, ecc.)' };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-user/v1.0/organizations/${input.organizationId}`, body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Organizzazione "${result.name}" aggiornata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_organization') {
            if (!input?.organizationId) return { error: 'organizationId obbligatorio per eliminare un\'organizzazione' };
            try {
                await liferayDelete(base, `/o/headless-admin-user/v1.0/organizations/${input.organizationId}`, user, pass);
                return { success: true, message: `Organizzazione con ID ${input.organizationId} eliminata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── USER GROUP CRUD ────────────────────────────────────────────────

        if (name === 'create_user_group') {
            if (!input?.name) return { error: 'name obbligatorio per creare un gruppo utente' };
            const body = { name: input.name };
            if (input.description) body.description = input.description;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            try {
                const result = await liferayPost(base, '/o/headless-admin-user/v1.0/user-groups', body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Gruppo utente "${result.name}" creato con successo (ID: ${result.id})` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'update_user_group') {
            if (!input?.userGroupId) return { error: 'userGroupId obbligatorio per aggiornare un gruppo utente' };
            const body = {};
            if (input.name) body.name = input.name;
            if (input.description !== undefined) body.description = input.description;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.description_i18n) body.description_i18n = input.description_i18n;
            if (input.viewableBy) body.viewableBy = input.viewableBy;
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno un campo (name, description, ecc.)' };
            try {
                const result = await liferayPatch(base, `/o/headless-admin-user/v1.0/user-groups/${input.userGroupId}`, body, user, pass);
                return { success: true, id: result.id, name: result.name, message: `Gruppo utente "${result.name}" aggiornato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'delete_user_group') {
            if (!input?.userGroupId) return { error: 'userGroupId obbligatorio per eliminare un gruppo utente' };
            try {
                await liferayDelete(base, `/o/headless-admin-user/v1.0/user-groups/${input.userGroupId}`, user, pass);
                return { success: true, message: `Gruppo utente con ID ${input.userGroupId} eliminato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── ASSIGN USER TO SITE ──────────────────────────────────────────

        if (name === 'assign_user_to_site') {
            if (!input?.userId) return { error: 'userId obbligatorio' };
            if (!input?.siteId) return { error: 'siteId obbligatorio' };
            try {
                // Verifica se l'utente è già assegnato al sito
                const currentUser = await liferayGet(base, `/o/headless-admin-user/v1.0/user-accounts/${input.userId}?fields=id,name,siteBriefs`, user, pass);
                const currentSites = currentUser.siteBriefs || [];
                const alreadyAssigned = currentSites.some(s => s.id === input.siteId);
                if (alreadyAssigned) {
                    return { success: true, message: `L'utente è già assegnato al sito con ID ${input.siteId}` };
                }
                // Usa l'endpoint dedicato per assegnare l'utente al sito
                await liferayPost(base, `/o/headless-site/v1.0/sites/${input.siteId}/user-accounts`, { id: input.userId }, user, pass);
                return { success: true, userId: input.userId, siteId: input.siteId, message: `Utente assegnato al sito con ID ${input.siteId} con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── ASSIGN ROLE TO USER ──────────────────────────────────────────

        if (name === 'assign_role_to_user') {
            if (!input?.userId) return { error: 'userId obbligatorio' };
            if (!input?.roleId) return { error: 'roleId obbligatorio' };
            try {
                // Recupera il ruolo per determinare il tipo (regular, site, organization, depot)
                const roleData = await liferayGet(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}?fields=id,name,roleType`, user, pass);
                const roleType = roleData.roleType;
                const roleName = roleData.name || `ID ${input.roleId}`;

                if (roleType === 'site') {
                    // I ruoli site richiedono il siteId nel path
                    const sid = input?.siteId || siteId;
                    if (!sid) return { error: 'siteId obbligatorio per i ruoli di tipo site. Specifica siteId o configura siteGroupId.' };
                    await liferayPost(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}/association/user-account/${input.userId}/site/${sid}`, {}, user, pass);
                    return { success: true, userId: input.userId, roleId: input.roleId, roleName, roleType, siteId: sid, message: `Ruolo site "${roleName}" (ID ${input.roleId}) assegnato all'utente ${input.userId} nel sito ${sid} con successo` };
                } else if (roleType === 'organization') {
                    // I ruoli organization richiedono l'organizationId nel path
                    if (!input?.organizationId) return { error: 'organizationId obbligatorio per i ruoli di tipo organization. Specifica l\'ID dell\'organizzazione.' };
                    await liferayPost(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}/association/user-account/${input.userId}/organization/${input.organizationId}`, {}, user, pass);
                    return { success: true, userId: input.userId, roleId: input.roleId, roleName, roleType, organizationId: input.organizationId, message: `Ruolo organization "${roleName}" (ID ${input.roleId}) assegnato all'utente ${input.userId} nell'organizzazione ${input.organizationId} con successo` };
                } else if (roleType === 'depot') {
                    // I ruoli depot (Asset Library) non sono supportati dall'endpoint di associazione diretta
                    return { error: `Il ruolo "${roleName}" è di tipo depot (Asset Library). L'assegnazione dei ruoli depot non è supportata tramite questa API. Usa le API Asset Library per gestire i ruoli depot.` };
                } else {
                    // I ruoli regular non richiedono contesto aggiuntivo
                    await liferayPost(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}/association/user-account/${input.userId}`, {}, user, pass);
                    return { success: true, userId: input.userId, roleId: input.roleId, roleName, roleType, message: `Ruolo ${roleType} "${roleName}" (ID ${input.roleId}) assegnato all'utente ${input.userId} con successo` };
                }
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── REMOVE ROLE FROM USER ─────────────────────────────────────────

        if (name === 'remove_role_from_user') {
            if (!input?.userId) return { error: 'userId obbligatorio' };
            if (!input?.roleId) return { error: 'roleId obbligatorio' };
            try {
                // Recupera il ruolo per determinare il tipo (regular, site, organization, depot)
                const roleData = await liferayGet(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}?fields=id,name,roleType`, user, pass);
                const roleType = roleData.roleType;
                const roleName = roleData.name || `ID ${input.roleId}`;

                if (roleType === 'site') {
                    const sid = input?.siteId || siteId;
                    if (!sid) return { error: 'siteId obbligatorio per i ruoli di tipo site. Specifica siteId o configura siteGroupId.' };
                    await liferayDelete(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}/association/user-account/${input.userId}/site/${sid}`, user, pass);
                    return { success: true, userId: input.userId, roleId: input.roleId, roleName, roleType, siteId: sid, message: `Ruolo site "${roleName}" (ID ${input.roleId}) rimosso dall'utente ${input.userId} nel sito ${sid} con successo` };
                } else if (roleType === 'organization') {
                    if (!input?.organizationId) return { error: 'organizationId obbligatorio per i ruoli di tipo organization. Specifica l\'ID dell\'organizzazione.' };
                    await liferayDelete(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}/association/user-account/${input.userId}/organization/${input.organizationId}`, user, pass);
                    return { success: true, userId: input.userId, roleId: input.roleId, roleName, roleType, organizationId: input.organizationId, message: `Ruolo organization "${roleName}" (ID ${input.roleId}) rimosso dall'utente ${input.userId} nell'organizzazione ${input.organizationId} con successo` };
                } else if (roleType === 'depot') {
                    return { error: `Il ruolo "${roleName}" è di tipo depot (Asset Library). La rimozione dei ruoli depot non è supportata tramite questa API. Usa le API Asset Library per gestire i ruoli depot.` };
                } else {
                    await liferayDelete(base, `/o/headless-admin-user/v1.0/roles/${input.roleId}/association/user-account/${input.userId}`, user, pass);
                    return { success: true, userId: input.userId, roleId: input.roleId, roleName, roleType, message: `Ruolo ${roleType} "${roleName}" (ID ${input.roleId}) rimosso dall'utente ${input.userId} con successo` };
                }
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── GET SITE DETAILS ─────────────────────────────────────────────

        if (name === 'get_site_details') {
            const sid = input?.siteId || siteId;
            if (!sid) return { error: 'siteId obbligatorio o siteGroupId non configurato' };
            try {
                const site = await liferayGet(base, `/o/headless-site/v1.0/sites/${sid}?fields=id,name,description,friendlyUrlPath,type`, user, pass);
                let pages = null;
                let members = null;
                try { pages = await liferayGet(base, `/o/headless-site/v1.0/sites/${sid}/site-pages?pageSize=50&fields=id,title,friendlyUrlPath,type`, user, pass); } catch (e) { dbg('get_site_details: pages fetch failed:', e.message); }
                try { members = await liferayGet(base, `/o/headless-admin-user/v1.0/user-accounts?pageSize=50&fields=id,name,emailAddress`, user, pass); } catch (e) { dbg('get_site_details: members fetch failed:', e.message); }
                return {
                    id: site.id,
                    name: site.name,
                    description: site.description || null,
                    friendlyUrlPath: site.friendlyUrlPath || null,
                    type: site.type || null,
                    pages: pages?.items?.map(p => ({ id: p.id, title: p.title, friendlyUrlPath: p.friendlyUrlPath, type: p.type })) || [],
                    pagesCount: pages?.totalCount || 0,
                    members: members?.items?.map(m => ({ id: m.id, name: m.name, emailAddress: m.emailAddress })) || [],
                    membersCount: members?.totalCount || 0,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── CREATE SITE ──────────────────────────────────────────────────

        if (name === 'create_site') {
            if (!input?.name) return { error: 'name obbligatorio per creare un sito' };
            const body = { name: input.name };
            if (input.description) body.description = input.description;
            if (input.membershipType) body.membershipType = input.membershipType;
            if (input.friendlyUrlPath) body.friendlyUrlPath = input.friendlyUrlPath;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (input.parentSiteKey) body.parentSiteKey = input.parentSiteKey;
            if (input.templateKey) body.templateKey = input.templateKey;
            if (input.templateType) body.templateType = input.templateType;
            if (input.typeSettings) body.typeSettings = input.typeSettings;
            if (input.active !== undefined) body.active = input.active;
            if (input.manualMembership !== undefined) body.manualMembership = input.manualMembership;
            try {
                const result = await liferayPost(base, '/o/headless-site/v1.0/sites', body, user, pass);
                return {
                    success: true,
                    id: result.id,
                    name: result.name,
                    friendlyUrlPath: result.friendlyUrlPath,
                    membershipType: result.membershipType,
                    key: result.key,
                    externalReferenceCode: result.externalReferenceCode,
                    message: `Sito "${result.name}" creato con successo (ID: ${result.id})`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── UPDATE SITE ──────────────────────────────────────────────────

        if (name === 'update_site') {
            if (!input?.siteId) return { error: 'siteId obbligatorio per aggiornare un sito' };
            // Liferay Site API: PUT /o/headless-site/v1.0/sites with id in body (NOT PATCH on /sites/{id})
            const body = { id: input.siteId };
            if (input.name) body.name = input.name;
            if (input.description) body.description = input.description;
            if (input.membershipType) body.membershipType = input.membershipType;
            if (input.friendlyUrlPath) body.friendlyUrlPath = input.friendlyUrlPath;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            if (input.typeSettings) body.typeSettings = input.typeSettings;
            if (input.active !== undefined) body.active = input.active;
            if (input.manualMembership !== undefined) body.manualMembership = input.manualMembership;
            try {
                const result = await liferayPut(base, '/o/headless-site/v1.0/sites', body, user, pass);
                return {
                    success: true,
                    id: result.id,
                    name: result.name,
                    friendlyUrlPath: result.friendlyUrlPath,
                    membershipType: result.membershipType,
                    message: `Sito "${result.name}" (ID: ${result.id}) aggiornato con successo`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── DELETE SITE ──────────────────────────────────────────────────

        if (name === 'delete_site') {
            if (!input?.siteId) return { error: 'siteId obbligatorio per eliminare un sito' };
            try {
                await liferayDelete(base, `/o/headless-site/v1.0/sites/${input.siteId}`, user, pass);
                return { success: true, siteId: input.siteId, message: `Sito ID ${input.siteId} eliminato con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── MASTER PAGES ──────────────────────────────────────────────────

        // Helper: risolve siteERC dal siteId
        async function getSiteErcFromSiteId(sid) {
            try {
                const siteData = await liferayGet(base, `/o/headless-site/v1.0/sites/${sid}`, user, pass);
                return siteData.externalReferenceCode || null;
            } catch (e) { dbg('getSiteErcFromSiteId fallito:', e.message); return null; }
        }

        // ── LIST MASTER PAGES ─────────────────────────────────────────────

        if (name === 'list_master_pages') {
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            try {
                const pageSize = input?.page_size || 20;
                const data = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/master-pages?pageSize=${pageSize}`, user, pass);
                const items = (data.items || []).map(mp => ({
                    name: mp.name,
                    key: mp.key,
                    externalReferenceCode: mp.externalReferenceCode,
                    uuid: mp.uuid,
                    markedAsDefault: mp.markedAsDefault,
                    dateCreated: mp.dateCreated,
                    dateModified: mp.dateModified,
                }));
                return { totalCount: data.totalCount || items.length, items };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── CREATE MASTER PAGE ────────────────────────────────────────────

        if (name === 'create_master_page') {
            if (!input?.name) return { error: 'name obbligatorio per creare una master page' };
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            const body = { name: input.name };
            if (input.key) body.key = input.key;
            if (input.markedAsDefault !== undefined) body.markedAsDefault = input.markedAsDefault;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            try {
                const result = await liferayPost(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/master-pages`, body, user, pass);
                return {
                    success: true,
                    name: result.name,
                    key: result.key,
                    externalReferenceCode: result.externalReferenceCode,
                    uuid: result.uuid,
                    markedAsDefault: result.markedAsDefault,
                    message: `Master Page "${result.name}" creata con successo`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── UPDATE MASTER PAGE ────────────────────────────────────────────

        if (name === 'update_master_page') {
            if (!input?.masterPageId && !input?.masterPageErc) return { error: 'masterPageId o masterPageErc obbligatorio per aggiornare una master page' };
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            // Risolvi l'ERC se è stato fornito solo l'ID numerico
            let mpErc = input.masterPageErc;
            if (!mpErc && input.masterPageId) {
                try {
                    const list = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/master-pages?pageSize=200`, user, pass);
                    const found = (list.items || []).find(mp => mp.uuid === String(input.masterPageId) || mp.externalReferenceCode === String(input.masterPageId));
                    if (found) mpErc = found.externalReferenceCode;
                    else return { error: `Master Page con ID "${input.masterPageId}" non trovata` };
                } catch (e) { return { error: `Errore nella ricerca della master page: ${e.message || String(e)}` }; }
            }
            const body = {};
            if (input.name) body.name = input.name;
            if (input.key) body.key = input.key;
            if (input.markedAsDefault !== undefined) body.markedAsDefault = input.markedAsDefault;
            if (input.name_i18n) body.name_i18n = input.name_i18n;
            try {
                const result = await liferayPatch(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/master-pages/${mpErc}`, body, user, pass);
                return {
                    success: true,
                    name: result.name,
                    key: result.key,
                    externalReferenceCode: result.externalReferenceCode,
                    markedAsDefault: result.markedAsDefault,
                    message: `Master Page "${result.name}" aggiornata con successo`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── DELETE MASTER PAGE ─────────────────────────────────────────────

        if (name === 'delete_master_page') {
            if (!input?.masterPageId && !input?.masterPageErc) return { error: 'masterPageId o masterPageErc obbligatorio per eliminare una master page' };
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            // Risolvi l'ERC se è stato fornito solo l'ID numerico
            let mpErc = input.masterPageErc;
            if (!mpErc && input.masterPageId) {
                try {
                    const list = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/master-pages?pageSize=200`, user, pass);
                    const found = (list.items || []).find(mp => mp.uuid === String(input.masterPageId) || mp.externalReferenceCode === String(input.masterPageId));
                    if (found) mpErc = found.externalReferenceCode;
                    else return { error: `Master Page con ID "${input.masterPageId}" non trovata` };
                } catch (e) { return { error: `Errore nella ricerca della master page: ${e.message || String(e)}` }; }
            }
            try {
                await liferayDelete(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/master-pages/${mpErc}`, user, pass);
                return { success: true, message: `Master Page eliminata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── UTILITY PAGES ──────────────────────────────────────────────────

        // ── LIST UTILITY PAGES ─────────────────────────────────────────────

        if (name === 'list_utility_pages') {
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            try {
                const pageSize = input?.page_size || 20;
                const data = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/utility-pages?pageSize=${pageSize}`, user, pass);
                const items = (data.items || []).map(up => ({
                    name: up.name,
                    type: up.type,
                    externalReferenceCode: up.externalReferenceCode,
                    uuid: up.uuid,
                    markedAsDefault: up.markedAsDefault,
                    dateCreated: up.dateCreated,
                    dateModified: up.dateModified,
                }));
                return { totalCount: data.totalCount || items.length, items };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── CREATE UTILITY PAGE ────────────────────────────────────────────

        if (name === 'create_utility_page') {
            if (!input?.name) return { error: 'name obbligatorio per creare una utility page' };
            if (!input?.type) return { error: 'type obbligatorio per creare una utility page. Valori possibili: ErrorCode404, ErrorCode500, CookiePolicy, CreateAccount, ForgotPassword, Login' };
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            const body = { name: input.name, type: input.type };
            if (input.markedAsDefault !== undefined) body.markedAsDefault = input.markedAsDefault;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            if (input.friendlyUrlPath_i18n) body.friendlyUrlPath_i18n = input.friendlyUrlPath_i18n;
            if (input.utilityPageSettings) body.utilityPageSettings = input.utilityPageSettings;
            try {
                const result = await liferayPost(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/utility-pages`, body, user, pass);
                return {
                    success: true,
                    name: result.name,
                    type: result.type,
                    externalReferenceCode: result.externalReferenceCode,
                    uuid: result.uuid,
                    markedAsDefault: result.markedAsDefault,
                    message: `Utility Page "${result.name}" creata con successo`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── UPDATE UTILITY PAGE ────────────────────────────────────────────

        if (name === 'update_utility_page') {
            if (!input?.utilityPageId && !input?.utilityPageErc) return { error: 'utilityPageId o utilityPageErc obbligatorio per aggiornare una utility page' };
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            // Risolvi l'ERC se è stato fornito solo l'ID numerico
            let upErc = input.utilityPageErc;
            if (!upErc && input.utilityPageId) {
                try {
                    const list = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/utility-pages?pageSize=200`, user, pass);
                    const found = (list.items || []).find(up => up.uuid === String(input.utilityPageId) || up.externalReferenceCode === String(input.utilityPageId));
                    if (found) upErc = found.externalReferenceCode;
                    else return { error: `Utility Page con ID "${input.utilityPageId}" non trovata` };
                } catch (e) { return { error: `Errore nella ricerca della utility page: ${e.message || String(e)}` }; }
            }
            const body = {};
            if (input.name) body.name = input.name;
            if (input.markedAsDefault !== undefined) body.markedAsDefault = input.markedAsDefault;
            if (input.friendlyUrlPath_i18n) body.friendlyUrlPath_i18n = input.friendlyUrlPath_i18n;
            if (input.utilityPageSettings) body.utilityPageSettings = input.utilityPageSettings;
            try {
                const result = await liferayPatch(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/utility-pages/${upErc}`, body, user, pass);
                return {
                    success: true,
                    name: result.name,
                    type: result.type,
                    externalReferenceCode: result.externalReferenceCode,
                    markedAsDefault: result.markedAsDefault,
                    message: `Utility Page "${result.name}" aggiornata con successo`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── DELETE UTILITY PAGE ─────────────────────────────────────────────

        if (name === 'delete_utility_page') {
            if (!input?.utilityPageId && !input?.utilityPageErc) return { error: 'utilityPageId o utilityPageErc obbligatorio per eliminare una utility page' };
            const siteErc = await getSiteErcFromSiteId(siteId);
            if (!siteErc) return { error: 'Impossibile risolvere il siteERC per il sito corrente' };
            // Risolvi l'ERC se è stato fornito solo l'ID numerico
            let upErc = input.utilityPageErc;
            if (!upErc && input.utilityPageId) {
                try {
                    const list = await liferayGet(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/utility-pages?pageSize=200`, user, pass);
                    const found = (list.items || []).find(up => up.uuid === String(input.utilityPageId) || up.externalReferenceCode === String(input.utilityPageId));
                    if (found) upErc = found.externalReferenceCode;
                    else return { error: `Utility Page con ID "${input.utilityPageId}" non trovata` };
                } catch (e) { return { error: `Errore nella ricerca della utility page: ${e.message || String(e)}` }; }
            }
            try {
                await liferayDelete(base, `/o/headless-admin-site/v1.0/sites/${siteErc}/utility-pages/${upErc}`, user, pass);
                return { success: true, message: `Utility Page eliminata con successo` };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        if (name === 'user_management_help') {
            return {
                info: 'Gestione utenti Liferay — Informazioni sui tool disponibili',
                tools: {
                    create_user: {
                        description: 'Crea un nuovo utente nel portale. ATTENZIONE: organizationBriefs e userGroupBriefs NON funzionano — per associare utente a organizzazione/gruppo usare il pannello di controllo Liferay.',
                        required: ['alternateName (screen name) oppure emailAddress'],
                        optional_fields: {
                            givenName: 'Nome',
                            familyName: 'Cognome',
                            emailAddress: 'Email',
                            password: 'Password iniziale',
                            alternateName: 'Screen name (obbligatorio se manca email)',
                            jobTitle: 'Titolo/ruolo lavorativo',
                            gender: 'Sesso (0=non specificato, 1=maschio, 2=femmina)',
                            birthday: 'Data di nascita (YYYY-MM-DD)',
                            comment: 'Note sull\'utente',
                            agreedToTermsOfUse: 'Accetta i termini di utilizzo (boolean)',
                            passwordNeverExpires: 'Password senza scadenza (boolean)',
                            sendResetPasswordEmail: 'Invia email reset password (boolean)',
                            roleBriefs: 'Array di ruoli [{id, name}] — usa get_available_roles per la lista',
                            siteBriefs: 'Array di siti [{id, name}]',
                            givenName_i18n: 'Nome localizzato {it_IT: "...", en_US: "..."}',
                            familyName_i18n: 'Cognome localizzato {it_IT: "...", en_US: "..."}',
                        },
                        not_supported: {
                            organizationBriefs: 'NON supportato dalle API Headless. Per associare un utente a un\'organizzazione usare il pannello di controllo Liferay (Control Panel → Users → Edit User → Organizations).',
                            userGroupBriefs: 'NON supportato dalle API Headless. Per associare un utente a un gruppo utente usare il pannello di controllo Liferay (Control Panel → Users → Edit User → User Groups).',
                        },
                    },
                    update_user: {
                        description: 'Aggiorna un utente esistente (PATCH — solo i campi forniti). ATTENZIONE: organizationBriefs e userGroupBriefs NON funzionano.',
                        required: ['userId'],
                        optional_fields: 'Stessi campi di create_user (tranne sendResetPasswordEmail). Fornisci solo i campi da modificare. organizationBriefs e userGroupBriefs NON funzionano.',
                    },
                    delete_user: {
                        description: 'Elimina un utente dal portale',
                        required: ['userId'],
                    },
                    get_user_detail: {
                        description: 'Recupera il dettaglio completo di un utente (ruoli, organizzazioni, gruppi)',
                        required: ['userId'],
                    },
                    get_users: {
                        description: 'Elenca gli utenti del portale con ricerca opzionale',
                        parameters: { page_size: 'numero risultati (default 20)', search: 'filtro di ricerca' },
                    },
                    get_available_roles: {
                        description: 'Elenca i ruoli disponibili nel portale (per assegnarli con create_user/update_user)',
                    },
                    get_available_organizations: {
                        description: 'Elenca le organizzazioni disponibili nel portale',
                    },
                    get_available_user_groups: {
                        description: 'Elenca i gruppi utente disponibili nel portale',
                    },
                    create_role: {
                        description: 'Crea un nuovo ruolo nel portale',
                        required: ['name'],
                        optional_fields: {
                            description: 'Descrizione del ruolo',
                            roleType: 'Tipo di ruolo: regular (default), site, organization',
                            name_i18n: 'Nome localizzato {it_IT: "...", en_US: "..."}',
                            description_i18n: 'Descrizione localizzata',
                            externalReferenceCode: 'Codice riferimento esterno',
                            permissions: 'Array di permessi [{actionId, resourcePrimaryKey, scope}]',
                            viewableBy: 'Visibilità',
                        },
                    },
                    update_role: {
                        description: 'Aggiorna un ruolo esistente (PATCH — solo i campi forniti)',
                        required: ['roleId'],
                        optional_fields: 'name, description, roleType, name_i18n, description_i18n, permissions, viewableBy',
                    },
                    delete_role: {
                        description: 'Elimina un ruolo dal portale',
                        required: ['roleId'],
                    },
                    create_organization: {
                        description: 'Crea una nuova organizzazione nel portale. NOTA: non è possibile associare utenti a un\'organizzazione tramite le API Headless — usare il pannello di controllo Liferay.',
                        required: ['name'],
                        optional_fields: {
                            description: 'Descrizione dell\'organizzazione',
                            parentOrganizationId: 'ID dell\'organizzazione padre (per creare sotto-organizzazioni)',
                            name_i18n: 'Nome localizzato {it_IT: "...", en_US: "..."}',
                            description_i18n: 'Descrizione localizzata',
                            externalReferenceCode: 'Codice riferimento esterno',
                            status: 'Stato: 0=attivo, 1=inattivo',
                            viewableBy: 'Visibilità',
                        },
                    },
                    update_organization: {
                        description: 'Aggiorna un\'organizzazione esistente (PATCH — solo i campi forniti)',
                        required: ['organizationId'],
                        optional_fields: 'name, description, parentOrganizationId, name_i18n, description_i18n, status, viewableBy',
                    },
                    delete_organization: {
                        description: 'Elimina un\'organizzazione dal portale',
                        required: ['organizationId'],
                    },
                    create_user_group: {
                        description: 'Crea un nuovo gruppo utente nel portale',
                        required: ['name'],
                        optional_fields: {
                            description: 'Descrizione del gruppo utente',
                            name_i18n: 'Nome localizzato {it_IT: "...", en_US: "..."}',
                            description_i18n: 'Descrizione localizzata',
                            externalReferenceCode: 'Codice riferimento esterno',
                            viewableBy: 'Visibilità',
                        },
                    },
                    update_user_group: {
                        description: 'Aggiorna un gruppo utente esistente (PATCH — solo i campi forniti)',
                        required: ['userGroupId'],
                        optional_fields: 'name, description, name_i18n, description_i18n, viewableBy',
                    },
                    delete_user_group: {
                        description: 'Elimina un gruppo utente dal portale',
                        required: ['userGroupId'],
                    },
                    assign_user_to_site: {
                        description: 'Assegna un utente a un sito specifico (usa endpoint dedicato POST /sites/{siteId}/user-accounts)',
                        required: ['userId', 'siteId'],
                        note: 'Per le organizzazioni NON è possibile associare utenti tramite API — usare il pannello di controllo Liferay.',
                    },
                    assign_role_to_user: {
                        description: 'Assegna un ruolo a un utente. Il tipo di ruolo determina l\'endpoint usato:',
                        required: ['userId', 'roleId'],
                        parameters: {
                            userId: 'ID dell\'utente (campo id restituito da get_users)',
                            roleId: 'ID del ruolo (campo id restituito da get_available_roles)',
                            siteId: 'ID del sito — obbligatorio SOLO per ruoli di tipo "site" (es. Site Administrator, Site Member, Site Owner)',
                            organizationId: 'ID dell\'organizzazione — obbligatorio SOLO per ruoli di tipo "organization" (es. Organization Administrator, Organization Owner, Organization User)',
                        },
                        endpoint_per_roleType: {
                            regular: 'POST /roles/{roleId}/association/user-account/{userId}',
                            site: 'POST /roles/{roleId}/association/user-account/{userId}/site/{siteId}',
                            organization: 'POST /roles/{roleId}/association/user-account/{userId}/organization/{organizationId} — NOTA: l\'utente deve già essere membro dell\'organizzazione (non è possibile associarlo tramite API)',
                            depot: 'NON supportato — gestire i ruoli Asset Library dal pannello di controllo Liferay',
                        },
                    },
                    remove_role_from_user: {
                        description: 'Rimuove un ruolo da un utente. Stessa logica di assign_role_to_user ma con DELETE:',
                        required: ['userId', 'roleId'],
                        parameters: {
                            userId: 'ID dell\'utente',
                            roleId: 'ID del ruolo da rimuovere',
                            siteId: 'ID del sito — obbligatorio SOLO per ruoli di tipo "site"',
                            organizationId: 'ID dell\'organizzazione — obbligatorio SOLO per ruoli di tipo "organization"',
                        },
                    },
                    get_site_details: {
                        description: 'Recupera i dettagli completi di un sito: nome, descrizione, tipo, pagine, membri',
                        required: [],
                        parameters: { siteId: 'ID del sito (se non fornito, usa il sito corrente)' },
                    },
                    create_site: {
                        description: 'Crea un nuovo sito nel portale. Usa l\'API Headless Site POST /o/headless-site/v1.0/sites',
                        required: ['name'],
                        optional_fields: {
                            description: 'Descrizione localizzata, es. {"it-IT": "Descrizione", "en-US": "Description"}',
                            membershipType: 'Tipo di membership: open (default), private, restricted',
                            friendlyUrlPath: 'URL amichevole (es. "mio-sito"). Se non specificato, generato dal nome',
                            name_i18n: 'Nome localizzato {"it-IT": "Mio Sito", "en-US": "My Site"}',
                            externalReferenceCode: 'Codice riferimento esterno',
                            parentSiteKey: 'Key del sito padre (per sotto-siti)',
                            templateKey: 'Key del template sito',
                            templateType: 'Tipo di template: site-initializer o site-template',
                            typeSettings: 'Impostazioni tipo, es. {"locales": "it_IT,en_US"}',
                            active: 'Se il sito è attivo (default: true)',
                            manualMembership: 'Se la membership è manuale (default: true)',
                        },
                    },
                    update_site: {
                        description: 'Aggiorna un sito esistente. ATTENZIONE: usa PUT su /o/headless-site/v1.0/sites con l\'id nel body (non PATCH su /sites/{id}). Fornisci siteId e solo i campi da modificare.',
                        required: ['siteId'],
                        optional_fields: 'name, description, membershipType, friendlyUrlPath, name_i18n, typeSettings, active, manualMembership',
                    },
                    delete_site: {
                        description: 'Elimina un sito dal portale. Attenzione: azione irreversibile — elimina il sito e tutti i suoi contenuti.',
                        required: ['siteId'],
                    },
                    list_master_pages: {
                        description: 'Elenca le Master Page (pagine master/layout) del sito. Restituisce nome, chiave, ERC, UUID e se è quella predefinita.',
                        required: [],
                        parameters: { page_size: 'Numero di risultati per pagina (default: 20)' },
                    },
                    create_master_page: {
                        description: 'Crea una nuova Master Page (pagina master/layout) nel sito. Usa l\'API Headless Admin Site POST /sites/{siteERC}/master-pages',
                        required: ['name'],
                        optional_fields: {
                            key: 'Chiave univoca della master page (se non specificata, generata dal nome)',
                            markedAsDefault: 'Se la master page è quella predefinita (default: false)',
                            externalReferenceCode: 'Codice riferimento esterno',
                            name_i18n: 'Nome localizzato {"it-IT": "Layout Principale", "en-US": "Main Layout"}',
                        },
                    },
                    update_master_page: {
                        description: 'Aggiorna una Master Page esistente (PATCH). Fornisci masterPageId (ID numerico) o masterPageErc (externalReferenceCode) e i campi da modificare.',
                        required: ['masterPageId o masterPageErc'],
                        optional_fields: 'name, key, markedAsDefault, name_i18n',
                    },
                    delete_master_page: {
                        description: 'Elimina una Master Page dal sito. Attenzione: azione irreversibile. Fornisci masterPageId o masterPageErc.',
                        required: ['masterPageId o masterPageErc'],
                    },
                    list_utility_pages: {
                        description: 'Elenca le Utility Page del sito (pagine di utilità come 404, 500, session expired)',
                        required: [],
                        parameters: { page_size: 'Numero di risultati per pagina (default: 20)' },
                    },
                    create_utility_page: {
                        description: 'Crea una nuova Utility Page nel sito. Usa l\'API Headless Admin Site POST /sites/{siteERC}/utility-pages. IL CAMPO type È OBBLIGATORIO.',
                        required: ['name', 'type'],
                        optional_fields: {
                            type: 'OBBLIGATORIO. Valori possibili: ErrorCode404, ErrorCode500, CookiePolicy, CreateAccount, ForgotPassword, Login',
                            markedAsDefault: 'Se la utility page è quella predefinita per il suo tipo (default: false)',
                            externalReferenceCode: 'Codice riferimento esterno',
                            friendlyUrlPath_i18n: 'URL amichevole localizzato {"it-IT": "/404", "en-US": "/404"}',
                            utilityPageSettings: 'Impostazioni della utility page (seoSettings con description_i18n e htmlTitle_i18n)',
                        },
                    },
                    update_utility_page: {
                        description: 'Aggiorna una Utility Page esistente (PATCH). Fornisci utilityPageId o utilityPageErc e i campi da modificare.',
                        required: ['utilityPageId o utilityPageErc'],
                        optional_fields: 'name, markedAsDefault, friendlyUrlPath_i18n, utilityPageSettings',
                    },
                    delete_utility_page: {
                        description: 'Elimina una Utility Page dal sito. Attenzione: azione irreversibile. Fornisci utilityPageId o utilityPageErc.',
                        required: ['utilityPageId o utilityPageErc'],
                    },
                },
                examples: {
                    crea_utente_con_ruolo: 'create_user({ alternateName: "mrossi", givenName: "Mario", familyName: "Rossi", emailAddress: "mario.rossi@esempio.it", roleBriefs: [{ name: "Power User" }] })',
                    crea_utente_avviso_org: 'NOTA: organizationBriefs e userGroupBriefs NON funzionano nelle API Headless. Per associare un utente a un\'organizzazione o gruppo utente, usare il pannello di controllo Liferay.',
                    aggiorna_ruoli: 'update_user({ userId: 12345, roleBriefs: [{ name: "Administrator" }] })',
                    elimina_utente: 'delete_user({ userId: 12345 })',
                    crea_ruolo: 'create_role({ name: "Responsabile Qualità", description: "Responsabile del controllo qualità", roleType: "regular" })',
                    aggiorna_ruolo: 'update_role({ roleId: 56789, description: "Nuova descrizione del ruolo" })',
                    elimina_ruolo: 'delete_role({ roleId: 56789 })',
                    crea_organizzazione: 'create_organization({ name: "Dipartimento IT", description: "Dipartimento Informatico" })',
                    crea_sotto_org: 'create_organization({ name: "Team Sviluppo", parentOrganizationId: 12345, description: "Team di sviluppo software" })',
                    aggiorna_org: 'update_organization({ organizationId: 12345, description: "Nuova descrizione" })',
                    elimina_org: 'delete_organization({ organizationId: 12345 })',
                    crea_gruppo_utente: 'create_user_group({ name: "Amministratori IT", description: "Gruppo degli amministratori IT" })',
                    aggiorna_gruppo_utente: 'update_user_group({ userGroupId: 56789, description: "Nuova descrizione" })',
                    elimina_gruppo_utente: 'delete_user_group({ userGroupId: 56789 })',
                    assegna_utente_sito: 'assign_user_to_site({ userId: 12345, siteId: 67890 })',
                    assegna_ruolo_regular: 'assign_role_to_user({ userId: 12345, roleId: 56789 })  // ruolo regular, non serve siteId né organizationId',
                    assegna_ruolo_site: 'assign_role_to_user({ userId: 12345, roleId: 56789, siteId: 67890 })  // ruolo site, serve siteId',
                    assegna_ruolo_organization: 'assign_role_to_user({ userId: 12345, roleId: 56789, organizationId: 99999 })  // ruolo organization, serve organizationId',
                    rimuovi_ruolo_regular: 'remove_role_from_user({ userId: 12345, roleId: 56789 })  // ruolo regular',
                    rimuovi_ruolo_site: 'remove_role_from_user({ userId: 12345, roleId: 56789, siteId: 67890 })  // ruolo site',
                    crea_object_con_tipi: 'create_object({ object_name: "Segnalazione", label_en: "Report", label_it: "Segnalazione", fields: [{ name: "titolo", label_en: "Title", label_it: "Titolo", type: "TEXT", required: true }, { name: "descrizione", label_en: "Description", label_it: "Descrizione", type: "LONGTEXT" }, { name: "priorita", label_en: "Priority", label_it: "Priorità", type: "INTEGER", indexed: true }, { name: "costo", label_en: "Cost", label_it: "Costo", type: "DECIMAL" }, { name: "risolto", label_en: "Resolved", label_it: "Risolto", type: "BOOLEAN" }, { name: "scadenza", label_en: "Deadline", label_it: "Scadenza", type: "DATE" }] })',
                    rimuovi_ruolo_organization: 'remove_role_from_user({ userId: 12345, roleId: 56789, organizationId: 99999 })  // ruolo organization',
                    dettagli_sito: 'get_site_details({ siteId: 67890 })',
                    crea_sito: 'create_site({ name: "Nuovo Sito", membershipType: "open", description: { "it-IT": "Sito di test" } })',
                    aggiorna_sito: 'update_site({ siteId: 67890, name: "Sito Rinominato", description: { "it-IT": "Nuova descrizione" } })',
                    elimina_sito: 'delete_site({ siteId: 67890 })',
                    lista_master_pages: 'list_master_pages({})',
                    crea_master_page: 'create_master_page({ name: "Layout Principale", markedAsDefault: true })',
                    aggiorna_master_page: 'update_master_page({ masterPageErc: "abc123", name: "Layout Aggiornato" })',
                    elimina_master_page: 'delete_master_page({ masterPageErc: "abc123" })',
                    lista_utility_pages: 'list_utility_pages({})',
                    crea_utility_page: 'create_utility_page({ name: "Pagina 404 Custom", type: "ErrorCode404", markedAsDefault: false })',
                    aggiorna_utility_page: 'update_utility_page({ utilityPageErc: "abc123", name: "Pagina Errore" })',
                    elimina_utility_page: 'delete_utility_page({ utilityPageErc: "abc123" })',
                },
            };
        }

        // ── OBJECT ENTRY CRUD ─────────────────────────────────────────────────

        if (name === 'create_object_entry') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            if (!input?.fields || typeof input.fields !== 'object' || Object.keys(input.fields).length === 0) return { error: 'fields obbligatorio — oggetto con i campi e i valori da inserire' };
            const objName = input.object_name;
            const restPath = await resolveObjectRestPath(base, objName, user, pass);
            const body = { ...input.fields };
            if (input.object_entry_folder_id) {
                body.objectEntryFolderId = input.object_entry_folder_id;
            }
            const scopeKey = input.scope_key || null;

            if (scopeKey) {
                // Site-scoped: usa il restPath corretto con scopes
                try {
                    const result = await liferayPost(base, `${restPath}/scopes/${encodeURIComponent(scopeKey)}`, body, user, pass);
                    return { success: true, id: result.id, objectName: objName, scope: scopeKey, message: `Voce creata con successo nell'Object "${objName}" (Space: ${scopeKey})`, entry: result };
                } catch (e) {
                    // Se fallisce con scopeKey, prova senza (company scope)
                    dbg(`create_object_entry: scope "${scopeKey}" fallito, provo company scope:`, e.message);
                }
            }

            // Prova company scope
            try {
                const result = await liferayPost(base, restPath, body, user, pass);
                return { success: true, id: result.id, objectName: objName, scope: 'company', message: `Voce creata con successo nell'Object "${objName}"`, entry: result };
            } catch (e1) {
                // Se fallisce, prova a cercare negli Spaces accessibili
                dbg(`create_object_entry: company scope fallito per "${objName}":`, e1.message);
            }

            // Fallback: cerca negli asset libraries
            let assetLibraries = [];
            try {
                const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass);
                assetLibraries = libData.items || [];
            } catch (e2) {
                return { error: `Impossibile creare la voce nell'Object "${objName}": ${e1.message}`, objectName: objName };
            }

            if (assetLibraries.length === 0) {
                return { error: `Impossibile creare la voce nell'Object "${objName}": nessuno Space disponibile`, objectName: objName };
            }

            for (const lib of assetLibraries) {
                const libId = lib.externalReferenceCode || lib.id;
                const libName = lib.name || String(lib.id);
                const scopeKeyAttempt = lib.name || lib.externalReferenceCode || String(libId);
                try {
                    const result = await liferayPost(base, `${restPath}/scopes/${encodeURIComponent(scopeKeyAttempt)}`, body, user, pass);
                    return { success: true, id: result.id, objectName: objName, scope: scopeKeyAttempt, message: `Voce creata con successo nell'Object "${objName}" (Space: ${libName})`, entry: result };
                } catch (e3) { dbg(`create_object_entry: scope "${scopeKeyAttempt}" fallito:`, e3.message); }
            }

            return { error: `Impossibile creare la voce nell'Object "${objName}". Verifica che l'Object esista e che tu abbia i permessi necessari.`, objectName: objName };
        }

        if (name === 'update_object_entry') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            if (!input?.entry_id) return { error: 'entry_id obbligatorio' };
            if (!input?.fields || typeof input.fields !== 'object' || Object.keys(input.fields).length === 0) return { error: 'fields obbligatorio — oggetto con i campi da modificare' };
            const objName = input.object_name;
            const restPath = await resolveObjectRestPath(base, objName, user, pass);
            const entryId = input.entry_id;
            const body = { ...input.fields };
            const scopeKey = input.scope_key || null;

            if (scopeKey) {
                try {
                    const result = await liferayPatch(base, `${restPath}/scopes/${encodeURIComponent(scopeKey)}/${entryId}`, body, user, pass);
                    return { success: true, id: result.id, objectName: objName, entryId, message: `Voce ${entryId} aggiornata con successo nell'Object "${objName}"`, entry: result };
                } catch (e) {
                    dbg(`update_object_entry: scope "${scopeKey}" fallito, provo company scope:`, e.message);
                }
            }

            // Prova company scope
            try {
                const result = await liferayPatch(base, `${restPath}/${entryId}`, body, user, pass);
                return { success: true, id: result.id, objectName: objName, entryId, message: `Voce ${entryId} aggiornata con successo nell'Object "${objName}"`, entry: result };
            } catch (e1) {
                // Fallback: cerca negli asset libraries
                dbg(`update_object_entry: company scope fallito per "${objName}":`, e1.message);
            }

            let assetLibraries = [];
            try {
                const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass);
                assetLibraries = libData.items || [];
            } catch (e2) {
                return { error: `Impossibile aggiornare la voce ${entryId} nell'Object "${objName}": ${e1.message}` };
            }

            for (const lib of assetLibraries) {
                const libId = lib.externalReferenceCode || lib.id;
                const scopeKeyAttempt = lib.name || lib.externalReferenceCode || String(libId);
                try {
                    const result = await liferayPatch(base, `${restPath}/scopes/${encodeURIComponent(scopeKeyAttempt)}/${entryId}`, body, user, pass);
                    return { success: true, id: result.id, objectName: objName, entryId, message: `Voce ${entryId} aggiornata con successo (Space: ${scopeKeyAttempt})`, entry: result };
                } catch (e3) { /* try next */ }
            }

            return { error: `Impossibile aggiornare la voce ${entryId} nell'Object "${objName}". Verifica permessi e scope.`, objectName: objName, entryId };
        }

        if (name === 'delete_object_entry') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            if (!input?.entry_id) return { error: 'entry_id obbligatorio' };
            const objName = input.object_name;
            const restPath = await resolveObjectRestPath(base, objName, user, pass);
            const entryId = input.entry_id;
            const scopeKey = input.scope_key || null;

            if (scopeKey) {
                try {
                    await liferayDelete(base, `${restPath}/scopes/${encodeURIComponent(scopeKey)}/${entryId}`, user, pass);
                    return { success: true, message: `Voce ${entryId} eliminata dall'Object "${objName}" (Space: ${scopeKey})` };
                } catch (e) {
                    dbg(`delete_object_entry: scope "${scopeKey}" fallito, provo company scope:`, e.message);
                }
            }

            // Prova company scope
            try {
                await liferayDelete(base, `${restPath}/${entryId}`, user, pass);
                return { success: true, message: `Voce ${entryId} eliminata dall'Object "${objName}"` };
            } catch (e1) {
                // Fallback: cerca negli asset libraries
                dbg(`delete_object_entry: company scope fallito per "${objName}":`, e1.message);
            }

            let assetLibraries = [];
            try {
                const libData = await liferayGet(base, '/o/headless-asset-library/v1.0/asset-libraries', user, pass);
                assetLibraries = libData.items || [];
            } catch (e2) {
                return { error: `Impossibile eliminare la voce ${entryId} dall'Object "${objName}": ${e1.message}` };
            }

            for (const lib of assetLibraries) {
                const libId = lib.externalReferenceCode || lib.id;
                const scopeKeyAttempt = lib.name || lib.externalReferenceCode || String(libId);
                try {
                    await liferayDelete(base, `${restPath}/scopes/${encodeURIComponent(scopeKeyAttempt)}/${entryId}`, user, pass);
                    return { success: true, message: `Voce ${entryId} eliminata dall'Object "${objName}" (Space: ${scopeKeyAttempt})` };
                } catch (e3) { /* try next */ }
            }

            return { error: `Impossibile eliminare la voce ${entryId} dall'Object "${objName}". Verifica permessi e scope.`, objectName: objName, entryId };
        }

        if (name === 'get_object_fields') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            const objName = input.object_name;

            // Strategia 1: cerca nella lista object-admin per nome (case-insensitive)
            // L'endpoint corretto è /o/object-admin/v1.0/object-definitions
            try {
                // Prova prima il nome esatto (es. "ArticleAi")
                const filterExact = encodeURIComponent(`name eq '${objName.replace(/'/g, "''")}'`);
                let listData = await liferayGet(base, `/o/object-admin/v1.0/object-definitions?filter=${filterExact}&pageSize=1`, user, pass);
                let found = (listData.items || [])[0];

                // Se non trovato, prova case-insensitive con contains
                if (!found) {
                    const filterContains = encodeURIComponent(`name contains '${objName.replace(/'/g, "''")}'`);
                    listData = await liferayGet(base, `/o/object-admin/v1.0/object-definitions?filter=${filterContains}&pageSize=5`, user, pass);
                    // Cerca match case-insensitive
                    found = (listData.items || []).find((o) => o.name.toLowerCase() === objName.toLowerCase()) || (listData.items || [])[0];
                }

                if (found) {
                    // Recupera la definizione completa con i campi
                    const objDef = await liferayGet(base, `/o/object-admin/v1.0/object-definitions/${found.id}?nestedFields=objectFields`, user, pass);
                    if (objDef?.objectFields) {
                        const fields = objDef.objectFields
                            .filter((f) => !f.system)
                            .map((f) => ({
                                name: f.name,
                                label: f.label?.it_IT || f.label?.en_US || f.name,
                                type: f.businessType || 'TEXT',
                                required: f.required || false,
                                indexed: f.indexed || false,
                            }));
                        return {
                            objectName: objDef.name,
                            objectLabel: objDef.label?.it_IT || objDef.label?.en_US || objDef.name,
                            scope: objDef.scope || 'company',
                            externalReferenceCode: objDef.externalReferenceCode,
                            restEndpoint: objDef.restContextPath || `/o/c/${objDef.name.toLowerCase()}s`,
                            fieldsCount: fields.length,
                            fields,
                        };
                    }
                }
            } catch (e1) {
                dbg(`get_object_fields: object-admin search fallito per "${objName}":`, e1.message);
            }

            // Strategia 2: prova con by-external-reference-code (per ERC noti)
            try {
                const objDef = await liferayGet(base, `/o/object-admin/v1.0/object-definitions/by-external-reference-code/${objName}?nestedFields=objectFields`, user, pass);
                if (objDef?.objectFields) {
                    const fields = objDef.objectFields
                        .filter((f) => !f.system)
                        .map((f) => ({
                            name: f.name,
                            label: f.label?.it_IT || f.label?.en_US || f.name,
                            type: f.businessType || 'TEXT',
                            required: f.required || false,
                            indexed: f.indexed || false,
                        }));
                    return {
                        objectName: objDef.name,
                        objectLabel: objDef.label?.it_IT || objDef.label?.en_US || objDef.name,
                        scope: objDef.scope || 'company',
                        externalReferenceCode: objDef.externalReferenceCode,
                        restEndpoint: objDef.restContextPath || `/o/c/${objDef.name.toLowerCase()}s`,
                        fieldsCount: fields.length,
                        fields,
                    };
                }
            } catch (e2) {
                dbg(`get_object_fields: by-erc fallito per "${objName}":`, e2.message);
            }

            // Strategia 3: inferisci i campi da una entry esistente
            try {
                const restPath = await resolveObjectRestPath(base, objName, user, pass);
                // Per oggetti site-scoped serve lo scope
                const scopeQs = siteId ? `?scope=${siteId}` : '?pageSize=1';
                const entries = await liferayGet(base, `${restPath}${scopeQs}`, user, pass);
                if (entries?.items?.[0]) {
                    const sample = entries.items[0];
                    const fields = Object.keys(sample).filter((k) => !k.startsWith('_') && k !== 'id' && k !== 'dateCreated' && k !== 'dateModified' && k !== 'creator').map((k) => ({
                        name: k,
                        type: typeof sample[k] === 'number' ? 'INTEGER' : typeof sample[k] === 'boolean' ? 'BOOLEAN' : 'TEXT',
                        required: false,
                    }));
                    return { objectName: objName, scope: 'unknown', fieldsCount: fields.length, fields, _source: 'inferred_from_entry' };
                }
            } catch (e3) {
                dbg(`get_object_fields: inferenza da entry fallita per "${objName}":`, e3.message);
            }

            return { error: `Object "${objName}" non trovato. Verifica il nome e usa get_custom_objects per la lista.`, objectName: objName };
        }

        // ── UPDATE OBJECT FIELD ─────────────────────────────────────────────
        if (name === 'update_object_field') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            const objName = input.object_name;

            // Se non è fornito field_id, cerca l'Object e il campo per nome
            let fieldId = input.field_id || null;
            let fieldName = input.field_name || null;

            if (!fieldId) {
                if (!fieldName) return { error: 'Specificare field_name o field_id per identificare il campo da aggiornare.' };

                const objDef = await findObjectDefinitionWithFields(base, objName, user, pass);
                if (!objDef) return { error: `Object "${objName}" non trovato. Usa get_custom_objects per la lista degli Object disponibili.`, objectName: objName };

                const field = objDef.objectFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
                if (!field) return { error: `Campo "${fieldName}" non trovato nell'Object "${objName}". Campi disponibili: ${objDef.objectFields.map((f) => f.name).join(', ')}`, objectName: objName, fieldName };

                fieldId = field.id;
                dbg(`update_object_field: trovato campo "${field.name}" con id=${fieldId}`);
            }

            // Costruisci il body di aggiornamento
            const updates = {};
            if (input.label) updates.label = input.label;
            if (input.businessType) updates.businessType = input.businessType;
            if (input.DBType) updates.DBType = input.DBType;
            if (input.indexed !== undefined) updates.indexed = input.indexed;
            if (input.indexedLanguageId) updates.indexedLanguageId = input.indexedLanguageId;

            if (Object.keys(updates).length === 0) {
                return { error: 'Nessun campo da aggiornare fornito. Campi supportati: label, businessType, DBType, indexed, indexedLanguageId. NOTA: required e name (rename) non sono supportati su Object già pubblicati.' };
            }

            return await updateObjectField(base, fieldId, updates, user, pass);
        }

        // ── ADD OBJECT FIELD ─────────────────────────────────────────────────
        if (name === 'add_object_field') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            if (!input?.field_name) return { error: 'field_name obbligatorio' };
            if (!input?.type) return { error: 'type obbligatorio. Valori possibili: TEXT, LONGTEXT, INTEGER, DECIMAL, BOOLEAN, DATE' };

            const objName = input.object_name;

            // Trova l'Object Definition
            const objDef = await findObjectDefinitionWithFields(base, objName, user, pass);
            if (!objDef) return { error: `Object "${objName}" non trovato. Usa get_custom_objects per la lista degli Object disponibili.`, objectName: objName };

            // Verifica che il campo non esista già
            const existingField = objDef.objectFields.find((f) => f.name.toLowerCase() === input.field_name.toLowerCase());
            if (existingField) {
                return { error: `Il campo "${input.field_name}" esiste già nell'Object "${objName}" (id=${existingField.id}, tipo=${existingField.businessType}). Usa update_object_field per modificarlo.`, objectName: objName, fieldName: input.field_name };
            }

            // Costruisci il field definition
            const fType = normalizeFieldType(input.type || 'TEXT');
            const fieldDef = buildField(
                input.field_name,
                buildI18nLabel(input.label_en || input.field_name, input.label_it || input.field_name),
                fType,
                { required: Boolean(input.required), indexed: Boolean(input.indexed) }
            );

            return await addObjectField(base, objDef.id, fieldDef, user, pass);
        }

        // ── DELETE OBJECT FIELD ───────────────────────────────────────────────
        if (name === 'delete_object_field') {
            if (!input?.object_name) return { error: 'object_name obbligatorio' };
            const objName = input.object_name;

            let fieldId = input.field_id || null;
            let fieldName = input.field_name || null;

            if (!fieldId) {
                if (!fieldName) return { error: 'Specificare field_name o field_id per identificare il campo da eliminare.' };

                const objDef = await findObjectDefinitionWithFields(base, objName, user, pass);
                if (!objDef) return { error: `Object "${objName}" non trovato. Usa get_custom_objects per la lista degli Object disponibili.`, objectName: objName };

                const field = objDef.objectFields.find((f) => f.name.toLowerCase() === fieldName.toLowerCase());
                if (!field) return { error: `Campo "${fieldName}" non trovato nell'Object "${objName}". Campi disponibili: ${objDef.objectFields.map((f) => f.name).join(', ')}`, objectName: objName, fieldName };

                fieldId = field.id;
                dbg(`delete_object_field: trovato campo "${field.name}" con id=${fieldId}`);
            }

            return await deleteObjectField(base, fieldId, user, pass);
        }

        // ── SPACE (ASSET LIBRARY) MANAGEMENT ──────────────────────────────────

        // ── CREATE SPACE ──────────────────────────────────────────────────────
        if (name === 'create_space') {
            if (!input?.name) return { error: 'name obbligatorio per creare uno Space.' };
            const body = {
                name: input.name,
                type: 'Space',
            };
            if (input.description) body.description = input.description;
            if (input.externalReferenceCode) body.externalReferenceCode = input.externalReferenceCode;
            // Settings è obbligatorio per evitare errore 500
            body.settings = {
                autoTaggingEnabled: input.autoTaggingEnabled !== undefined ? Boolean(input.autoTaggingEnabled) : false,
                sharingEnabled: input.sharingEnabled !== undefined ? Boolean(input.sharingEnabled) : true,
                trashEnabled: input.trashEnabled !== undefined ? Boolean(input.trashEnabled) : true,
                trashEntriesMaxAge: 0,
                useCustomLanguages: false,
                defaultLanguageId: input.defaultLanguageId || 'it_IT',
            };
            try {
                const result = await liferayPost(base, '/o/headless-asset-library/v1.0/asset-libraries', body, user, pass);
                return {
                    success: true,
                    id: result.id,
                    name: result.name,
                    description: result.description || '',
                    externalReferenceCode: result.externalReferenceCode,
                    type: result.type,
                    message: `Space "${result.name}" creato con successo`,
                };
            } catch (e) { return { error: e.message || String(e) }; }
        }

        // ── UPDATE SPACE ──────────────────────────────────────────────────────
        if (name === 'update_space') {
            if (!input?.spaceErc) return { error: 'spaceErc obbligatorio. Usa get_user_spaces per trovare l\'externalReferenceCode dello Space.' };
            const body = {};
            if (input.name) body.name = input.name;
            if (input.description !== undefined) body.description = input.description;
            if (Object.keys(body).length === 0) return { error: 'Nessun campo da aggiornare fornito. Specifica almeno name o description.' };
            try {
                const result = await liferayPatch(base, `/o/headless-asset-library/v1.0/asset-libraries/${input.spaceErc}`, body, user, pass);
                return {
                    success: true,
                    id: result.id,
                    name: result.name,
                    description: result.description || '',
                    externalReferenceCode: result.externalReferenceCode,
                    type: result.type,
                    message: `Space "${result.name}" aggiornato con successo`,
                };
            } catch (e) { return { error: e.message || String(e), spaceErc: input.spaceErc }; }
        }

        // ── DELETE SPACE ───────────────────────────────────────────────────────
        if (name === 'delete_space') {
            if (!input?.spaceErc) return { error: 'spaceErc obbligatorio. Usa get_user_spaces per trovare l\'externalReferenceCode dello Space.' };
            try {
                await liferayDelete(base, `/o/headless-asset-library/v1.0/asset-libraries/${input.spaceErc}`, user, pass);
                return { success: true, message: `Space con ERC "${input.spaceErc}" eliminato con successo` };
            } catch (e) { return { error: e.message || String(e), spaceErc: input.spaceErc }; }
        }

        // ── CONNECT SPACE TO SITE ──────────────────────────────────────────────
        if (name === 'connect_space_site') {
            if (!input?.spaceErc) return { error: 'spaceErc obbligatorio.' };
            if (!input?.siteErc) return { error: 'siteErc obbligatorio. Es. "L_GUEST" per il sito Guest.' };
            try {
                const body = { externalReferenceCode: input.siteErc };
                const result = await liferayPut(base, `/o/headless-asset-library/v1.0/asset-libraries/${input.spaceErc}/connected-sites/${input.siteErc}`, body, user, pass);
                return {
                    success: true,
                    siteName: result.name,
                    siteErc: result.externalReferenceCode,
                    message: `Sito "${result.name}" collegato allo Space con successo`,
                };
            } catch (e) { return { error: e.message || String(e), spaceErc: input.spaceErc, siteErc: input.siteErc }; }
        }

        // ── DISCONNECT SPACE FROM SITE ─────────────────────────────────────────
        if (name === 'disconnect_space_site') {
            if (!input?.spaceErc) return { error: 'spaceErc obbligatorio.' };
            if (!input?.siteErc) return { error: 'siteErc obbligatorio.' };
            try {
                await liferayDelete(base, `/o/headless-asset-library/v1.0/asset-libraries/${input.spaceErc}/connected-sites/${input.siteErc}`, user, pass);
                return { success: true, message: `Sito "${input.siteErc}" scollegato dallo Space con successo` };
            } catch (e) { return { error: e.message || String(e), spaceErc: input.spaceErc, siteErc: input.siteErc }; }
        }

        // ── ASSIGN USER TO SPACE ──────────────────────────────────────────────
        if (name === 'assign_user_to_space') {
            if (!input?.spaceErc) return { error: 'spaceErc obbligatorio. Usa get_user_spaces per trovarlo.' };
            if (!input?.userErc) return { error: 'userErc obbligatorio. È l\'externalReferenceCode UUID dell\'utente. Usa get_users per trovarlo.' };
            try {
                const body = { externalReferenceCode: input.userErc };
                const result = await liferayPut(base, `/o/headless-asset-library/v1.0/asset-libraries/${input.spaceErc}/user-accounts/${input.userErc}`, body, user, pass);
                return {
                    success: true,
                    userName: result.name,
                    userErc: result.externalReferenceCode,
                    message: `Utente "${result.name}" assegnato allo Space con successo`,
                };
            } catch (e) { return { error: e.message || String(e), spaceErc: input.spaceErc, userErc: input.userErc }; }
        }

        // ── REMOVE USER FROM SPACE ─────────────────────────────────────────────
        if (name === 'remove_user_from_space') {
            if (!input?.spaceErc) return { error: 'spaceErc obbligatorio.' };
            if (!input?.userErc) return { error: 'userErc obbligatorio.' };
            try {
                await liferayDelete(base, `/o/headless-asset-library/v1.0/asset-libraries/${input.spaceErc}/user-accounts/${input.userErc}`, user, pass);
                return { success: true, message: `Utente "${input.userErc}" rimosso dallo Space con successo` };
            } catch (e) { return { error: e.message || String(e), spaceErc: input.spaceErc, userErc: input.userErc }; }
        }

        // ── PICK DOCUMENT ─────────────────────────────────────────────────────
        if (name === 'pick_document') {
            if (!input?.document_id) return { error: 'document_id obbligatorio. Usa search_documents per trovare l\'ID del documento.' };
            const docId = input.document_id;
            const extractText = input.extract_text !== false; // default true
            try {
                // Fetch document metadata
                const doc = await liferayGet(base, `/o/headless-delivery/v1.0/documents/${docId}`, user, pass);
                const result = {
                    id: doc.id,
                    title: doc.title || doc.fileName || 'Untitled',
                    fileName: doc.fileName || '',
                    mimeType: doc.mimeType || '',
                    size: doc.size || 0,
                    contentUrl: doc.contentUrl || '',
                    dateCreated: doc.dateCreated || '',
                    dateModified: doc.dateModified || '',
                    description: doc.description || '',
                    adaptedImages: (doc.adaptedImages || []).map(img => ({
                        resolution: img.resolution,
                        contentUrl: img.contentUrl,
                    })),
                };

                // Try to extract text content for text-based documents
                if (extractText && doc.contentUrl) {
                    const contentUrl = doc.contentUrl.startsWith('http') ? doc.contentUrl : base + doc.contentUrl;
                    const mimeType = (doc.mimeType || '').toLowerCase();

                    if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('csv') || mimeType === 'application/javascript') {
                        try {
                            const textRes = await fetch(contentUrl, { headers: { Authorization: 'Basic ' + btoa(user + ':' + pass) } });
                            if (textRes.ok) {
                                const text = await textRes.text();
                                result.textContent = text.length > 10000 ? text.substring(0, 10000) + '\n[...truncated, total ' + text.length + ' chars]' : text;
                                result.textExtracted = true;
                            }
                        } catch (_) { /* ignore extraction errors */ }
                    } else if (mimeType === 'application/pdf') {
                        result.textContent = '[PDF content not directly extractable via REST API. Use the contentUrl to download the PDF.]';
                        result.textExtracted = false;
                    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
                        // Excel files: download and parse them into structured text
                        try {
                            const fileRes = await fetch(contentUrl, { headers: { Authorization: 'Basic ' + btoa(user + ':' + pass) } });
                            if (fileRes.ok) {
                                const arrayBuffer = await fileRes.arrayBuffer();
                                const excelText = await parseExcelFromBuffer(arrayBuffer);
                                result.textContent = excelText;
                                result.textExtracted = true;
                                result.textFormat = 'excel_structured';
                            } else {
                                result.textContent = '[Excel file — content could not be downloaded. Use the contentUrl to download it manually.]';
                                result.textExtracted = false;
                            }
                        } catch (parseErr) {
                            dbg('[pick_document] Excel parse error:', parseErr.message);
                            result.textContent = `[Excel file — error parsing content: ${parseErr.message}. Use the contentUrl to download it manually.]`;
                            result.textExtracted = false;
                        }
                    } else if (mimeType.includes('word') || mimeType.includes('officedocument') || mimeType.includes('presentation')) {
                        result.textContent = '[Office document content not directly extractable via REST API. Use the contentUrl to download the file.]';
                        result.textExtracted = false;
                    } else if (mimeType.startsWith('image/')) {
                        result.textContent = `[Image: ${doc.title}] (${mimeType}, ${doc.size} bytes)`;
                        result.textExtracted = false;
                    }
                }

                return result;
            } catch (e) {
                return { error: `Errore nel recupero del documento ${docId}: ${e.message}` };
            }
        }

        // ── LIST DOCUMENT FOLDERS ──────────────────────────────────────────────
        if (name === 'list_document_folders') {
            const pageSize = input?.page_size || 50;
            const parentId = input?.parent_folder_id;
            try {
                let url;
                if (parentId) {
                    url = `/o/headless-delivery/v1.0/document-folders/${parentId}/document-folders?pageSize=${pageSize}`;
                } else {
                    url = `/o/headless-delivery/v1.0/sites/${siteId}/document-folders?pageSize=${pageSize}`;
                }
                const data = await liferayGet(base, url, user, pass);
                const folders = (data.items || []).map(f => ({
                    id: f.id,
                    name: f.name || 'Unnamed',
                    description: f.description || '',
                    parentDocumentFolderId: f.parentDocumentFolderId || null,
                    dateCreated: f.dateCreated || '',
                    dateModified: f.dateModified || '',
                    numberOfDocuments: f.numberOfDocuments || 0,
                    numberOfDocumentFolders: f.numberOfDocumentFolders || 0,
                }));
                return {
                    totalCount: data.totalCount || folders.length,
                    folders,
                    message: folders.length === 0
                        ? 'Nessuna cartella trovata.'
                        : `Trovate ${folders.length} cartelle.`,
                };
            } catch (e) {
                return { error: `Errore nel recupero delle cartelle documenti: ${e.message}` };
            }
        }

        // ── LIST FOLDER DOCUMENTS ─────────────────────────────────────────────
        if (name === 'list_folder_documents') {
            if (!input?.folder_id) return { error: 'folder_id obbligatorio. Usa list_document_folders per trovare l\'ID della cartella.' };
            const page = input?.page || 1;
            const pageSize = input?.page_size || 20;
            try {
                const data = await liferayGet(base, `/o/headless-delivery/v1.0/document-folders/${input.folder_id}/documents?page=${page}&pageSize=${pageSize}`, user, pass);
                const documents = (data.items || []).map(doc => ({
                    id: doc.id,
                    title: doc.title || doc.fileName || 'Untitled',
                    fileName: doc.fileName || '',
                    mimeType: doc.mimeType || '',
                    size: doc.size || 0,
                    dateCreated: doc.dateCreated || '',
                    dateModified: doc.dateModified || '',
                    description: doc.description || '',
                    contentUrl: doc.contentUrl || '',
                }));
                return {
                    totalCount: data.totalCount || 0,
                    page,
                    pageSize,
                    documents,
                    message: documents.length === 0
                        ? 'Nessun documento in questa cartella.'
                        : `Trovati ${data.totalCount} documenti (pagina ${page}, ${documents.length} risultati).`,
                };
            } catch (e) {
                return { error: `Errore nel recupero dei documenti dalla cartella ${input.folder_id}: ${e.message}` };
            }
        }

        // ── UPLOAD DOCUMENT ──────────────────────────────────────────────────
        if (name === 'upload_document') {
            const fileIndex = input?.file_index || 0;
            const title = input?.title || '';
            const folderId = input?.folder_id || 0;

            // Get pending files from cfg
            const pendingFiles = cfg._pendingFiles || [];
            if (pendingFiles.length === 0) {
                return { error: 'Nessun file allegato trovato. L\'utente deve prima trascinare o allegare un file nella chat prima di poterlo caricare nella Document Library.' };
            }
            if (fileIndex >= pendingFiles.length) {
                return { error: `Indice file ${fileIndex} non valido. Ci sono solo ${pendingFiles.length} file allegati (indici 0-${pendingFiles.length - 1}).` };
            }

            const pendingFile = pendingFiles[fileIndex];
            try {
                // Convert base64 to Blob
                const byteCharacters = atob(pendingFile.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: pendingFile.type });

                const docTitle = title || pendingFile.name;
                const doc = await liferayUploadDocument(base, siteId, blob, pendingFile.name, docTitle, folderId || undefined, user, pass);

                const result = {
                    success: true,
                    id: doc.id,
                    title: doc.title || doc.fileName,
                    fileName: doc.fileName || '',
                    mimeType: doc.mimeType || pendingFile.type,
                    size: doc.size || pendingFile.size,
                    contentUrl: doc.contentUrl || '',
                    dateCreated: doc.dateCreated || '',
                    message: `✅ File "${doc.title || doc.fileName}" caricato con successo nella Document Library.\n\nID documento: ${doc.id}\nTipo: ${doc.mimeType || pendingFile.type}\nDimensione: ${_formatDocSize(doc.size || pendingFile.size)}\n\nPuoi usare questo ID (${doc.id}) come value_document_id nei campi image o document_library di create_structured_content e update_structured_content.`,
                };

                // If the file is an image, add adaptedImages info
                if (doc.adaptedImages && doc.adaptedImages.length > 0) {
                    result.adaptedImages = doc.adaptedImages.map(img => ({
                        resolution: img.resolution,
                        contentUrl: img.contentUrl,
                    }));
                    result.message += `\n\n⚠️ IMPORTANTE: Questo è un file immagine. Per usarlo in un campo image di un contenuto web, usa value_document_id: ${doc.id}.`;
                }

                return result;
            } catch (e) {
                return { error: `Errore nel caricamento del file "${pendingFile.name}": ${e.message}` };
            }
        }

        // ── GENERATE EXCEL TEMPLATE ──────────────────────────────────────────
        if (name === 'generate_excel_template') {
            const locale = input?.locale || 'it';
            const sheets = input?.sheets || null;
            const fileName = input?.file_name || `template_${locale}.xlsx`;

            try {
                dbg('[generate_excel_template] Generating template, locale:', locale, 'sheets:', sheets, 'fileName:', fileName);

                // 1. Generate the Excel file
                const buffer = await generateTemplateBuffer(locale, sheets);
                dbg('[generate_excel_template] Buffer generated, size:', buffer?.byteLength);

                // 2. Convert ArrayBuffer to Blob
                const blob = new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                });

                // 3. Ensure "template" folder exists in DML
                dbg('[generate_excel_template] Ensuring template folder...');
                const templateFolder = await liferayEnsureFolder(base, siteId, 'template', undefined, user, pass);
                const folderId = templateFolder.id;
                dbg('[generate_excel_template] Template folder ID:', folderId);

                // 4. Upload the file to the template folder
                dbg('[generate_excel_template] Uploading file:', fileName);
                const doc = await liferayUploadDocument(base, siteId, blob, fileName, fileName, folderId, user, pass);
                dbg('[generate_excel_template] Upload complete, doc ID:', doc.id);

                return {
                    success: true,
                    id: doc.id,
                    title: doc.title || fileName,
                    fileName: doc.fileName || fileName,
                    folderId: folderId,
                    folderName: 'template',
                    mimeType: doc.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    size: _formatDocSize(doc.size || buffer.byteLength),
                    contentUrl: doc.contentUrl || '',
                    dateCreated: doc.dateCreated || '',
                    message: `✅ Template Excel "${fileName}" generato e caricato con successo nella cartella "template" della Document Library.\n\nID documento: ${doc.id}\nCartella: template (ID: ${folderId})\nDimensione: ${_formatDocSize(doc.size || buffer.byteLength)}\n\nIl file è ora disponibile per il download e può essere usato come riferimento per creare contenuti in batch.`,
                };
            } catch (e) {
                dbg('[generate_excel_template] ERROR:', e.message, e.stack);
                return { error: `Errore nella generazione del template Excel: ${e.message}` };
            }
        }

        return { error: `Tool sconosciuto: ${name}` };

    } catch (e) {
        dbg(`Errore tool ${name}:`, e);
        // Detect configuration issues and provide helpful messages
        const errMsg = (e.message || String(e)).toLowerCase();
        const cfgBase = getBaseUrl(cfg.liferayUrl);
        const cfgSite = getSiteId(cfg.siteGroupId);
        if (!cfgBase || cfgBase === window.location.origin) {
            return { error: `⚠️ Impossibile contattare Liferay. Verifica nelle impostazioni ⚙ che il campo "Liferay URL" sia compilato correttamente (es. https://vostro-portale.liferay.com). Errore originale: ${e.message}`, tool: name };
        }
        if (!cfgSite) {
            return { error: `⚠️ Site Group ID non configurato. Apri le impostazioni ⚙ e inserisci il Site Group ID (es. 12345). Senza questo campo, il chatbot non può accedere ai contenuti del portale. Errore originale: ${e.message}`, tool: name };
        }
        if (errMsg.includes('failed to fetch') || errMsg.includes('networkerror') || errMsg.includes('network request failed') || errMsg.includes('err_connection')) {
            return { error: `⚠️ Errore di connessione a Liferay (${cfgBase}). Verifica che l'URL sia corretto e che il server sia raggiungibile. Errore originale: ${e.message}`, tool: name };
        }
        if (errMsg.includes('401') || errMsg.includes('unauthorized')) {
            return { error: `⚠️ Errore di autenticazione (401). Verifica che le credenziali Liferay siano corrette nelle impostazioni ⚙. Errore originale: ${e.message}`, tool: name };
        }
        if (errMsg.includes('403') || errMsg.includes('forbidden')) {
            return { error: `⚠️ Accesso negato (403). L'utente non ha i permessi necessari per questa operazione. Errore originale: ${e.message}`, tool: name };
        }
        return { error: e.message, tool: name };
    }
}
