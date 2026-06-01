/**
 * lib/contentStats.js — ai-chatbot-fullpage
 * Fetches and aggregates content statistics from Liferay REST APIs.
 * Used by ContentStatsPanelFP.jsx.
 *
 * OPTIMIZED: Uses a DataCache to avoid duplicate API calls.
 * On large portals, the old approach made hundreds of calls because
 * each function independently fetched all articles/pages.
 * Now, loadAllData() fetches each data type ONCE, and all aggregation
 * functions operate on the cached data.
 */

import { liferayGet, getBaseUrl, getSiteId } from './liferay.js';
import { dbg } from './utils.js';
import { getDictionary, getLocale } from './i18n.js';

// ── API endpoints ──────────────────────────────────────────────────────────

const API = {
    structures:  (siteId) => `/o/headless-delivery/v1.0/sites/${siteId}/content-structures?pageSize=200`,
    allArticles: (siteId) =>
        `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?flatten=true&nestedFields=workflowStatusInfo`,
    // Admin API: returns ALL content statuses (Draft, Pending, etc.) — requires auth
    adminArticles: (siteId) =>
        `/o/headless-admin-content/v1.0/sites/${siteId}/structured-contents?flatten=true&nestedFields=workflowStatusInfo`,
    documents:   (siteId) =>
        `/o/headless-delivery/v1.0/sites/${siteId}/documents?flatten=true`,
    docFolders:  (siteId) => `/o/headless-delivery/v1.0/sites/${siteId}/document-folders?pageSize=200`,
    pages:       (siteId) =>
        `/o/headless-delivery/v1.0/sites/${siteId}/site-pages`,
    // Admin pages API: returns ALL pages including Draft — uses site externalReferenceCode
    adminPages: (siteKey) =>
        `/o/headless-admin-site/v1.0/sites/${siteKey}/site-pages`,
    // Resolve siteId to externalReferenceCode for admin-site API
    siteInfo:   (siteId) => `/o/headless-admin-site/v1.0/sites?pageSize=50`,
    objects:     (siteId) => `/o/object-admin/v1.0/object-definitions?pageSize=1`,
    vocabularies: (siteId) => `/o/headless-admin-taxonomy/v1.0/sites/${siteId}/taxonomy-vocabularies?pageSize=200`,
    categories:  (vocabId, page = 1) =>
        `/o/headless-admin-taxonomy/v1.0/taxonomy-vocabularies/${vocabId}/taxonomy-categories?pageSize=200&page=${page}`,
};

/**
 * Fetch all pages of a paginated Liferay API — optimized for speed.
 * Phase 1: fetch page 1 to discover lastPage.
 * Phase 2: fetch all remaining pages in parallel (batches of 6).
 * Returns all items merged.
 */
async function fetchAllPages(base, path, user, pass) {
    const sep = path.includes('?') ? '&' : '?';
    const url1 = `${path}${sep}page=1&pageSize=200`;
    const first = await liferayGet(base, url1, user, pass);
    const items = [...(first.items || [])];
    const lastPage = Math.min(first.lastPage || 1, 50); // safety limit

    if (lastPage <= 1) return items;

    // Fetch remaining pages in parallel batches of 6
    const BATCH = 6;
    for (let start = 2; start <= lastPage; start += BATCH) {
        const batchPages = [];
        for (let p = start; p < start + BATCH && p <= lastPage; p++) {
            batchPages.push(p);
        }
        const results = await Promise.allSettled(
            batchPages.map(p => {
                const url = `${path}${sep}page=${p}&pageSize=200`;
                return liferayGet(base, url, user, pass);
            })
        );
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value.items) {
                items.push(...r.value.items);
            }
        }
    }
    return items;
}

// ── Data Cache ──────────────────────────────────────────────────────────────
// Fetches each data type ONCE and caches the result.
// This eliminates the hundreds of duplicate API calls on large portals.

class DataCache {
    constructor() {
        this._articles = null;
        this._structures = null;
        this._pages = null;
        this._documents = null;
        this._docFolders = null;
        this._vocabularies = null;
        this._categoryMap = null; // vocabId → categories[]
    }

    async getArticles(base, siteId, user, pass) {
        if (!this._articles) {
            // First: fetch published articles from headless-delivery (always works)
            const published = await fetchAllPages(base, API.allArticles(siteId), user, pass);

            // Also fetch ALL statuses (Draft, Pending, etc.) from admin API
            // and merge with published, deduplicating by id.
            // The admin API requires authentication — liferayGet handles both
            // Basic Auth (user/pass) and CSRF token (when running inside Liferay).
            try {
                const adminArticles = await fetchAllPages(base, API.adminArticles(siteId), user, pass);
                // Build a set of published article IDs for deduplication
                const publishedIds = new Set(published.map(a => a.id));
                // Add admin articles that are NOT already in the published set
                for (const a of adminArticles) {
                    if (!publishedIds.has(a.id)) {
                        published.push(a);
                    }
                }
            } catch (e) {
                // Admin API may not be available or user may lack permissions — silently continue
                dbg('contentStats: admin articles fetch failed, using published only:', e.message);
            }
            this._articles = published;
        }
        return this._articles;
    }

    async getStructures(base, siteId, user, pass) {
        if (!this._structures) {
            this._structures = await fetchAllPages(base, API.structures(siteId), user, pass);
        }
        return this._structures;
    }

