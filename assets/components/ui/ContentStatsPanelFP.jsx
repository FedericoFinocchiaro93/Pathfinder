/**
 * components/ui/ContentStatsPanelFP.jsx — ai-chatbot-fullpage
 * Content Analytics overlay — professional dashboard with interactive donut charts.
 * Click on chart slices navigates to detail tabs or shows drill-down lists.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    loadAllData,
    getDataCache,
    computeOverviewCounts,
    computeArticlesByStructure,
    computeDocumentsStats,
    computePagesStats,
    computeAuthorsStats,
    computeVocabulariesStats,
    computeContentInsights,
    computePagesInsights,
    computeVocabularyCategories,
    computeAuthorDetail,
    computeContentGaps,
    computeStaleContent,
    computeAlerts,
    fetchFilteredArticles,
    fetchFilteredPages,
    fetchFilteredDocuments,
    fetchFilteredArticlesByAuthorAndStructure,
    fetchFilteredArticlesByAuthorAndCategory,
    formatBytes,
} from '../../lib/contentStats.js';

// ── Color palette — refined, enterprise-grade ──────────────────────────────
const COLORS = [
    '#6366f1', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
    '#3b82f6', '#a855f7', '#0ea5e9', '#84cc16', '#e11d48',
];

// ── SVG Icon Components (modern, clean, 20×20 viewBox) ─────────────────────
const Icon = ({ d, size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d={d} />
    </svg>
);

const Icons = {
    // Navigation
    arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
    chevronLeft: 'M15 18l-6-6 6-6',
    chevronRight: 'M9 18l6-6-6-6',
    close: 'M18 6L6 18M6 6l12 12',
    // Actions
    refresh: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.83 2.75M21 3v6h-6',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    // Chart types
    donut: 'M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z',
    barChart: 'M18 20V10M12 20V4M6 20v-6',
    tableList: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
};

// ── Interactive Donut Chart ─────────────────────────────────────────────────

function DonutChart({ data, valueKey, labelKey, size = 340, innerRatio = 0.62, maxSlices = 12, onSliceClick, showAll = false }) {
    const [hovered, setHovered] = useState(null);

    if (!data || data.length === 0) return <div className="afp-stats-empty">—</div>;

    let slices = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
    // When showAll is true, never group into "Other" — show every slice
    if (!showAll && slices.length > maxSlices) {
        const top = slices.slice(0, maxSlices - 1);
        const otherTotal = slices.slice(maxSlices - 1).reduce((s, d) => s + (d[valueKey] || 0), 0);
        slices = [...top, { [labelKey]: 'Other', [valueKey]: otherTotal }];
    }

    const total = slices.reduce((s, d) => s + (d[valueKey] || 0), 0);
    if (total === 0) return <div className="afp-stats-empty">0</div>;

    const cx = size / 2;
    const cy = size / 2;
    const outerR = (size - 48) / 2;
    const innerR = outerR * innerRatio;

    let cumAngle = -Math.PI / 2;
    const arcs = slices.map((item, i) => {
        const val = item[valueKey] || 0;
        const angle = (val / total) * 2 * Math.PI;
        const startAngle = cumAngle;
        const endAngle = cumAngle + angle;
        cumAngle = endAngle;

        const largeArc = angle > Math.PI ? 1 : 0;
        const x1 = cx + outerR * Math.cos(startAngle);
        const y1 = cy + outerR * Math.sin(startAngle);
        const x2 = cx + outerR * Math.cos(endAngle);
        const y2 = cy + outerR * Math.sin(endAngle);
        const ix1 = cx + innerR * Math.cos(endAngle);
        const iy1 = cy + innerR * Math.sin(endAngle);
        const ix2 = cx + innerR * Math.cos(startAngle);
        const iy2 = cy + innerR * Math.sin(startAngle);

        const path = `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${innerR},${innerR} 0 ${largeArc} 0 ${ix2},${iy2} Z`;

        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';

        return {
            path, color: COLORS[i % COLORS.length], label: item[labelKey],
            value: val, pct, isHovered: hovered === i, originalItem: item,
        };
    });

    const handleClick = (i) => {
        if (onSliceClick) onSliceClick(arcs[i].originalItem, i);
    };

    return (
        <div className="afp-stats-donut-container">
            <div className="afp-stats-donut-chart" style={{ width: size, height: size }}>
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
                    {/* Background ring */}
                    <circle cx={cx} cy={cy} r={outerR} fill="none"
                        stroke="var(--afp-border, #e2e8f0)" strokeWidth="1" opacity="0.3" />
                    {arcs.map((arc, i) => (
                        <path key={i} d={arc.path}
                            fill={arc.color}
                            opacity={hovered !== null && !arc.isHovered ? 0.4 : 1}
                            stroke="var(--afp-bg-main, #ffffff)"
                            strokeWidth="2"
                            style={{
                                cursor: 'pointer',
                                transform: arc.isHovered ? `translate(${(cx - size/2) * 0.02}px, ${(cy - size/2) * 0.02}px) scale(1.02)` : 'none',
                                transformOrigin: `${cx}px ${cy}px`,
                                transition: 'opacity 0.2s ease, transform 0.2s ease',
                            }}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                            onClick={() => handleClick(i)}
                        />
                    ))}
                    {/* Center label */}
                    <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--afp-text-primary, #1e293b)"
                        fontSize="28" fontWeight="800" style={{ pointerEvents: 'none' }}>
                        {total}
                    </text>
                    <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--afp-text-muted, #64748b)"
                        fontSize="11" fontWeight="500" style={{ pointerEvents: 'none' }}>
                        total
                    </text>
                </svg>
                {/* Hover tooltip */}
                {hovered !== null && arcs[hovered] && (
                    <div className="afp-stats-donut-tip">
                        <span className="afp-stats-donut-tip-dot" style={{ background: arcs[hovered].color }} />
                        <span className="afp-stats-donut-tip-label">{arcs[hovered].label}</span>
                        <span className="afp-stats-donut-tip-val">{arcs[hovered].value}</span>
                        <span className="afp-stats-donut-tip-pct">{arcs[hovered].pct}%</span>
                    </div>
                )}
            </div>
            {/* Legend */}
            <div className="afp-stats-donut-legend">
                {arcs.map((arc, i) => (
                    <div key={i} className={`afp-stats-donut-legend-row${arc.isHovered ? ' afp-stats-donut-legend-active' : ''}`}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => handleClick(i)}
                        style={{ opacity: hovered !== null && !arc.isHovered ? 0.45 : 1 }}>
                        <span className="afp-stats-donut-legend-dot" style={{ background: arc.color }} />
                        <span className="afp-stats-donut-legend-label">{arc.label}</span>
                        <span className="afp-stats-donut-legend-val">{arc.value}</span>
                        <span className="afp-stats-donut-legend-pct">{arc.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Metric card — clean, minimal, enterprise ─────────────────────────────────
function MetricCard({ label, value, color, onClick }) {
    return (
        <div className="afp-stats-metric" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
            <div className="afp-stats-metric-value" style={color ? { color } : {}}>{value}</div>
            <div className="afp-stats-metric-label">{label}</div>
            {color && <div className="afp-stats-metric-bar" style={{ background: color }} />}
        </div>
    );
}

// ── Bar Chart (SVG) ─────────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, barColor = '#6366f1', height = 180, maxBars = 12, onBarClick }) {
    if (!data || data.length === 0) return <div className="afp-stats-empty">—</div>;
    const bars = data.slice(0, maxBars);
    const maxVal = Math.max(...bars.map(d => d[valueKey] || 0), 1);

    return (
        <div className="afp-stats-bar-container">
            <div className="afp-stats-bar-chart" style={{ height }}>
                {bars.map((item, i) => {
                    const val = item[valueKey] || 0;
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    return (
                        <div key={i} className="afp-stats-bar-col" onClick={() => onBarClick && onBarClick(item)}
                            style={onBarClick ? { cursor: 'pointer' } : {}}>
                            <div className="afp-stats-bar-val">{val > 0 ? val : ''}</div>
                            <div className="afp-stats-bar-track">
                                <div className="afp-stats-bar-fill" style={{
                                    height: `${pct}%`,
                                    background: barColor,
                                }} />
                            </div>
                            <div className="afp-stats-bar-label">{item[labelKey]}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Chart View Toggle (donut / bar / table) ────────────────────────────────
const CHART_MODES = [
    { key: 'donut', icon: 'donut', label: 'Donut' },
    { key: 'bar', icon: 'barChart', label: 'Bar' },
    { key: 'table', icon: 'tableList', label: 'Table' },
];

function ChartView({ data, valueKey, labelKey, size = 340, innerRatio = 0.62, maxSlices = 12, onSliceClick, defaultMode = 'donut', showAll = false }) {
    const [mode, setMode] = useState(defaultMode);

    if (!data || data.length === 0) return <div className="afp-stats-empty">\u2014</div>;

    const sorted = [...data].sort((a, b) => b[valueKey] - a[valueKey]);
    const total = sorted.reduce((s, d) => s + (d[valueKey] || 0), 0);

    return (
        <div className="afp-stats-chart-view">
            <div className="afp-stats-chart-toggle">
                {CHART_MODES.map(m => (
                    <button key={m.key}
                        className={`afp-stats-chart-toggle-btn${mode === m.key ? ' afp-stats-chart-toggle-active' : ''}`}
                        onClick={() => setMode(m.key)}
                        title={m.label}>
                        <Icon d={Icons[m.icon]} size={16} />
                    </button>
                ))}
            </div>
            <div className="afp-stats-chart-body">
                {mode === 'donut' && (
                    <DonutChart data={data} valueKey={valueKey} labelKey={labelKey} size={size} innerRatio={innerRatio} maxSlices={maxSlices} onSliceClick={onSliceClick} showAll={showAll} />
                )}
                {mode === 'bar' && (
                    <BarChart data={data} valueKey={valueKey} labelKey={labelKey} barColor="#6366f1" height={220} maxBars={maxSlices}
                        onBarClick={onSliceClick ? (item) => onSliceClick(item) : undefined} />
                )}
                {mode === 'table' && (
                    <ChartTable data={sorted} valueKey={valueKey} labelKey={labelKey} total={total} onRowClick={onSliceClick} />
                )}
            </div>
        </div>
    );
}

function ChartTable({ data, valueKey, labelKey, total, onRowClick }) {
    return (
        <div className="afp-stats-chart-table-wrap">
            <table className="afp-stats-chart-table">
                <thead>
                    <tr>
                        <th>{'\u2014'}</th>
                        <th>{labelKey === 'author' ? 'Author' : labelKey === 'name' ? 'Name' : 'Label'}</th>
                        <th>Count</th>
                        <th>%</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, i) => {
                        const val = item[valueKey] || 0;
                        const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                        return (
                            <tr key={i} style={onRowClick ? { cursor: 'pointer' } : {}}
                                onClick={() => onRowClick && onRowClick(item)}>
                                <td><span className="afp-stats-chart-table-dot" style={{ background: COLORS[i % COLORS.length] }} /></td>
                                <td className="afp-stats-cell-title">{item[labelKey]}</td>
                                <td>{val}</td>
                                <td>{pct}%</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ── Health Gauge (SVG arc) ──────────────────────────────────────────────────
function HealthGauge({ score, size = 140 }) {
    const r = (size - 20) / 2;
    const c = Math.PI * r; // half-circle circumference
    const offset = c - (c * Math.min(Math.max(score, 0), 100)) / 100;
    const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div className="afp-stats-gauge" style={{ width: size, textAlign: 'center' }}>
            <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
                {/* Background arc */}
                <path d={`M10,${size / 2} A${r},${r} 0 0 1 ${size - 10},${size / 2}`}
                    fill="none" stroke="var(--afp-border, #e2e8f0)" strokeWidth="8" strokeLinecap="round" />
                {/* Value arc */}
                <path d={`M10,${size / 2} A${r},${r} 0 0 1 ${size - 10},${size / 2}`}
                    fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div className="afp-stats-gauge-value" style={{ color, marginTop: -6 }}>{score}</div>
            <div className="afp-stats-gauge-label">/ 100</div>
        </div>
    );
}

// ── Export to CSV ───────────────────────────────────────────────────────────
function exportToCSV(rows, headers, filename) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ── Tab definitions ─────────────────────────────────────────────────────────
const TABS = ['contents', 'pages', 'vocabularies', 'documents'];

// ── Main component ─────────────────────────────────────────────────────────
function ContentStatsPanelFP({ cfg, onBack, t }) {
    const [tab, setTab] = useState('contents');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [overview, setOverview] = useState(null);
    const [structures, setStructures] = useState([]);
    const [docs, setDocs] = useState({ byMimeType: [], byFolder: [], totalSize: 0 });
    const [pages, setPages] = useState([]);
    const [authors, setAuthors] = useState([]);
    const [vocabs, setVocabs] = useState([]);
    const [insights, setInsights] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    // ── Author detail state ─────────────────────────────────────────────
    const [authorDetail, setAuthorDetail] = useState(null); // null or { authorName, structures, pages, categories, ... }

    // ── Universal drill-down state ─────────────────────────────────────
    const [drillFilter, setDrillFilter] = useState(null);
    const [drillArticles, setDrillArticles] = useState([]);
    const [drillTotal, setDrillTotal] = useState(0);
    const [drillPage, setDrillPage] = useState(1);
    const [drillLoading, setDrillLoading] = useState(false);
    const [drillSection, setDrillSection] = useState(null); // which section is active
    const [vocabCategories, setVocabCategories] = useState([]);
    const [selectedVocab, setSelectedVocab] = useState(null);
    const [pageInsights, setPageInsights] = useState(null);
    const [contentGaps, setContentGaps] = useState(null);
    const [staleContent, setStaleContent] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const PAGE_SIZE = 10;

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Load all raw data ONCE (6 parallel API calls instead of hundreds)
            await loadAllData(cfg);
            const cache = getDataCache();

            // Compute all stats from cached data (synchronous, no API calls)
            const ov = computeOverviewCounts(cache);
            const st = computeArticlesByStructure(cache);
            const dc = computeDocumentsStats(cache);
            const pg = computePagesStats(cache);
            const au = computeAuthorsStats(cache);
            const vc = computeVocabulariesStats(cache);
            const ins = computeContentInsights(cache);
            const pi = computePagesInsights(cache);
            const gaps = computeContentGaps(cache);
            const stale = computeStaleContent(cache, 5);
            const alrts = computeAlerts(cache);

            setOverview(ov);
            setStructures(st);
            setDocs(dc);
            setPages(pg);
            setAuthors(au);
            setVocabs(vc);
            setInsights(ins);
            setPageInsights(pi);
            setContentGaps(gaps);
            setStaleContent(stale);
            setAlerts(alrts);
            setLastRefresh(new Date());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [cfg]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const tabLabels = { contents: t.statsTabContents || 'Contents', pages: t.statsTabPages || 'Pages', vocabularies: t.statsTabVocabularies || 'Vocabularies', documents: t.statsTabDocuments || 'Documents' };

    // ── Universal drill-down ───────────────────────────────────────────
    const openDrillDown = useCallback(async (filterType, filterValue, filterLabel, sectionKey) => {
        setDrillFilter({ type: filterType, value: filterValue, label: filterLabel });
        setDrillSection(sectionKey || null);
        setDrillPage(1); setDrillLoading(true); setDrillArticles([]); setDrillTotal(0);
        try {
            let fetchFn;
            if (filterType.startsWith('page')) fetchFn = fetchFilteredPages;
            else if (filterType.startsWith('doc')) fetchFn = fetchFilteredDocuments;
            else fetchFn = fetchFilteredArticles;
            const res = await fetchFn(cfg, { type: filterType, value: filterValue }, 1, PAGE_SIZE);
            setDrillArticles(res.items); setDrillTotal(res.totalCount);
        } catch { setDrillArticles([]); setDrillTotal(0); } finally { setDrillLoading(false); }
    }, [cfg]);

    const closeDrillDown = useCallback(() => {
        setDrillFilter(null); setDrillArticles([]); setDrillTotal(0); setDrillPage(1); setDrillSection(null);
    }, []);

    // ── Author detail navigation ────────────────────────────────────────
    const openAuthorDetail = useCallback((authorName) => {
        const cache = getDataCache();
        const detail = computeAuthorDetail(cache, authorName);
        setAuthorDetail(detail);
        closeDrillDown();
    }, []);

    const closeAuthorDetail = useCallback(() => {
        setAuthorDetail(null);
    }, []);

    const loadDrillPage = useCallback(async (page) => {
        if (!drillFilter) return;
        setDrillPage(page); setDrillLoading(true);
        try {
            let fetchFn;
            if (drillFilter.type.startsWith('page')) fetchFn = fetchFilteredPages;
            else if (drillFilter.type.startsWith('doc')) fetchFn = fetchFilteredDocuments;
            else fetchFn = fetchFilteredArticles;
            const res = await fetchFn(cfg, { type: drillFilter.type, value: drillFilter.value }, page, PAGE_SIZE);
            setDrillArticles(res.items); setDrillTotal(res.totalCount);
        } catch { setDrillArticles([]); } finally { setDrillLoading(false); }
    }, [cfg, drillFilter]);

    // ── Export CSV ──────────────────────────────────────────────────────
    const handleExportCSV = useCallback(() => {
        const isPage = tab === 'pages';
        const rows = isPage ? (pageInsights?.byType || []) : drillArticles.length > 0 ? drillArticles : [];
        let headers, filename;
        if (drillFilter && drillArticles.length > 0) {
            // Export current drill-down data
            if (isPage) {
                headers = [t.statsColTitle || 'Title', t.statsColAuthor || 'Author', t.statsColDate || 'Date', t.statsColType || 'Type'];
                filename = `pages-${drillFilter.label}.csv`;
            } else {
                headers = [t.statsColTitle || 'Title', t.statsColAuthor || 'Author', t.statsColDate || 'Date'];
                filename = `content-${drillFilter.label}.csv`;
            }
        } else {
            // Export tab-level data
            switch (tab) {
                case 'contents':
                    headers = [t.statsColTitle || 'Title', t.statsColAuthor || 'Author', t.statsColDate || 'Date'];
                    filename = 'contents.csv';
                    break;
                case 'pages':
                    headers = [t.statsColType || 'Type', 'Count'];
                    filename = 'pages.csv';
                    break;
                case 'vocabularies':
                    headers = [t.statsColCategory || 'Category', t.statsColUsage || 'Usage Count'];
                    filename = 'vocabularies.csv';
                    break;
                case 'documents':
                    headers = ['Type', 'Count', 'Size'];
                    filename = 'documents.csv';
                    break;
                default:
                    headers = ['Title']; filename = 'export.csv';
            }
        }
        exportToCSV(rows, headers, filename);
    }, [tab, drillFilter, drillArticles, pageInsights, t]);

    // ── Render tabs ─────────────────────────────────────────────────────
    const renderTabs = () => (
        <div className="afp-stats-tabs">
            {TABS.map(key => (
                <button key={key}
                    className={`afp-stats-tab${tab === key ? ' afp-stats-tab-active' : ''}`}
                    onClick={() => { setTab(key); closeDrillDown(); }}>
                    {tabLabels[key]}
                </button>
            ))}
        </div>
    );

    // ── Drill-down panel ──────────────────────────────────────────────
    const renderDrillDown = () => {
        if (!drillFilter) return null;
        const totalPages = Math.ceil(drillTotal / PAGE_SIZE);
        const isDocFilter = drillFilter.type.startsWith('doc');
        return (
            <div className="afp-stats-drilldown">
                <div className="afp-stats-drilldown-header">
                    <h4>{drillFilter.label}</h4>
                    <button className="afp-stats-struct-close" onClick={closeDrillDown}><Icon d={Icons.close} size={16} /></button>
                </div>
                {drillLoading ? (
                    <div className="afp-stats-loading" style={{ padding: '16px 0' }}><div className="afp-stats-spinner" /></div>
                ) : drillArticles.length === 0 ? (
                    <div className="afp-stats-empty">{t.statsNoData || 'No data found'}</div>
                ) : isDocFilter ? (
                    <>
                        <div className="afp-stats-article-table-wrap">
                            <table className="afp-stats-article-table">
                                <thead><tr>
                                    <th>{t.statsColTitle || 'Title'}</th>
                                    <th>{t.statsColType || 'Type'}</th>
                                    <th>{t.statsColAuthor || 'Author'}</th>
                                    <th>{t.statsColDate || 'Date'}</th>
                                    <th>{t.statsColSize || 'Size'}</th>
                                </tr></thead>
                                <tbody>
                                    {drillArticles.map((d, i) => (
                                        <tr key={d.id || i}>
                                            <td className="afp-stats-cell-title">{d.title || d.name || '\u2014'}</td>
                                            <td>{d.encodingFormat || '\u2014'}</td>
                                            <td>{d.creator?.name || '\u2014'}</td>
                                            <td>{d.dateCreated ? new Date(d.dateCreated).toLocaleDateString() : '\u2014'}</td>
                                            <td>{formatBytes(d.sizeInBytes)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="afp-stats-pagination">
                                <button disabled={drillPage <= 1} onClick={() => loadDrillPage(drillPage - 1)}><Icon d={Icons.chevronLeft} size={16} /></button>
                                <span className="afp-stats-page-info">{drillPage} / {totalPages}</span>
                                <button disabled={drillPage >= totalPages} onClick={() => loadDrillPage(drillPage + 1)}><Icon d={Icons.chevronRight} size={16} /></button>
                                <span className="afp-stats-page-total">{drillTotal} {t.statsArticles?.toLowerCase() || 'items'}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="afp-stats-article-table-wrap">
                            <table className="afp-stats-article-table">
                                <thead><tr>
                                    <th>{t.statsColTitle || 'Title'}</th>
                                    <th>{t.statsColStatus || 'Status'}</th>
                                    <th>{t.statsColAuthor || 'Author'}</th>
                                    <th>{t.statsColDate || 'Date'}</th>
                                    <th>{t.statsColReviewDate || 'Review'}</th>
                                    <th className="afp-stats-th-actions"></th>
                                </tr></thead>
                                <tbody>
                                    {drillArticles.map((a, i) => {
                                        const reviewDate = a.reviewDate || a.dateReview || null;
                                        const friendlyUrl = (a.friendlyUrlPath || a.contentUrl || '').replace(/^\/+/, '');
                                        const contentUrl = friendlyUrl ? `${cfg.liferayUrl || ''}/web/guest/-/${friendlyUrl}` : null;
                                        // Compute status label using same logic as computeContentInsights
                                        let statusLabel;
                                        const versionStatus = a.version?.status?.label;
                                        const wfStatus = a.workflowStatusInfo?.label || a.status?.label;
                                        const effectiveStatus = versionStatus || wfStatus;
                                        if (effectiveStatus) {
                                            const s = effectiveStatus.toLowerCase();
                                            if (s.includes('draft') || s.includes('bozza')) statusLabel = 'Draft';
                                            else if (s.includes('pending') || s.includes('in review') || s.includes('da approvare')) statusLabel = 'Pending';
                                            else if (s.includes('denied') || s.includes('rejected') || s.includes('rifiutato')) statusLabel = 'Denied';
                                            else if (s.includes('scheduled') || s.includes('programmato')) statusLabel = 'Scheduled';
                                            else if (s.includes('publish') || s.includes('approv') || s.includes('approved')) statusLabel = 'Published';
                                            else statusLabel = effectiveStatus;
                                        } else {
                                            const pubDate = a.datePublished ? new Date(a.datePublished).getTime() : 0;
                                            if (!a.datePublished || a.datePublished.startsWith('1970')) statusLabel = 'Unpublished';
                                            else if (pubDate > Date.now()) statusLabel = 'Scheduled';
                                            else statusLabel = 'Published';
                                        }
                                        const statusColors = { Draft: '#f59e0b', Pending: '#6366f1', Denied: '#ef4444', Scheduled: '#8b5cf6', Published: '#22c55e', Unpublished: '#64748b' };
                                        const statusColor = statusColors[statusLabel] || '#64748b';
                                        return (
                                            <tr key={a.id || i}>
                                                <td className="afp-stats-cell-title">{a.title || a.name || '\u2014'}</td>
                                                <td><span className="afp-stats-status-badge" style={{ background: statusColor + '18', color: statusColor, borderColor: statusColor + '40' }}>{statusLabel}</span></td>
                                                <td>{a.creator?.name ? (
                                                    <span className="afp-stats-author-link" onClick={() => openAuthorDetail(a.creator.name)}>{a.creator.name}</span>
                                                ) : '\u2014'}</td>
                                                <td>{a.dateCreated ? new Date(a.dateCreated).toLocaleDateString() : '\u2014'}</td>
                                                <td>{reviewDate ? new Date(reviewDate).toLocaleDateString() : <span style={{ color: 'var(--afp-text-muted, #64748b)', fontStyle: 'italic' }}>{'\u2014'}</span>}</td>
                                                <td className="afp-stats-td-actions">
                                                    {contentUrl && (
                                                        <a href={contentUrl} target="_blank" rel="noopener noreferrer"
                                                            className="afp-stats-action-link" title={t.statsViewPage || 'View'}>
                                                            <Icon d={Icons.eye} size={16} />
                                                        </a>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="afp-stats-pagination">
                                <button disabled={drillPage <= 1} onClick={() => loadDrillPage(drillPage - 1)}><Icon d={Icons.chevronLeft} size={16} /></button>
                                <span className="afp-stats-page-info">{drillPage} / {totalPages}</span>
                                <button disabled={drillPage >= totalPages} onClick={() => loadDrillPage(drillPage + 1)}><Icon d={Icons.chevronRight} size={16} /></button>
                                <span className="afp-stats-page-total">{drillTotal} {t.statsArticles?.toLowerCase() || 'articles'}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // ── Author Detail view ──────────────────────────────────────────────
    const renderAuthorDetail = () => {
        if (!authorDetail) return null;
        const ad = authorDetail;

        const handleStructClick = async (structItem) => {
            setDrillFilter({ type: 'authorStructure', value: structItem.id, label: structItem.name, authorName: ad.authorName });
            setDrillSection('authorStructures');
            setDrillPage(1); setDrillLoading(true); setDrillArticles([]); setDrillTotal(0);
            try {
                const res = fetchFilteredArticlesByAuthorAndStructure(cfg, ad.authorName, structItem.id, 1, PAGE_SIZE);
                setDrillArticles(res.items); setDrillTotal(res.totalCount);
            } catch { setDrillArticles([]); setDrillTotal(0); } finally { setDrillLoading(false); }
        };

        const handleCategoryClick = async (catItem) => {
            setDrillFilter({ type: 'authorCategory', value: catItem.id, label: catItem.name, authorName: ad.authorName });
            setDrillSection('authorCategories');
            setDrillPage(1); setDrillLoading(true); setDrillArticles([]); setDrillTotal(0);
            try {
                const res = fetchFilteredArticlesByAuthorAndCategory(cfg, ad.authorName, catItem.id, 1, PAGE_SIZE);
                setDrillArticles(res.items); setDrillTotal(res.totalCount);
            } catch { setDrillArticles([]); setDrillTotal(0); } finally { setDrillLoading(false); }
        };

        return (
            <div className="afp-stats-author-detail">
                <div className="afp-stats-author-detail-header">
                    <button className="afp-config-back" onClick={closeAuthorDetail} title={t.statsBack || 'Back'}>
                        <Icon d={Icons.arrowLeft} size={20} />
                    </button>
                    <div className="afp-stats-author-detail-title">
                        <h2>{ad.authorName}</h2>
                        <span className="afp-stats-author-detail-subtitle">
                            {ad.totalArticles} {t.statsArticles || 'articles'} · {ad.totalPages} {t.statsPages || 'pages'} · {ad.totalCategories} {t.statsCategoryUsages || 'category usages'}
                        </span>
                    </div>
                </div>

                {/* ── Section 1: Structures ────────────────────────────── */}
                {ad.structures.length > 0 && (
                    <div className="afp-stats-section-block afp-stats-section-visible">
                        <h3>{t.statsAuthorStructures || 'Content Structures'}</h3>
                        <div className="afp-stats-struct-row">
                            <ChartView data={ad.structures} valueKey="count" labelKey="name" size={260} innerRatio={0.6}
                                onSliceClick={(item) => handleStructClick(item)} />
                        </div>
                        <div className="afp-stats-total">
                            {ad.structures.length} {t.statsTotalStructures?.toLowerCase() || 'structures'} {' — '}
                            {ad.structures.reduce((s, v) => s + v.count, 0)} {t.statsTotalArticles?.toLowerCase() || 'articles'}
                        </div>
                        {drillSection === 'authorStructures' && renderDrillDown()}
                    </div>
                )}

                {/* ── Section 2: Pages ─────────────────────────────────── */}
                {ad.pages.length > 0 && (
                    <div className="afp-stats-section-block afp-stats-section-visible">
                        <h3>{t.statsAuthorPages || 'Pages Created'}</h3>
                        <div className="afp-stats-article-table-wrap">
                            <table className="afp-stats-article-table">
                                <thead><tr>
                                    <th>{t.statsColTitle || 'Title'}</th>
                                    <th>{t.statsColType || 'Type'}</th>
                                    <th>{t.statsColDate || 'Date'}</th>
                                    <th className="afp-stats-th-actions"></th>
                                </tr></thead>
                                <tbody>
                                    {ad.pages.map((p, i) => (
                                        <tr key={p.id || i}>
                                            <td className="afp-stats-cell-title">{p.title}</td>
                                            <td>{p.typeLabel}</td>
                                            <td>{p.dateCreated ? new Date(p.dateCreated).toLocaleDateString() : '—'}</td>
                                            <td className="afp-stats-td-actions">
                                                {p.friendlyUrlPath && (
                                                    <a href={`${cfg.liferayUrl || ''}/web/guest/-/${(p.friendlyUrlPath || '').replace(/^\/+/, '')}`} target="_blank" rel="noopener noreferrer"
                                                        className="afp-stats-action-link" title={t.statsViewPage || 'View'}>
                                                        <Icon d={Icons.eye} size={16} />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Section 3: Categories ────────────────────────────── */}
                {ad.categories.length > 0 && (
                    <div className="afp-stats-section-block afp-stats-section-visible">
                        <h3>{t.statsAuthorCategories || 'Categories Used'}</h3>
                        <div className="afp-stats-struct-row">
                            <ChartView data={ad.categories} valueKey="count" labelKey="name" size={260} innerRatio={0.6}
                                onSliceClick={(item) => handleCategoryClick(item)} />
                        </div>
                        <div className="afp-stats-total">
                            {ad.categories.length} {t.statsTotalCategories?.toLowerCase() || 'categories'}
                        </div>
                        {drillSection === 'authorCategories' && renderDrillDown()}
                    </div>
                )}
            </div>
        );
    };

    // ── Contents tab (all content analytics in one) ───────────────────
    const renderContents = () => {
        if (!overview) return null;
        const ds = drillSection; // shorthand
        // Helper: returns class name for section visibility
        const secCls = (key) => !ds || ds === key ? 'afp-stats-section-block afp-stats-section-visible' : 'afp-stats-section-block afp-stats-section-hidden';
        return (
            <div className="afp-stats-sections">
                {/* Structures */}
                {structures.length > 0 && (
                    <div className={secCls('structures')}>
                        <h3>{t.statsArticlesByStructure || 'Articles by Content Structure'}</h3>
                        <div className="afp-stats-struct-row">
                            <ChartView data={structures} valueKey="count" labelKey="name" size={260} innerRatio={0.6}
                                showAll={true}
                                onSliceClick={(item) => openDrillDown('structure', item.id, `${t.statsArticlesByStructure || 'Structure'}: ${item.name}`, 'structures')} />
                        </div>
                        <div className="afp-stats-total">
                            {structures.length} {t.statsTotalStructures?.toLowerCase() || 'structures'} {' \u2014 '}
                            {structures.reduce((s, v) => s + v.count, 0)} {t.statsTotalArticles?.toLowerCase() || 'articles'}
                        </div>
                        {ds === 'structures' && renderDrillDown()}
                    </div>
                )}

                {/* Publication Status */}
                {insights?.publicationStatus?.length > 0 && (
                    <div className={secCls('status')}>
                        <h3>{t.statsWorkflowTitle || 'Publication Status'}</h3>
                        <div className="afp-stats-status-grid">
                            {insights.publicationStatus.map((s, i) => {
                                const colors = { Published: '#22c55e', Scheduled: '#f59e0b', Unpublished: '#64748b' };
                                const c = colors[s.label] || COLORS[i % COLORS.length];
                                const total = insights.publicationStatus.reduce((a, b) => a + b.count, 0) || 1;
                                const pct = ((s.count / total) * 100).toFixed(1);
                                return (
                                    <div key={s.label} className="afp-stats-status-card afp-stats-tilt" style={{ borderColor: c, cursor: 'pointer' }}
                                        onClick={() => openDrillDown('status', s.label, `${t.statsWorkflowTitle || 'Status'}: ${s.label}`, 'status')}>
                                        <div className="afp-stats-status-value" style={{ color: c }}>{s.count}</div>
                                        <div className="afp-stats-status-label">{s.label}</div>
                                        <div className="afp-stats-status-pct">{pct}%</div>
                                    </div>
                                );
                            })}
                        </div>
                        {ds === 'status' && renderDrillDown()}
                    </div>
                )}

                {/* Freshness */}
                {insights?.freshness && (
                    <div className={secCls('freshness')}>
                        <h3>{t.statsFreshnessTitle || 'Content Freshness'}</h3>
                        <div className="afp-stats-freshness-grid">
                            {insights.freshness.map((b, i) => {
                                const colors = ['#22c55e', '#06b6d4', '#f59e0b', '#ef4444'];
                                const total = insights.freshness.reduce((s, x) => s + x.count, 0) || 1;
                                const pct = ((b.count / total) * 100).toFixed(1);
                                return (
                                    <div key={b.key} className="afp-stats-freshness-card afp-stats-tilt" style={{ cursor: 'pointer' }}
                                        onClick={() => openDrillDown('freshness', b.key, `${t.statsFreshnessTitle || 'Freshness'}: ${b.label}`, 'freshness')}>
                                        <div className="afp-stats-freshness-bar" style={{ background: colors[i] }} />
                                        <div className="afp-stats-freshness-value" style={{ color: colors[i] }}>{b.count}</div>
                                        <div className="afp-stats-freshness-label">{b.label}</div>
                                        <div className="afp-stats-freshness-pct">{pct}%</div>
                                    </div>
                                );
                            })}
                        </div>
                        {ds === 'freshness' && renderDrillDown()}
                    </div>
                )}

                {/* Timeline */}
                {insights?.timeline && (
                    <div className={secCls('timeline')}>
                        <h3>{t.statsTimelineTitle || 'Content Timeline'}</h3>
                        <div className="afp-stats-timeline-legend">
                            <span className="afp-stats-timeline-dot" style={{ background: '#6366f1' }} />
                            <span>{t.statsTimelineCreated || 'Created'}</span>
                        </div>
                        <div className="afp-stats-timeline-chart">
                            <BarChart data={insights.timeline} valueKey="created" labelKey="label" barColor="#6366f1" height={160}
                                onBarClick={(item) => openDrillDown('month', { year: item.year, month: item.month }, `${t.statsTimelineTitle || 'Timeline'}: ${item.label}`, 'timeline')} />
                        </div>
                        {ds === 'timeline' && renderDrillDown()}
                    </div>
                )}

                {/* Health */}
                {insights?.health && (
                    <div className={secCls('health')}>
                        <h3>{t.statsHealthTitle || 'Content Health Score'}</h3>
                        <div className="afp-stats-health-row">
                            <HealthGauge score={insights.health.score} size={140} />
                            <div className="afp-stats-health-indicators">
                                {[
                                    { key: 'noCategories', label: t.statsHealthNoCategories || 'Without Categories', ...insights.health.noCategories, color: '#ef4444' },
                                    { key: 'noKeywords', label: t.statsHealthNoKeywords || 'Without Tags', ...insights.health.noKeywords, color: '#f97316' },
                                    { key: 'stale', label: t.statsHealthStale || 'Stale (>90 days)', ...insights.health.stale, color: '#64748b' },
                                    ...(insights.health.noReviewDate ? [{ key: 'noReviewDate', label: t.statsHealthNoReviewDate || 'No Review Date', ...insights.health.noReviewDate, color: '#8b5cf6' }] : []),
                                ].map(ind => (
                                    <div key={ind.key} className="afp-stats-health-ind afp-stats-tilt" style={{ cursor: 'pointer' }}
                                        onClick={() => openDrillDown('health', ind.key, `${t.statsHealthTitle || 'Health'}: ${ind.label}`, 'health')}>
                                        <span className="afp-stats-health-dot" style={{ background: ind.color }} />
                                        <span className="afp-stats-health-label">{ind.label}</span>
                                        <span className="afp-stats-health-val">{ind.count}</span>
                                        <span className="afp-stats-health-pct">{ind.pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {ds === 'health' && renderDrillDown()}
                    </div>
                )}

                {/* Authors */}
                {authors.length > 0 && (
                    <div className={secCls('authors')}>
                        <h3>{t.statsTopAuthors || 'Top Authors'}</h3>
                        <ChartView data={authors} valueKey="count" labelKey="author" size={260} innerRatio={0.6}
                            onSliceClick={(item) => openAuthorDetail(item.author)} />
                    </div>
                )}

                {/* Stale Content — Top 5 da aggiornare */}
                {staleContent.length > 0 && (
                    <div className={secCls('stale')}>
                        <h3>{t.statsStaleContent || 'Top 5 Content to Update'}</h3>
                        <div className="afp-stats-article-table-wrap">
                            <table className="afp-stats-article-table">
                                <thead><tr>
                                    <th>{t.statsColTitle || 'Title'}</th>
                                    <th>{t.statsColStructure || 'Structure'}</th>
                                    <th>{t.statsColAuthor || 'Author'}</th>
                                    <th>{t.statsStaleDays || 'Days Stale'}</th>
                                    <th className="afp-stats-th-actions"></th>
                                </tr></thead>
                                <tbody>
                                    {staleContent.map((a, i) => (
                                        <tr key={a.id || i}>
                                            <td className="afp-stats-cell-title">{a.title}</td>
                                            <td>{a.structureName}</td>
                                            <td>{a.author !== 'Unknown' ? (
                                                <span className="afp-stats-author-link" onClick={() => openAuthorDetail(a.author)}>{a.author}</span>
                                            ) : '—'}</td>
                                            <td><span style={{ color: a.staleDays > 180 ? '#ef4444' : a.staleDays > 120 ? '#f59e0b' : '#64748b', fontWeight: 600 }}>{a.staleDays}</span></td>
                                            <td className="afp-stats-td-actions">
                                                {a.friendlyUrlPath && (
                                                    <a href={`${cfg.liferayUrl || ''}/web/guest/-/${(a.friendlyUrlPath || '').replace(/^\/+/, '')}`} target="_blank" rel="noopener noreferrer"
                                                        className="afp-stats-action-link" title={t.statsViewPage || 'View'}>
                                                        <Icon d={Icons.eye} size={16} />
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Content Gaps */}
                {contentGaps && (contentGaps.emptyStructures.length > 0 || contentGaps.orphanVocabularies.length > 0) && (
                    <div className={secCls('gaps')}>
                        <h3>{t.statsContentGaps || 'Content Gaps'}</h3>
                        {contentGaps.emptyStructures.length > 0 && (
                            <div className="afp-stats-gap-section">
                                <div className="afp-stats-gap-label">{t.statsEmptyStructures || 'Empty Structures (no articles)'}</div>
                                <div className="afp-stats-gap-items">
                                    {contentGaps.emptyStructures.map((s, i) => (
                                        <span key={s.id || i} className="afp-stats-gap-tag">{s.name}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {contentGaps.orphanVocabularies.length > 0 && (
                            <div className="afp-stats-gap-section">
                                <div className="afp-stats-gap-label">{t.statsOrphanVocabularies || 'Unused Vocabularies (no articles tagged)'}</div>
                                <div className="afp-stats-gap-items">
                                    {contentGaps.orphanVocabularies.map((v, i) => (
                                        <span key={v.id || i} className="afp-stats-gap-tag afp-stats-gap-tag-warn">{v.name} ({v.categoryCount})</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        );
    };

    // ── Vocabularies tab ──────────────────────────────────────────────
    const handleVocabClick = useCallback((vocab) => {
        setSelectedVocab(vocab);
        // Use cached data instead of fetching
        const cache = getDataCache();
        const cats = computeVocabularyCategories(cache, vocab.id);
        setVocabCategories(cats);
    }, []);

    const renderVocabularies = () => {
        if (vocabs.length === 0) return <div className="afp-stats-empty">{t.statsNoData || 'No data available'}</div>;
        return (
            <div className="afp-stats-vocab-layout">
                <div className="afp-stats-vocab-chart">
                    <ChartView data={vocabs} valueKey="categoryCount" labelKey="name" size={280} innerRatio={0.6}
                        onSliceClick={(item) => handleVocabClick(item)} />
                    <div className="afp-stats-total">
                        {vocabs.length} {t.statsTotalVocabs?.toLowerCase() || 'vocabularies'} {' \u2014 '}
                        {vocabs.reduce((s, v) => s + v.categoryCount, 0)} {t.statsTotalCategories?.toLowerCase() || 'categories'}
                    </div>
                </div>
                <div className="afp-stats-vocab-detail">
                    {selectedVocab ? (
                        <div className="afp-stats-vocab-detail-inner">
                            <div className="afp-stats-vocab-detail-header">
                                <h4>{selectedVocab.name}</h4>
                                <button className="afp-stats-struct-close" onClick={() => { setSelectedVocab(null); setVocabCategories([]); }}><Icon d={Icons.close} size={16} /></button>
                            </div>
                            {vocabCategories.length === 0 ? (
                                <div className="afp-stats-empty">{t.statsNoData || 'No categories found'}</div>
                            ) : (
                                <div className="afp-stats-article-table-wrap">
                                    <table className="afp-stats-article-table">
                                        <thead><tr>
                                            <th>{t.statsColCategory || 'Category'}</th>
                                            <th>{t.statsColUsage || 'Usage Count'}</th>
                                        </tr></thead>
                                        <tbody>
                                            {vocabCategories.map((cat, i) => (
                                                <tr key={cat.id || i} className="afp-stats-vocab-cat-row"
                                                    onClick={() => openDrillDown('category', cat.id, `${selectedVocab.name}: ${cat.name}`, 'vocabs')}
                                                    style={{ cursor: 'pointer' }}>
                                                    <td className="afp-stats-cell-title">
                                                        <span className="afp-stats-cat-dot" style={{ background: COLORS[i % COLORS.length] }} />
                                                        {cat.name}
                                                    </td>
                                                    <td>{cat.usageCount}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {drillSection === 'vocabs' && renderDrillDown()}
                        </div>
                    ) : (
                        <div className="afp-stats-vocab-placeholder">
                            <span>{t.statsVocabClickHint || 'Click a vocabulary to see its categories'}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ── Pages tab ──────────────────────────────────────────────────────
    const renderPages = () => {
        if (!pageInsights) return <div className="afp-stats-empty">{t.statsNoData || 'No data available'}</div>;
        const pi = pageInsights;
        const ds = drillSection;
        const secCls = (key) => !ds || ds === key ? 'afp-stats-section-block afp-stats-section-visible' : 'afp-stats-section-block afp-stats-section-hidden';

        return (
            <div className="afp-stats-sections">
                {/* Pages by Type */}
                {pi.byType.length > 0 && (
                    <div className={secCls('pageType')}>
                        <h3>{t.statsPagesByType || 'Pages by Type'}</h3>
                        <div className="afp-stats-struct-row">
                            <ChartView data={pi.byType} valueKey="count" labelKey="label" size={260} innerRatio={0.6}
                                onSliceClick={(item) => openDrillDown('pageType', item.type, `${t.statsPagesByType || 'Page Type'}: ${item.label}`, 'pageType')} />
                        </div>
                        <div className="afp-stats-total">
                            {pi.byType.length} {t.statsTotalTypes?.toLowerCase() || 'types'} {' \u2014 '}
                            {pi.byType.reduce((s, v) => s + v.count, 0)} {t.statsTotalPages?.toLowerCase() || 'pages'}
                        </div>
                        {ds === 'pageType' && renderDrillDown()}
                    </div>
                )}

                {/* Publication Status */}
                {pi.publicationStatus.length > 0 && (
                    <div className={secCls('pageStatus')}>
                        <h3>{t.statsPageStatusTitle || 'Page Status'}</h3>
                        <div className="afp-stats-status-grid">
                            {pi.publicationStatus.map((s, i) => {
                                const colors = { Published: '#22c55e', Draft: '#f59e0b', Scheduled: '#06b6d4', Unpublished: '#64748b' };
                                const c = colors[s.label] || COLORS[i % COLORS.length];
                                const total = pi.publicationStatus.reduce((a, b) => a + b.count, 0) || 1;
                                const pct = ((s.count / total) * 100).toFixed(1);
                                return (
                                    <div key={s.label} className="afp-stats-status-card afp-stats-tilt" style={{ borderColor: c, cursor: 'pointer' }}
                                        onClick={() => openDrillDown('pageStatus', s.label, `${t.statsPageStatusTitle || 'Page Status'}: ${s.label}`, 'pageStatus')}>
                                        <div className="afp-stats-status-value" style={{ color: c }}>{s.count}</div>
                                        <div className="afp-stats-status-label">{s.label}</div>
                                        <div className="afp-stats-status-pct">{pct}%</div>
                                    </div>
                                );
                            })}
                        </div>
                        {ds === 'pageStatus' && renderDrillDown()}
                    </div>
                )}

                {/* Freshness */}
                {pi.freshness && (
                    <div className={secCls('pageFreshness')}>
                        <h3>{t.statsPageFreshnessTitle || 'Page Freshness'}</h3>
                        <div className="afp-stats-freshness-grid">
                            {pi.freshness.map((b, i) => {
                                const colors = ['#22c55e', '#06b6d4', '#f59e0b', '#ef4444'];
                                const total = pi.freshness.reduce((s, x) => s + x.count, 0) || 1;
                                const pct = ((b.count / total) * 100).toFixed(1);
                                return (
                                    <div key={b.key} className="afp-stats-freshness-card afp-stats-tilt" style={{ cursor: 'pointer' }}
                                        onClick={() => openDrillDown('pageFreshness', b.key, `${t.statsPageFreshnessTitle || 'Page Freshness'}: ${b.label}`, 'pageFreshness')}>
                                        <div className="afp-stats-freshness-bar" style={{ background: colors[i] }} />
                                        <div className="afp-stats-freshness-value" style={{ color: colors[i] }}>{b.count}</div>
                                        <div className="afp-stats-freshness-label">{b.label}</div>
                                        <div className="afp-stats-freshness-pct">{pct}%</div>
                                    </div>
                                );
                            })}
                        </div>
                        {ds === 'pageFreshness' && renderDrillDown()}
                    </div>
                )}

                {/* Timeline */}
                {pi.timeline && (
                    <div className={secCls('pageTimeline')}>
                        <h3>{t.statsPageTimelineTitle || 'Page Timeline'}</h3>
                        <div className="afp-stats-timeline-legend">
                            <span className="afp-stats-timeline-dot" style={{ background: '#6366f1' }} />
                            <span>{t.statsTimelineCreated || 'Created'}</span>
                        </div>
                        <div className="afp-stats-timeline-chart">
                            <BarChart data={pi.timeline} valueKey="created" labelKey="label" barColor="#6366f1" height={160}
                                onBarClick={(item) => openDrillDown('pageMonth', { year: item.year, month: item.month }, `${t.statsPageTimelineTitle || 'Page Timeline'}: ${item.label}`, 'pageTimeline')} />
                        </div>
                        {ds === 'pageTimeline' && renderDrillDown()}
                    </div>
                )}

                {/* Health */}
                {pi.health && (
                    <div className={secCls('pageHealth')}>
                        <h3>{t.statsPageHealthTitle || 'Page Health Score'}</h3>
                        <div className="afp-stats-health-row">
                            <HealthGauge score={pi.health.score} size={140} />
                            <div className="afp-stats-health-indicators">
                                {[
                                    { key: 'noDescription', label: t.statsPageNoDescription || 'Without Description', ...pi.health.noDescription, color: '#ef4444' },
                                    { key: 'hidden', label: t.statsPageHidden || 'Hidden from Nav', ...pi.health.hidden, color: '#f97316' },
                                    { key: 'stale', label: t.statsPageStale || 'Stale (>90 days)', ...pi.health.stale, color: '#64748b' },
                                ].map(ind => (
                                    <div key={ind.key} className="afp-stats-health-ind afp-stats-tilt" style={{ cursor: 'pointer' }}
                                        onClick={() => openDrillDown('pageHealth', ind.key, `${t.statsPageHealthTitle || 'Page Health'}: ${ind.label}`, 'pageHealth')}>
                                        <span className="afp-stats-health-dot" style={{ background: ind.color }} />
                                        <span className="afp-stats-health-label">{ind.label}</span>
                                        <span className="afp-stats-health-val">{ind.count}</span>
                                        <span className="afp-stats-health-pct">{ind.pct}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {ds === 'pageHealth' && renderDrillDown()}
                    </div>
                )}

                {/* Authors */}
                {pi.byAuthor.length > 0 && (
                    <div className={secCls('pageAuthors')}>
                        <h3>{t.statsPageAuthors || 'Pages by Author'}</h3>
                        <ChartView data={pi.byAuthor} valueKey="count" labelKey="author" size={260} innerRatio={0.6}
                            onSliceClick={(item) => openAuthorDetail(item.author)} />
                    </div>
                )}

                {/* Hierarchy */}
                {pi.hierarchy && (
                    <div className={secCls('pageHierarchy')}>
                        <h3>{t.statsPageHierarchy || 'Site Hierarchy'}</h3>
                        <div className="afp-stats-metrics-row">
                            <MetricCard label={t.statsTotalPages || 'Total Pages'} value={pi.hierarchy.totalPages} color={COLORS[0]} />
                            <MetricCard label={t.statsRootPages || 'Root Pages'} value={pi.hierarchy.rootPages} color={COLORS[2]} />
                            <MetricCard label={t.statsMaxDepth || 'Max Depth'} value={pi.hierarchy.maxDepth} color={COLORS[4]} />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Documents tab ──────────────────────────────────────────────────
    const renderDocuments = () => {
        const ds = drillSection;
        const secCls = (key) => !ds || ds === key ? 'afp-stats-section-block afp-stats-section-visible' : 'afp-stats-section-block afp-stats-section-hidden';
        return (
            <div className="afp-stats-sections">
                {docs.byMimeType.length > 0 && (
                    <div className={secCls('docMimeType')}>
                        <h3>{t.statsDocsByType || 'Documents by Type'}</h3>
                        <ChartView data={docs.byMimeType} valueKey="count" labelKey="label" size={340} innerRatio={0.6}
                            onSliceClick={(item) => openDrillDown('docMimeType', item.type, `${t.statsDocsByType || 'Type'}: ${item.label}`, 'docMimeType')} />
                        {ds === 'docMimeType' && renderDrillDown()}
                    </div>
                )}
                {docs.byFolder.length > 1 && (
                    <div className={secCls('docFolder')}>
                        <h3>{t.statsDocsByFolder || 'Documents by Folder'}</h3>
                        <ChartView data={docs.byFolder} valueKey="count" labelKey="name" size={300} innerRatio={0.6}
                            onSliceClick={(item) => openDrillDown('docFolder', item.name, `${t.statsDocsByFolder || 'Folder'}: ${item.name}`, 'docFolder')} />
                        {ds === 'docFolder' && renderDrillDown()}
                    </div>
                )}
            </div>
        );
    };

    // ── Render content ──────────────────────────────────────────────────
    const renderContent = () => {
        if (loading && !overview) {
            return (
                <div className="afp-stats-loading">
                    <div className="afp-stats-spinner" />
                    <span>{t.statsLoading || 'Loading statistics\u2026'}</span>
                </div>
            );
        }
        if (error) {
            return (
                <div className="afp-stats-error">
                    <span><Icon d={Icons.alert} size={18} className="afp-stats-icon-error" /> {error}</span>
                    <button className="afp-stats-retry-btn" onClick={loadAll}>{t.statsRetry || 'Retry'}</button>
                </div>
            );
        }
        // Author detail view takes priority
        if (authorDetail) return renderAuthorDetail();
        if (tab === 'contents') return renderContents();
        if (tab === 'pages') return renderPages();
        if (tab === 'vocabularies') return renderVocabularies();
        return renderDocuments();
    };

    // ── Main render ─────────────────────────────────────────────────────
    return (
        <div className="afp-config-overlay">
            <div className="afp-config-header">
                <button className="afp-config-back" onClick={onBack}><Icon d={Icons.arrowLeft} size={20} /></button>
                <h2>{t.statsTitle || 'Content Analytics'}</h2>
                <div style={{ flex: 1 }} />
                <button className="afp-stats-refresh-btn" onClick={loadAll} disabled={loading}
                    title={t.statsRefresh || 'Refresh'}><Icon d={Icons.refresh} size={18} /></button>
                <button className="afp-stats-export-btn" onClick={handleExportCSV}
                    title={t.statsExportCSV || 'Export CSV'}><Icon d={Icons.download} size={18} /></button>
            </div>
            {renderTabs()}
            {/* Proactive Alert Banners */}
            {alerts.length > 0 && !authorDetail && (
                <div className="afp-stats-alerts">
                    {alerts.map(a => (
                        <div key={a.key} className={`afp-stats-alert afp-stats-alert-${a.severity}`}
                            onClick={() => {
                                if (a.key === 'noCategories') openDrillDown('health', 'noCategories', `${t.statsHealthTitle || 'Health'}: ${a.label}`, 'health');
                                else if (a.key === 'noKeywords') openDrillDown('health', 'noKeywords', `${t.statsHealthTitle || 'Health'}: ${a.label}`, 'health');
                                else if (a.key === 'stale') openDrillDown('freshness', 'stale', `${t.statsFreshnessTitle || 'Freshness'}: ${a.label}`, 'freshness');
                                else if (a.key === 'noReviewDate') openDrillDown('health', 'noReviewDate', `${t.statsHealthTitle || 'Health'}: ${a.label}`, 'health');
                                else if (a.key === 'hiddenPages') openDrillDown('pageHealth', 'hidden', `${t.statsPageHealthTitle || 'Page Health'}: ${a.label}`, 'pageHealth');
                            }}>
                            <span className="afp-stats-alert-count">{a.count}</span>
                            <span className="afp-stats-alert-label">{a.label}</span>
                        </div>
                    ))}
                </div>
            )}
            <div className="afp-config-body">
                {renderContent()}
            </div>
            {lastRefresh && (
                <div className="afp-stats-footer">
                    {t.statsLastRefresh || 'Last refresh'}: {lastRefresh.toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}

export default ContentStatsPanelFP;