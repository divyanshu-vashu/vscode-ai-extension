Below is a proof‐of‐concept (PoC) that lays out a modular VS Code extension architecture using an OpenAI–compatible module. This example shows how to build a chat-based extension that can later be switched between different LLM providers (for example, Gemini or Ollama). The PoC is split into multiple files so that each file remains small and focused.

Below is an outline of the directory structure and key files:

```plaintext
your-chatbot-extension/
├── core/
│   └── openaiProvider.ts        # Wraps the OpenAI–compatible API for chat (and later, embeddings)
├── gui/
│   └── ChatWebviewProvider.ts   # Implements the VS Code webview for chat interactions
└── src/
    └── extension.ts             # Entry point that activates the extension and registers commands
```

---

### 1. Extension Entry Point (src/extension.ts)

This file activates the extension, registers commands, and sets up the webview panel.

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { ChatWebviewProvider } from '../gui/ChatWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
  // Create and register the Chat Webview
  const provider = new ChatWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("chatView", provider)
  );

  // Command to reveal the chat panel (for example, via a command palette or shortcut)
  context.subscriptions.push(
    vscode.commands.registerCommand('chat.open', () => {
      vscode.commands.executeCommand('workbench.view.extension.chatView');
    })
  );
}

export function deactivate() {}
```

---

### 2. Webview Provider (gui/ChatWebviewProvider.ts)

This file implements a webview-based UI for interacting with the chatbot. It includes a simple HTML interface with a text area and send button. When the user sends a message, it calls the AI provider to get a response.

```typescript
// gui/ChatWebviewProvider.ts
import * as vscode from 'vscode';
import { AIProvider } from '../core/openaiProvider';

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  // Instantiate the AI provider with a Gemini-compatible endpoint.
  // In the future you can swap this with another provider (e.g. Ollama) simply by replacing this instance.
  private aiProvider: AIProvider;

  constructor(private readonly extensionUri: vscode.Uri) {
    // Use your real API key and endpoint here (or better, load them from configuration)
    this.aiProvider = new AIProvider("GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/");
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.setMessageListener(webviewView.webview);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Basic HTML interface; you can later enhance this with frameworks (e.g., React)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chat Assistant</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 10px; }
    #chat-container { display: flex; flex-direction: column; height: 100vh; }
    #chat-output { flex: 1; overflow-y: auto; border: 1px solid #ccc; padding: 5px; }
    #chat-input { width: 100%; height: 60px; margin-top: 10px; }
    button { margin-top: 5px; }
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="chat-output"></div>
    <textarea id="chat-input" placeholder="Type your message here..."></textarea>
    <button id="send-btn">Send</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const sendBtn = document.getElementById("send-btn");
    sendBtn.addEventListener("click", () => {
      const input = document.getElementById("chat-input").value;
      vscode.postMessage({ command: "sendMessage", text: input });
    });

    window.addEventListener("message", event => {
      const message = event.data;
      switch (message.command) {
        case "receiveMessage":
          const chatOutput = document.getElementById("chat-output");
          chatOutput.innerHTML += "<div>" + message.text + "</div>";
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  private setMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (data) => {
      if (data.command === "sendMessage") {
        // Call the AI provider with a simple conversation
        const response = await this.aiProvider.getChatCompletion("gemini-2.0-flash", [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: data.text }
        ]);
        webview.postMessage({ command: "receiveMessage", text: response });
      }
    });
  }
}
```

---

### 3. AI Provider Module (core/openaiProvider.ts)

This module wraps the OpenAI–compatible API. It’s designed so that you can easily swap out the underlying LLM model (e.g., Gemini, Ollama) by using the same interface. You can later add methods for embeddings (as required by your “apply” button).

```typescript
// core/openaiProvider.ts
import OpenAI from "openai";

export class AIProvider {
  private openai: any;

