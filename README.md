# 🧭 Pathfinder AI

**The intelligent chat-based assistant for Liferay DXP — conversational, contextual, multimodal.**

Pathfinder AI turns your Liferay portal into a conversational powerhouse. Everything happens through a natural chat interface: create content, manage users, build pages, modify taxonomies, handle objects — just type what you need. No forms, no admin panels, no friction. It's like having a Liferay expert available 24/7 in a chat window.

<div align="center">
  <img src="./assets/img/Screenshot 2026-06-09 143245.png" alt="Pathfinder AI" width="600"/>
</div>

---

## ✨ What It Can Do

### ✏️ Create, Modify & Delete — Just by Talking
This is where Pathfinder AI truly shines. Every CRUD operation across your Liferay portal is available through a single chat message.

#### 📄 Structured Content
- **Create structured web content** with the right DDM fields, data types, and values — Pathfinder knows your content structures inside out
- **Update existing content** by describing the change; no form-hunting required
- **Delete content** safely, with confirmation built into the conversation flow
- **Multi-language support** — create and update content with localized titles, descriptions, and friendly URLs in multiple languages

#### 🗂️ Pages
- **Create pages** — content pages, widget pages, child pages, with master page templates — all from a single message
- **Search and browse pages** across your portal hierarchy

> ⚠️ **Liferay requires feature flag `LPS-178052`**

 — Page creation via Headless API returns `UnsupportedOperationException` unless you add this to `portal-ext.properties`:
> ```
> feature.flag.LPS-178052=true
> ```

#### 🧩 Page Fragments
- **Create Fragment Collections** — organize your Page Fragments into logical groups (e.g. "Ricerca", "Layout", "Components")
- **Create Page Fragments** — build reusable UI components with HTML, CSS, and JS directly from chat
- **Liferay-specific HTML** — use `<lfr-drop-zone>` for editable drop areas, `data-lfr-editable-id` and `data-lfr-editable-type` for inline-editable fields (rich-text, text, image, link)
- **Fragment types** — Section (type 0, with drop zones), Component (type 1, no drop zones), Input (type 2, form fields)
- **Configurable Fragments** — define custom configuration fields (colors, text, images) via JSON configuration
- **Read & Update** — inspect any Fragment's full HTML/CSS/JS source, then modify it in place
- **Delete** — remove individual Fragments or entire Collections (with confirmation)

#### 👥 Users, Organizations & Groups
- **Full user management** — create, update, deactivate, and delete users
- **Manage organizations** — create, update, and delete organizational structures
- **Manage user groups** — full CRUD through Liferay Headless APIs
- **Assign and remove roles** — regular roles, site roles, organization roles — Pathfinder picks the right parameters automatically

#### 🏗️ Sites & Spaces (CMS)
- **Create and manage sites** — full create/update/delete operations
- **Manage Liferay Spaces (Asset Libraries)** — create, update, and delete Spaces; connect/disconnect them to sites; assign and remove users with specific roles
- **Manage Space-scoped Objects and content** directly from the chat

#### � Documents & Files
- **Browse and select documents** from the Liferay Document Library directly in the chat
- **Attach local files** via drag & drop or file picker — the AI uses them as context and uploads to DML only when requested

#### �🔖 Taxonomies
- **Create vocabularies and categories** — build your entire taxonomy from a conversation
- **Update and reorganize** existing categories and tags
- **Delete taxonomies** cleanly, understanding relationships to existing content

#### 🧩 Custom Object Definitions
- **Create Object Definitions on the fly** — just describe what you need: field names, types (text, integer, decimal, boolean, date, relationship), scope (company, site, or Space)
- **Manage Object entries** — full CRUD on all Object instances, regardless of scope
- Pathfinder uses a dedicated `objectFieldBuilder` to handle complex field type combinations automatically

#### 🔎 SXP Blueprints & Elements (Search Experiences)
- **Full CRUD** on SXP Blueprints and Elements — create blueprints from scratch, update existing ones, delete, list, and inspect their full configuration
- **Advanced filtering** — combine DDM structure keys, asset category IDs, and custom Elasticsearch clauses (terms, range, match, exists, bool, nested) in a single blueprint to precisely target search results
- **Flexible boolean logic** — `filter` (AND, no scoring), `should` (OR, boosts relevance), `must` (AND + scoring), `must_not` (exclude) — compose complex queries that match real-world search requirements
- **Aggregations & highlighting** — configure facets (terms, range, date_histogram), field highlighting, and sort rules to build rich search experiences

