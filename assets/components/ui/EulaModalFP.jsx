/**
 * components/ui/EulaModalFP.jsx
 * Modale con i Termini d'uso (Developer EULA) completi.
 */

import React from 'react';

function EulaModalFP({ t, onClose }) {
    return (
        <div className="afp-eula-overlay" onClick={onClose}>
            <div className="afp-eula-card" onClick={(e) => e.stopPropagation()}>
                <div className="afp-eula-header">
                    <h2 className="afp-eula-title">📄 {t.eulaTitle}</h2>
                    <button className="afp-eula-close" onClick={onClose} aria-label="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                <div className="afp-eula-body">
                    <div className="afp-eula-section">
                        <h3>{t.eulaSection1Title}</h3>
                        <p>{t.eulaSection1Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection2Title}</h3>
                        <p>{t.eulaSection2Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection3Title}</h3>
                        <p>{t.eulaSection3Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection4Title}</h3>
                        <p>{t.eulaSection4Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection5Title}</h3>
                        <p>{t.eulaSection5Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection6Title}</h3>
                        <p>{t.eulaSection6Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection7Title}</h3>
                        <p>{t.eulaSection7Text}</p>
                    </div>

                    <div className="afp-eula-section">
                        <h3>{t.eulaSection8Title}</h3>
                        <p>{t.eulaSection8Text}</p>
                    </div>
                </div>

                <div className="afp-eula-footer">
                    <button className="afp-eula-ok" onClick={onClose}>{t.eulaClose}</button>
                </div>
            </div>
        </div>
    );
}

export default EulaModalFP;