  constructor(apiKey: string, baseURL: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    });
  }

  async getChatCompletion(model: string, messages: any[]): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages,
      });
      // Adjust based on your response schema; here we assume a simple structure.
      return response.choices[0].message;
    } catch (error) {
      console.error("Error fetching chat completion:", error);
      return "There was an error processing your request.";
    }
  }

  // Example placeholder for embeddings functionality.
  // Later you can call this method when the user clicks the "apply" button.
  async getEmbeddings(text: string, provider: "ollama" | "gemini"): Promise<any> {
    // You can conditionally call different endpoints based on the provider.
    // For now, this is a stub that you can later implement.
    if (provider === "ollama") {
      // Call Ollama's embedding API
      // e.g., using "nomic-embed-text:latest" model
    } else {
      // Default to Gemini or other provider
    }
    return {}; // return the embedding result
  }
}
```

---

### Extending the PoC

This PoC covers a basic VS Code chat interface with a single command to send a message and receive a response using a configurable LLM interface. You can extend this project by:

- **Text Analysis (text_analysis):**  
  Implement inline code suggestions as the user types (listening to the text editor changes and pressing Tab to accept suggestions).

- **Lightbulb Tips (lightbulb_tips):**  
  Map a command (e.g., `cmd+i`) to trigger a request to the LLM for code creation/modification.

- **Menu Book Spark (menu_book_spark):**  
  When code is selected in the editor, provide context menu options for additional actions such as code explanation.

- **Folder Spark (folder_spark):**  
  Enhance file access by scanning the workspace and, when the user types `@`, showing a dropdown of available files to include context in the LLM request.

Each of these features can be implemented in separate modules under the core and GUI folders. For example, you could add a module that interacts with the VS Code workspace API to list files and supply them as context when needed.

---

### Final Remarks

This PoC demonstrates a modular design that isolates the AI integration (using the OpenAI–compatible module) from the VS Code interface. This separation of concerns means that in the future you can swap out the LLM (for instance, switching between Gemini and Ollama) with minimal changes to the rest of the codebase.

Feel free to ask if you’d like to dive deeper into any specific part of this plan or if you need further implementation details for any of the features.



Below is an updated PoC that highlights the three main features you mentioned. The design uses a modular approach so that:

- **Generate Code:**  
  The chat UI renders code as formatted code blocks with “Copy” and “Paste” buttons. The “Paste” button inserts the code directly into the active editor.
  
- **Apply Button with Embeddings:**  
  An “Apply” button triggers an embedding request. The code supports two providers (Gemini or Ollama) via a configurable property, letting you switch the LLM backend easily.

- **File Access with “@” Suggestions:**  
  The chat input listens for the “@” character and, when detected, queries the VS Code workspace for files. A dropdown is displayed to allow the user to insert file references.

Below is an example directory structure with three key files:

```plaintext
your-chatbot-extension/
├── core/
│   └── openaiProvider.ts        // Wraps OpenAI–compatible API for chat and embeddings
├── gui/
│   └── ChatWebviewProvider.ts   // Implements the VS Code webview with our chat UI and file access features
└── src/
    └── extension.ts             // Entry point that activates the extension and registers commands
```

---

### 1. Extension Entry Point (src/extension.ts)

This file sets up the extension and registers our webview.

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { ChatWebviewProvider } from '../gui/ChatWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("chatView", provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('chat.open', () => {
      vscode.commands.executeCommand('workbench.view.extension.chatView');
    })
  );
}

export function deactivate() {}
```

---

### 2. Webview Provider with Enhanced UI (gui/ChatWebviewProvider.ts)

This file implements a webview-based chat interface that includes:
- A textarea for chat input.
- Buttons for “Send,” “Apply” (to use embeddings), “Copy,” and “Paste.”
- Code is rendered in code blocks.
- Input monitoring for “@” to trigger file suggestions.

```typescript
// gui/ChatWebviewProvider.ts
import * as vscode from 'vscode';
import { AIProvider } from '../core/openaiProvider';

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  // Configure AIProvider for chat (OpenAI–compatible) 
  // and later for embeddings with configurable provider ("gemini" or "ollama")
  private aiProvider: AIProvider;

  constructor(private readonly extensionUri: vscode.Uri) {
    // Replace GEMINI_API_KEY with your real key or load from configuration.
    this.aiProvider = new AIProvider("GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/");
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    this.setMessageListener(webviewView.webview);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // The HTML includes:
    // - A chat output area for messages (including code formatted as code blocks).
    // - A chat input area that listens for '@' to provide file suggestions.
    // - Buttons for sending, applying embeddings, copying, and pasting code.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Chat Assistant</title>
  <style>
    body { font-family: sans-serif; margin: 0; padding: 10px; }
    #chat-container { display: flex; flex-direction: column; height: 100vh; }
    #chat-output { flex: 1; overflow-y: auto; border: 1px solid #ccc; padding: 5px; }
    #chat-input { width: 100%; height: 60px; margin-top: 10px; }
    button { margin-top: 5px; }
    .code-block { background: #f4f4f4; padding: 5px; border-radius: 3px; font-family: monospace; }
    #file-suggestions { border: 1px solid #ccc; background: #fff; position: absolute; display: none; max-height: 150px; overflow-y: auto; }
    #file-suggestions div { padding: 5px; cursor: pointer; }
    #file-suggestions div:hover { background: #eee; }
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="chat-output"></div>
    <textarea id="chat-input" placeholder="Type your message here..."></textarea>
    <button id="send-btn">Send</button>
    <button id="apply-btn">Apply (Embeddings)</button>
    <div id="file-suggestions"></div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    
    const sendBtn = document.getElementById("send-btn");
    const applyBtn = document.getElementById("apply-btn");
    const chatInput = document.getElementById("chat-input");
    const fileSuggestions = document.getElementById("file-suggestions");

    // Send message on click
    sendBtn.addEventListener("click", () => {
      const input = chatInput.value;
      vscode.postMessage({ command: "sendMessage", text: input });
      chatInput.value = "";
    });
    
    // Apply embeddings using the configured LLM (Gemini/Ollama)
    applyBtn.addEventListener("click", () => {
      const selectedText = window.getSelection().toString();
      vscode.postMessage({ command: "applyEmbedding", text: selectedText });
    });

    // Listen for '@' in the input to show file suggestions
    chatInput.addEventListener("keyup", (e) => {
      if(e.key === '@') {
        vscode.postMessage({ command: "listFiles" });
      }
    });
    
    // Handle messages from extension
    window.addEventListener("message", event => {
      const message = event.data;
      switch (message.command) {
        case "receiveMessage":
          // Render code responses in a code block with Copy/Paste buttons
          renderChatMessage(message.text, message.isCode);
          break;
        case "fileList":
          renderFileSuggestions(message.files);
          break;
      }
    });
    
    // Render chat message with optional code formatting
    function renderChatMessage(text, isCode) {
      const chatOutput = document.getElementById("chat-output");
      let html = "";
      if(isCode) {
        html += '<div class="code-block"><pre>' + text + '</pre>';
        html += '<button onclick="copyCode(`' + encodeURIComponent(text) + '`)">Copy</button>';
        html += '<button onclick="pasteCode(`' + encodeURIComponent(text) + '`)">Paste</button>';
        html += '</div>';
      } else {
        html += "<div>" + text + "</div>";
      }
      chatOutput.innerHTML += html;
    }
    
    // Copy code to clipboard
    function copyCode(encodedCode) {
      const code = decodeURIComponent(encodedCode);
      navigator.clipboard.writeText(code);
    }
    
    // Paste code into the active editor via message to extension
    function pasteCode(encodedCode) {
      const code = decodeURIComponent(encodedCode);
      vscode.postMessage({ command: "pasteCode", text: code });
    }
    
    // Render file suggestions dropdown
    function renderFileSuggestions(files) {
      fileSuggestions.innerHTML = "";
      if(files.length === 0) {
        fileSuggestions.style.display = "none";
        return;
      }
      files.forEach(file => {
        const div = document.createElement("div");
        div.textContent = file;
        div.onclick = () => {
          // Insert file reference at cursor position
          chatInput.value += " " + file;
          fileSuggestions.style.display = "none";
        };
        fileSuggestions.appendChild(div);
      });
      fileSuggestions.style.display = "block";
    }
  </script>
</body>
</html>`;
  }

  private setMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case "sendMessage":
          // For chat, generate code or text response via LLM (OpenAI–compatible)
          const chatResponse = await this.aiProvider.getChatCompletion("gemini-2.0-flash", [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: data.text }
          ]);
          // If response contains code, you can set isCode flag (here we assume responses starting with "```" are code)
          const isCode = chatResponse.trim().startsWith("```");
          webview.postMessage({ command: "receiveMessage", text: chatResponse, isCode });
          break;
        case "applyEmbedding":
          // Use embedding functionality – support only two providers: gemini or ollama.
          // You could pass an option from settings; here we hard-code for demonstration.
          const provider = "ollama"; // or "gemini"
          const embedResult = await this.aiProvider.getEmbeddings(data.text, provider);
          webview.postMessage({ command: "receiveMessage", text: "Embedding result: " + JSON.stringify(embedResult), isCode: false });
          break;
        case "listFiles":
          // Retrieve list of files from the workspace
          const files = await this.getWorkspaceFiles();
          webview.postMessage({ command: "fileList", files });
          break;
        case "pasteCode":
          // Insert the code into the active editor at the current cursor position
          const editor = vscode.window.activeTextEditor;
          if(editor) {
            editor.edit(editBuilder => {
              editBuilder.insert(editor.selection.active, data.text);
            });
          }
          break;
      }
    });
  }

  // Helper: List files from the workspace for file access suggestions.
  private async getWorkspaceFiles(): Promise<string[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }
    const files = await vscode.workspace.findFiles('**/*.*', '**/node_modules/**', 10);
    return files.map(f => vscode.workspace.asRelativePath(f));
  }
}
```

---

### 3. AI Provider with Chat and Embeddings (core/openaiProvider.ts)

This module wraps the API for both generating code and handling embeddings. The interface is kept consistent so you can swap LLM models later.

```typescript
// core/openaiProvider.ts
import OpenAI from "openai";