#### 📊 Batch Creation from Excel
- **Drag & drop Excel files** (.xlsx, .xls, .csv) directly into the chat — data is automatically parsed and presented in tabular format
- **Generate Excel templates** — ask Pathfinder to create a blank template for structures, objects, vocabularies, pages, roles, or users, then fill it and upload
- **Sequential batch creation** — the AI processes each row one at a time, creating entities in the correct order (e.g. parent pages before child pages)
- **Progress tracking** — real-time progress messages during batch operations: ✅ per-type completion, 🎉 final summary with counts and errors
- **Error resilience** — individual row errors don't stop the batch; the AI continues and reports a final error count
- **Template sheets** — built-in templates in Italian and English for: Structures, Objects, Vocabularies, Pages, Roles, Users

---

### 🔍 Search & Discover — When You Need It
- **Find anything** across your entire portal: web content, documents, blog posts, pages — all in natural language
- **Advanced filtering** by content structure, taxonomy category, vocabulary, and tags
- **Browse taxonomies** conversationally: *"Show me all categories under Organization"*, *"What vocabularies exist?"*
- **Deep content inspection** — retrieve full structured content by ID, explore DDM structure fields and their data types
- **Full-text search** powered by Liferay's Search API with filters, sorting, and pagination
- **SXP Blueprints & Elements** — create, configure, and manage Search Experiences blueprints with advanced Elasticsearch filters: DDM structure keys, asset category IDs, and custom ES query clauses (terms, range, match, exists, bool, etc.)

---

### 🧠 Understands Your Portal — Deeply
- **Knows your DDM structures** — field names, data types, required fields, validation rules. No guessing, no mistakes
- **Understands relationships** between content, categories, vocabularies, and pages — navigates your content model like a human expert
- **Context-aware** — remembers the conversation, references previous results, chains operations logically (e.g. create a category, then immediately create content using it)
- **Smart tool selection** — automatically picks the right Liferay API for the job, with the right parameters, every time
- **Bilingual by default** — responds in Italian and English, adapting to the user's language automatically

### 🛡️ Privacy & Security — Built In
- **Mandatory privacy consent screen** on first access — no chat until the user accepts
- **Full EULA** always accessible from the settings panel
- **Liferay credentials stay in the browser** — never transmitted to third parties
- **14 behavioral rule blocks** injected at runtime into the system prompt — covering communication, data integrity, multi-step flows, entity handling, Excel file handling, Page Fragment management, and known API limitations
- **No telemetry** — zero data sent to external servers

---

### 👍👎 Feedback & Learning System
- **Thumbs up/down** on every AI response — users rate response quality directly in the chat
- **Auto-created Liferay Custom Object** (`ACPFeedback`) — the feedback object is created automatically when the feature is first enabled in settings
- **Smart deduplication** — similar questions are grouped into a single record with an incremental **score** (👍 = +1, 👎 = -1), avoiding duplicate entries
- **Tool call tracking** — every feedback record stores which Liferay tools were called to produce the answer
- **RAG from positive feedback** — when a user asks a question, the system fetches the highest-rated Q&A pairs from the Custom Object and injects them into the system prompt as privileged context, so the LLM learns from previously approved answers
- **Configurable** — the feedback feature can be enabled/disabled from the settings panel; when disabled, no feedback buttons appear and no RAG context is injected

---

### 📊 Content Analytics Dashboard
- **Content statistics** — view counts of web content, documents, blog entries, and pages
- **Author breakdown** — see who created what, with system-authored content labeled as "System"
- **Timeline charts** — content creation over time with selectable ranges (3m, 6m, 12m, 24m)
- **Site hierarchy** — browse pages by depth level with drill-down navigation and parent page info
- **Compact bar charts** — automatic compact mode when displaying few data points
- **i18n** — full Italian and English support for all analytics labels

---

## 🚧 Beta & Continuous Improvement

Some features of Pathfinder AI are currently in beta and are continuously evolving.  
We are actively improving stability, tool orchestration, multilingual understanding, and compatibility across different LLM providers and Liferay APIs.

