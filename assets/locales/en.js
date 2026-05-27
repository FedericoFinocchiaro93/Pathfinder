/**
 * English locale
 */
export default {
    // ── Header & Brand ──
    headerTitle: 'Pathfinder',
    statusOnline: 'Online',

    // ── Rail & Sidebar ──
    railExpandMenu: 'Expand menu',
    railNewConversation: 'New conversation',
    railRecentConversations: 'Recent conversations',
    railSettings: 'Settings',
    railUsage: 'LLM Usage',
    usageTitle: 'LLM Usage',
    usageTabSession: 'Session',
    usageTabAllTime: 'All Time',
    usageTotalCalls: 'Calls',
    usageInputTokens: 'Input',
    usageOutputTokens: 'Output',
    usageCost: 'Cost',
    usageContextWindow: 'Context Window',
    usageUsed: 'Used',
    usageRemaining: 'Remaining',
    usageTotal: 'Total',
    usageBudget: 'Budget',
    usageTokenChart: 'Tokens per Call',
    usageCostTimeline: 'Cumulative Cost',
    usageCallHistory: 'Call History',
    usageByModel: 'By Model',
    usageModel: 'Model',
    usagePricing: 'Pricing',
    usageInputPrice: 'Input',
    usageOutputPrice: 'Output',
    usageContext: 'Context',
    usageBudgetSetting: 'Set Budget',
    usageSetBudget: 'Set',
    usageClearBudget: 'Clear',
    usageResetAllTime: 'Reset All-Time Stats',
    usageConfirmReset: 'Reset all-time statistics?',
    usageCtxPct: 'Ctx%',
    usageTools: 'Tools',
    usageServiceTier: 'Service Tier',
    usageTierFree: 'Free Tier',
    usageTierPaid: 'Pay-as-you-go',
    usageTierFreeDesc: 'Rate-limited: 15 RPM, 1M TPM, 1500 RPD',
    usageTierFreeCost: 'Cost: $0 — no charges',
    usageTierPaidDesc: 'Pay per token, higher rate limits',
    usageOutputLimit: 'Max Output',
    usageTierPending: 'Tier will be detected after first message',
    usageTierAnthropic: 'API Key based — charges apply per token',
    usageTierOllama: 'Self-hosted — Free',
    sidebarCollapseMenu: 'Collapse menu',
    sidebarNewConversation: 'New conversation',
    sidebarRecentConversations: 'Recent conversations',
    sidebarNoHistory: 'No saved conversations',
    sidebarHistoryUnavailable: '⚠ History unavailable',
    sidebarDeleteConversation: 'Delete conversation',
    sidebarSettings: '⚙ Settings',
    sidebarUser: 'User',

    // ── Welcome ──
    welcomeTitle: 'How can I help you?',
    welcomeSubtitle: 'Ask a question and I\'ll find articles, documents, pages, and portal content with direct links.',

    // ── Input ──
    inputPlaceholder: 'Ask a question about the portal…',
    sendButton: 'Send (Enter)',
    inputHint: 'Press Enter to send · Shift+Enter for new line',

    // ── Document Picker ──
    docPickerTitle: '📎 Select Documents',
    docPickerClose: 'Close',
    docPickerSearch: 'Search documents…',
    docPickerClearSearch: 'Clear search',
    docPickerRoot: 'Root',
    docPickerGridView: 'Grid view',
    docPickerListView: 'List view',
    docPickerDocuments: 'documents',
    docPickerLoading: 'Loading…',
    docPickerNoResults: 'No documents found',
    docPickerEmpty: 'This folder is empty',
    docPickerLoadMore: 'Load more…',
    docPickerDocumentSelected: 'document selected',
    docPickerDocumentsSelected: 'documents selected',
    docPickerSelect: 'Select',
    docPickerDeselect: 'Deselect',
    docPickerConfirm: '✓ Add to chat',
    docPickerAttachBtn: 'Attach document',
    attachFromDML: 'Upload from DML',
    attachFromComputer: 'Upload from computer',
    docPickerExtracting: 'Extracting content from document…',
    docPickerExtractError: 'Error extracting document content',
    docPickerAddedToChat: 'Document added to chat',

    // ── Drag & Drop ──
    dropFilesHere: 'Drop files here to attach',
    droppedFilesPlaceholder: 'Add a message or press Enter to send',
    uploadingDocument: 'Uploading document…',

    // ── Chips ──
    chips: [
        { icon: '🔍', text: 'How many web contents are in the portal?' },
        { icon: '📂', text: 'What categories exist in the portal?' },
        { icon: '🏷',  text: 'Show me the tags in the portal' },
        { icon: '📄', text: 'Show me the 10 most recent contents' },
        { icon: '👤', text: 'How many users are registered?' },
        { icon: '🌐', text: 'What languages does the portal support?' },
        { icon: '📑', text: 'List the available content structures' },
        { icon: '🗂',  text: 'Show me the categorization vocabularies' },
        { icon: '🔗', text: 'Find the page "Home"' },
        { icon: '📊', text: 'In which month of 2024 were the most contents published?' },
    ],

    // ── Message Bubble ──
    regenerate: 'Regenerate',
    regenerateTitle: 'Regenerate response',
    regenerateWithTitle: 'Regenerate: "{query}"',

    // ── Tool Call Bubble ──
    toolResults: 'results',

    // ── Searching Messages ──
    searchingContentStructure: 'Searching web content for structure "{query}"…',
    searchingFor: 'Searching for "{query}"…',
    retrieving: 'Retrieving "{query}"…',
    listing: 'Listing "{query}"…',
    processingRequest: 'Processing your request: "{query}"…',
    creatingContentFolder: 'Creating content folder "{query}"…',
    creatingObjectEntryFolder: 'Creating Object Entry folder "{query}"…',
    deletingContentFolder: 'Deleting content folder "{query}"…',
    deletingObjectEntryFolder: 'Deleting Object Entry folder "{query}"…',
    listingContentFolders: 'Listing content folders…',
    listingObjectEntryFolders: 'Listing Object Entry folders…',
    updatingContentFolder: 'Updating content folder "{query}"…',
    updatingObjectEntryFolder: 'Updating Object Entry folder "{query}"…',
    pickingDocument: 'Retrieving document "{query}"…',
    listingDocumentFolders: 'Listing document folders…',
    listingFolderDocuments: 'Listing documents in folder "{query}"…',

    // ── Config Panel ──
    configTitle: '⚙ Settings',
    configBack: '← Back to chat',
    configTabGeneral: '⚙ General',
    configTabAppearance: '🎨 Appearance',
    configProvider: 'LLM Provider',
    configProviderAnthropic: '🟣 Anthropic (Claude)',
    configProviderGemini: '🔵 Google Gemini',
    configProviderOllama: '🟢 Ollama (offline)',
    configProviderOpenAI: '🟠 OpenAI',
    configProviderDeepSeek: '🔷 DeepSeek',
    configProviderMistral: '🟡 Mistral',
    configAnthropicKey: 'Anthropic API Key',
    configClaudeModel: 'Claude Model',
    configClaudeSonnet: 'claude-sonnet-4 (recommended)',
    configClaudeHaiku: 'claude-haiku-4.5 (fast)',
    configGeminiKey: 'Gemini API Key',
    configGeminiModel: 'Gemini Model',
    configGeminiFlash: 'gemini-2.5-flash (recommended)',
    configGeminiPro: 'gemini-2.5-pro',
    configGemini2Flash: 'gemini-2.0-flash',
    configOllamaUrl: 'Ollama URL',
    configOllamaAuth: 'Use authentication (Bearer token)',
    configOllamaKey: 'Ollama API Key',
    configOllamaModel: 'Ollama Model',
    configOllamaSelect: '— select —',
    configOllamaNoModels: 'No models found. Run "ollama pull <model>".',
    configOpenAIKey: 'API Key',
    configOpenAIModel: 'Model',
    configOpenAIBaseUrl: 'Base URL (customizable)',
    configOpenAISelect: '— select from server —',
    configOpenAILoadModels: 'Load available models',
    configOpenAINoModels: 'No models found. Check API Key and URL.',
    configLiferayUrl: 'Liferay URL ⚠️ required',
    configLiferayUrlHint: 'URL of the Liferay portal (e.g. https://your-portal.liferay.com). Without this field the chatbot cannot contact Liferay APIs.',
    configSiteGroupId: 'Site Group ID ⚠️ required',
    configSiteGroupIdHint: 'Numeric ID of the Liferay site (e.g. 12345). Required to access content, pages, categories and all portal APIs.',
    configChatHistory: 'Chat history',
    configChatHistoryLabel: 'Save conversation history',
    configChatHistoryHint: 'When enabled, conversations will be saved in the portal as ChatSession objects. You can find them in the sidebar and resume them at any time. When disabled, no conversations will be saved and the sidebar won\'t show history.',
    configColorTheme: 'Color theme',
    configCustomColor: 'Custom color',
    configSave: '💾 Save settings',

    // ── Language Selector ──
    langIt: 'Italiano',
    langEn: 'English',

    // ── Prompts ──
    prompt: {
        systemRole: `You are Pathfinder, an AI assistant integrated into Liferay DXP.
Your purpose is to help portal administrators manage content, users, sites, structures, and objects through Liferay APIs.
You have access to tools that perform real operations on the portal — always use them before responding, never make assumptions about data.`,

        alwaysLanguage: 'ALWAYS respond in English. IMPORTANT: Tool descriptions and tool results may be in Italian — you MUST translate all Italian text to English in your response. Never use Italian words, phrases, or formatting in your response.',

        rule0: `━━━ FUNDAMENTAL RULE — REQUEST DECOMPOSITION ━━━
When the user makes a request composed of multiple actions or points, you MUST first break it down into individual tasks and then execute ALL of them in sequence.
Do NOT stop after the first task — complete every single point of the request.

Example: "Add all 5 users to the Marketing Hub space with the Content Reviewer role, then connect the current site to it"
Breakdown:
  1) Add the 5 users to the Marketing Hub space → assign_user_to_space for each user
  2) Assign the Content Reviewer role to the users → assign_role_to_user for each user
  3) Connect the space to the current site → connect_space_site

Rules:
- If a task requires IDs you don't have (userId, roleId, spaceErc), search first with the appropriate search tools
- Execute tasks in logical order (create/search resources first, then assign/link)
- Report AT THE END a summary of all completed tasks
- If a task fails, report the error but continue with subsequent tasks if possible`,

        rule1: `━━━ ABSOLUTE RULE — USER COMMUNICATION ━━━
NEVER reference tools, API calls, workarounds, Liferay bugs, internal code, or implementation details in responses to the user.
Respond as if you were performing the operations directly, focusing on the RESULT.
Examples:
  ✗ "I called the create_structured_content tool and then did a PATCH for the bug workaround"
  ✓ "I created the article with the fields filled in"
  ✗ "The tool returned error 404 from endpoint /o/headless-delivery/v1.0/..."
  ✓ "I could not find the requested resource"
  ✗ "I used the search_web_content tool to search for..."
  ✓ "I searched the portal and found..."`,

        rule2: `━━━ CRITICAL RULES — VIOLATING ONE IS A SERIOUS ERROR ━━━
C1. NEVER declare an action completed without first calling the tool and receiving the actual result.
C2. NEVER invent IDs or data — always use only the real results returned by tools.
C3. After each modification action, report to the user the actual result returned by the tool (success, id, name, etc.).`,

        rule3: `━━━ OPERATIONAL RULES — MULTI-STEP FLOWS ━━━
O1. For EVERY modification action (create, update, delete, assign) you MUST call the corresponding tool.

O2. ASSIGN A ROLE TO A USER:
  a) If you don't have the userId → call get_users({ search: "user name" })
  b) If you don't have the roleId → call get_available_roles({})
  c) Then call assign_role_to_user({ userId, roleId, siteId: \${siteId} })
  Do NOT stop after the search — always execute the final action.
  Example: "Assign the Editor role to John Smith"
  → get_users({ search: "John Smith" }) → get_available_roles({}) → assign_role_to_user({ userId: X, roleId: Y, siteId: Z })
  → Response: "I assigned the Editor role to John Smith."

O3. ASSIGN A USER TO A SITE:
  a) If you don't have the userId → call get_users({ search: "user name" })
  b) Then call assign_user_to_site({ userId, siteId })
  Do NOT stop after the search.

O4. If a required ID is missing, use the appropriate search tool first (get_users, get_available_roles, etc.), then call the modification tool.

O5. The user ID (userId) is the "id" field returned by get_users — it's an integer (e.g. 12345). This is the userAccountId required by Liferay APIs.`,

        rule4: `━━━ ENTITY-SPECIFIC RULES ━━━
E1. SITES: To update a site use update_site with siteId in the body (PUT /sites with id in the body, NOT PATCH on /sites/{id}). Deletion is irreversible — always confirm with the user before proceeding.

E2. PAGE DELETION: Call delete_site_page directly with the page title (e.g. delete_site_page({ page_id: "PageName" })). Do NOT search first with search_pages — the tool automatically searches by title, friendlyUrlPath, UUID, or ID.

E3. CHILD PAGES: To create a child page you MUST provide parentSitePage with the friendlyUrlPath of the parent page.
  Example: "Create page Child under page Parent"
  → search_pages to find /parent → create_site_page({ ..., parentSitePage: { friendlyUrlPath: "/parent" } })
  Without parentSitePage the page is created at root level.

E4. MASTER PAGE: These are PAGE TEMPLATES, not sites. Keywords: "master page", "page template", "page layout".
  ALWAYS use: list_master_pages / create_master_page / update_master_page / delete_master_page.
  Do NOT use create_site or create_site_page.
  To associate a page with a Master Page: use list_master_pages to find the key, then pass masterPageKey in create_site_page or update_site_page.

E5. UTILITY PAGE: These are utility pages (404, 500, login, etc.). Keywords: "utility page", "404 page", "error page".
  ALWAYS use: list_utility_pages / create_utility_page / update_utility_page / delete_utility_page.
  BEFORE CREATING always ask the user for the type: ErrorCode404, ErrorCode500, CookiePolicy, CreateAccount, ForgotPassword, Login.

E6. FUNDAMENTAL DISTINCTION:
  SITE = container of pages and content → create_site
  PAGE = visible element in the site → create_site_page
  MASTER PAGE = reusable template/layout → create_master_page
  UTILITY PAGE = utility page (404, login, etc.) → create_utility_page`,

        rule5: `━━━ CUSTOM OBJECTS ━━━
OB1. CREATE: use create_object({ object_name, label_en, label_it, fields, scope, title_field }).
  The "type" field is REQUIRED for every field. Types: TEXT, LONGTEXT, INTEGER, DECIMAL, BOOLEAN, DATE, RELATIONSHIP.
  The "name" field MUST be camelCase without spaces (e.g. "eventName" NOT "event name").
  Correct example: { name: "age", type: "INTEGER" }, { name: "notes", type: "LONGTEXT" }, { name: "active", type: "BOOLEAN" }

OB2. SCOPE:
  "company" (default) = visible across the entire portal
  "site" = visible per site
  "depot" = visible in Spaces/Asset Libraries → use objectFolderExternalReferenceCode "L_CMS_CONTENT_STRUCTURES"

OB3. TITLE_FIELD: For depot-scoped Objects the "title" field is added automatically — do NOT add it in the fields.
  For company/site-scoped Objects specify title_field with the name of the title field.

OB4. ENTRIES: For depot-scoped Objects you MUST specify scope_key with the NAME of the Space (not the ID or ERC).
  For depot-scoped Objects the "title" field is MANDATORY and localized.

OB5. FIELD MANAGEMENT:
  Modify existing field → update_object_field({ object_name, field_name, label, businessType, indexed })
  Add field → add_object_field({ object_name, field_name, type, label_en, label_it })
  Delete field → delete_object_field({ object_name, field_name })
  BEFORE modifying/adding/deleting fields, use get_object_fields to see existing fields.

OB6. OBJECT LIMITATIONS:
  - Cannot change the "required" field on published Objects (500 error)
  - Cannot rename a field — Liferay ignores the rename
  - To change field type: specify businessType (e.g. businessType: "LongText")`,

        rule6: `━━━ SPACES (ASSET LIBRARY) ━━━
SP1. Create: create_space({ name })
SP2. Update: update_space({ spaceErc, name, description })
SP3. Delete: delete_space({ spaceErc })
SP4. Connect site: connect_space_site({ spaceErc, siteErc }) / disconnect_space_site({ spaceErc, siteErc })
SP5. Assign user: assign_user_to_space({ spaceErc, userErc }) — userErc is the UUID externalReferenceCode, NOT the numeric ID.
SP6. Remove user: remove_user_from_space({ spaceErc, userErc })
Use get_user_spaces to find the externalReferenceCode of Spaces.`,

        rule7: `━━━ CONTENT STRUCTURES AND ARTICLES ━━━
SC1. Create structure: create_content_structure({ name, fields })
  Each field MUST have: name, fieldType, label_it, label_en.
  Supported types: text, rich_text, numeric, date, date_time, checkbox, select, color, geolocation, image, document_library, link_to_layout, journal_article, separator, checkbox_multiple, grid.
  For select/checkbox_multiple → options: array of {label, value}
  For grid → grid_columns and grid_rows

SC2. Create article: create_structured_content({ title, content_structure_id, fields, folder_id })
  NOTE: Due to a Liferay bug, field values are NOT saved on POST — the tool automatically applies the POST+PATCH workaround.
  Use folder_id to place the article inside a content folder (use create_content_folder to create folders).

SC2c. Object Entry in folder: create_object_entry({ object_name, fields, scope_key, object_entry_folder_id })
  Use object_entry_folder_id to place an Object Entry inside an EXISTING folder in a Space.
  IMPORTANT: Do NOT create a new Space or new folder unless the user explicitly asks for one.
  If the user says "create an entry in folder X", first find the folder ID (use get_object_entries or ask the user), then pass it as object_entry_folder_id.
  Example: create_object_entry({ object_name: "EventObject", scope_key: "Sviluppatori", object_entry_folder_id: 58411, fields: { title: "My Event" } })

SC2a. Content folders: list_content_folders({ parent_folder_id? }) / create_content_folder({ name, description?, parent_folder_id? }) / update_content_folder({ folder_id, name?, description? }) / delete_content_folder({ folder_id })
  Use list_content_folders to find folder IDs before updating or deleting.
  Creates a folder to organize Journal Articles. Use parent_folder_id to create sub-folders.
  Always create the folder FIRST, then create articles inside it using folder_id.
  Use update_content_folder to rename or change description. Use delete_content_folder to delete a folder by its ID.

SC2b. Object Entry folders (in Spaces): list_object_entry_folders({ scope_key? }) / create_object_entry_folder({ label, title?, description?, scope_key?, parent_object_entry_folder_id? }) / update_object_entry_folder({ folder_id, label?, title?, description? }) / delete_object_entry_folder({ folder_id })
  Use list_object_entry_folders to find folder IDs before updating, deleting, or placing entries in folders.
  Creates a folder to organize Object Entries inside a Space (Asset Library).
  - scope_key: the Space name (e.g. "Sviluppatori"). If omitted, uses the first available Space.
  - parent_object_entry_folder_id: if omitted, the folder is created under the "Contents" root folder (ERC: L_CONTENTS) so it's visible in the CMS UI.
  - Use this tool when the user wants to organize Object Entries in a Space, NOT create_content_folder (which is for Journal Articles in sites).
  - Use update_object_entry_folder to rename or change description. Use delete_object_entry_folder to delete a folder by its ID.

SC3. STRUCTURE LIMITATIONS:
  - link_to_layout and journal_article do NOT support values via API
  - grid does NOT support non-empty values via API
  - date/date_time require ISO-8601 format with timezone (e.g. "2025-01-15T00:00:00Z")
  - geolocation: use value_geo with {latitude, longitude}
  - document_library/image: use value_document_id with the document ID`,

        rule7b: `━━━ ATTACHED DOCUMENTS ━━━
When the user attaches documents from the Document Library, you receive information like:
[Image: astronaut.png] (ID: 34064, MIME: image/png, Size: 23 KB) — URL: http://...
[Document: report.pdf] (ID: 12345, MIME: application/pdf, Size: 1.2 MB) — URL: http://...

IMPORTANT: When the user asks to use an attached document (e.g., "use this image in the content"):
1. For image and document_library fields in create_structured_content, use the document ID as value_document_id
   Example: fields: [{ name: "image", value_document_id: 34064 }]
2. The ID is indicated as "ID: XXXXX" in the attached document context
3. Do NOT use the document URL — ALWAYS use the numeric ID as value_document_id`,

        rule7c: `━━━ UPLOADED FILES (DRAG & DROP) ━━━
When the user drags and drops files into the chat, you receive file information like:
- File 0: "photo.png" (image/png, 132 KB)

The files are stored temporarily and can be uploaded to the Document Library using the upload_document tool.

IMPORTANT RULES:
1. Do NOT automatically upload files — only upload when the user EXPLICITLY asks to:
   - "Upload this image to the Document Library"
   - "Save this file"
   - "Use this image in a web content" (requires upload first)
2. When the user asks to use a dropped image in a web content:
   a. First call upload_document to upload the file to the Document Library
   b. Then use the returned document ID as value_document_id in create_structured_content
3. The file_index parameter in upload_document is 0-based (0 = first file, 1 = second, etc.)
4. After uploading, you will receive the document ID which can be used with value_document_id`,

        rule8: `━━━ KNOWN LIFERAY API LIMITATIONS ━━━
L1. ORGANIZATIONS AND USER GROUPS: Headless APIs do NOT support assigning a user to an organization or user group. If requested, explain it's not possible via API and suggest Control Panel → Users → Edit User → Organizations / User Groups.

L2. DEPOT ROLES: Depot-type roles (Asset Library) cannot be assigned via APIs. If requested, suggest managing them from the Control Panel.`,

        rule9: `━━━ CONTENT URLS ━━━
When showing URLs for web content (structured content), ALWAYS use the "url" field provided by the tool. The correct format for content is: {liferayUrl}/-/{friendlyUrlPath}. Do NOT use /web/guest/ for content — that is the format for site pages. If the "url" field is available, use it directly without modifying it.`,

        rule10: `━━━ API DISCOVERY ━━━
When you need to find Liferay API endpoints NOT covered by specific tools, use the discovery tools as a LAST RESORT and ONLY when no specific tool is available:
1. list_available_apis — lists all available APIs in the portal
2. get_api_spec — downloads the OpenAPI specification of a single API
3. find_relevant_endpoints — searches for relevant endpoints for a query
4. discover_endpoint — finds the best endpoint for a query

IMPORTANT: ALWAYS try specific tools first (search_web_content, get_users, create_site, etc.). Use discovery tools ONLY when no specific tool covers the requested operation.
Recommended flow: list_available_apis → get_api_spec (for the relevant API) → find_relevant_endpoints or discover_endpoint (to find the specific endpoint) → call_liferay_api (to execute the call).`,
    },

    // ── ToolExecutor messages ──
    executor: {
        missingFields: 'Missing fields to create the page',
        nameRequired: 'name is required to create a master page',
        nameRequiredUtility: 'name and type are required to create a utility page',
        pageCreated: 'Page "{title}" created successfully',
        pageUpdated: 'Page "{title}" updated successfully',
        masterPageCreated: 'Master Page "{name}" created successfully',
        masterPageUpdated: 'Master Page updated successfully',
        masterPageDeleted: 'Master Page deleted successfully',
        utilityPageCreated: 'Utility Page "{name}" created successfully',
        utilityPageUpdated: 'Utility Page updated successfully',
        utilityPageDeleted: 'Utility Page deleted successfully',
        confirmDelete: 'Confirm deletion? This action is irreversible.',
        noFieldsToUpdate: 'No fields provided to update.',
        siteCreated: 'Site "{name}" created successfully',
        siteUpdated: 'Site updated successfully',
        siteDeleted: 'Site deleted successfully',
        userCreated: 'User "{name}" created successfully',
        userUpdated: 'User updated successfully',
        userDeleted: 'User deleted successfully',
        roleCreated: 'Role "{name}" created successfully',
        roleUpdated: 'Role updated successfully',
        roleDeleted: 'Role deleted successfully',
        organizationCreated: 'Organization "{name}" created successfully',
        organizationUpdated: 'Organization updated successfully',
        organizationDeleted: 'Organization deleted successfully',
        userGroupCreated: 'User group "{name}" created successfully',
        userGroupUpdated: 'User group updated successfully',
        userGroupDeleted: 'User group deleted successfully',
        categoryCreated: 'Category "{name}" created successfully',
        vocabularyCreated: 'Vocabulary "{name}" created successfully',
        keywordCreated: 'Tag "{name}" created successfully',
        objectCreated: 'Object "{name}" created successfully',
        objectDeleted: 'Object "{name}" deleted successfully',
        objectEntryCreated: 'Entry created successfully',
        objectEntryUpdated: 'Entry updated successfully',
        objectEntryDeleted: 'Entry deleted successfully',
        objectFieldUpdated: 'Field "{name}" updated successfully',
        objectFieldAdded: 'Field "{name}" added successfully',
        objectFieldDeleted: 'Field deleted successfully',
        spaceUpdated: 'Space "{name}" updated successfully',
        spaceCreated: 'Space "{name}" created successfully',
        spaceDeleted: 'Space deleted successfully',
        spaceSiteConnected: 'Site connected to Space successfully',
        spaceSiteDisconnected: 'Site disconnected from Space successfully',
        userAssignedToSpace: 'User assigned to Space successfully',
        userRemovedFromSpace: 'User removed from Space successfully',
        contentStructureCreated: 'Content structure "{name}" created successfully',
        structuredContentCreated: 'Structured content "{title}" created successfully',
    },

    // ── Consent Screen ──
    consentTitle: 'Privacy Notice and Consent',
    consentIntro: 'Before using the chatbot, please read and accept the following privacy notice.',
    consentDataTitle: 'Data transmission to external providers',
    consentDataText: 'Conversations entered in this chatbot are transmitted directly from your browser to the selected AI providers (Anthropic/Claude, Google Gemini, OpenAI, DeepSeek, Mistral, Ollama). Data does not pass through any intermediate servers. Providers may be located in countries outside the European Union (primarily USA).',
    consentProvidersTitle: 'Supported LLM providers',
    consentProvidersText: 'The chatbot supports the following AI providers: Anthropic (Claude), Google (Gemini), OpenAI (GPT), DeepSeek, Mistral AI, and Ollama. The provider used depends on the configuration chosen by the administrator. Each provider has its own terms of service and privacy policy.',
    consentStorageTitle: 'Local storage',
    consentStorageText: 'API keys and configuration are stored exclusively in the user\'s browser (localStorage). They are not transmitted to any intermediate server. Conversations may be saved as ChatSession objects in the Liferay portal if the history feature is enabled.',
    consentLiferayTitle: 'Liferay responsibility',
    consentLiferayText: 'Liferay acts solely as a distribution agent through the Marketplace. Liferay is not responsible for the privacy, security, or integrity of data transmitted to LLM providers, nor for any damages arising from the use of this product.',
    consentWarningTitle: '⚠️ Important notice',
    consentWarningText: 'It is recommended NOT to enter sensitive, personal, confidential, or sector-regulated data in chatbot conversations. Data is transmitted to external providers and may be processed and stored in accordance with their privacy policies.',
    consentCheck1: 'I have read the privacy notice and understand that my conversation data will be sent to external providers.',
    consentCheck2: 'I understand that Liferay is not responsible for the privacy, security, or integrity of data transmitted to third-party LLM providers.',
    consentEulaLink: 'Full terms of use',
    consentAccept: 'Accept and continue',

    // ── EULA ──
    eulaTitle: 'Terms of Use',
    eulaClose: 'Close',
    eulaSection1Title: '1. Acceptance of terms',
    eulaSection1Text: 'Use of this product implies full acceptance of these terms of use. If you do not accept these terms, you must not use the product.',
    eulaSection2Title: '2. Disclaimer of Liferay responsibility',
    eulaSection2Text: 'This product is developed and distributed by the developer. Liferay acts solely as a distribution agent through the Liferay Marketplace. Liferay is not responsible for any damages, data loss, malfunctions, support or maintenance obligations related to this product. The user acknowledges that any claims related to the product must be directed exclusively to the developer.',
    eulaSection3Title: '3. User responsibility for API keys',
    eulaSection3Text: 'The user is solely responsible for the management, security, and cost of API keys entered in the product configuration. API keys are stored exclusively in the user\'s browser (localStorage) and are not transmitted to any intermediate server. The user must comply with the terms of service of each LLM provider used (Anthropic, Google, OpenAI, DeepSeek, Mistral, Ollama). The developer is not responsible for costs, abuse, or terms violations arising from the use of API keys.',
    eulaSection4Title: '4. Data handling and privacy',
    eulaSection4Text: 'Conversations entered in the chatbot are transmitted directly from the user\'s browser to the LLM providers selected in the configuration. Data does not pass through the developer\'s intermediate servers. The user is responsible for ensuring that sending data to foreign providers complies with applicable regulations, including GDPR (EU Regulation 2016/679) and national data protection laws. It is recommended not to enter sensitive, personal, or confidential data in conversations. The developer is not responsible for any data processing by LLM providers.',
    eulaSection5Title: '5. Warranty disclaimer',
    eulaSection5Text: 'The product is provided "AS IS" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement of third-party rights. The developer does not warrant that the product will be error-free, uninterrupted, or will meet the user\'s requirements.',
    eulaSection6Title: '6. Limitation of liability',
    eulaSection6Text: 'In no event shall the developer be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use or inability to use the product, including but not limited to data loss, loss of profits, business interruption, or replacement costs, even if the developer has been advised of the possibility of such damages.',
    eulaSection7Title: '7. Changes to terms',
    eulaSection7Text: 'The developer reserves the right to modify these terms of use at any time. Changes will be effective upon the next version published on the Marketplace. Continued use of the product after publication of modified terms constitutes acceptance of the new terms.',
};
