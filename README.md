# 🧭 Pathfinder AI

**L'assistente intelligente per Liferay DXP — conversazionale, contestuale, multimodale.**

Pathfinder AI trasforma il tuo portale Liferay in una piattaforma conversazionale. Chiedi, crea, cerca, modifica — tutto tramite linguaggio naturale. Niente form, niente pannelli, niente frizione.

---

## ✨ Cosa può fare

### 🔍 Cercare e trovare
- Cerca contenuti, documenti, blog, pagine — tutto indicizzato dal portale
- Ricerca avanzata con filtri per struttura, categoria, vocabolario
- Naviga tassonomie, tag e categorie in linguaggio naturale

### ✏️ Creare e modificare
- Crea contenuti strutturati, pagine, categorie, tag, vocabolari
- Modifica contenuti esistenti, aggiorna categorie, gestisci pagine
- Assegna ruoli, gestisci utenti e siti — tutto via chat

### 🧠 Comprendere il contesto
- Conosce le strutture DDM e i loro campi
- Capisce le relazioni tra contenuti, categorie e vocabolari
- Risponde in italiano e inglese, adattandosi alla lingua dell'utente

### 🛡️ Privacy e sicurezza
- Schermata di consenso privacy obbligatoria al primo accesso
- Termini d'uso completi (EULA) sempre consultabili
- Le credenziali Liferay restano nel browser — mai trasmesse a terze parti
- Regole interne che impediscono all'LLM di esporre dettagli tecnici o workaround

---

## 🤖 Provider LLM supportati

| Provider | Modelli | Note |
|----------|---------|------|
| **Anthropic** | Claude Sonnet 4, Claude 3.5 Sonnet, ecc. | Provider predefinito |
| **Google Gemini** | Gemini 2.5 Flash, Pro, ecc. | API Key Google AI |
| **OpenAI** | GPT-4o, GPT-4o-mini, ecc. | API compatibili OpenAI |
| **DeepSeek** | DeepSeek Chat, Reasoner | API compatibili OpenAI |
| **Mistral** | Mistral Large, Medium, Small | API compatibili OpenAI |
| **Ollama** | Qualsiasi modello locale | Self-hosted, nessuna API key |

