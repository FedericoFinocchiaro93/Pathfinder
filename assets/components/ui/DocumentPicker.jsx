/**
 * DocumentPicker.jsx
 *
 * Modal picker per selezionare documenti dalla Document Library di Liferay.
 * Supporta:
 *   - Navigazione cartelle (con breadcrumb)
 *   - Ricerca documenti
 *   - Anteprime (thumbnail per immagini, icone per tipo file)
 *   - Paginazione (scroll infinito / "Carica altri")
 *   - Selezione multipla
 *   - Estrazione contenuto per invio al LLM
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { liferayGet, getBaseUrl, getSiteId } from '../../lib/liferay.js';

// ── SVG Icon components ──────────────────────────────────────────────────────
const SvgIcon = ({ d, size = 20, color = 'currentColor', lineCap = 'round' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap={lineCap} strokeLinejoin="round">
        <path d={d} />
    </svg>
);

const ICONS = {
    search: 'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    close: 'M18 6L6 18M6 6l12 12',
    folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    check: 'M20 6L9 17l-5-5',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
    image: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14m-6-6h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
    paperclip: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
};

// ── File type icons (emoji fallback) ──────────────────────────────────────────
const FILE_ICONS = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📊', pptx: '📊', txt: '📃', csv: '📊',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    mp4: '🎬', mp3: '🎵', wav: '🎵', zip: '📦', rar: '📦',
    default: '📎',
};

function getFileIcon(filename) {
    if (!filename) return FILE_ICONS.default;
    const ext = filename.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || FILE_ICONS.default;
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

export default function DocumentPicker({ cfg, t, onSelect, onClose }) {
    const [documents, setDocuments] = useState([]);
    const [folders, setFolders] = useState([]);
    const [breadcrumb, setBreadcrumb] = useState([]); // [{id, name}]
    const [currentFolderId, setCurrentFolderId] = useState(null); // null = root
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState([]); // [{id, title, contentUrl, ...}]
    const [previewDoc, setPreviewDoc] = useState(null);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const searchRef = useRef(null);
    const listRef = useRef(null);
    const PAGE_SIZE = 20;

    // ── API helpers ──────────────────────────────────────────────────────────
    const base = getBaseUrl(cfg.liferayUrl);
    const siteId = getSiteId(cfg.siteGroupId);
    const user = cfg.lfUser;
    const pass = cfg.lfPass;

    // ── Fetch folders ────────────────────────────────────────────────────────
    const fetchFolders = useCallback(async (parentFolderId) => {
        if (!base || !siteId) return [];

        let path;
        if (parentFolderId) {
            path = `/o/headless-delivery/v1.0/document-folders/${parentFolderId}/document-folders?pageSize=50`;
        } else {
            path = `/o/headless-delivery/v1.0/sites/${siteId}/document-folders?pageSize=50`;
        }

        try {
            const data = await liferayGet(base, path, user, pass);
            return (data.items || []).map(f => ({
                id: f.id,
                name: f.name || f.label || 'Unnamed',
                description: f.description || '',
                dateModified: f.dateModified || '',
                dateCreated: f.dateCreated || '',
                isFolder: true,
            }));
        } catch (e) {
            console.error('Error fetching folders:', e);
            return [];
        }
    }, [base, siteId, user, pass]);

    // ── Fetch documents ──────────────────────────────────────────────────────
    const fetchDocuments = useCallback(async (parentFolderId, pageNum, search, append = false) => {
        if (!base || !siteId) {
            console.warn('[DocumentPicker] fetchDocuments: missing base or siteId', { base, siteId });
            return;
        }

        setLoading(true);
        try {
            let path;
            if (search) {
                // Use flatten=true to search across ALL folders, not just root
                path = `/o/headless-delivery/v1.0/sites/${siteId}/documents?flatten=true&search=${encodeURIComponent(search)}&page=${pageNum}&pageSize=${PAGE_SIZE}`;
            } else if (parentFolderId) {
                path = `/o/headless-delivery/v1.0/document-folders/${parentFolderId}/documents?page=${pageNum}&pageSize=${PAGE_SIZE}`;
            } else {
                // Root: show only root-level documents (folders are shown separately)
                path = `/o/headless-delivery/v1.0/sites/${siteId}/documents?page=${pageNum}&pageSize=${PAGE_SIZE}`;
            }

            console.log('[DocumentPicker] fetchDocuments:', { path, search, pageNum, append });
            const data = await liferayGet(base, path, user, pass);
            console.log('[DocumentPicker] fetchDocuments result:', { totalCount: data.totalCount, itemsCount: (data.items || []).length });

            const items = (data.items || []).map(doc => ({
                id: doc.id,
                title: doc.title || doc.fileName || 'Untitled',
                fileName: doc.fileName || '',
                mimeType: doc.mimeType || '',
                size: doc.size || 0,
                contentUrl: doc.contentUrl || '',
                adaptedImages: doc.adaptedImages || [],
                dateCreated: doc.dateCreated || '',
                dateModified: doc.dateModified || '',
                description: doc.description || '',
                isFolder: false,
            }));

            setTotalCount(data.totalCount || 0);
            setHasMore(items.length === PAGE_SIZE);

            if (append) {
                setDocuments(prev => [...prev, ...items]);
            } else {
                setDocuments(items);
            }
        } catch (e) {
            console.error('[DocumentPicker] Error fetching documents:', e);
            if (!append) setDocuments([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [base, siteId, user, pass]);

    // ── Load folder contents ─────────────────────────────────────────────────
    const loadFolder = useCallback(async (folderId, folderName) => {
        setCurrentFolderId(folderId);
        setPage(1);
        setSearchQuery('');
        setPreviewDoc(null);

        if (folderId !== null) {
            setBreadcrumb(prev => [...prev, { id: folderId, name: folderName || 'Folder' }]);
        } else {
            setBreadcrumb([]);
        }

        const f = await fetchFolders(folderId);
        setFolders(f);
        await fetchDocuments(folderId, 1, '');
    }, [fetchFolders, fetchDocuments]);

    // ── Initial load ─────────────────────────────────────────────────────────
    useEffect(() => {
        loadFolder(null, '');
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Search ───────────────────────────────────────────────────────────────
    const handleSearch = useCallback(() => {
        const query = searchQuery.trim();
        if (!query) return;
        console.log('[DocumentPicker] handleSearch:', query);
        setPage(1);
        setPreviewDoc(null);
        setFolders([]);
        setDocuments([]);
        setTotalCount(0);
        fetchDocuments(null, 1, query);
    }, [searchQuery, fetchDocuments]);

    const handleSearchKeyDown = useCallback((e) => {
        if (e.key === 'Enter') handleSearch();
    }, [handleSearch]);

    // ── Load more ────────────────────────────────────────────────────────────
    const handleLoadMore = useCallback(() => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchDocuments(currentFolderId, nextPage, searchQuery, true);
    }, [page, currentFolderId, searchQuery, fetchDocuments]);

    // ── Breadcrumb navigation ────────────────────────────────────────────────
    const handleBreadcrumb = useCallback(async (index) => {
        if (index === -1) {
            // Root
            loadFolder(null, '');
        } else {
            const target = breadcrumb[index];
            setBreadcrumb(prev => prev.slice(0, index + 1));
            setCurrentFolderId(target.id);
            setPage(1);
            setSearchQuery('');
            setPreviewDoc(null);
            const f = await fetchFolders(target.id);
            setFolders(f);
            await fetchDocuments(target.id, 1, '');
        }
    }, [breadcrumb, fetchFolders, fetchDocuments, loadFolder]);

    // ── Select / deselect ────────────────────────────────────────────────────
    const handleToggleSelect = useCallback((doc) => {
        setSelected(prev => {
            const exists = prev.find(s => s.id === doc.id);
            if (exists) return prev.filter(s => s.id !== doc.id);
            return [...prev, {
                id: doc.id,
                title: doc.title,
                fileName: doc.fileName,
                mimeType: doc.mimeType,
                size: doc.size,
                contentUrl: doc.contentUrl,
                adaptedImages: doc.adaptedImages,
            }];
        });
    }, []);

    // ── Confirm selection ────────────────────────────────────────────────────
    const handleConfirm = useCallback(() => {
        if (selected.length === 0) return;
        onSelect(selected);
        onClose();
    }, [selected, onSelect, onClose]);

    // ── Get thumbnail URL ────────────────────────────────────────────────────
    const getThumbnail = useCallback((doc) => {
        if (doc.adaptedImages && doc.adaptedImages.length > 0) {
            // Find the smallest image (thumbnail)
            const thumb = doc.adaptedImages.find(img => img.resolution <= 300)
                || doc.adaptedImages[0];
            if (thumb && thumb.contentUrl) {
                return thumb.contentUrl.startsWith('http') ? thumb.contentUrl : base + thumb.contentUrl;
            }
        }
        return null;
    }, [base]);

    // ── Is image? ────────────────────────────────────────────────────────────
    const isImage = useCallback((mimeType) => {
        return mimeType && mimeType.startsWith('image/');
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="afp-dp-overlay" onClick={onClose}>
            <div className="afp-dp-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="afp-dp-header">
                    <h3 className="afp-dp-title">
                        {t.docPickerTitle || 'Select Documents'}
                    </h3>
                    <button className="afp-dp-close" onClick={onClose} title={t.docPickerClose || 'Close'}>
                        <SvgIcon d={ICONS.close} size={16} color="#6b7280" />
                    </button>
                </div>

                {/* Search bar */}
                <div className="afp-dp-search-bar">
                    <input
                        ref={searchRef}
                        className="afp-dp-search-input"
                        type="text"
                        placeholder={t.docPickerSearch || 'Search documents…'}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                    <button className="afp-dp-search-btn" onClick={handleSearch} title={t.docPickerSearch || 'Search'}>
                        <SvgIcon d={ICONS.search} size={16} color="#fff" />
                    </button>
                    {searchQuery && (
                        <button className="afp-dp-clear-btn" onClick={() => { setSearchQuery(''); loadFolder(currentFolderId, ''); }} title={t.docPickerClearSearch || 'Clear search'}>
                            <SvgIcon d={ICONS.close} size={14} />
                        </button>
                    )}
                </div>

                {/* Breadcrumb */}
                <div className="afp-dp-breadcrumb">
                    <button className="afp-dp-bc-item" onClick={() => handleBreadcrumb(-1)}>
                        <SvgIcon d={ICONS.folder} size={14} /> {t.docPickerRoot || 'Root'}
                    </button>
                    {breadcrumb.map((bc, i) => (
                        <React.Fragment key={bc.id}>
                            <span className="afp-dp-bc-sep">›</span>
                            <button className="afp-dp-bc-item" onClick={() => handleBreadcrumb(i)}>
                                {bc.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                {/* View mode toggle */}
                <div className="afp-dp-toolbar">
                    <div className="afp-dp-view-toggle">
                        <button
                            className={`afp-dp-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title={t.docPickerGridView || 'Grid view'}
                        ><SvgIcon d={ICONS.grid} size={16} /></button>
                        <button
                            className={`afp-dp-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                            onClick={() => setViewMode('list')}
                            title={t.docPickerListView || 'List view'}
                        ><SvgIcon d={ICONS.list} size={16} /></button>
                    </div>
                    <span className="afp-dp-count">
                        {totalCount > 0 ? `${totalCount} ${t.docPickerDocuments || 'documents'}` : ''}
                    </span>
                </div>

                {/* Content area */}
                <div className="afp-dp-content" ref={listRef}>
                    {loading && documents.length === 0 ? (
                        <div className="afp-dp-loading">
                            <div className="afp-dp-spinner" />
                            <span>{t.docPickerLoading || 'Loading…'}</span>
                        </div>
                    ) : folders.length === 0 && documents.length === 0 ? (
                        <div className="afp-dp-empty">
                            {searchQuery
                                ? (t.docPickerNoResults || 'No documents found')
                                : (t.docPickerEmpty || 'This folder is empty')}
                        </div>
                    ) : (
                        <>
                            {/* Folders */}
                            {folders.map(folder => (
                                <div
                                    key={`folder-${folder.id}`}
                                    className={`afp-dp-item ${viewMode} afp-dp-folder-item`}
                                    onClick={() => loadFolder(folder.id, folder.name)}
                                >
                                    <div className="afp-dp-item-thumb afp-dp-folder-thumb">
                                        <SvgIcon d={ICONS.folder} size={viewMode === 'grid' ? 36 : 22} color="#f59e0b" />
                                    </div>
                                    <div className="afp-dp-item-info">
                                        <div className="afp-dp-item-name">{folder.name}</div>
                                        {folder.description && <div className="afp-dp-item-desc">{folder.description}</div>}
                                    </div>
                                </div>
                            ))}

                            {/* Documents */}
                            {documents.map(doc => {
                                const isSelected = selected.some(s => s.id === doc.id);
                                const thumb = getThumbnail(doc);
                                const img = isImage(doc.mimeType);

                                return (
                                    <div
                                        key={`doc-${doc.id}`}
                                        className={`afp-dp-item ${viewMode} ${isSelected ? 'selected' : ''}`}
                                        onClick={() => img ? setPreviewDoc(doc) : handleToggleSelect(doc)}
                                    >
                                        {/* Thumbnail / icon */}
                                        <div className="afp-dp-item-thumb">
                                            {thumb ? (
                                                <img src={thumb} alt="" className="afp-dp-thumb-img" />
                                            ) : (
                                                <span className="afp-dp-item-icon-lg">{getFileIcon(doc.fileName)}</span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="afp-dp-item-info">
                                            <div className="afp-dp-item-name" title={doc.title}>{doc.title}</div>
                                            <div className="afp-dp-item-meta">
                                                {formatFileSize(doc.size)}
                                                {doc.mimeType && <span className="afp-dp-meta-sep">·</span>}
                                                {doc.mimeType && <span>{doc.mimeType.split('/').pop().toUpperCase()}</span>}
                                                {doc.dateModified && <span className="afp-dp-meta-sep">·</span>}
                                                {doc.dateModified && <span>{formatDate(doc.dateModified)}</span>}
                                            </div>
                                        </div>

                                        {/* Select checkbox */}
                                        <div className="afp-dp-item-check">
                                            {isSelected ? (
                                                <span className="afp-dp-check-on"><SvgIcon d={ICONS.check} size={16} color="#fff" /></span>
                                            ) : (
                                                <span className="afp-dp-check-off" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Load more */}
                    {hasMore && !loading && (
                        <button className="afp-dp-load-more" onClick={handleLoadMore}>
                            {t.docPickerLoadMore || 'Load more…'}
                        </button>
                    )}
                    {loading && documents.length > 0 && (
                        <div className="afp-dp-loading-more">
                            <div className="afp-dp-spinner-sm" /> {t.docPickerLoading || 'Loading…'}
                        </div>
                    )}
                </div>

                {/* Preview panel */}
                {previewDoc && (
                    <div className="afp-dp-preview-overlay" onClick={() => setPreviewDoc(null)}>
                        <div className="afp-dp-preview-panel" onClick={e => e.stopPropagation()}>
                            <div className="afp-dp-preview-header">
                                <span className="afp-dp-preview-title">{previewDoc.title}</span>
                                <button className="afp-dp-close" onClick={() => setPreviewDoc(null)}>
                                    <SvgIcon d={ICONS.close} size={16} />
                                </button>
                            </div>
                            <div className="afp-dp-preview-body">
                                {(() => {
                                    const thumb = getThumbnail(previewDoc);
                                    const largeImg = previewDoc.adaptedImages?.find(img => img.resolution > 300)
                                        || previewDoc.adaptedImages?.[0];
                                    const imgUrl = largeImg?.contentUrl
                                        ? (largeImg.contentUrl.startsWith('http') ? largeImg.contentUrl : base + largeImg.contentUrl)
                                        : thumb;
                                    if (imgUrl) {
                                        return <img src={imgUrl} alt={previewDoc.title} className="afp-dp-preview-img" />;
                                    }
                                    return <div className="afp-dp-preview-noimg">{getFileIcon(previewDoc.fileName)}</div>;
                                })()}
                                <div className="afp-dp-preview-info">
                                    <div><strong>{previewDoc.title}</strong></div>
                                    <div>{previewDoc.mimeType} · {formatFileSize(previewDoc.size)}</div>
                                    <div>{formatDate(previewDoc.dateModified)}</div>
                                </div>
                                <button
                                    className="afp-dp-preview-select"
                                    onClick={() => { handleToggleSelect(previewDoc); setPreviewDoc(null); }}
                                >
                                    {selected.some(s => s.id === previewDoc.id)
                                        ? (t.docPickerDeselect || 'Deselect')
                                        : (t.docPickerSelect || 'Select')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer with selection */}
                {selected.length > 0 && (
                    <div className="afp-dp-footer">
                        <div className="afp-dp-selection-info">
                            {selected.length} {selected.length === 1
                                ? (t.docPickerDocumentSelected || 'document selected')
                                : (t.docPickerDocumentsSelected || 'documents selected')}
                        </div>
                        <div className="afp-dp-selection-chips">
                            {selected.map(s => (
                                <span key={s.id} className="afp-dp-chip">
                                    {getFileIcon(s.fileName)} {s.title}
                                    <button className="afp-dp-chip-remove" onClick={() => handleToggleSelect(s)}>
                                        <SvgIcon d={ICONS.close} size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <button className="afp-dp-confirm-btn" onClick={handleConfirm}>
                            <SvgIcon d={ICONS.paperclip} size={16} color="#fff" lineCap="butt" /> {t.docPickerConfirm || 'Add to chat'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}