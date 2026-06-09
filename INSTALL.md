# Pathfinder AI — Installation and Uninstallation Guide

## Installation

### Prerequisites

- **Liferay DXP 7.4+** (Jakarta edition) or **Liferay Portal 7.4+**
- A Liferay workspace with Gradle build system
- Node.js 18+ and npm 9+ installed
- An AI provider API key (at least one of the following):
  - Anthropic (Claude) API key
  - Google (Gemini) API key
  - OpenAI (GPT) API key
  - DeepSeek API key
  - Mistral AI API key
  - Ollama running locally (no API key needed)

### Step 1: Build the Client Extension

From your Liferay workspace root:

```bash
./gradlew :client-extensions:ai-chatbot-fullpage:build
```

This compiles the React frontend and packages everything into a deployable `.jar` file.

### Step 2: Deploy to Liferay

Copy the generated `.jar` file to your Liferay `deploy/` folder:

```bash
cp build/docker/client-extensions/ai-chatbot-fullpage.jar <LIFERAY_HOME>/deploy/
```

Or use the deploy task:

```bash
./gradlew :client-extensions:ai-chatbot-fullpage:deploy
```

### Step 3: Configure the Chatbot

1. Log in to Liferay as an Administrator
2. Go to **Control Panel → Applications → Pathfinder AI** (or **AI Chatbot Fullpage**)
4. Configure the following settings:
   - **AI Provider**: Choose your provider (anthropic, gemini, openai, deepseek, mistral, ollama)
   - **API Key**: Enter your provider's API key
   - **Model**: Select the model (e.g., `claude-sonnet-4-20250514`, `gemini-2.0-flash`, `gpt-4o`)
   - **Site Group ID**: Enter your site's Group ID (find it in Control Panel → Sites)
   - **Liferay URL**: Your portal URL (e.g., `http://localhost:8080`)

### Step 4: Accept the EULA

When users first open the chatbot, they will see a consent screen with the privacy notice and EULA. They must accept it before using the chatbot.

The chatbot is now available in the **Applications** section of the Control Panel and can be accessed from any page where it has been configured.

---

## Uninstallation

### Step 1: Undeploy the Client Extension

Remove the `.jar` file from your Liferay `deploy/` folder, or run:

```bash
./gradlew :client-extensions:ai-chatbot-fullpage:clean
```

### Step 2: Remove Configuration

1. Go to **Control Panel → Applications → Pathfinder AI** (or **AI Chatbot Fullpage**)
2. Click the **⋮** menu → **Delete**

### Step 3: Clear Browser Data

The chatbot stores API keys and preferences in the browser's `localStorage`. To fully remove all traces:

1. Open the browser's Developer Tools (F12)
2. Go to **Application → Local Storage**
3. Find and delete all keys starting with `pathfinder_` or `ai_chatbot_`

---

## Troubleshooting

### The chatbot doesn't appear on the page
- Make sure the client extension is deployed correctly (check Liferay logs for errors)
- Verify the widget is added to the page and published
- Clear the browser cache and reload

### "Site Group ID non configurato" error
- Open the chatbot settings (⚙ icon)
- Enter the correct Site Group ID (find it in Control Panel → Sites)
- Save the configuration

### API key errors
- Verify your API key is valid and has sufficient credits
- Check that the correct provider is selected in settings
- For Ollama, make sure it's running locally on the default port (11434)

### 401 Unauthorized errors
- The Liferay session may have expired — refresh the page
- Check that the Liferay URL in settings is correct and accessible

---

## Support

For questions, bug reports, or feature requests:

- **Email:** federicofinocchiaro1993@gmail.com
- **GitHub Issues:** Open an issue on the project repository