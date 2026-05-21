/**
 * lib/pageIndex.js — ai-chatbot-fullpage
 * Cache key diversa dal widget per non condividere l'indice.
 */

import { liferayGet, getBaseUrl, getSiteId, getCachedResponse, setCachedResponse } from './liferay.js';
import { dbg } from './utils.js';

const CACHE_KEY_PREFIX = 'acfp_page_index_v1_';

function normalize(s) {
    if (!s) return '';
    return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function slugify(s) { return normalize(s).replace(/\s+/g, '-'); }
function trigrams(s) { const t = s.replace(/\s+/g, ''); const set = new Set(); for (let i = 0; i < t.length - 2; i++) set.add(t.substr(i, 3)); return set; }
function trigramSimilarity(a, b) { if (!a || !b) return 0; const sa = trigrams(a); const sb = trigrams(b); if (!sa.size || !sb.size) return 0; let inter = 0; for (const x of sa) if (sb.has(x)) inter++; const union = sa.size + sb.size - inter; return union === 0 ? 0 : inter / union; }
function tokenOverlap(a, b) { const ta = new Set((a||'').split(' ').filter(Boolean)); const tb = new Set((b||'').split(' ').filter(Boolean)); if (!ta.size || !tb.size) return 0; let inter = 0; for (const t of ta) if (tb.has(t)) inter++; return inter / Math.max(ta.size, tb.size); }

async function fetchPageBatch(baseUrl, siteId, pageSize, pages) {
    const results = [];
    for (const p of pages) {
        try {
            const data = await liferayGet(baseUrl, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages?fields=title,friendlyUrlPath&pageSize=${pageSize}&page=${p}`);
            if (data?.items) results.push(...data.items);
        } catch (e) { dbg('pageIndex fetch error', e.message || e); }
    }
    return results;
}

async function buildIndex({ baseUrl, siteId, pageSize = 200, concurrency = 5, forceRefresh = false } = {}) {
    baseUrl = baseUrl || getBaseUrl();
    siteId  = siteId  || getSiteId();
    const cacheKey = CACHE_KEY_PREFIX + siteId;
    if (!forceRefresh) { const cached = getCachedResponse(cacheKey); if (cached) return cached; }
    const first = await liferayGet(baseUrl, `/o/headless-delivery/v1.0/sites/${siteId}/site-pages?fields=title,friendlyUrlPath&pageSize=${pageSize}&page=1`);
    const total = first?.totalCount ? Number(first.totalCount) : (first?.items?.length || 0);
    const pagesCount = Math.max(1, Math.ceil(total / pageSize));
    const allItems = [...(first?.items || [])];
    const pages = []; for (let i = 2; i <= pagesCount; i++) pages.push(i);
    for (let i = 0; i < pages.length; i += concurrency) {
        const fetched = await fetchPageBatch(baseUrl, siteId, pageSize, pages.slice(i, i + concurrency));
        if (Array.isArray(fetched)) allItems.push(...fetched);
    }
    const index = allItems.map((it) => {
        const title = (it.title && (typeof it.title === 'string' ? it.title : it.title['en_US'])) || '';
        const path  = it.friendlyUrlPath || '';
        return { title, path, normTitle: normalize(title), slug: slugify(title) };
    });
    setCachedResponse(cacheKey, index, 24 * 60 * 60 * 1000);
    return index;
}

function scoreEntry(qNorm, entry) {
    return 0.6 * trigramSimilarity(qNorm, entry.normTitle) + 0.3 * tokenOverlap(qNorm, entry.normTitle) + 0.1 * (entry.normTitle.startsWith(qNorm) ? 1 : 0);
}

async function findBestUrl({ baseUrl, siteId, query, topN = 5, minScore = 0.25 } = {}) {
    if (!query) return { candidates: [] };
    baseUrl = baseUrl || getBaseUrl();
    siteId  = siteId  || getSiteId();
    const idx   = await buildIndex({ baseUrl, siteId });
    const qNorm = normalize(query);
    const qSlug = slugify(query);
    const exact = idx.find((e) => e.slug === qSlug || e.path === qSlug || e.path === `/${qSlug}`);
    if (exact) return { candidates: [{ path: exact.path, title: exact.title, score: 1 }] };
    const scored = idx.map((e) => ({ e, score: scoreEntry(qNorm, e) })).sort((a, b) => b.score - a.score);
    return { candidates: scored.filter((s) => s.score >= minScore).slice(0, topN).map((s) => ({ path: s.e.path, title: s.e.title, score: Number(s.score.toFixed(3)) })) };
}

export { buildIndex, findBestUrl };