    async getPages(base, siteId, user, pass) {
        if (!this._pages) {
            // First: fetch published pages from headless-delivery
            const published = await fetchAllPages(base, API.pages(siteId), user, pass);

            // Also fetch ALL pages (including Draft) from admin-site API
            // The admin-site API uses the site's externalReferenceCode (e.g. L_GUEST), not the numeric siteId.
            // We resolve it by calling the sites list API.
            try {
                const sitesData = await liferayGet(base, API.siteInfo(siteId), user, pass);
                const site = (sitesData.items || []).find(s => String(s.id) === String(siteId));
                const siteKey = site?.externalReferenceCode;
                if (siteKey) {
                    const adminPages = await fetchAllPages(base, API.adminPages(siteKey), user, pass);
                    // Build a set of published page UUIDs for deduplication
                    const publishedUuids = new Set(published.map(p => p.uuid));
                    // Add admin pages that are NOT already in the published set
                    // These are Draft/Unpublished pages
                    for (const p of adminPages) {
                        if (!publishedUuids.has(p.uuid)) {
                            // Normalize admin page fields to match delivery API format
                            const name = p.name_i18n?.en_US || p.name_i18n?.[Object.keys(p.name_i18n || {})[0]] || '';
                            const friendlyUrl = p.friendlyUrlPath_i18n?.en_US || p.friendlyUrlPath_i18n?.[Object.keys(p.friendlyUrlPath_i18n || {})[0]] || '';
                            published.push({
                                ...p,
                                id: p.id,
                                title: name,
                                name: name,
                                friendlyUrlPath: friendlyUrl,
                                pageType: p.type,
                                dateCreated: p.dateCreated,
                                dateModified: p.dateModified,
                                datePublished: p.datePublished,
                                // Mark as Draft since it's only in admin API
                                _isDraftPage: true,
                            });
                        }
                    }
                }
            } catch (e) {
                dbg('contentStats: admin pages fetch failed, using published only:', e.message);
            }
            this._pages = published;
        }
        return this._pages;
    }

    async getDocuments(base, siteId, user, pass) {
        if (!this._documents) {
            this._documents = await fetchAllPages(base, API.documents(siteId), user, pass);
        }
        return this._documents;
    }

    async getDocFolders(base, siteId, user, pass) {
        if (!this._docFolders) {
            this._docFolders = await fetchAllPages(base, API.docFolders(siteId), user, pass);
        }
        return this._docFolders;
    }

    async getVocabularies(base, siteId, user, pass) {
        if (!this._vocabularies) {
            const data = await liferayGet(base, API.vocabularies(siteId), user, pass);
            this._vocabularies = data.items || [];
        }
        return this._vocabularies;
    }

    async getCategoriesForVocab(base, vocabId, user, pass) {
        if (!this._categoryMap) this._categoryMap = {};
        if (!this._categoryMap[vocabId]) {
            this._categoryMap[vocabId] = await fetchAllPages(base, API.categories(vocabId), user, pass);
        }
        return this._categoryMap[vocabId];
    }

    /** Pre-load all data in parallel (called once by loadAllData) */
    async preloadAll(base, siteId, user, pass) {
        const [articles, structures, pages, documents, docFolders, vocabularies] = await Promise.all([
            this.getArticles(base, siteId, user, pass),
            this.getStructures(base, siteId, user, pass),
            this.getPages(base, siteId, user, pass),
            this.getDocuments(base, siteId, user, pass),
            this.getDocFolders(base, siteId, user, pass),
            this.getVocabularies(base, siteId, user, pass),
        ]);
        // Also preload categories for each vocabulary
        const vocabIds = vocabularies.map(v => v.id);
        await Promise.all(vocabIds.map(id => this.getCategoriesForVocab(base, id, user, pass)));
        return { articles, structures, pages, documents, docFolders, vocabularies };
    }

    /** Invalidate cache (for refresh) */
    invalidate() {
        this._articles = null;
        this._structures = null;
        this._pages = null;
        this._documents = null;
        this._docFolders = null;
        this._vocabularies = null;
        this._categoryMap = null;
    }
}

// Singleton cache instance
const dataCache = new DataCache();

/**
 * Load all raw data at once (6 parallel API calls instead of hundreds).
 * Returns the cache object for use by aggregation functions.
 */
export async function loadAllData(cfg) {
    const base   = getBaseUrl(cfg.liferayUrl);
    const siteId = getSiteId(cfg.siteGroupId);
    const user   = cfg.lfUser;
    const pass   = cfg.lfPass;
    if (!siteId) return null;
    dataCache.invalidate();
    return dataCache.preloadAll(base, siteId, user, pass);
}

/**
 * Get the current cache (for drill-down filtering without re-fetching).
 */
