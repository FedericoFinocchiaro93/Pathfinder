/**
 * components/ui/ConsentScreenFP.jsx
 * Schermata di consenso privacy — mostrata al primo utilizzo.
 * L'utente deve accettare prima di poter usare la chat.
 */

import React, { useState } from 'react';

const CONSENT_KEY    = 'acfp_consent_v1';
const CONSENT_VERSION = 1;

export function hasConsented() {
    try {
        const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
        return saved && saved.accepted && saved.version >= CONSENT_VERSION;
    } catch {
        return false;
    }
}

export function saveConsent() {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
        accepted: true,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
    }));
}

function ConsentScreenFP({ t, onAccept, onShowEula }) {
    const [check1, setCheck1] = useState(false);
    const [check2, setCheck2] = useState(false);
    const canAccept = check1 && check2;

    const handleAccept = () => {
        if (!canAccept) return;
        saveConsent();
        onAccept();
    };

    return (
        <div className="afp-consent-overlay">
            <div className="afp-consent-card">
                <div className="afp-consent-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>
                <h2 className="afp-consent-title">{t.consentTitle}</h2>

                <div className="afp-consent-body">
                    <p>{t.consentIntro}</p>

                    <div className="afp-consent-section">
                        <h4>📊 {t.consentDataTitle}</h4>
                        <p>{t.consentDataText}</p>
                    </div>

                    <div className="afp-consent-section">
                        <h4>🤖 {t.consentProvidersTitle}</h4>
                        <p>{t.consentProvidersText}</p>
                    </div>

                    <div className="afp-consent-section">
                        <h4>💾 {t.consentStorageTitle}</h4>
                        <p>{t.consentStorageText}</p>
                    </div>

                    <div className="afp-consent-section">
                        <h4>🏢 {t.consentLiferayTitle}</h4>
                        <p>{t.consentLiferayText}</p>
                    </div>

                    <div className="afp-consent-section afp-consent-warning">
                        <h4>⚠️ {t.consentWarningTitle}</h4>
                        <p>{t.consentWarningText}</p>
                    </div>
                </div>

                <div className="afp-consent-checks">
                    <label className="afp-consent-check">
                        <input type="checkbox" checked={check1}
                            onChange={(e) => setCheck1(e.target.checked)} />
                        <span>{t.consentCheck1}</span>
                    </label>
                    <label className="afp-consent-check">
                        <input type="checkbox" checked={check2}
                            onChange={(e) => setCheck2(e.target.checked)} />
                        <span>{t.consentCheck2}</span>
                    </label>
                </div>

                <div className="afp-consent-actions">
                    <button className="afp-consent-eula" onClick={onShowEula}>
                        📄 {t.consentEulaLink}
                    </button>
                    <button className={`afp-consent-accept${canAccept ? '' : ' afp-consent-accept-disabled'}`}
                        onClick={handleAccept} disabled={!canAccept}>
                        {t.consentAccept}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConsentScreenFP;