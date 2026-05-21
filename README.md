# 🧭 Pathfinder AI

**The intelligent assistant for Liferay DXP — conversational, contextual, multimodal.**

Pathfinder AI turns your Liferay portal into a conversational powerhouse. Ask, create, search, modify — all through natural language. No forms, no panels, no friction. Just talk.

---

## ✨ What It Can Do

### 🔍 Search & Discover — Instantly
- **Find anything** across your entire portal: web content, documents, blog posts, pages — all indexed and searchable in natural language
- **Advanced filtering** by content structure, taxonomy category, vocabulary, tags — zero friction
- **Browse taxonomies** like you're having a conversation: *"Show me all categories under Organization"*, *"What vocabularies exist?"*
- **Deep content inspection** — retrieve full structured content by ID, explore DDM structure fields and their data types, understand relationships between content, categories, and vocabularies
- **Full-text search** powered by Liferay's Search API with filters, sorting, and pagination

### ✏️ Create & Modify — By Talking
- **Create structured content** with the right fields, the right types, the right values — Pathfinder knows your DDM structures inside out
- **Build pages** — content pages, widget pages, child pages, with master page templates — all from a chat message
- **Manage Liferay Spaces (CMS)** — list, create, update, and delete Spaces (Asset Libraries); connect Spaces to sites; assign and remove users from Spaces; manage Space-scoped Objects and content
- **Manage taxonomies** — create categories, vocabularies, tags; update them; organize your content architecture without touching the admin panel
- **Create custom Object Definitions** with fields of any type (text, integer, decimal, boolean, date, relationship) — just describe what you need; supports company-scoped, site-scoped, and Space-scoped (depot) Objects
- **Assign and remove roles** — regular roles, site roles, organization roles — Pathfinder knows which type requires which parameters
- **Manage users, sites, organizations, user groups** — full CRUD operations through Liferay Headless APIs
- **Multi-language content** — create and update content with localized titles, descriptions, and friendly URLs in multiple languages

### 🧠 Understands Your Portal — Deeply
- **Knows your DDM structures** — field names, data types, required fields, validation rules. No guessing, no mistakes
- **Understands relationships** between content, categories, vocabularies, and pages — it navigates your content model like a human expert
- **Bilingual by default** — responds in Italian and English, adapting to the user's language automatically
- **Context-aware** — remembers the conversation, references previous results, chains operations logically
- **Smart tool selection** — automatically picks the right Liferay API for the job, with the right parameters, every time

### 🛡️ Privacy & Security — Built In
- **Mandatory privacy consent screen** on first access — no chat until the user accepts
- **Full EULA** always accessible from the settings panel
- **Liferay credentials stay in the browser** — never transmitted to third parties
- **22 internal rules** that prevent the LLM from exposing technical details, workarounds, or sensitive information
- **No telemetry** — zero data sent to external servers

---

## 🤖 Supported LLM Providers

| Provider | Models | Notes |
|----------|--------|-------|
| **Anthropic** | Claude Sonnet 4, Claude 3.5 Sonnet, etc. | Default provider |
| **Google Gemini** | Gemini 2.5 Flash, Pro, etc. | Google AI API Key |
| **OpenAI** | GPT-4o, GPT-4o-mini, etc. | OpenAI-compatible API |
| **DeepSeek** | DeepSeek Chat, Reasoner | OpenAI-compatible API |
| **Mistral** | Mistral Large, Medium, Small | OpenAI-compatible API |
| **Ollama** | Any local model | Self-hosted, no API key needed |

Switch providers at any time from the settings ⚙ — the conversation continues without interruption.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Pathfinder AI                   │
│              (React SPA — Fullpage)              │
├──────────┬──────────┬──────────┬────────────────┤
│  Anthropic│  Gemini  │  OpenAI  │    Ollama      │
│  Claude   │  API     │ Compat.  │   (local)      │
├──────────┴──────────┴──────────┴────────────────┤
│                   LLM Router                      │
│         (dispatch, retry, fallback)              │
├──────────────────────────────────────────────────┤
│               Tool Executor                       │
│         30+ Liferay Headless tools               │
├──────────────────────────────────────────────────┤
│            Liferay DXP Headless APIs              │
│   Delivery · Admin User · Taxonomy · Search      │
└──────────────────────────────────────────────────┘
```

### Key Components

| File | Role |
|------|------|
| `ChatbotFullpage.jsx` | Main layout — sidebar, header, messages, input |
| `useAgentFP.js` | React hook — conversation orchestration, tool loop |
| `llm/router.js` | Dispatch to selected LLM provider |
| `llm/anthropic.js` | Anthropic Claude integration (streaming, tool use) |
| `llm/gemini.js` | Google Gemini integration (streaming, function calling) |
| `llm/openai.js` | OpenAI / DeepSeek / Mistral integration (streaming, tool use) |
| `llm/ollama.js` | Ollama local integration (streaming, tool use) |
| `toolExecutor.js` | Execution of 30+ Liferay Headless tools |
| `tools.js` | Tool definitions (Anthropic/Gemini/Ollama/OpenAI schemas) |
| `prompts.js` | System prompt with 22 behavioral rules |
| `config.js` | Configuration management (localStorage) |
| `i18n.js` | Internationalization IT/EN |
| `ConsentScreenFP.jsx` | Privacy consent screen (mandatory on first access) |
| `EulaModalFP.jsx` | Full terms of use |
| `ConfigPanelFP.jsx` | Settings panel (provider, models, colors) |
| `UsagePanelFP.jsx` | Cost and token usage dashboard |

---

## 🛠️ Liferay Tools

Pathfinder AI can execute **30+ operations** on your Liferay portal through Headless APIs:

| Category | Tools |
|----------|-------|
| **Content** | Search content, get by ID, search by structure, list DDM structures, get structure fields |
| **Documents** | Search documents in the repository |
| **Blog** | Search blog posts |
| **Pages** | Search pages, create pages, list master pages |
| **Taxonomies** | Categories, vocabularies, tags — create, update, search |
| **Users** | Current user, search users, assign/remove roles |
| **Sites** | Site details, create/update/delete sites |
| **Organizations** | Create, update, delete organizations |
| **User Groups** | Create, update, delete user groups |
| **Objects** | Create custom Object Definitions with typed fields; CRUD on Object entries (company, site, and Space-scoped) |
| **Spaces (CMS)** | List, create, update, delete Spaces; connect/disconnect Spaces to sites; assign/remove users from Spaces |
| **Advanced Search** | Search API with filters, sorting, pagination |

---

## 🚀 Installation

### Prerequisites
- Liferay DXP 2025.Q4.11+ (or Liferay Portal 7.4 U112+ / DXP 7.4 GA112+)
- Node.js 18+ for building

### Build

```bash
# From the Liferay workspace root
gradlew :client-extensions:ai-chatbot-fullpage:build
```

### Deploy

Copy the generated JAR from `build/libs/` to Liferay's `deploy/` folder, or use:

```bash
gradlew :client-extensions:ai-chatbot-fullpage:deploy
```

### Configuration

1. Add the **Pathfinder AI** widget to a portal page
2. Open settings ⚙ and configure:
   - **LLM Provider** (Anthropic, Gemini, OpenAI, DeepSeek, Mistral, Ollama)
   - **API Key** for the selected provider
   - **Model** (or use the default)
   - **Liferay URL** — your portal address (required)
   - **Site Group ID** — your Liferay site ID (required)
   - **Liferay credentials** — email and password of a user with appropriate permissions
3. On first access, the privacy consent screen will appear

---

## 🎨 Customization

### Theme Colors
From settings you can customize:
- **Primary color** — header, buttons, accents
- **Accent color** — hover, selections
- **User bubble color** — sent messages
- **Bot bubble color** — received messages

### Language
Pathfinder AI automatically detects the browser language and supports:
- 🇮🇹 Italian (default)
- 🇬🇧 English

### Chat History
Conversation history can be saved on Liferay (enable it in settings) to resume chats where you left off.

---

## 📊 Cost Monitoring

The **Usage** panel shows in real time:
- Tokens used (input/output) per session
- Estimated cost in USD per provider and model
- Call history with details

Updated pricing for all providers: Anthropic, Gemini, OpenAI, DeepSeek, Mistral.

---

## 🔒 Security & Privacy

- **Mandatory consent** — user must accept terms before using the chat
- **EULA accessible** — full terms always available from the settings panel
- **Local credentials** — Liferay email and password stay in the browser, transmitted only to the portal
- **Local API keys** — LLM provider keys are stored in localStorage
- **No telemetry** — zero data sent to third-party servers
- **LLM rules** — 22 internal rules preventing the AI from exposing technical details, workarounds, or sensitive information

---

## 📁 Project Structure

```
ai-chatbot-fullpage/
├── client-extension.yaml      # Liferay Custom Element configuration
├── package.json                # Node.js dependencies
├── webpack.config.js           # Build configuration
├── assets/
│   ├── chatbot-fullpage.css    # Main styles
│   ├── components/
│   │   ├── ChatbotFullpage.jsx # Root component
│   │   └── ui/
│   │       ├── ConfigPanelFP.jsx
│   │       ├── ConsentScreenFP.jsx
│   │       ├── EulaModalFP.jsx
│   │       ├── MessageBubbleFP.jsx
│   │       ├── ToolCallBubbleFP.jsx
│   │       └── UsagePanelFP.jsx
│   ├── hooks/
│   │   ├── useAgentFP.js       # Conversational agent hook
│   │   └── useChatHistory.js    # Chat history hook
│   ├── lib/
│   │   ├── config.js           # Configuration management
│   │   ├── i18n.js              # Internationalization
│   │   ├── liferay.js           # Liferay Headless utilities
│   │   ├── llm/
│   │   │   ├── anthropic.js     # Anthropic provider
│   │   │   ├── gemini.js       # Gemini provider
│   │   │   ├── ollama.js        # Ollama provider
│   │   │   ├── openai.js        # OpenAI/DeepSeek/Mistral provider
│   │   │   ├── router.js        # Multi-provider router
│   │   │   └── llmUsageTracker.js # Cost tracking
│   │   ├── prompts.js           # System prompt and rules
│   │   ├── tools.js             # Tool definitions
│   │   ├── toolExecutor.js      # Tool execution
│   │   ├── cache.js             # Response cache
│   │   ├── objectFieldBuilder.js # Object Definition builder
│   │   ├── objectManager.js     # Object Definition management
│   │   ├── pageIndex.js         # Page index
│   │   └── utils.js             # Generic utilities
│   └── locales/
│       ├── it.js                # Italian translations
│       └── en.js                # English translations
└── build/
    └── static/                  # Webpack output
```

---

## 📜 License

This project is distributed as a client extension for Liferay DXP. See the Terms of Use (EULA) integrated in the application for full conditions.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

**Pathfinder AI** — *Your Liferay portal, in a conversation.*