export function getDataCache() {
    return dataCache;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute overview counts from cached data (no API calls).
 * @param {object} cache - DataCache instance
 * @returns {object} { articles, documents, pages, vocabularies, categories }
 */
export function computeOverviewCounts(cache) {
    const articles = cache._articles || [];
    const pages = cache._pages || [];
    const documents = cache._documents || [];
    const vocabularies = cache._vocabularies || [];
    const categoryMap = cache._categoryMap || {};

    let totalCategories = 0;
    for (const cats of Object.values(categoryMap)) {
        totalCategories += cats.length;
    }

    return {
        articles: articles.length,
        documents: documents.length,
        pages: pages.length,
        vocabularies: vocabularies.length,
        categories: totalCategories,
    };
}

/**
 * Compute articles grouped by content structure from cached data.
 * @param {object} cache - DataCache instance
 * @returns {Array<{name: string, id: number, count: number}>}
 */
export function computeArticlesByStructure(cache) {
    const structs = cache._structures || [];
    const articles = cache._articles || [];

    const countMap = {};
    for (const a of articles) {
        const structId = a.contentStructureId || (a.embedded && a.embedded.contentStructureId) || null;
        if (structId) {
            if (!countMap[structId]) countMap[structId] = 0;
            countMap[structId]++;
        }
    }

    return structs.map(s => ({
        name: s.name,
        id: s.id,
        count: countMap[s.id] || 0,
    })).sort((a, b) => b.count - a.count);
}

/**
 * Compute documents stats from cached data.
 * @param {object} cache - DataCache instance
 * @returns {object} { byMimeType, byFolder, totalSize }
 */
export function computeDocumentsStats(cache) {
    const docs = cache._documents || [];
    const folders = cache._docFolders || [];

    const folderMap = { 0: 'Root' };
    for (const f of folders) {
        folderMap[f.id] = f.name;
    }

    const mimeMap = {};
    let totalSize = 0;
    for (const d of docs) {
        const mime = d.encodingFormat || d.mimeType || (d.fileExtension ? `.${d.fileExtension}` : null) || 'unknown';
        if (!mimeMap[mime]) mimeMap[mime] = { type: mime, count: 0, size: 0 };
        mimeMap[mime].count++;
        mimeMap[mime].size += d.sizeInBytes || d.size || 0;
        totalSize += d.sizeInBytes || d.size || 0;
    }
    const byMimeType = Object.values(mimeMap)
        .sort((a, b) => b.count - a.count)
        .map(m => ({ ...m, label: friendlyMime(m.type) }));

    const folderCountMap = {};
    for (const d of docs) {
        const folderId = d.documentFolderId ?? d.parentDocumentFolderId ?? 0;
        const folderName = folderMap[folderId] || `Folder #${folderId}`;
        if (!folderCountMap[folderName]) folderCountMap[folderName] = { name: folderName, count: 0 };
        folderCountMap[folderName].count++;
    }
    const byFolder = Object.values(folderCountMap).sort((a, b) => b.count - a.count);

    return { byMimeType, byFolder, totalSize };
}

/**
 * Compute pages grouped by type from cached data.
 * @param {object} cache - DataCache instance
 * @returns {Array<{type: string, count: number, label: string}>}
 */
export function computePagesStats(cache) {
    const pages = cache._pages || [];
    const typeMap = {};
    for (const p of pages) {
        const type = p.pageType || p.type || 'unknown';
        if (!typeMap[type]) typeMap[type] = { type, count: 0 };
        typeMap[type].count++;
    }
    return Object.values(typeMap)
        .sort((a, b) => b.count - a.count)
        .map(t => ({ ...t, label: friendlyPageType(t.type) }));
}

/**
 * Compute authors stats from cached data.
 * @param {object} cache - DataCache instance
 * @returns {Array<{author: string, count: number}>}
 */
export function computeAuthorsStats(cache) {
    const articles = cache._articles || [];
    const authorMap = {};
    for (const a of articles) {
        const name = a.creator?.name || a.author?.name || 'Unknown';
        if (!authorMap[name]) authorMap[name] = { author: name, count: 0 };
        authorMap[name].count++;
    }
    return Object.values(authorMap).sort((a, b) => b.count - a.count);
}

/**
 * Compute vocabulary stats from cached data.
 * @param {object} cache - DataCache instance
 * @returns {Array<{name: string, id: number, categoryCount: number}>}
 */
export function computeVocabulariesStats(cache) {
    const vocabularies = cache._vocabularies || [];
    const categoryMap = cache._categoryMap || {};

    return vocabularies.map(v => ({
        name: v.name,
        id: v.id,
        categoryCount: (categoryMap[v.id] || []).length,
    })).sort((a, b) => b.categoryCount - a.categoryCount);
}

/**
 * Compute content insights from cached data.
 * @param {object} cache - DataCache instance
 * @returns {object} { publicationStatus, freshness, timeline, health }
 */
export function computeContentInsights(cache) {
    const articles = cache._articles || [];
    if (articles.length === 0) return null;

    const now = Date.now();
    const DAY = 86400000;
    const total = articles.length || 1;

    // ── Publication Status ──────────────────────────────────────────
    // Use version.status.label (from admin API) or workflowStatusInfo when available,
    // otherwise fall back to date-based inference.
    const pubMap = {};
    for (const a of articles) {
        let status;
        // Priority: version.status.label (admin API) > workflowStatusInfo.label > date inference
        const versionStatus = a.version?.status?.label;
        const wfStatus = a.workflowStatusInfo?.label || a.status?.label;
        const effectiveStatus = versionStatus || wfStatus;
        if (effectiveStatus) {
            // Normalize Liferay workflow labels
            const s = effectiveStatus.toLowerCase();
            if (s.includes('draft') || s.includes('bozza')) status = 'Draft';
            else if (s.includes('pending') || s.includes('in review') || s.includes('da approvare')) status = 'Pending';
            else if (s.includes('denied') || s.includes('rejected') || s.includes('rifiutato')) status = 'Denied';
            else if (s.includes('scheduled') || s.includes('programmato')) status = 'Scheduled';
            else if (s.includes('publish') || s.includes('approv') || s.includes('approved')) status = 'Published';
            else status = wfStatus;
        } else {
            // Fallback: infer from dates
            const pubDate = a.datePublished ? new Date(a.datePublished).getTime() : 0;
            if (!a.datePublished || a.datePublished.startsWith('1970')) {
                status = 'Unpublished';
            } else if (pubDate > now) {
                status = 'Scheduled';
            } else {
                status = 'Published';
            }
        }
        if (!pubMap[status]) pubMap[status] = { label: status, count: 0 };
        pubMap[status].count++;
    }
    const publicationStatus = Object.values(pubMap).sort((a, b) => b.count - a.count);

    // ── Content Freshness ───────────────────────────────────────────
    const freshnessBuckets = [
        { key: 'fresh',   label: '< 7 days',    maxAge: 7 * DAY },
        { key: 'recent',  label: '7\u201330 days',   maxAge: 30 * DAY },
        { key: 'aging',   label: '30\u201390 days',  maxAge: 90 * DAY },
        { key: 'stale',   label: '> 90 days',   maxAge: Infinity },
    ];
    const freshness = freshnessBuckets.map(b => ({ ...b, count: 0 }));
    for (const a of articles) {
        const modified = a.dateModified ? new Date(a.dateModified).getTime() : (a.dateCreated ? new Date(a.dateCreated).getTime() : 0);
        const age = now - modified;
        for (const b of freshness) {
            if (age < b.maxAge) { b.count++; break; }
        }
    }

    // ── Content Timeline ────────────────────────────────────────────
    const timeline = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        d.setHours(0, 0, 0, 0);
        const year = d.getFullYear();
        const month = d.getMonth();
        const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        timeline.push({ year, month, label, created: 0, modified: 0 });
    }
    for (const a of articles) {
        const created = a.dateCreated ? new Date(a.dateCreated) : null;
        const modified = a.dateModified ? new Date(a.dateModified) : null;
        if (created) {
            const slot = timeline.find(t => t.year === created.getFullYear() && t.month === created.getMonth());
            if (slot) slot.created++;
        }
        if (modified && (!created || modified.getTime() !== created.getTime())) {
            const slot = timeline.find(t => t.year === modified.getFullYear() && t.month === modified.getMonth());
            if (slot) slot.modified++;
        }
    }

    // ── Content Health Score ────────────────────────────────────────
    let noCategories = 0;
    let staleCount = 0;
    let noKeywords = 0;
    let noReviewDate = 0;
    for (const a of articles) {
        const cats = a.taxonomyCategoryBriefs?.length || 0;
        const kws = a.keywords?.length || 0;
        if (cats === 0) noCategories++;
        if (kws === 0) noKeywords++;
        const modified = a.dateModified ? new Date(a.dateModified).getTime() : 0;
        if ((now - modified) > 90 * DAY) staleCount++;
        if (!a.reviewDate && !a.dateReview) noReviewDate++;
    }
    const health = {
        score: Math.round(100 - ((noCategories / total * 30) + (noKeywords / total * 20) + (staleCount / total * 30) + (noReviewDate / total * 20))),
        noCategories: { count: noCategories, pct: ((noCategories / total) * 100).toFixed(1) },
        noKeywords:    { count: noKeywords, pct: ((noKeywords / total) * 100).toFixed(1) },
        stale:         { count: staleCount, pct: ((staleCount / total) * 100).toFixed(1) },
        noReviewDate:  { count: noReviewDate, pct: ((noReviewDate / total) * 100).toFixed(1) },
        total: articles.length,
    };

    return { publicationStatus, freshness, timeline, health };
}

