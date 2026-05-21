/**
 * components/ui/ToolCallBubbleFP.jsx
 * Indicatore chiamata tool per la versione fullpage.
 */

import React from 'react';
import { getDictionary } from '../../lib/i18n.js';

function ToolCallBubbleFP({ toolName, done, count }) {
    const t = getDictionary();
    return (
        <div className={`afp-tool-call${done ? ' afp-tool-done' : ''}`}>
            {done
                ? <span className="afp-tool-check">✓</span>
                : <span className="afp-tool-spin" />
            }
            <span className="afp-tool-label">{toolName}</span>
            {count !== undefined && count !== '?' && (
                <span className="afp-tool-count">{count} {t.toolResults}</span>
            )}
        </div>
    );
}

export default React.memo(ToolCallBubbleFP);
