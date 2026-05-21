/**
 * components/ui/MessageBubbleFP.jsx
 * MessageBubble adattato per la versione fullpage.
 * Stesse logiche dell'originale, classi CSS afp-* invece di acw-*.
 */

import React from 'react';
import ToolCallBubbleFP from './ToolCallBubbleFP.jsx';
import botIcon from '../../img/Copilot_20260516_162708.png';
import { getDictionary, getLocale } from '../../lib/i18n.js';

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

function MessageBubbleFP({ msg, onRegenerate }) {
    const t = getDictionary();
    if (msg.type === 'thinking')  return <ThinkingBubble />;
    if (msg.type === 'searching') return <SearchingBubble text={msg.text} />;

    const isAssistantWithText = msg.role === 'assistant' && !!msg.text;

    return (
        <div className={`afp-msg afp-${msg.role}`}>
            <div className="afp-msg-avatar">{msg.role === 'assistant' ? <img src={botIcon} alt="" /> : (AVATAR[msg.role] || '⚙')}</div>
            <div className="afp-msg-body">
                {msg.text && (
                    <div className="afp-bubble">{renderContent(msg.text)}</div>
                )}
                {isAssistantWithText && onRegenerate && (
                    <button
                        className="afp-regen-btn"
                        title={msg.sourceQuery ? t.regenerateWithTitle.replace('{query}', msg.sourceQuery) : t.regenerateTitle}
                        onClick={() => onRegenerate(msg.sourceQuery || '')}
                        aria-label={t.regenerateTitle}
                    >
                        ↻ {t.regenerate}
                    </button>
                )}
            </div>
        </div>
    );
}

export default React.memo(MessageBubbleFP);