Feedback and contributions are welcome to help shape future releases.

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
│         50+ Liferay Headless & JSON-WS tools      │
├──────────────────────────────────────────────────┤
│            Liferay DXP APIs                        │
│   Delivery · Admin User · Taxonomy · Search      │
│   Search Experiences (SXP) · Fragments · JSON-WS │
└──────────────────────────────────────────────────┘
```

### Key Components

| File | Role |
|------|------|
| `ChatbotFullpage.jsx` | Main layout — sidebar, header, messages, input |
| `DocumentPicker.jsx` | Document Library browser and picker |
| `useAgentFP.js` | React hook — conversation orchestration, tool loop |
| `llm/router.js` | Dispatch to selected LLM provider |
| `llm/anthropic.js` | Anthropic Claude integration (streaming, tool use) |
| `llm/gemini.js` | Google Gemini integration (streaming, function calling) |
| `llm/openai.js` | OpenAI / DeepSeek / Mistral integration (streaming, tool use) |
| `llm/ollama.js` | Ollama local integration (streaming, tool use) |
| `toolExecutor.js` | Execution of 30+ Liferay Headless tools |
| `tools.js` | Tool definitions (Anthropic/Gemini/Ollama/OpenAI schemas) |
| `excelTemplate.js` | Excel template generation and parsing for batch creation |
| `prompts.js` | System prompt with 22 behavioral rules + feedback RAG context |
| `config.js` | Configuration management (localStorage) |
| `feedbackTracker.js` | Feedback tracking, deduplication, Liferay sync, RAG fetch |
| `contentStats.js` | Content analytics data layer with DataCache |
| `i18n.js` | Internationalization IT/EN |
| `ConsentScreenFP.jsx` | Privacy consent screen (mandatory on first access) |
| `EulaModalFP.jsx` | Full terms of use |
| `ConfigPanelFP.jsx` | Settings panel (provider, models, colors) |
| `UsagePanelFP.jsx` | Cost and token usage dashboard |
| `ContentStatsPanelFP.jsx` | Content analytics dashboard |
| `MessageBubbleFP.jsx` | Chat message bubble with feedback buttons |

---

## 🛠️ Liferay Tools

Pathfinder AI can execute **50+ operations** on your Liferay portal through Headless APIs and JSON-WS:

| Category | CRUD Operations | Search / Read |
|----------|----------------|---------------|
| **Content** | Create, update, delete structured content | Search by keyword, structure, or ID; explore DDM fields |
| **Documents** | Upload, update, delete documents; attach and upload files via chat | Search and browse documents in the DML |
| **Blog** | Create, update, delete blog posts | Search blog entries |
| **Pages** | Create content pages, widget pages, child pages | Search pages; list master page templates |
| **Taxonomies** | Create/update/delete categories, vocabularies, tags | Browse by vocabulary or category |
| **Users** | Create, update, deactivate, delete users; assign/remove roles | Search users; get current user |
| **Sites** | Create, update, delete sites | Get site details |
| **Organizations** | Create, update, delete organizations | — |
| **User Groups** | Create, update, delete user groups | — |
| **Objects** | Create Object Definitions with typed fields; full CRUD on entries (company, site, Space-scoped) | — |
| **Spaces (CMS)** | Create, update, delete Spaces; connect/disconnect to sites; assign/remove users | List all Spaces |
| **Page Fragments** | Create/update/delete Fragment Collections and Fragment Entries; full HTML/CSS/JS editing with Liferay tags (`<lfr-drop-zone>`, `data-lfr-editable-*`) | List collections and fragments; get fragment details by ID |
| **SXP Blueprints** | Create, update, delete Search Experience blueprints with filters (structure, categories, custom ES clauses) | List, get blueprints; get structure keys |
| **SXP Elements** | Create, update, delete Search Experience filter elements | List, get elements |

---

## 🚀 Installation

### Prerequisites
- Liferay DXP 2025.Q4.11+
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

### Feedback & Learning
When enabled in settings, users can rate AI responses with 👍/👎. Positive feedback is stored in a Liferay Custom Object and used as RAG context for future similar questions, so the LLM learns from previously approved answers over time. The system automatically deduplicates similar questions and increments a score counter instead of creating duplicate records.

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
- **LLM rules** — 14 behavioral rule blocks injected at runtime, preventing the AI from exposing technical details, inventing data, or bypassing operational constraints
- **Feedback RAG** — positively rated Q&A pairs are injected into the system prompt so the LLM learns from approved answers

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
│   │       ├── DocumentPicker.jsx
│   │       ├── EulaModalFP.jsx
│   │       ├── MessageBubbleFP.jsx
│   │       ├── ToolCallBubbleFP.jsx
│   │       ├── UsagePanelFP.jsx
│   │       └── ContentStatsPanelFP.jsx
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
│   │   ├── contentStats.js     # Content analytics data layer
│   │   ├── feedbackTracker.js  # Feedback tracking & Liferay sync
│   │   ├── prompts.js           # System prompt, rules & feedback RAG
│   │   ├── tools.js             # Tool definitions
│   │   ├── toolExecutor.js      # Tool execution
│   │   ├── excelTemplate.js     # Excel template generation & parsing
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