/**
 * Compute pages insights from cached data.
 * @param {object} cache - DataCache instance
 * @returns {object} { byType, publicationStatus, freshness, timeline, health, byAuthor, hierarchy }
 */
export function computePagesInsights(cache) {
    const pages = cache._pages || [];
    if (pages.length === 0) return null;

    const now = Date.now();
    const DAY = 86400000;
    const total = pages.length || 1;

    // ── By Type ────────────────────────────────────────────────────
    const typeMap = {};
    for (const p of pages) {
        const type = p.pageType || p.type || 'unknown';
        if (!typeMap[type]) typeMap[type] = { type, count: 0 };
        typeMap[type].count++;
    }
    const byType = Object.values(typeMap)
        .sort((a, b) => b.count - a.count)
        .map(t => ({ ...t, label: friendlyPageType(t.type) }));

    // ── Publication Status ─────────────────────────────────────────
    // Pages from admin-site API that are NOT in delivery API are marked with _isDraftPage.
    // For published pages, if dateModified > datePublished, they have unpublished changes (Draft).
    const statusMap = {};
    for (const p of pages) {
        let status;
        // Priority 1: explicit status from API (future-proof)
        const explicitStatus = p.status?.label || p.workflowStatusInfo?.label;
        if (explicitStatus) {
            status = explicitStatus;
        } else if (p._isDraftPage) {
            // Page exists only in admin API → never published → Draft
            status = 'Draft';
        } else if (p.dateModified && p.datePublished) {
            const modTime = new Date(p.dateModified).getTime();
            const pubTime = new Date(p.datePublished).getTime();
            // Allow 2-second tolerance for rounding differences
            if (modTime > pubTime + 2000) {
                status = 'Draft';
            } else {
                status = 'Published';
            }
        } else if (p.datePublished) {
            status = 'Published';
        } else {
            status = 'Unpublished';
        }
        if (!statusMap[status]) statusMap[status] = { label: status, count: 0 };
        statusMap[status].count++;
    }
    const publicationStatus = Object.values(statusMap).sort((a, b) => b.count - a.count);

    // ── Freshness ───────────────────────────────────────────────────
    const freshnessBuckets = [
        { key: 'fresh',  label: '< 7 days',  maxAge: 7 * DAY },
        { key: 'recent', label: '7\u201330 days', maxAge: 30 * DAY },
        { key: 'aging',  label: '30\u201390 days', maxAge: 90 * DAY },
        { key: 'stale',  label: '> 90 days',  maxAge: Infinity },
    ];
    const freshness = freshnessBuckets.map(b => ({ ...b, count: 0 }));
    for (const p of pages) {
        const modified = p.dateModified ? new Date(p.dateModified).getTime() : (p.dateCreated ? new Date(p.dateCreated).getTime() : 0);
        const age = now - modified;
        for (const b of freshness) {
            if (age < b.maxAge) { b.count++; break; }
        }
    }

    // ── Timeline ──────────────────────────────────────────────────
    const timeline = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        d.setHours(0, 0, 0, 0);
        const year = d.getFullYear();
        const month = d.getMonth();
        const label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        timeline.push({ year, month, label, created: 0, modified: 0 });
    }
    for (const p of pages) {
        const created = p.dateCreated ? new Date(p.dateCreated) : null;
        const modified = p.dateModified ? new Date(p.dateModified) : null;
        if (created) {
            const slot = timeline.find(t => t.year === created.getFullYear() && t.month === created.getMonth());
            if (slot) slot.created++;
        }
        if (modified && (!created || modified.getTime() !== created.getTime())) {
            const slot = timeline.find(t => t.year === modified.getFullYear() && t.month === modified.getMonth());
            if (slot) slot.modified++;
        }
    }

    // ── Health Score ───────────────────────────────────────────────
    let noDescription = 0;
    let hidden = 0;
    let stale = 0;
    for (const p of pages) {
        if (!p.description && !p.htmlTitle) noDescription++;
        if (p.hiddenFromNavigation) hidden++;
        const modified = p.dateModified ? new Date(p.dateModified).getTime() : 0;
        if ((now - modified) > 90 * DAY) stale++;
    }
    const health = {
        score: Math.max(0, Math.round(100 - ((noDescription / total * 30) + (hidden / total * 30) + (stale / total * 40)))),
        noDescription: { count: noDescription, pct: ((noDescription / total) * 100).toFixed(1) },
        hidden:        { count: hidden, pct: ((hidden / total) * 100).toFixed(1) },
        stale:         { count: stale, pct: ((stale / total) * 100).toFixed(1) },
        total: pages.length,
    };

    // ── By Author ──────────────────────────────────────────────────
    const authorMap = {};
    for (const p of pages) {
        const name = p.creator?.name || 'Unknown';
        if (!authorMap[name]) authorMap[name] = { author: name, count: 0 };
        authorMap[name].count++;
    }
    const byAuthor = Object.values(authorMap).sort((a, b) => b.count - a.count).slice(0, 10);

    // ── Hierarchy ──────────────────────────────────────────────────
    let maxDepth = 0;
    let rootCount = 0;
    for (const p of pages) {
        const parentPath = p.friendlyUrlPath?.split('/').slice(0, -1).join('/') || '';
        if (!parentPath) rootCount++;
        const depth = (p.friendlyUrlPath?.split('/').length || 1) - 1;
        if (depth > maxDepth) maxDepth = depth;
    }
    const hierarchy = { totalPages: pages.length, rootPages: rootCount, maxDepth: Math.max(maxDepth, 1) };

    return { byType, publicationStatus, freshness, timeline, health, byAuthor, hierarchy };
}

