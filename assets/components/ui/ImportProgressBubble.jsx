/**
 * components/ui/ImportProgressBubble.jsx
 * Collapsible progress indicator for Excel/file imports.
 * Shows a single message in chat that updates in-place with:
 * - Animated progress bar
 * - Current phase label
 * - Record count (processed/total)
 * - Expandable error/details section
 */

import React, { useState } from 'react';
import { getDictionary } from '../../lib/i18n.js';
import botIcon from '../../img/PathfinderLogo.png';

function ImportProgressBubble({ msg }) {
    const t = getDictionary();
    const [expanded, setExpanded] = useState(false);
    const data = msg.importProgress || {};
    const {
        total = 0,
        processed = 0,
        phase = '',        // e.g. 'Validazione...', 'Creazione contenuti...', 'Completamento'
        status = 'importing', // 'importing' | 'completed' | 'error'
        successes = [],    // [{ label: 'Pagine', name: 'Nome Pagina' }, ...]
        errors = [],
        fileName = '',
    } = data;

    const isCompleted = status === 'completed';
    const isError = status === 'error';
    // During import (total unknown), show indeterminate progress.
    // On completion, jump to 100%.
    const pct = isCompleted || isError
        ? 100
        : total > 0
            ? Math.round((processed / total) * 100)
            : 0; // indeterminate — bar will animate

    // Color based on status
    const barColor = isError
        ? '#ef4444'
        : isCompleted
            ? '#22c55e'
            : 'var(--afp-primary, #0054b1)';

    const phaseLabel = isCompleted
        ? (t.importCompleted || '✅ Importazione completata')
        : isError
            ? (t.importError || '❌ Errore durante l\'importazione')
            : phase || (t.importing || 'Importazione in corso...');

    const statusIcon = isCompleted
        ? '✅'
        : isError
            ? '❌'
            : '⏳';

    return (
        <div className="afp-msg afp-assistant">
            <div className="afp-msg-avatar">
                <img src={botIcon} alt="" />
            </div>
            <div className="afp-msg-body">
                <div className="afp-import-progress">
                    {/* Header */}
                    <div className="afp-import-progress-header" onClick={() => setExpanded(!expanded)}>
                        <span className="afp-import-progress-icon">{statusIcon}</span>
                        <div className="afp-import-progress-info">
                            <div className="afp-import-progress-title">
                                {fileName
                                    ? (t.importingFile || 'Importazione di {file}').replace('{file}', fileName)
                                    : (t.importProgress || 'Importazione')}
                            </div>
                            <div className="afp-import-progress-phase">{phaseLabel}</div>
                        </div>
                        {(total > 0 || isCompleted || isError) && (
                            <span className="afp-import-progress-pct">{pct}%</span>
                        )}
                        <span className={`afp-import-progress-expand${expanded ? ' afp-import-progress-expanded' : ''}`}>▾</span>
                    </div>

                    {/* Progress bar — indeterminate animation when total unknown */}
                    <div className="afp-import-progress-bar-track">
                        {total > 0 || isCompleted || isError ? (
                            <div
                                className="afp-import-progress-bar-fill"
                                style={{
                                    width: `${pct}%`,
                                    background: barColor,
                                    transition: 'width 0.3s ease',
                                }}
                            />
                        ) : (
                            <div
                                className="afp-import-progress-bar-fill afp-import-progress-bar-indeterminate"
                                style={{ background: barColor }}
                            />
                        )}
                    </div>

                    {/* Counter */}
                    <div className="afp-import-progress-count">
                        {total > 0
                            ? `${processed} / ${total}`
                            : `${processed}`}
                        {' '}{t.importRecords || 'record'}
                    </div>

                    {/* Expandable details */}
                    {expanded && (
                        <div className="afp-import-progress-details">
                            {successes.length > 0 && (
                                <div className="afp-import-progress-successes">
                                    <div className="afp-import-progress-successes-title">
                                        {t.importSuccesses || 'Operazioni completate'} ({successes.length})
                                    </div>
                                    {successes.map((s, i) => (
                                        <div key={i} className="afp-import-progress-success-item">
                                            <span className="afp-import-progress-success-icon">✅</span>
                                            <span className="afp-import-progress-success-text">
                                                {s.label}: <strong>{s.name}</strong>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {errors.length > 0 && (
                                <div className="afp-import-progress-errors">
                                    <div className="afp-import-progress-errors-title">
                                        {t.importErrors || 'Errori'} ({errors.length})
                                    </div>
                                    {errors.map((err, i) => (
                                        <div key={i} className="afp-import-progress-error-item">
                                            <span className="afp-import-progress-error-row">
                                                {t.importRow || 'Riga'} {err.row || '?'}
                                            </span>
                                            <span className="afp-import-progress-error-msg">{err.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {isCompleted && (
                                <div className="afp-import-progress-summary">
                                    {t.importSummary || 'Riepilogo'}: {processed}/{total} {t.importRecords || 'record'}
                                    {errors.length > 0 ? ` — ${errors.length} ${t.importErrors || 'errori'}` : ''}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default React.memo(ImportProgressBubble);