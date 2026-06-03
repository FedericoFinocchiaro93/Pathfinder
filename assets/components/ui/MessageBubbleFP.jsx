/**
 * components/ui/MessageBubbleFP.jsx
 * MessageBubble adattato per la versione fullpage.
 * Stesse logiche dell'originale, classi CSS afp-* invece di acw-*.
 */

import React, { useState } from 'react';
import ToolCallBubbleFP from './ToolCallBubbleFP.jsx';
import ImportProgressBubble from './ImportProgressBubble.jsx';
import botIcon from '../../img/PathfinderLogo.png';
import { getDictionary, getLocale } from '../../lib/i18n.js';
import { trackFeedback, getFeedback, removeFeedback } from '../../lib/feedbackTracker.js';

function renderContent(text) {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const html = escaped
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(
            /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
        )
        .replace(
            /(?<!href=")(https?:\/\/[^\s<"]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        )
        .replace(/\n/g, '<br/>');

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function ThinkingBubble() {
    return (
        <div className="afp-msg afp-assistant">
            <div className="afp-msg-avatar"><img src={botIcon} alt="" /></div>
            <div className="afp-msg-body">
                <div className="afp-thinking"><span /><span /><span /></div>
            </div>
        </div>
    );
}

function SearchingBubble({ text }) {
    return (
        <div className="afp-msg afp-assistant">
            <div className="afp-msg-avatar"><img src={botIcon} alt="" /></div>
            <div className="afp-msg-body">
                <div className="afp-bubble afp-searching-bubble">
                    <span>{text}</span>
                    <span className="afp-searching-dots"><span /><span /><span /></span>
                </div>
            </div>
        </div>
    );
}

const AVATAR = { user: '👤', assistant: null, system: '⚙' };

function formatDocSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(fileName) {
    if (!fileName) return '📎';
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊', txt: '📃', csv: '📊', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', mp4: '🎬', mp3: '🎵', zip: '📦' };
    return icons[ext] || '📎';
}

function DocPreview({ doc }) {
    const base = (window.Liferay?.ThemeDisplay?.getCDNHost?.() || '') + (window.Liferay?.ThemeDisplay?.getPathContext?.() || '');
    const thumb = doc.adaptedImages?.find(img => img.resolution <= 300) || doc.adaptedImages?.[0];
    const thumbUrl = thumb?.contentUrl ? (thumb.contentUrl.startsWith('http') ? thumb.contentUrl : base + thumb.contentUrl) : null;
    const isImage = doc.mimeType?.startsWith('image/');

    return (
        <div className="afp-doc-preview" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '4px 10px', margin: '2px 0', maxWidth: '100%' }}>
            {thumbUrl ? (
                <img src={thumbUrl} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
            ) : (
                <span style={{ fontSize: 18 }}>{getFileIcon(doc.fileName)}</span>
            )}
            <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{doc.title}</span>
            {doc.size ? <span style={{ fontSize: 11, color: '#888' }}>{formatDocSize(doc.size)}</span> : null}
        </div>
    );
}

function MessageBubbleFP({ msg, onRegenerate, cfg }) {
    const t = getDictionary();
    const [feedback, setFeedback] = useState(() => getFeedback(msg.id));
    const feedbackEnabled = cfg?.feedbackEnabled !== false;

    const handleFeedback = (rating) => {
        const newRating = feedback === rating ? null : rating;
        if (newRating) {
            trackFeedback({
                messageId: String(msg.id),
                rating: newRating,
                query: msg.sourceQuery || '',
                response: (msg.text || '').substring(0, 2000),
                provider: cfg?.llmProvider || '',
                model: cfg?.model || '',
                toolCalls: msg.toolCalls || '',
            });
        } else {
            removeFeedback(String(msg.id));
        }
        setFeedback(newRating);
    };
    if (msg.type === 'thinking')  return <ThinkingBubble />;
    if (msg.type === 'searching') return <SearchingBubble text={msg.text} />;
    if (msg.type === 'import_progress') return <ImportProgressBubble msg={msg} />;

    const isAssistantWithText = msg.role === 'assistant' && !!msg.text;

    return (
        <div className={`afp-msg afp-${msg.role}`}>
            <div className="afp-msg-avatar">{msg.role === 'assistant' ? <img src={botIcon} alt="" /> : (AVATAR[msg.role] || '⚙')}</div>
            <div className="afp-msg-body">
                {msg.docs && msg.docs.length > 0 && (
                    <div className="afp-doc-previews" style={{ marginBottom: 6 }}>
                        {msg.docs.map(doc => (
                            <DocPreview key={doc.id} doc={doc} />
                        ))}
                    </div>
                )}
                {msg.droppedFiles && msg.droppedFiles.length > 0 && (
                    <div className="afp-doc-previews" style={{ marginBottom: 6 }}>
                        {msg.droppedFiles.map((f, i) => (
                            <div key={i} className="afp-doc-preview" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.04)', borderRadius: 8, padding: '4px 10px', margin: '2px 0', maxWidth: '100%' }}>
                                {f.preview ? (
                                    <img src={f.preview} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: 18 }}>{getFileIcon(f.name)}</span>
                                )}
                                <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{f.name}</span>
                                {f.size ? <span style={{ fontSize: 11, color: '#888' }}>{formatDocSize(f.size)}</span> : null}
                            </div>
                        ))}
                    </div>
                )}
                {msg.text && (
                    <div className="afp-bubble">{renderContent(msg.text)}</div>
                )}
                {isAssistantWithText && (onRegenerate || feedbackEnabled) && (
                    <div className="afp-msg-actions">
                        {onRegenerate && (
                            <button
                                className="afp-regen-btn"
                                title={msg.sourceQuery ? t.regenerateWithTitle.replace('{query}', msg.sourceQuery) : t.regenerateTitle}
                                onClick={() => onRegenerate(msg.sourceQuery || '')}
                                aria-label={t.regenerateTitle}
                            >
                                ↻ {t.regenerate}
                            </button>
                        )}
                        {feedbackEnabled && (
                            <>
                                <button
                                    className={`afp-feedback-btn afp-feedback-btn-up${feedback === 'up' ? ' afp-feedback-active' : ''}`}
                                    onClick={() => handleFeedback('up')}
                                    title={t.feedbackThumbsUp || 'Helpful'}
                                    aria-label={t.feedbackThumbsUp || 'Helpful'}
                                >👍</button>
                                <button
                                    className={`afp-feedback-btn afp-feedback-btn-down${feedback === 'down' ? ' afp-feedback-active' : ''}`}
                                    onClick={() => handleFeedback('down')}
                                    title={t.feedbackThumbsDown || 'Not helpful'}
                                    aria-label={t.feedbackThumbsDown || 'Not helpful'}
                                >👎</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default React.memo(MessageBubbleFP);