/**
 * Compute vocabulary categories with usage count from cached data.
 * @param {object} cache - DataCache instance
 * @param {number} vocabId
 * @returns {Array<{name: string, id: number, usageCount: number}>}
 */
export function computeVocabularyCategories(cache, vocabId) {
    const categories = (cache._categoryMap || {})[vocabId] || [];
    const articles = cache._articles || [];

    const usageMap = {};
    for (const a of articles) {
        const cats = a.taxonomyCategoryBriefs || [];
        for (const c of cats) {
            const cid = c.taxonomyCategoryId || c.id;
            if (cid) {
                usageMap[cid] = (usageMap[cid] || 0) + 1;
            }
        }
    }

    return categories.map(cat => ({
        name: cat.name,
        id: cat.id,
        usageCount: usageMap[cat.id] || 0,
    })).sort((a, b) => b.usageCount - a.usageCount);
}

/**
 * Filter articles from cached data (for drill-down).
 * Uses server-side OData filter for structure, client-side for everything else.
 * @param {object} cfg
 * @param {object} filter - { type, value }
 * @param {number} page
 * @param {number} pageSize
 * @returns {Promise<{items: Array, totalCount: number}>}
 */
export async function fetchFilteredArticles(cfg, filter, page = 1, pageSize = 10) {
    const cache = getDataCache();
    const now = Date.now();
    const DAY = 86400000;

    // For structure filter, use server-side OData filter (efficient)
    if (filter.type === 'structure') {
        const base   = getBaseUrl(cfg.liferayUrl);
        const siteId = getSiteId(cfg.siteGroupId);
        const user   = cfg.lfUser;
        const pass   = cfg.lfPass;
        const path = `/o/headless-delivery/v1.0/sites/${siteId}/structured-contents?flatten=true&filter=contentStructureId eq ${filter.value}&page=${page}&pageSize=${pageSize}&sort=dateCreated:desc`;
        const data = await liferayGet(base, path, user, pass);
        return { items: data.items || [], totalCount: data.totalCount || 0 };
    }

    // For all other filters, use cached data (no API calls)
    const allArticles = cache._articles || [];
    let filtered = allArticles;

    switch (filter.type) {
        case 'status': {
            filtered = allArticles.filter(a => {
                let status;
                // Use version.status.label (from admin API) or workflowStatusInfo when available
                const versionStatus = a.version?.status?.label;
                const wfStatus = a.workflowStatusInfo?.label || a.status?.label;
                const effectiveStatus = versionStatus || wfStatus;
                if (effectiveStatus) {
                    const s = effectiveStatus.toLowerCase();
                    if (s.includes('draft') || s.includes('bozza')) status = 'Draft';
                    else if (s.includes('pending') || s.includes('in review') || s.includes('da approvare')) status = 'Pending';
                    else if (s.includes('denied') || s.includes('rejected') || s.includes('rifiutato')) status = 'Denied';
                    else if (s.includes('scheduled') || s.includes('programmato')) status = 'Scheduled';
                    else if (s.includes('publish') || s.includes('approv') || s.includes('approved')) status = 'Published';
                    else status = effectiveStatus;
                } else {
                    // Fallback: infer from dates
                    const pubDate = a.datePublished ? new Date(a.datePublished).getTime() : 0;
                    if (!a.datePublished || a.datePublished.startsWith('1970')) status = 'Unpublished';
                    else if (pubDate > now) status = 'Scheduled';
                    else status = 'Published';
                }
                return status === filter.value;
            });
            break;
        }
        case 'freshness': {
            const buckets = [
                { key: 'fresh',  maxAge: 7 * DAY },
                { key: 'recent', maxAge: 30 * DAY },
                { key: 'aging',  maxAge: 90 * DAY },
                { key: 'stale',  maxAge: Infinity },
            ];
            const bucket = buckets.find(b => b.key === filter.value);
            if (bucket) {
                filtered = allArticles.filter(a => {
                    const modified = a.dateModified ? new Date(a.dateModified).getTime() : (a.dateCreated ? new Date(a.dateCreated).getTime() : 0);
                    const age = now - modified;
                    return age < bucket.maxAge;
                });
            }
            break;
        }
        case 'health': {
            switch (filter.value) {
                case 'noCategories':
                    filtered = allArticles.filter(a => !(a.taxonomyCategoryBriefs?.length > 0));
                    break;
                case 'noKeywords':
                    filtered = allArticles.filter(a => !(a.keywords?.length > 0));
                    break;
                case 'stale':
                    filtered = allArticles.filter(a => {
                        const modified = a.dateModified ? new Date(a.dateModified).getTime() : 0;
                        return (now - modified) > 90 * DAY;
                    });
                    break;
                case 'noReviewDate':
                    filtered = allArticles.filter(a => !a.reviewDate && !a.dateReview);
                    break;
            }
            break;
        }
        case 'month': {
            filtered = allArticles.filter(a => {
                const created = a.dateCreated ? new Date(a.dateCreated) : null;
                return created && created.getFullYear() === filter.value.year && created.getMonth() === filter.value.month;
            });
            break;
        }
        case 'author': {
            filtered = allArticles.filter(a => (a.creator?.name || 'Unknown') === filter.value);
            break;
        }
        case 'vocabulary': {
            filtered = allArticles.filter(a => {
                const cats = a.taxonomyCategoryBriefs || [];
                return cats.some(c => c.taxonomyVocabularyId === filter.value);
            });
            break;
        }
        case 'category': {
            filtered = allArticles.filter(a => {
                const cats = a.taxonomyCategoryBriefs || [];
                return cats.some(c => (c.taxonomyCategoryId || c.id) === filter.value);
            });
            break;
        }
    }

    const totalCount = filtered.length;
    // Sort by dateCreated descending (most recent first) — copy first to avoid mutating cache
    const sorted = [...filtered].sort((a, b) => {
        const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        return db - da;
    });
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);
    return { items, totalCount };
}

