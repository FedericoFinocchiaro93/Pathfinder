/**
 * Italian locale — default language
 */
export default {
    // ── Header & Brand ──
    headerTitle: 'Pathfinder',
    statusOnline: 'Online',

    // ── Rail & Sidebar ──
    railExpandMenu: 'Espandi menu',
    railNewConversation: 'Nuova conversazione',
    railRecentConversations: 'Conversazioni recenti',
    railSettings: 'Impostazioni',
    railUsage: 'Utilizzo LLM',
    usageTitle: 'Utilizzo LLM',
    usageTabSession: 'Sessione',
    usageTabAllTime: 'Totale',
    usageTotalCalls: 'Chiamate',
    usageInputTokens: 'Input',
    usageOutputTokens: 'Output',
    usageCost: 'Costo',
    usageContextWindow: 'Finestra di Contesto',
    usageUsed: 'Usato',
    usageRemaining: 'Rimanente',
    usageTotal: 'Totale',
    usageBudget: 'Budget',
    usageTokenChart: 'Token per Chiamata',
    usageCostTimeline: 'Costo Cumulativo',
    usageCallHistory: 'Storico Chiamate',
    usageByModel: 'Per Modello',
    usageModel: 'Modello',
    usagePricing: 'Prezzi',
    usageInputPrice: 'Input',
    usageOutputPrice: 'Output',
    usageContext: 'Contesto',
    usageBudgetSetting: 'Imposta Budget',
    usageSetBudget: 'Imposta',
    usageClearBudget: 'Rimuovi',
    usageResetAllTime: 'Azzera Statistiche Totali',
    usageConfirmReset: 'Azzerare tutte le statistiche cumulative?',
    usageCtxPct: 'Ctx%',
    usageTools: 'Strumenti',
    usageServiceTier: 'Piano Servizio',
    usageTierFree: 'Tier Gratuito',
    usageTierPaid: 'Pay-as-you-go',
    usageTierFreeDesc: 'Con limiti di rate: 15 RPM, 1M TPM, 1500 RPD',
    usageTierFreeCost: 'Costo: $0 — nessun addebito',
    usageTierPaidDesc: 'Pagamento per token, limiti di rate più alti',
    usageOutputLimit: 'Max Output',
    usageTierPending: 'Il piano sarà rilevato dopo il primo messaggio',
    usageTierAnthropic: 'Basato su API Key — addebito per token',
    usageTierOllama: 'Self-hosted — Gratuito',
    sidebarCollapseMenu: 'Comprimi menu',
    sidebarNewConversation: 'Nuova conversazione',
    sidebarRecentConversations: 'Conversazioni recenti',
    sidebarNoHistory: 'Nessuna conversazione salvata',
    sidebarHistoryUnavailable: '⚠ Storico non disponibile',
    sidebarDeleteConversation: 'Elimina conversazione',
    sidebarSettings: '⚙ Impostazioni',
    sidebarUser: 'Utente',

    // ── Welcome ──
    welcomeTitle: 'Come posso aiutarti?',
    welcomeSubtitle: 'Fai una domanda e troverò articoli, documenti, pagine e contenuti del portale con i link diretti.',

    // ── Input ──
    inputPlaceholder: 'Fai una domanda sul portale…',
    sendButton: 'Invia (Enter)',
    inputHint: 'Premi Enter per inviare · Shift+Enter per nuova riga',

    // ── Chips ──
    chips: [
        { icon: '🔍', text: 'Quanti contenuti web ci sono nel portale?' },
        { icon: '📂', text: 'Quali categorie esistono nel portale?' },
        { icon: '🏷',  text: 'Dammi i tag presenti nel portale' },
        { icon: '📄', text: 'Mostrami i 10 contenuti più recenti' },
        { icon: '👤', text: 'Quanti utenti sono registrati?' },
        { icon: '🌐', text: 'Quali lingue supporta il portale?' },
        { icon: '📑', text: 'Elenca le strutture di contenuto disponibili' },
        { icon: '🗂',  text: 'Mostrami i vocabolari di categorizzazione' },
        { icon: '🔗', text: 'Trovami la pagina "Il Ministro"' },
        { icon: '📊', text: 'In quale mese del 2024 sono stati pubblicati più contenuti?' },
    ],

    // ── Message Bubble ──
    regenerate: 'Rigenera',
    regenerateTitle: 'Rigenera risposta',
    regenerateWithTitle: 'Rigenera: "{query}"',

    // ── Tool Call Bubble ──
    toolResults: 'risultati',

    // ── Searching Messages ──
    searchingContentStructure: 'Ricerco i contenuti web per la struttura "{query}"…',
    searchingFor: 'Sto cercando "{query}"…',
    retrieving: 'Recupero "{query}"…',
    listing: 'Sto elencando "{query}"…',
    processingRequest: 'Elaboro la tua richiesta: "{query}"…',
    creatingContentFolder: 'Creo la cartella contenuti "{query}"…',

    // ── Config Panel ──
    configTitle: '⚙ Impostazioni',
    configBack: '← Torna alla chat',
    configTabGeneral: '⚙ Generali',
    configTabAppearance: '🎨 Aspetto',
    configProvider: 'Provider LLM',
    configProviderAnthropic: '🟣 Anthropic (Claude)',
    configProviderGemini: '🔵 Google Gemini',
    configProviderOllama: '🟢 Ollama (offline)',
    configProviderOpenAI: '🟠 OpenAI',
    configProviderDeepSeek: '🔷 DeepSeek',
    configProviderMistral: '🟡 Mistral',
    configAnthropicKey: 'Anthropic API Key',
    configClaudeModel: 'Modello Claude',
    configClaudeSonnet: 'claude-sonnet-4 (raccomandato)',
    configClaudeHaiku: 'claude-haiku-4.5 (veloce)',
    configGeminiKey: 'Gemini API Key',
    configGeminiModel: 'Modello Gemini',
    configGeminiFlash: 'gemini-2.5-flash (raccomandato)',
    configGeminiPro: 'gemini-2.5-pro',
    configGemini2Flash: 'gemini-2.0-flash',
    configOllamaUrl: 'Ollama URL',
    configOllamaAuth: 'Usa autenticazione (Bearer token)',
    configOllamaKey: 'Ollama API Key',
    configOllamaModel: 'Modello Ollama',
    configOllamaSelect: '— seleziona —',
    configOllamaNoModels: 'Nessun modello. Esegui "ollama pull <modello>".',
    configOpenAIKey: 'API Key',
    configOpenAIModel: 'Modello',
    configOpenAIBaseUrl: 'Base URL (personalizzabile)',
    configOpenAISelect: '— seleziona dal server —',
    configOpenAILoadModels: 'Carica modelli disponibili',
    configOpenAINoModels: 'Nessun modello trovato. Verifica API Key e URL.',
    configLiferayUrl: 'Liferay URL ⚠️ obbligatorio',
    configLiferayUrlHint: 'URL del portale Liferay (es. https://vostro-portale.liferay.com). Senza questo campo il chatbot non può contattare le API di Liferay.',
    configSiteGroupId: 'Site Group ID ⚠️ obbligatorio',
    configSiteGroupIdHint: 'ID numerico del sito Liferay (es. 12345). Fondamentale per accedere a contenuti, pagine, categorie e tutte le API del portale.',
    configChatHistory: 'Storico conversazioni',
    configChatHistoryLabel: 'Salva lo storico delle conversazioni',
    configChatHistoryHint: 'Se abilitato, le conversazioni verranno salvate nel portale come oggetti ChatSession. Potrai ritrovarle nella sidebar e riprenderle in qualsiasi momento. Se disabilitato, nessuna conversazione verrà salvata e la sidebar non mostrerà lo storico.',
    configColorTheme: 'Tema colori',
    configCustomColor: 'Colore personalizzato',
    configSave: '💾 Salva impostazioni',

    // ── Language Selector ──
    langIt: 'Italiano',
    langEn: 'English',

    // ── Prompts ──
    prompt: {
        systemRole: `Sei Pathfinder, un assistente AI integrato in Liferay DXP (versione 2025.Q4 e successive).
Il tuo scopo è aiutare gli amministratori del portale a gestire contenuti, utenti, siti, strutture e oggetti tramite le API Headless di Liferay.
Hai accesso a tool che eseguono operazioni reali sul portale — usali sempre prima di rispondere, non fare mai supposizioni sui dati.`,

        alwaysLanguage: 'Rispondi SEMPRE in italiano. Anche se i risultati dei tool sono in inglese, traduci e rispondi in italiano.',

        rule0: `━━━ REGOLA FONDAMENTALE — DECOMPOSIZIONE DELLE RICHIESTE ━━━
Quando l'utente fa una richiesta composta da più azioni o punti, DEVI prima scomporla in task individuali e poi eseguirli TUTTI in sequenza.
Non fermarti dopo il primo task — completa ogni singolo punto della richiesta.

Esempio: "Aggiungi tutti e 5 gli utenti allo spazio Marketing Hub con il ruolo Content Reviewer, poi collega il sito attuale"
Scomposizione:
  1) Aggiungere i 5 utenti allo spazio Marketing Hub → assign_user_to_space per ciascun utente
  2) Assegnare il ruolo Content Reviewer agli utenti → assign_role_to_user per ciascun utente
  3) Collegare lo spazio al sito attuale → connect_space_site

Regole:
- Se un task richiede ID che non hai (userId, roleId, spaceErc), cerca prima con i tool di ricerca
- Esegui i task nell'ordine logico (prima crea/cerca le risorse, poi assegna/collega)
- Riporta ALLA FINE un riepilogo di tutti i task completati
- Se un task fallisce, segnala l'errore ma continua con i task successivi se possibile`,

        rule1: `━━━ REGOLA ASSOLUTA — COMUNICAZIONE CON L'UTENTE ━━━
Non fare MAI riferimento a tool, chiamate API, workaround, bug di Liferay, codice interno o dettagli implementativi nelle risposte all'utente.
Rispondi come se tu stessi eseguendo le operazioni direttamente, concentrandoti sul RISULTATO.
Esempi:
  ✗ "Ho chiamato il tool create_structured_content e poi ho fatto una PATCH per il workaround del bug"
  ✓ "Ho creato l'articolo con i campi compilati"
  ✗ "Il tool ha restituito errore 404 dall'endpoint /o/headless-delivery/v1.0/..."
  ✓ "Non ho trovato la risorsa richiesta"
  ✗ "Ho usato il tool search_web_content per cercare..."
  ✓ "Ho cercato nel portale e ho trovato..."`,

        rule2: `━━━ REGOLE CRITICHE — VIOLARNE UNA È UN ERRORE GRAVE ━━━
C1. Non dichiarare MAI un'azione completata senza aver prima chiamato il tool e ricevuto il risultato reale.
C2. Non inventare MAI ID o dati — usa sempre e solo i risultati reali restituiti dai tool.
C3. Dopo ogni azione di modifica, riporta all'utente il risultato effettivo restituito dal tool (success, id, nome, ecc.).`,

        rule3: `━━━ REGOLE OPERATIVE — FLUSSI MULTI-STEP ━━━
O1. Per OGNI azione di modifica (creare, aggiornare, eliminare, assegnare) DEVI chiamare il tool corrispondente.

O2. ASSEGNARE UN RUOLO A UN UTENTE:
  a) Se non hai l'userId → chiama get_users({ search: "nome utente" })
  b) Se non hai il roleId → chiama get_available_roles({})
  c) Poi chiama assign_role_to_user({ userId, roleId, siteId: \${siteId} })
  NON fermarti dopo la ricerca — esegui sempre l'azione finale.
  Esempio: "Assegna il ruolo Editor a Mario Rossi"
  → get_users({ search: "Mario Rossi" }) → get_available_roles({}) → assign_role_to_user({ userId: X, roleId: Y, siteId: Z })
  → Risposta: "Ho assegnato il ruolo Editor a Mario Rossi."

O3. ASSEGNARE UN UTENTE A UN SITO:
  a) Se non hai l'userId → chiama get_users({ search: "nome utente" })
  b) Poi chiama assign_user_to_site({ userId, siteId })
  NON fermarti dopo la ricerca.

O4. Se manca un ID necessario, usa prima il tool di ricerca appropriato (get_users, get_available_roles, ecc.), poi chiama il tool di modifica.

O5. L'ID utente (userId) è il campo "id" restituito da get_users — è un numero intero (es. 12345). Questo è il userAccountId richiesto dalle API Liferay.`,

        rule4: `━━━ REGOLE SPECIFICHE PER ENTITÀ ━━━
E1. SITI: Per aggiornare un sito usa update_site con siteId nel body (PUT /sites con id nel body, NON PATCH su /sites/{id}). L'eliminazione è irreversibile — conferma sempre con l'utente prima di procedere.

E2. PAGINE — ELIMINAZIONE: Chiama delete_site_page direttamente con il titolo (es. delete_site_page({ page_id: "NomePagina" })). NON cercare prima con search_pages — il tool cerca automaticamente per titolo, friendlyUrlPath, UUID o ID.

E3. PAGINE FIGLIE: Per creare una pagina figlia DEVI fornire parentSitePage con il friendlyUrlPath della pagina padre.
  Esempio: "Crea la pagina Figlia sotto la pagina Padre"
  → search_pages per trovare /padre → create_site_page({ ..., parentSitePage: { friendlyUrlPath: "/padre" } })
  Senza parentSitePage la pagina viene creata al livello radice.

E4. MASTER PAGE: Sono TEMPLATE DI PAGINA, non siti. Parole chiave: "master page", "page template", "modello di pagina".
  Usa SEMPRE: list_master_pages / create_master_page / update_master_page / delete_master_page.
  NON usare create_site o create_site_page.
  Per associare una pagina a una Master Page: usa list_master_pages per trovare la key, poi passa masterPageKey in create_site_page o update_site_page.

E5. UTILITY PAGE: Sono pagine di utilità (404, 500, login, ecc.). Parole chiave: "utility page", "pagina 404", "pagina di errore".
  Usa SEMPRE: list_utility_pages / create_utility_page / update_utility_page / delete_utility_page.
  PRIMA DI CREARE chiedi sempre il tipo all'utente: ErrorCode404, ErrorCode500, CookiePolicy, CreateAccount, ForgotPassword, Login.

E6. DISTINZIONE FONDAMENTALE:
  SITO = contenitore di pagine e contenuti → create_site
  PAGINA = elemento visibile nel sito → create_site_page
  MASTER PAGE = template/layout riutilizzabile → create_master_page
  UTILITY PAGE = pagina di utilità (404, login, ecc.) → create_utility_page`,

        rule5: `━━━ OBJECT CUSTOM ━━━
OB1. CREAZIONE: usa create_object({ object_name, label_en, label_it, fields, scope, title_field }).
  Il campo "type" è OBBLIGATORIO per ogni field. Tipi: TEXT, LONGTEXT, INTEGER, DECIMAL, BOOLEAN, DATE, RELATIONSHIP.
  Il campo "name" DEVE essere camelCase senza spazi (es. "nomeEvento" NON "nome evento").
  Esempio corretto: { name: "eta", type: "INTEGER" }, { name: "note", type: "LONGTEXT" }, { name: "attivo", type: "BOOLEAN" }

OB2. SCOPE:
  "company" (default) = visibile in tutto il portale
  "site" = visibile per sito
  "depot" = visibile negli Space/Asset Library → usa objectFolderExternalReferenceCode "L_CMS_CONTENT_STRUCTURES"

OB3. TITLE_FIELD: Per Object depot-scoped il campo "title" viene aggiunto automaticamente — NON aggiungerlo nei fields.
  Per Object company/site-scoped specifica title_field con il nome del campo titolo.

OB4. ENTRY: Per Object depot-scoped DEVI specificare scope_key con il NOME dello Space (non l'ID né l'ERC).
  Per Object depot-scoped il campo "title" è OBBLIGATORIO e localizzato.

OB5. MODIFICA CAMPI:
  Modifica campo esistente → update_object_field({ object_name, field_name, label, businessType, indexed })
  Aggiungi campo → add_object_field({ object_name, field_name, type, label_en, label_it })
  Elimina campo → delete_object_field({ object_name, field_name })
  PRIMA di modificare/aggiungere/eliminare campi, usa get_object_fields per vedere i campi esistenti.

OB6. LIMITAZIONI OBJECT:
  - Non si può cambiare il campo "required" su Object già pubblicati (errore 500)
  - Non si può rinominare un campo — Liferay ignora il rename
  - Per cambiare tipo: specifica businessType (es. businessType: "LongText")`,

        rule6: `━━━ SPACE (ASSET LIBRARY) ━━━
SP1. Crea: create_space({ name })
SP2. Modifica: update_space({ spaceErc, name, description })
SP3. Elimina: delete_space({ spaceErc })
SP4. Collega sito: connect_space_site({ spaceErc, siteErc }) / disconnect_space_site({ spaceErc, siteErc })
SP5. Assegna utente: assign_user_to_space({ spaceErc, userErc }) — userErc è l'UUID externalReferenceCode, NON l'ID numerico.
SP6. Rimuovi utente: remove_user_from_space({ spaceErc, userErc })
Usa get_user_spaces per trovare l'externalReferenceCode degli Space.`,

        rule7: `━━━ STRUTTURE DI CONTENUTO E ARTICOLI ━━━
SC1. Crea struttura: create_content_structure({ name, fields })
  Ogni campo DEVE avere: name, fieldType, label_it, label_en.
  Tipi supportati: text, rich_text, numeric, date, date_time, checkbox, select, color, geolocation, image, document_library, link_to_layout, journal_article, separator, checkbox_multiple, grid.
  Per select/checkbox_multiple → options: array di {label, value}
  Per grid → grid_columns e grid_rows

SC2. Crea articolo: create_structured_content({ title, content_structure_id, fields, folder_id })
  NOTA: per un bug di Liferay i valori dei campi NON vengono salvati nel POST — il tool applica automaticamente il workaround POST+PATCH.
  Usa folder_id per inserire l'articolo in una cartella (usa create_content_folder per creare cartelle).

SC2a. Cartelle contenuti: create_content_folder({ name, description?, parent_folder_id? })
  Crea una cartella per organizzare i Journal Articles. Usa parent_folder_id per creare sottocartelle.
  Crea SEMPRE prima la cartella, poi crea gli articoli al suo interno usando folder_id.

SC3. LIMITAZIONI STRUTTURE:
  - link_to_layout e journal_article NON supportano valori via API
  - grid NON supporta valori non vuoti via API
  - date/date_time richiedono formato ISO-8601 con timezone (es. "2025-01-15T00:00:00Z")
  - geolocation: usa value_geo con {latitude, longitude}
  - document_library/image: usa value_document_id con l'ID del documento`,

        rule8: `━━━ LIMITAZIONI NOTE DELLE API LIFERAY ━━━
L1. ORGANIZZAZIONI E GRUPPI UTENTE: Le API Headless NON supportano l'associazione di un utente a un'organizzazione né a un gruppo utente. Se richiesto, spiega che non è possibile via API e suggerisci Control Panel → Users → Edit User → Organizations / User Groups.

L2. RUOLI DEPOT: I ruoli di tipo depot (Asset Library) non possono essere assegnati tramite API. Se richiesto, suggerisci di gestirli dal Control Panel.`,

        rule9: `━━━ URL DEI CONTENUTI ━━━
Quando mostri URL di contenuti web (structured content), usa SEMPRE il campo "url" fornito dal tool. Il formato corretto per i contenuti è: {liferayUrl}/-/{friendlyUrlPath}. NON usare /web/guest/ per i contenuti — quello è il formato delle pagine del sito. Se il campo "url" è disponibile, usalo direttamente senza modificarlo.`,

        rule10: `━━━ DISCOVERY DELLE API ━━━
Quando devi trovare endpoint API Liferay NON coperti dai tool specifici, usa i tool di discovery come ULTIMA RISORSA e SOLO se nessun tool specifico è disponibile:
1. list_available_apis — elenca tutte le API disponibili nel portale
2. get_api_spec — scarica la specifica OpenAPI di una singola API
3. find_relevant_endpoints — cerca endpoint rilevanti per una query
4. discover_endpoint — trova il miglior endpoint per una query

IMPORTANTE: usa SEMPRE prima i tool specifici (search_web_content, get_users, create_site, ecc.). Usa i tool di discovery SOLO quando nessun tool specifico copre l'operazione richiesta.
Flusso consigliato: list_available_apis → get_api_spec (per l'API rilevante) → find_relevant_endpoints o discover_endpoint (per trovare l'endpoint specifico) → call_liferay_api (per eseguire la chiamata).`,
    },

    // ── ToolExecutor messages ──
    executor: {
        missingFields: 'Campi mancanti per creare la pagina',
        nameRequired: 'name obbligatorio per creare una master page',
        nameRequiredUtility: 'name e type obbligatori per creare una utility page',
        pageCreated: 'Pagina "{title}" creata con successo',
        pageUpdated: 'Pagina "{title}" aggiornata con successo',
        masterPageCreated: 'Master Page "{name}" creata con successo',
        masterPageUpdated: 'Master Page aggiornata con successo',
        masterPageDeleted: 'Master Page eliminata con successo',
        utilityPageCreated: 'Utility Page "{name}" creata con successo',
        utilityPageUpdated: 'Utility Page aggiornata con successo',
        utilityPageDeleted: 'Utility Page eliminata con successo',
        confirmDelete: 'Confermi l\'eliminazione? Questa azione è irreversibile.',
        noFieldsToUpdate: 'Nessun campo da aggiornare fornito.',
        siteCreated: 'Sito "{name}" creato con successo',
        siteUpdated: 'Sito aggiornato con successo',
        siteDeleted: 'Sito eliminato con successo',
        userCreated: 'Utente "{name}" creato con successo',
        userUpdated: 'Utente aggiornato con successo',
        userDeleted: 'Utente eliminato con successo',
        roleCreated: 'Ruolo "{name}" creato con successo',
        roleUpdated: 'Ruolo aggiornato con successo',
        roleDeleted: 'Ruolo eliminato con successo',
        organizationCreated: 'Organizzazione "{name}" creata con successo',
        organizationUpdated: 'Organizzazione aggiornata con successo',
        organizationDeleted: 'Organizzazione eliminata con successo',
        userGroupCreated: 'Gruppo utente "{name}" creato con successo',
        userGroupUpdated: 'Gruppo utente aggiornato con successo',
        userGroupDeleted: 'Gruppo utente eliminato con successo',
        categoryCreated: 'Categoria "{name}" creata con successo',
        vocabularyCreated: 'Vocabolario "{name}" creato con successo',
        keywordCreated: 'Tag "{name}" creato con successo',
        objectCreated: 'Object "{name}" creato con successo',
        objectDeleted: 'Object "{name}" eliminato con successo',
        objectEntryCreated: 'Voce creata con successo',
        objectEntryUpdated: 'Voce aggiornata con successo',
        objectEntryDeleted: 'Voce eliminata con successo',
        objectFieldUpdated: 'Campo "{name}" aggiornato con successo',
        objectFieldAdded: 'Campo "{name}" aggiunto con successo',
        objectFieldDeleted: 'Campo eliminato con successo',
        spaceUpdated: 'Space "{name}" aggiornato con successo',
        spaceCreated: 'Space "{name}" creato con successo',
        spaceDeleted: 'Space eliminato con successo',
        spaceSiteConnected: 'Sito collegato allo Space con successo',
        spaceSiteDisconnected: 'Sito scollegato dallo Space con successo',
        userAssignedToSpace: 'Utente assegnato allo Space con successo',
        userRemovedFromSpace: 'Utente rimosso dallo Space con successo',
        contentStructureCreated: 'Struttura di contenuto "{name}" creata con successo',
        structuredContentCreated: 'Contenuto strutturato "{title}" creato con successo',
    },

    // ── Consent Screen ──
    consentTitle: 'Informativa Privacy e Consenso',
    consentIntro: 'Prima di utilizzare il chatbot, è necessario leggere e accettare la seguente informativa.',
    consentDataTitle: 'Trasmissione dati a provider esterni',
    consentDataText: 'Le conversazioni inserite in questo chatbot vengono trasmesse direttamente dal tuo browser ai provider di intelligenza artificiale selezionati nella configurazione (Anthropic/Claude, Google Gemini, OpenAI, DeepSeek, Mistral, Ollama). I dati non transitano per server intermedi. I provider possono trovarsi in paesi al di fuori dell\'Unione Europea (principalmente USA).',
    consentProvidersTitle: 'Provider LLM supportati',
    consentProvidersText: 'Il chatbot supporta i seguenti provider di intelligenza artificiale: Anthropic (Claude), Google (Gemini), OpenAI (GPT), DeepSeek, Mistral AI e Ollama. Il provider utilizzato dipende dalla configurazione scelta dall\'amministratore. Ogni provider ha i propri termini di servizio e la propria politica sulla privacy.',
    consentStorageTitle: 'Archiviazione locale',
    consentStorageText: 'Le API key e la configurazione vengono memorizzate esclusivamente nel browser dell\'utente (localStorage). Non vengono trasmesse a nessun server intermedio. Le conversazioni possono essere salvate come oggetti ChatSession nel portale Liferay, se la funzionalità di storico è abilitata.',
    consentLiferayTitle: 'Responsabilità di Liferay',
    consentLiferayText: 'Liferay agisce esclusivamente come agente di distribuzione tramite il Marketplace. Liferay non è responsabile per la privacy, la sicurezza o l\'integrità dei dati trasmessi ai provider LLM, né per eventuali danni derivanti dall\'uso di questo prodotto.',
    consentWarningTitle: '⚠️ Avvertenza importante',
    consentWarningText: 'Si raccomanda di NON inserire dati sensibili, personali, riservati o soggetti a normativa di settore nelle conversazioni del chatbot. I dati vengono trasmessi a provider esterni e potrebbero essere elaborati e memorizzati in conformità alle loro politiche di privacy.',
    consentCheck1: 'Ho letto l\'informativa privacy e comprendo che i dati delle mie conversazioni verranno inviati a provider esterni.',
    consentCheck2: 'Comprendo che Liferay non è responsabile della privacy, sicurezza o integrità dei dati trasmessi a provider LLM terzi.',
    consentEulaLink: 'Termini d\'uso completi',
    consentAccept: 'Accetta e continua',

    // ── EULA ──
    eulaTitle: 'Termini d\'uso',
    eulaClose: 'Chiudi',
    eulaSection1Title: '1. Accettazione dei termini',
    eulaSection1Text: 'L\'uso di questo prodotto implica l\'accettazione completa dei presenti termini d\'uso. Se non si accettano questi termini, non si deve utilizzare il prodotto.',
    eulaSection2Title: '2. Esclusione di responsabilità di Liferay',
    eulaSection2Text: 'Questo prodotto è sviluppato e distribuito dallo sviluppatore. Liferay agisce esclusivamente come agente di distribuzione tramite il Liferay Marketplace. Liferay non è responsabile per qualsiasi danno, perdita di dati, malfunzionamento, obbligo di supporto o manutenzione relativo a questo prodotto. L\'utente riconosce che qualsiasi reclamo relativo al prodotto deve essere rivolto esclusivamente allo sviluppatore.',
    eulaSection3Title: '3. Responsabilità dell\'utente per le API key',
    eulaSection3Text: 'L\'utente è il solo responsabile della gestione, sicurezza e costo delle API key inserite nella configurazione del prodotto. Le API key vengono memorizzate esclusivamente nel browser dell\'utente (localStorage) e non vengono trasmesse a nessun server intermedio. L\'utente deve rispettare i termini di servizio di ciascun provider LLM utilizzato (Anthropic, Google, OpenAI, DeepSeek, Mistral, Ollama). Lo sviluppatore non è responsabile per costi, abusi o violazioni dei termini derivanti dall\'uso delle API key.',
    eulaSection4Title: '4. Trattamento dei dati e privacy',
    eulaSection4Text: 'Le conversazioni inserite nel chatbot vengono trasmesse direttamente dal browser dell\'utente ai provider LLM selezionati nella configurazione. I dati non transitano per server intermedi dello sviluppatore. L\'utente è responsabile di garantire che l\'invio di dati a provider esteri sia conforme alla normativa applicabile, inclusi il GDPR (Regolamento UE 2016/679) e le normative nazionali in materia di protezione dei dati. Si raccomanda di non inserire dati sensibili, personali o riservati nelle conversazioni. Lo sviluppatore non è responsabile per l\'eventuale trattamento dei dati da parte dei provider LLM.',
    eulaSection5Title: '5. Limitazione di garanzia',
    eulaSection5Text: 'Il prodotto è fornito "così com\'è" (AS IS) senza garanzie di alcun tipo, espresse o implicite, incluse ma non limitate a garanzie di commerciabilità, idoneità per uno scopo specifico e non violazione di diritti di terzi. Lo sviluppatore non garantisce che il prodotto sarà privo di errori, ininterrotto o che soddisferà le esigenze dell\'utente.',
    eulaSection6Title: '6. Limitazione di responsabilità',
    eulaSection6Text: 'In nessun caso lo sviluppatore sarà responsabile per danni indiretti, incidentali, speciali, consequenziali o punitivi derivanti dall\'uso o dall\'impossibilità di uso del prodotto, inclusi ma non limitati a perdita di dati, perdita di profitti, interruzione di attività o costi di sostituzione, anche se lo sviluppatore è stato avvisato della possibilità di tali danni.',
    eulaSection7Title: '7. Modifiche ai termini',
    eulaSection7Text: 'Lo sviluppatore si riserva il diritto di modificare i presenti termini d\'uso in qualsiasi momento. Le modifiche saranno efficaci dalla prossima versione pubblicata sul Marketplace. L\'uso continuato del prodotto dopo la pubblicazione di termini modificati costituisce accettazione dei nuovi termini.',
};
