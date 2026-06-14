/**
 * hooks/useChatHistory.js
 *
 * Gestisce lo storico delle conversazioni tramite Liferay Object.
 *
 * Al primo utilizzo (o se l'Object non esiste) lo crea automaticamente
 * tramite Object Admin API (richiede ruolo Administrator).
 *
 * Object name : ChatSession
 * REST path   : /o/c/chatsessions/
 *
 * Campi:
 *   - title        (Text)     : prime parole del primo messaggio utente
 *   - messagesJson (LongText) : JSON.stringify dell'array messages React
 *   - historyJson  (LongText) : JSON.stringify dell'array history LLM
 *   - sessionDate  (Date)     : data creazione sessione
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getBaseUrl,
    liferayGet,
    liferayPost,
    liferayPut,
    liferayPatch,
    liferayDelete,
} from '../lib/liferay.js';
import { dbg } from '../lib/utils.js';

// ── costanti Object ────────────────────────────────────────────────────────────
const OBJ_PLURAL_URL = '/o/c/chatsessions'; // endpoint REST generato da Liferay
const MAX_JSON_CHARS = 500_000;             // limite sicuro per LongText
const MAX_SESSIONS   = 50;                  // max sessioni in sidebar

// ── definizione Object (creata solo se non esiste) ────────────────────────────
const OBJECT_DEFINITION = {
    name:        'ChatSession',
    label:       { en_US: 'Chat Session', it_IT: 'Sessione Chat' },
    pluralLabel: { en_US: 'Chat Sessions', it_IT: 'Sessioni Chat' },
    scope:       'company',
    status:      { code: 0 },   // Draft — verrà pubblicato subito dopo
    objectFields: [
        {
            name:             'title',
            label:            { en_US: 'Title', it_IT: 'Titolo' },
            businessType:     'Text',
            DBType:           'String',
            indexed:          true,
            indexedAsKeyword: false,
            indexedLanguageId:'en_US',
            required:         false,
        },
        {
            name:         'messagesJson',
            label:        { en_US: 'Messages JSON', it_IT: 'Messaggi JSON' },
            businessType: 'LongText',
            DBType:       'Clob',
            indexed:      false,
            required:     false,
        },
        {
            name:         'historyJson',
            label:        { en_US: 'History JSON', it_IT: 'Storico LLM JSON' },
            businessType: 'LongText',
            DBType:       'Clob',
            indexed:      false,
            required:     false,
        },
        {
            name:         'sessionDate',
            label:        { en_US: 'Session Date', it_IT: 'Data Sessione' },
            businessType: 'Date',
            DBType:       'Date',
            indexed:      true,
            required:     false,
        },
    ],
};

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Cerca la definizione Object per name.
 * Ritorna { id, active, status } oppure null.
 * NON lancia eccezione: un 400/404 viene trattato come "non trovato".
 */
async function findObjectDefinition(base, user, pass) {
    try {
        const data = await liferayGet(
            base,
            `/o/object-admin/v1.0/object-definitions` +
            `?filter=${encodeURIComponent(`name eq 'ChatSession'`)}&pageSize=1`,
            user, pass
        );
        const found = (data.items || [])[0];
        return found ? { id: found.id, active: found.active, status: found.status } : null;
    } catch (e) {
        // 400 / 404 / rete: trattiamo come "non trovato" per non bloccare il bootstrap
        dbg('[ChatHistory] findObjectDefinition: non trovato o errore ignorato:', e.message);
        return null;
    }
}

/**
 * Crea la Object Definition e la pubblica immediatamente.
 */
async function createObjectDefinition(base, user, pass) {
    dbg('[ChatHistory] Creazione Object Definition ChatSession…');

    // Crea l'Object — con status code 0 (approved) Liferay lo pubblica automaticamente.
    // Non è necessaria una chiamata /publish separata.
    const created = await liferayPost(
        base,
        '/o/object-admin/v1.0/object-definitions',
        OBJECT_DEFINITION,
        user, pass
    );
    const defId = created.id;
    dbg('[ChatHistory] Object creato e pubblicato, id:', defId);
    return defId;
}

/** Serializza in JSON troncando se troppo grande. */
function safeJson(value) {
    try {
        const s = JSON.stringify(value);
        if (s.length > MAX_JSON_CHARS) return JSON.stringify([]);
        // Strip 4-byte UTF-8 chars (emoji, rare CJK) that MariaDB utf8 charset can't store.
        // MariaDB utf8 = 3 bytes max; emoji need utf8mb4.
        // Replace with JSON-safe surrogate pairs (\uD83D\uDE00) so JSON.parse works.
        return s.replace(/[\ud800-\udbff][\udc00-\udfff]/g, (pair) => {
            const hi = pair.charCodeAt(0);
            const lo = pair.charCodeAt(1);
            return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        });
    } catch {
        return JSON.stringify([]);
    }
}

/** Genera il titolo della sessione dalla prima domanda utente. */
function makeTitle(text) {
    if (!text) return 'Nuova conversazione';
    const clean = text.trim().replace(/\s+/g, ' ');
    return clean.length > 60 ? clean.slice(0, 57) + '…' : clean;
}

/** Formatta una data ISO in formato leggibile it-IT. */
function formatDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('it-IT', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch {
        return '';
    }
}

// ── hook principale ───────────────────────────────────────────────────────────

export function useChatHistory(cfg) {
    // Se cfg è null, lo storico è disabilitato — restituiamo un oggetto no-op
    const disabled = !cfg;

    const base = getBaseUrl(cfg?.liferayUrl);
    const user = cfg?.lfUser;
    const pass = cfg?.lfPass;

    const [ready,    setReady]    = useState(false);
    const [error,    setError]    = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading,  setLoading]  = useState(false);

    // Tiene traccia dell'ID della sessione corrente (null = nuova chat)
    const currentSessionIdRef = useRef(null);

    // ── bootstrap: verifica/crea Object al mount ──────────────────────────────
    useEffect(() => {
        let cancelled = false;

        async function bootstrap() {
            setLoading(true);
            setError(null);
            try {
                const found = await findObjectDefinition(base, user, pass);

                if (!found) {
                    dbg('[ChatHistory] Object non trovato, lo creo…');
                    try {
                        await createObjectDefinition(base, user, pass);
                    } catch (eCreate) {
                        // Se la creazione fallisce con 409 Conflict l'Object
                        // esiste già (race condition / doppio mount): ignoriamo.
                        // Qualsiasi altro errore lo rilanciamo.
                        if (!eCreate.message.includes('409')) throw eCreate;
                        dbg('[ChatHistory] Object già presente (409 Conflict), proseguo.');
                    }
                    // Attesa affinché Liferay registri il nuovo endpoint REST.
                    // Facciamo polling sull'endpoint con max 5 tentativi.
                    let attempts = 0;
                    while (attempts < 5) {
                        await new Promise((r) => setTimeout(r, 1000));
                        attempts++;
                        try {
                            await liferayGet(base, `${OBJ_PLURAL_URL}?pageSize=1`, user, pass);
                            dbg('[ChatHistory] Endpoint pronto dopo', attempts, 'tentativo/i.');
                            break; // endpoint risponde: usciamo dal loop
                        } catch (_) {
                            dbg('[ChatHistory] Endpoint non ancora pronto, tentativo', attempts);
                        }
                    }
                } else {
                    dbg('[ChatHistory] Object già esistente:', found);
                }

                if (!cancelled) setReady(true);
            } catch (e) {
                dbg('[ChatHistory] Bootstrap error:', e.message);
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        bootstrap();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [base, user, pass]);

    // ── carica lista sessioni quando pronto ───────────────────────────────────
    const fetchSessions = useCallback(async () => {
        if (!ready) return;
        try {
            const data = await liferayGet(
                base,
                `${OBJ_PLURAL_URL}?pageSize=${MAX_SESSIONS}&sort=dateCreated:desc` +
                `&fields=id,title,sessionDate,dateCreated`,
                user, pass
            );
            setSessions(
                (data.items || []).map((s) => ({
                    id:    s.id,
                    title: s.title || 'Sessione',
                    date:  formatDate(s.sessionDate || s.dateCreated),
                }))
            );
        } catch (e) {
            dbg('[ChatHistory] fetchSessions error:', e.message);
        }
    }, [ready, base, user, pass]);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    // ── crea una nuova sessione (chiamata al primo messaggio) ─────────────────
    const createSession = useCallback(async (firstUserText, messages, history) => {
        if (!ready) return null;
        try {
            const body = {
                title:        makeTitle(firstUserText),
                messagesJson: safeJson(messages),
                historyJson:  safeJson(history),
                sessionDate:  new Date().toISOString().split('T')[0], // YYYY-MM-DD
            };
            const created = await liferayPost(base, OBJ_PLURAL_URL, body, user, pass);
            currentSessionIdRef.current = created.id;
            // Aggiorna la sidebar in testa alla lista
            setSessions((prev) => [{
                id:    created.id,
                title: body.title,
                date:  formatDate(body.sessionDate),
            }, ...prev].slice(0, MAX_SESSIONS));
            dbg('[ChatHistory] Sessione creata:', created.id);
            return created.id;
        } catch (e) {
            dbg('[ChatHistory] createSession error:', e.message);
            return null;
        }
    }, [ready, base, user, pass]);

    // ── aggiorna la sessione corrente dopo ogni risposta ──────────────────────
    // NOTE: Liferay Object API returns 500 on PATCH with LongText/Clob fields,
    // ── aggiorna la sessione corrente dopo ogni risposta ──────────────────────
    // Retry PATCH up to 3 times with short delay; if all fail, fall back to PUT.
    const updateSession = useCallback(async (messages, history) => {
        const id = currentSessionIdRef.current;
        if (!ready || !id) return;
        const payload = {
            messagesJson: safeJson(messages),
            historyJson:  safeJson(history),
        };
        try {
            let patched = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    await liferayPatch(base, `${OBJ_PLURAL_URL}/${id}`, payload, user, pass);
                    patched = true;
                    break;
                } catch (err) {
                    dbg(`[ChatHistory] PATCH attempt ${attempt} failed:`, err.message);
                    if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
                }
            }
            if (!patched) {
                dbg('[ChatHistory] All PATCH attempts failed, falling back to PUT');
                await liferayPut(base, `${OBJ_PLURAL_URL}/${id}`, {
                    title:        makeTitle(messages.find(m => m.role === 'user')?.text),
                    ...payload,
                    sessionDate:  new Date().toISOString().split('T')[0],
                }, user, pass);
            }
            dbg('[ChatHistory] Sessione aggiornata:', id);
        } catch (e) {
            dbg('[ChatHistory] updateSession error:', e.message);
        }
    }, [ready, base, user, pass]);

    // ── carica una sessione cliccata dalla sidebar ────────────────────────────
    const loadSession = useCallback(async (sessionId) => {
        if (!ready) return null;
        try {
            const data = await liferayGet(
                base,
                `${OBJ_PLURAL_URL}/${sessionId}`,
                user, pass
            );
            const messages = JSON.parse(data.messagesJson || '[]');
            const history  = JSON.parse(data.historyJson  || '[]');
            currentSessionIdRef.current = sessionId;
            dbg('[ChatHistory] Sessione caricata:', sessionId);
            return { messages, history };
        } catch (e) {
            dbg('[ChatHistory] loadSession error:', e.message);
            return null;
        }
    }, [ready, base, user, pass]);

    // ── elimina una sessione ──────────────────────────────────────────────────
    const deleteSession = useCallback(async (sessionId) => {
        if (!ready) return;
        try {
            await liferayDelete(base, `${OBJ_PLURAL_URL}/${sessionId}`, user, pass);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
            if (currentSessionIdRef.current === sessionId) {
                currentSessionIdRef.current = null;
            }
            dbg('[ChatHistory] Sessione eliminata:', sessionId);
        } catch (e) {
            dbg('[ChatHistory] deleteSession error:', e.message);
        }
    }, [ready, base, user, pass]);

    // ── resetta la sessione corrente (nuova chat) ─────────────────────────────
    const resetCurrentSession = useCallback(() => {
        currentSessionIdRef.current = null;
    }, []);

    // Se lo storico è disabilitato, restituiamo un oggetto no-op
    if (disabled) {
        return {
            ready: false,
            error: null,
            loading: false,
            sessions: [],
            fetchSessions: async () => {},
            createSession: async () => null,
            updateSession: async () => {},
            loadSession: async () => null,
            deleteSession: async () => {},
            resetCurrentSession: () => {},
            currentSessionId: { current: null },
        };
    }

    return {
        ready,
        error,
        loading,
        sessions,
        fetchSessions,
        createSession,
        updateSession,
        loadSession,
        deleteSession,
        resetCurrentSession,
        currentSessionId: currentSessionIdRef,
    };
}