/**
 * Filter pages from cached data (for drill-down).
 * @param {object} cfg
 * @param {object} filter - { type, value }
 * @param {number} page
 * @param {number} pageSize
 * @returns {Promise<{items: Array, totalCount: number}>}
 */
export async function fetchFilteredPages(cfg, filter, page = 1, pageSize = 10) {
    const cache = getDataCache();
    const allPages = cache._pages || [];
    const now = Date.now();
    const DAY = 86400000;

    let filtered = allPages;

    switch (filter.type) {
        case 'pageType':
            filtered = allPages.filter(p => (p.pageType || p.type || 'unknown') === filter.value);
            break;
        case 'pageStatus':
            filtered = allPages.filter(p => {
                let status;
                const explicitStatus = p.status?.label || p.workflowStatusInfo?.label;
                if (explicitStatus) {
                    status = explicitStatus;
                } else if (p._isDraftPage) {
                    status = 'Draft';
                } else if (p.dateModified && p.datePublished) {
                    const modTime = new Date(p.dateModified).getTime();
                    const pubTime = new Date(p.datePublished).getTime();
                    status = (modTime > pubTime + 2000) ? 'Draft' : 'Published';
                } else if (p.datePublished) {
                    status = 'Published';
                } else {
                    status = 'Unpublished';
                }
                return status === filter.value;
            });
            break;
        case 'pageFreshness': {
            const buckets = [
                { key: 'fresh',  maxAge: 7 * DAY },
                { key: 'recent', maxAge: 30 * DAY },
                { key: 'aging',  maxAge: 90 * DAY },
                { key: 'stale',  maxAge: Infinity },
            ];
            const bucket = buckets.find(b => b.key === filter.value);
            if (bucket) {
                filtered = allPages.filter(p => {
                    const modified = p.dateModified ? new Date(p.dateModified).getTime() : (p.dateCreated ? new Date(p.dateCreated).getTime() : 0);
                    return (now - modified) < bucket.maxAge;
                });
            }
            break;
        }
        case 'pageMonth':
            filtered = allPages.filter(p => {
                const created = p.dateCreated ? new Date(p.dateCreated) : null;
                return created && created.getFullYear() === filter.value.year && created.getMonth() === filter.value.month;
            });
            break;
        case 'pageHealth':
            switch (filter.value) {
                case 'noDescription':
                    filtered = allPages.filter(p => !p.description && !p.htmlTitle);
                    break;
                case 'hidden':
                    filtered = allPages.filter(p => p.hiddenFromNavigation);
                    break;
                case 'stale':
                    filtered = allPages.filter(p => {
                        const modified = p.dateModified ? new Date(p.dateModified).getTime() : 0;
                        return (now - modified) > 90 * DAY;
                    });
                    break;
            }
            break;
        case 'pageAuthor':
            filtered = allPages.filter(p => (p.creator?.name || 'Unknown') === filter.value);
            break;
    }

    const totalCount = filtered.length;
    // Sort by dateCreated descending (most recent first) — copy first to avoid mutating cache
    const sorted = [...filtered].sort((a, b) => {
        const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        return db - da;
    });
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize).map(p => ({
        id: p.pageId || p.id,
        title: p.title || p.name || '\u2014',
        name: p.title || p.name || '\u2014',
        creator: p.creator || { name: 'Unknown' },
        dateCreated: p.dateCreated,
        dateModified: p.dateModified,
        type: p.pageType || p.type,
        friendlyUrlPath: p.friendlyUrlPath,
    }));
    return { items, totalCount };
}

/**
 * Filter documents from cached data (for drill-down).
 * @param {object} cfg
 * @param {object} filter - { type: 'docMimeType'|'docFolder', value: string }
 * @param {number} page
 * @param {number} pageSize
 * @returns {Promise<{items: Array, totalCount: number}>}
 */
export async function fetchFilteredDocuments(cfg, filter, page = 1, pageSize = 10) {
    const cache = getDataCache();
    const allDocs = cache._documents || [];
    const folders = cache._docFolders || [];
    const folderMap = { 0: 'Root' };
    for (const f of folders) {
        folderMap[f.id] = f.name;
    }

    let filtered = allDocs;

    switch (filter.type) {
        case 'docMimeType':
            filtered = allDocs.filter(d => {
                const mime = d.encodingFormat || d.mimeType || (d.fileExtension ? `.${d.fileExtension}` : null) || 'unknown';
                return mime === filter.value;
            });
            break;
        case 'docFolder': {
            const folderName = filter.value;
            filtered = allDocs.filter(d => {
                const folderId = d.documentFolderId ?? d.parentDocumentFolderId ?? 0;
                const name = folderMap[folderId] || `Folder #${folderId}`;
                return name === folderName;
            });
            break;
        }
    }

    const totalCount = filtered.length;
    const sorted = [...filtered].sort((a, b) => {
        const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        return db - da;
    });
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize).map(d => ({
        id: d.id,
        title: d.title || d.name || '\u2014',
        name: d.title || d.name || '\u2014',
        creator: d.creator || { name: 'Unknown' },
        dateCreated: d.dateCreated,
        dateModified: d.dateModified,
        encodingFormat: d.encodingFormat || d.mimeType || (d.fileExtension ? `.${d.fileExtension}` : null) || 'unknown',
        sizeInBytes: d.sizeInBytes || d.size || 0,
        contentUrl: d.contentUrl || d.url || null,
    }));
    return { items, totalCount };
}