Cambia provider in qualsiasi momento dalle impostazioni ⚙ — la conversazione continua senza interruzioni.

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────┐
│                  Pathfinder AI                   │
│              (React SPA — Fullpage)              │
├──────────┬──────────┬──────────┬────────────────┤
│  Anthropic│  Gemini  │  OpenAI  │    Ollama      │
│  Claude   │  API     │ Compat.  │   (locale)      │
├──────────┴──────────┴──────────┴────────────────┤
│                   Router LLM                      │
│         (dispatch, retry, fallback)              │
├──────────────────────────────────────────────────┤
│               Tool Executor                       │
│         30+ strumenti Liferay Headless            │
├──────────────────────────────────────────────────┤
│            Liferay DXP Headless APIs              │
│   Delivery · Admin User · Taxonomy · Search      │
└──────────────────────────────────────────────────┘
```

### Componenti chiave

| File | Ruolo |
|------|-------|
| `ChatbotFullpage.jsx` | Layout principale — sidebar, header, messaggi, input |
| `useAgentFP.js` | Hook React — orchestrazione conversazione, tool loop |
| `llm/router.js` | Dispatch verso il provider LLM selezionato |
| `llm/anthropic.js` | Integrazione Anthropic Claude (streaming, tool use) |
| `llm/gemini.js` | Integrazione Google Gemini (streaming, function calling) |
| `llm/openai.js` | Integrazione OpenAI / DeepSeek / Mistral (streaming, tool use) |
| `llm/ollama.js` | Integrazione Ollama locale (streaming, tool use) |
| `toolExecutor.js` | Esecuzione di 30+ strumenti Liferay Headless |
| `tools.js` | Definizione degli strumenti (schema Anthropic/Gemini/Ollama/OpenAI) |
| `prompts.js` | System prompt con 22 regole di comportamento |
| `config.js` | Gestione configurazione (localStorage) |
| `i18n.js` | Internazionalizzazione IT/EN |
| `ConsentScreenFP.jsx` | Schermata consenso privacy (obbligatoria) |
| `EulaModalFP.jsx` | Termini d'uso completi |
| `ConfigPanelFP.jsx` | Pannello impostazioni (provider, modelli, colori) |
| `UsagePanelFP.jsx` | Dashboard costi e utilizzo token |

---

## 🛠️ Strumenti Liferay

Pathfinder AI può eseguire **30+ operazioni** sul portale Liferay tramite le API Headless:

| Categoria | Strumenti |
|-----------|-----------|
| **Contenuti** | Cerca contenuti, recupera per ID, cerca per struttura, strutture DDM, campi struttura |
| **Documenti** | Cerca documenti nel repository |
| **Blog** | Cerca post blog |
| **Pagine** | Cerca pagine, crea pagine, lista master pages |
| **Tassonomie** | Categorie, vocabolari, tag — crea, aggiorna, cerca |
| **Utenti** | Utente corrente, cerca utenti, assegna/rimuovi ruoli |
| **Siti** | Dettagli sito, crea/aggiorna/elimina siti |
| **Organizzazioni** | Crea, aggiorna, elimina organizzazioni |
| **Gruppi** | Crea, aggiorna, elimina gruppi utente |
| **Object** | Crea Object Definition personalizzati con campi |
| **Ricerca avanzata** | Search API con filtri, ordinamento, paginazione |

---

## 🚀 Installazione

### Prerequisiti
- Liferay DXP 7.4+ (o Liferay Portal 7.4+)
- Node.js 18+ per la build

### Build

```bash
# Dalla root del workspace Liferay
gradlew :client-extensions:ai-chatbot-fullpage:build
```

### Deploy

Copiare il JAR generato in `build/libs/` nella cartella `deploy/` di Liferay, oppure usare:

```bash
gradlew :client-extensions:ai-chatbot-fullpage:deploy
```

### Configurazione

1. Aggiungi il widget **Pathfinder AI** a una pagina del portale
2. Apri le impostazioni ⚙ e configura:
   - **Provider LLM** (Anthropic, Gemini, OpenAI, DeepSeek, Mistral, Ollama)
   - **API Key** del provider scelto
   - **Modello** (o usa il modello predefinito)
   - **Liferay URL** — l'indirizzo del tuo portale (obbligatorio)
   - **Site Group ID** — l'ID del sito Liferay (obbligatorio)
   - **Credenziali Liferay** — email e password dell'utente con permessi adeguati
3. Al primo accesso, la schermata di consenso privacy verrà mostrata

---

## 🎨 Personalizzazione

### Colori tema
Dalle impostazioni puoi personalizzare:
- **Colore primario** — header, bottoni, accenti
- **Colore accent** — hover, selezioni
- **Colore bolla utente** — messaggi inviati
- **Colore bolla bot** — messaggi ricevuti

### Lingua
Pathfinder AI rileva automaticamente la lingua del browser e supporta:
- 🇮🇹 Italiano (predefinito)
- 🇬🇧 English

### Storia chat
La cronologia delle conversazioni può essere salvata su Liferay (abilitandola nelle impostazioni) per riprendere le chat da dove le hai lasciate.

---

## 📊 Monitoraggio costi

Il pannello **Usage** mostra in tempo reale:
- Token utilizzati (input/output) per sessione
- Costo stimato in USD per provider e modello
- Storico delle chiamate con dettagli

Prezzi aggiornati per tutti i provider: Anthropic, Gemini, OpenAI, DeepSeek, Mistral.

---

## 🔒 Sicurezza e Privacy

- **Consenso obbligatorio** — l'utente deve accettare i termini prima di usare la chat
- **EULA consultabile** — termini completi sempre accessibili dal pannello impostazioni
- **Credenziali locali** — email e password Liferay restano nel browser, trasmesse solo al portale
- **API key locali** — le chiavi dei provider LLM sono salvate in localStorage
- **Nessun telemetry** — nessun dato inviato a server terzi
- **Regole LLM** — 22 regole interne che impediscono all'IA di esporre dettagli tecnici, workaround o informazioni sensibili

---

## 📁 Struttura progetto

```
ai-chatbot-fullpage/
├── client-extension.yaml      # Configurazione Liferay Custom Element
├── package.json                # Dipendenze Node.js
├── webpack.config.js           # Build configuration
├── assets/
│   ├── chatbot-fullpage.css    # Stili principali
│   ├── components/
│   │   ├── ChatbotFullpage.jsx # Componente root
│   │   └── ui/
│   │       ├── ConfigPanelFP.jsx
│   │       ├── ConsentScreenFP.jsx
│   │       ├── EulaModalFP.jsx
│   │       ├── MessageBubbleFP.jsx
│   │       ├── ToolCallBubbleFP.jsx
│   │       └── UsagePanelFP.jsx
│   ├── hooks/
│   │   ├── useAgentFP.js       # Hook agente conversazionale
│   │   └── useChatHistory.js    # Hook cronologia chat
│   ├── lib/
│   │   ├── config.js           # Gestione configurazione
│   │   ├── i18n.js             # Internazionalizzazione
│   │   ├── liferay.js           # Utility Liferay Headless
│   │   ├── llm/
│   │   │   ├── anthropic.js     # Provider Anthropic
│   │   │   ├── gemini.js        # Provider Gemini
│   │   │   ├── ollama.js        # Provider Ollama
│   │   │   ├── openai.js         # Provider OpenAI/DeepSeek/Mistral
│   │   │   ├── router.js         # Router multi-provider
│   │   │   └── llmUsageTracker.js # Tracciamento costi
│   │   ├── prompts.js           # System prompt e regole
│   │   ├── tools.js             # Definizione strumenti
│   │   ├── toolExecutor.js      # Esecuzione strumenti
│   │   ├── cache.js             # Cache risposte
│   │   ├── objectFieldBuilder.js # Builder Object Definition
│   │   ├── objectManager.js     # Gestione Object Definition
│   │   ├── pageIndex.js        # Indice pagine
│   │   └── utils.js             # Utility generiche
│   └── locales/
│       ├── it.js                # Traduzioni italiane
│       └── en.js                # Traduzioni inglesi
└── build/
    └── static/                  # Output webpack
```

---

## 📜 Licenza

Questo progetto è distribuito come client extension per Liferay DXP. Consultare i Termini d'uso (EULA) integrati nell'applicazione per le condizioni complete.

---

## 🤝 Contribuire

1. Fork del repository
2. Crea un branch feature (`git checkout -b feature/nome-feature`)
3. Commit delle modifiche (`git commit -m 'Aggiunta feature'`)
4. Push del branch (`git push origin feature/nome-feature`)
5. Apri una Pull Request

---

**Pathfinder AI** — *Il tuo portale Liferay, in una conversazione.*