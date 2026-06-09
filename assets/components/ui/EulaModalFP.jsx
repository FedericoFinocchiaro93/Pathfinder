/**
 * components/ui/EulaModalFP.jsx
 * Modale con i Termini d'uso (Developer EULA) completi — 14 sezioni bilingui.
 * Include toggle per switchare tra italiano e inglese.
 */

import React, { useState } from 'react';
import { getDictionary } from '../../lib/i18n.js';

const EULA_SECTIONS = Array.from({ length: 14 }, (_, i) => i + 1);

function EulaModalFP({ t, onClose }) {
    const [eulaLang, setEulaLang] = useState(null); // null = use current app locale
    const dict = eulaLang ? getDictionary(eulaLang) : t;

    return (
        <div className="afp-eula-overlay" onClick={onClose}>
            <div className="afp-eula-card" onClick={(e) => e.stopPropagation()}>
                <div className="afp-eula-header">
                    <h2 className="afp-eula-title">📄 {dict.eulaTitle}</h2>
                    <div className="afp-eula-lang-toggle">
                        <button
                            className={`afp-eula-lang-btn${(!eulaLang || eulaLang === 'it') ? ' afp-eula-lang-active' : ''}`}
                            onClick={() => setEulaLang('it')}
                        >🇮🇹 IT</button>
                        <button
                            className={`afp-eula-lang-btn${(eulaLang === 'en') ? ' afp-eula-lang-active' : ''}`}
                            onClick={() => setEulaLang('en')}
                        >🇬🇧 EN</button>
                    </div>
                    <button className="afp-eula-close" onClick={onClose} aria-label="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div className="afp-eula-body">
                    <div className="afp-eula-important">{dict.eulaImportant}</div>
                    {EULA_SECTIONS.map((n) => (
                        <div className="afp-eula-section" key={n}>
                            <h3>{dict[`eulaSection${n}Title`]}</h3>
                            <p>{dict[`eulaSection${n}Text`]}</p>
                        </div>
                    ))}
                </div>

                <div className="afp-eula-footer">
                    <button className="afp-eula-ok" onClick={onClose}>{dict.eulaClose}</button>
                </div>
            </div>
        </div>
    );
}

export default EulaModalFP;