// ── Author Detail ──────────────────────────────────────────────────────────

/**
 * Compute detailed author profile from cached data.
 * Returns structures with article counts, pages, and categories for the given author.
 * @param {object} cache - DataCache instance
 * @param {string} authorName - The author name to filter by
 * @returns {object} Author detail with structures, pages, categories, totals
 */
export function computeAuthorDetail(cache, authorName) {
    const articles = (cache._articles || []).filter(a => (a.creator?.name || 'Unknown') === authorName);
    const pages = (cache._pages || []).filter(p => (p.creator?.name || 'Unknown') === authorName);
    const structures = cache._structures || [];

    // ── Structures breakdown ──────────────────────────────────────────
    const structCountMap = {};
    for (const a of articles) {
        const structId = a.contentStructureId || (a.embedded && a.embedded.contentStructureId) || null;
        if (structId) {
            if (!structCountMap[structId]) structCountMap[structId] = 0;
            structCountMap[structId]++;
        }
    }
    const authorStructures = structures
        .map(s => ({
            name: s.name,
            id: s.id,
            count: structCountMap[s.id] || 0,
        }))
        .filter(s => s.count > 0)
        .sort((a, b) => b.count - a.count);

    // ── Categories breakdown ─────────────────────────────────────────
    const catMap = {};
    for (const a of articles) {
        const cats = a.taxonomyCategoryBriefs || [];
        for (const c of cats) {
            const catId = c.taxonomyCategoryId || c.id;
            const catName = c.taxonomyCategoryName || c.name || `#${catId}`;
            const vocabName = c.taxonomyVocabularyName || '';
            if (!catMap[catId]) {
                catMap[catId] = { id: catId, name: catName, vocabularyName: vocabName, count: 0 };
            }
            catMap[catId].count++;
        }
    }
    const authorCategories = Object.values(catMap).sort((a, b) => b.count - a.count);

    // ── Pages ────────────────────────────────────────────────────────
    const authorPages = pages.map(p => ({
        id: p.pageId || p.id,
        title: p.title || p.name || '—',
        type: p.pageType || p.type || 'unknown',
        typeLabel: friendlyPageType(p.pageType || p.type),
        dateCreated: p.dateCreated,
        dateModified: p.dateModified,
        friendlyUrlPath: p.friendlyUrlPath,
        hiddenFromNavigation: p.hiddenFromNavigation || false,
    })).sort((a, b) => {
        const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        return db - da;
    });

    return {
        authorName,
        structures: authorStructures,
        pages: authorPages,
        categories: authorCategories,
        totalArticles: articles.length,
        totalPages: pages.length,
        totalCategories: authorCategories.reduce((s, c) => s + c.count, 0),
    };
}

/**
 * Filter articles by author AND structure from cached data (for drill-down in author detail).
 * @param {object} cfg
 * @param {string} authorName
 * @param {number} structureId
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ items: Array, totalCount: number }}
 */
export function fetchFilteredArticlesByAuthorAndStructure(cfg, authorName, structureId, page = 1, pageSize = 10) {
    const cache = getDataCache();
    const allArticles = cache._articles || [];
    const filtered = allArticles.filter(a => {
        const authorMatch = (a.creator?.name || 'Unknown') === authorName;
        const structMatch = (a.contentStructureId || (a.embedded && a.embedded.contentStructureId)) === structureId;
        return authorMatch && structMatch;
    });
    const totalCount = filtered.length;
    // Sort by dateCreated descending (most recent first) — copy first to avoid mutating cache
    const sorted = [...filtered].sort((a, b) => {
        const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        return db - da;
    });
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);
    return { items, totalCount };
}

/**
 * Filter articles by author AND category from cached data (for drill-down in author detail).
 * @param {object} cfg
 * @param {string} authorName
 * @param {number} categoryId
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ items: Array, totalCount: number }}
 */
export function fetchFilteredArticlesByAuthorAndCategory(cfg, authorName, categoryId, page = 1, pageSize = 10) {
    const cache = getDataCache();
    const allArticles = cache._articles || [];
    const filtered = allArticles.filter(a => {
        const authorMatch = (a.creator?.name || 'Unknown') === authorName;
        const catMatch = (a.taxonomyCategoryBriefs || []).some(c => (c.taxonomyCategoryId || c.id) === categoryId);
        return authorMatch && catMatch;
    });
    const totalCount = filtered.length;
    // Sort by dateCreated descending (most recent first) — copy first to avoid mutating cache
    const sorted = [...filtered].sort((a, b) => {
        const da = a.dateCreated ? new Date(a.dateCreated).getTime() : 0;
        const db = b.dateCreated ? new Date(b.dateCreated).getTime() : 0;
        return db - da;
    });
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);
    return { items, totalCount };
}

// ── Content Gaps & Stale Content ────────────────────────────────────────────

/**
 * Compute content gaps: structures with 0 articles, vocabularies with 0 categories used.
 * @param {object} cache - DataCache instance
 * @returns {{ emptyStructures: Array, orphanVocabularies: Array, unusedCategories: Array }}
 */
export function computeContentGaps(cache) {
    const structures = cache._structures || [];
    const articles = cache._articles || [];
    const vocabularies = cache._vocabularies || [];
    const categoryMap = cache._categoryMap || {};

    // Structures with 0 articles
    const structCountMap = {};
    for (const a of articles) {
        const structId = a.contentStructureId || (a.embedded && a.embedded.contentStructureId) || null;
        if (structId) {
            if (!structCountMap[structId]) structCountMap[structId] = 0;
            structCountMap[structId]++;
        }
    }
    const emptyStructures = structures
        .filter(s => !structCountMap[s.id])
        .map(s => ({ id: s.id, name: s.name }));

    // Vocabularies with 0 categories used in any article
    const usedCatIds = new Set();
    for (const a of articles) {
        const cats = a.taxonomyCategoryBriefs || [];
        for (const c of cats) {
            usedCatIds.add(c.taxonomyCategoryId || c.id);
        }
    }
    const orphanVocabularies = vocabularies
        .filter(v => {
            const cats = categoryMap[v.id] || [];
            return cats.length > 0 && cats.every(c => !usedCatIds.has(c.id));
        })
        .map(v => ({ id: v.id, name: v.name, categoryCount: (categoryMap[v.id] || []).length }));

    // Categories with 0 usage
    const unusedCategories = [];
    for (const vocabId of Object.keys(categoryMap)) {
        for (const cat of categoryMap[vocabId]) {
            if (!usedCatIds.has(cat.id)) {
                const vocabName = vocabularies.find(v => v.id === Number(vocabId))?.name || '';
                unusedCategories.push({ id: cat.id, name: cat.name, vocabularyName: vocabName });
            }
        }
    }

    return { emptyStructures, orphanVocabularies, unusedCategories };
}