export class AIProvider {
  private openai: any;

  constructor(apiKey: string, baseURL: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    });
  }

  async getChatCompletion(model: string, messages: any[]): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages,
      });
      // Adjust based on your API response schema.
      return response.choices[0].message;
    } catch (error) {
      console.error("Error in chat completion:", error);
      return "Error processing your request.";
    }
  }

  // Embeddings functionality: supports only two providers (Gemini or Ollama)
  async getEmbeddings(text: string, provider: "ollama" | "gemini"): Promise<any> {
    try {
      if (provider === "ollama") {
        // Call Ollama's embedding API using the nomic-embed-text:latest model.
        // (Pseudo-code – replace with the actual API call)
        return await this.openai.embeddings.create({
          provider: "ollama",
          model: "nomic-embed-text:latest",
          input: text,
        });
      } else {
        // Default: call Gemini's embedding endpoint or other similar endpoint.
        return await this.openai.embeddings.create({
          provider: "gemini",
          model: "gemini-embed-model",
          input: text,
        });
      }
    } catch (error) {
      console.error("Error in embeddings:", error);
      return { error: "Embedding error" };
    }
  }
}
```

---

### Final Remarks

- **Generate Code:**  
  The chat response is checked for code formatting (e.g., beginning with ```). If code is detected, the webview displays it with “Copy” and “Paste” buttons. The “Paste” button sends a message to the extension, which inserts the code into the active editor.

- **Apply Button (Embeddings):**  
  When the “Apply” button is clicked, the selected text (or a code snippet) is sent to the `getEmbeddings` method. The provider (hard-coded here as `"ollama"`) can be easily swapped to `"gemini"` via configuration or settings.

- **File Access:**  
  When the user types `@` in the input box, a message is sent to the extension to list workspace files. A simple dropdown is rendered in the webview, letting the user pick a file reference to insert into their message.

This PoC serves as a starting point for a modular VS Code chat extension that can generate and manipulate code, utilize embeddings