/**
 * Compute stale content: articles not updated in > 90 days, sorted by age.
 * Returns top N items with direct edit/view links.
 * @param {object} cache - DataCache instance
 * @param {number} limit - max items to return (default 5)
 * @returns {Array<{id, title, structureName, dateModified, dateCreated, author, staleDays, friendlyUrlPath}>}
 */
export function computeStaleContent(cache, limit = 5) {
    const articles = cache._articles || [];
    const structures = cache._structures || [];
    const structMap = {};
    for (const s of structures) { structMap[s.id] = s.name; }
    const now = Date.now();
    const DAY = 86400000;

    return articles
        .map(a => {
            const modified = a.dateModified ? new Date(a.dateModified).getTime() : (a.dateCreated ? new Date(a.dateCreated).getTime() : 0);
            const staleDays = modified > 0 ? Math.floor((now - modified) / DAY) : null;
            return {
                id: a.id,
                title: a.title || a.name || '—',
                structureName: structMap[a.contentStructureId] || '—',
                dateModified: a.dateModified,
                dateCreated: a.dateCreated,
                author: a.creator?.name || 'Unknown',
                staleDays,
                friendlyUrlPath: a.friendlyUrlPath || a.contentUrl || null,
            };
        })
        .filter(a => a.staleDays !== null && a.staleDays > 90)
        .sort((a, b) => b.staleDays - a.staleDays)
        .slice(0, limit);
}

/**
 * Compute proactive alerts for the dashboard banner.
 * @param {object} cache - DataCache instance
 * @returns {Array<{key, label, count, severity}>}
 */
export function computeAlerts(cache) {
    const articles = cache._articles || [];
    const pages = cache._pages || [];
    const now = Date.now();
    const DAY = 86400000;
    const alerts = [];

    const noCategories = articles.filter(a => !(a.taxonomyCategoryBriefs?.length > 0)).length;
    if (noCategories > 0) alerts.push({ key: 'noCategories', label: 'Without Categories', count: noCategories, severity: 'warning' });

    const noKeywords = articles.filter(a => !(a.keywords?.length > 0)).length;
    if (noKeywords > 0) alerts.push({ key: 'noKeywords', label: 'Without Tags', count: noKeywords, severity: 'info' });

    const hiddenPages = pages.filter(p => p.hiddenFromNavigation).length;
    if (hiddenPages > 0) alerts.push({ key: 'hiddenPages', label: 'Hidden Pages', count: hiddenPages, severity: 'info' });

    const staleArticles = articles.filter(a => {
        const modified = a.dateModified ? new Date(a.dateModified).getTime() : 0;
        return modified > 0 && (now - modified) > 90 * DAY;
    }).length;
    if (staleArticles > 0) alerts.push({ key: 'stale', label: 'Stale (>90 days)', count: staleArticles, severity: 'danger' });

    const noReviewDate = articles.filter(a => !a.reviewDate && !a.dateReview).length;
    if (noReviewDate > 0) alerts.push({ key: 'noReviewDate', label: 'No Review Date', count: noReviewDate, severity: 'warning' });

    return alerts;
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function friendlyMime(mime) {
    if (!mime || mime === 'unknown') return 'Unknown';
    const map = {
        'application/pdf': 'PDF',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (XLSX)',
        'application/vnd.ms-excel': 'Excel (XLS)',
        'text/csv': 'CSV',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
        'application/msword': 'Word (DOC)',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (PPTX)',
        'application/vnd.ms-powerpoint': 'PowerPoint (PPT)',
        'application/zip': 'ZIP',
        'application/json': 'JSON',
        'text/plain': 'Text',
        'text/html': 'HTML',
        'image/png': 'PNG',
        'image/jpeg': 'JPEG',
        'image/gif': 'GIF',
        'image/svg+xml': 'SVG',
        'image/webp': 'WebP',
        'video/mp4': 'MP4 Video',
        'audio/mpeg': 'MP3 Audio',
    };
    if (map[mime]) return map[mime];
    if (mime.startsWith('.')) return mime.substring(1).toUpperCase();
    if (mime.includes('/')) return mime.split('/').pop().toUpperCase();
    return mime.toUpperCase();
}

function friendlyPageType(type) {
    if (!type) return 'Unknown';
    const t = getDictionary(getLocale());
    // Map API-returned type strings (both English and Italian) to i18n keys
    const lower = type.toLowerCase();
    const keyMap = {
        'content': 'pageTypeContent',
        'content_page': 'pageTypeContent',
        'pagina contenuto': 'pageTypeContent',
        'widget': 'pageTypeWidget',
        'widget_page': 'pageTypeWidget',
        'pagina widget': 'pageTypeWidget',
        'link': 'pageTypeLink',
        'link_page': 'pageTypeLink',
        'url': 'pageTypeUrl',
        'embedded': 'pageTypeEmbedded',
        'node': 'pageTypeNode',
        'full': 'pageTypeFull',
    };
    const key = keyMap[lower];
    if (key && t[key]) return t[key];
    // If the API returns a friendly name with spaces (e.g. "Content Page"),
    // try to map it; otherwise return as-is
    if (type.includes(' ')) {
        // Check if it's a known Italian name that we should translate
        if (lower.startsWith('pagina')) return t.pageTypeContent || 'Content Page';
        return type; // Already a friendly English name
    }
    return t.pageTypeUnknown || 'Unknown';
}

export function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}