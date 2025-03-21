./src/api.ts

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import * as dotenv from "dotenv";
import { FileManager } from "./fileManager";

dotenv.config();

const API_KEY = "";
const genAI = new GoogleGenerativeAI(API_KEY);

// Available models
const MODELS = {
    FLASH: "gemini-2.0-flash",
    FLASH_LITE: "gemini-2.0-flash-lite",
    FLASH_15: "gemini-1.5-flash"
} as const;

type ModelName = typeof MODELS[keyof typeof MODELS];

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface GenerationConfig {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
}

const DEFAULT_CONFIG: GenerationConfig = {
    temperature: 0.7,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
};

// Keep track of conversation history
let conversationHistory: Message[] = [];

// Command handlers
const commandHandlers = {
    create: async (args: string) => {
        const [fileName, ...content] = args.split(' ');
        if (!fileName) {
            return "Please provide a file name";
        }
        await FileManager.getInstance().createFile(fileName, content.join(' '));
        return `File ${fileName} created successfully`;
    },
    update: async (args: string) => {
        const [fileName, ...content] = args.split(' ');
        if (!fileName) {
            return "Please provide a file name";
        }
        await FileManager.getInstance().updateFile(fileName, content.join(' '));
        return `File ${fileName} updated successfully`;
    },
    delete: async (args: string) => {
        if (!args) {
            return "Please provide a file name";
        }
        await FileManager.getInstance().deleteFile(args);
        return `File ${args} deleted successfully`;
    }
};

export function clearConversationHistory() {
    conversationHistory = [];
}

export async function askAI(prompt: string, context: string, modelName: ModelName = MODELS.FLASH): Promise<any> {
    try {
        if (!prompt.trim()) {
            return "Please provide a valid prompt.";
        }

        // Handle commands
        if (prompt.startsWith('/')) {
            const [command, ...args] = prompt.slice(1).split(' ');
            const handler = commandHandlers[command as keyof typeof commandHandlers];
            if (handler) {
                const result = await handler(args.join(' '));
                return result;
            }
        }

        // Initialize the model
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: DEFAULT_CONFIG,
        });

        // Add user message to history
        conversationHistory.push({ role: 'user', content: prompt });

        // Prepare context and history
        const fullPrompt = [
            "You are a helpful AI assistant with access to the codebase. You can help with code modifications, file operations, and providing explanations. When suggesting code changes, wrap them in code blocks with the target file specified like: ```language {file: path/to/file}\ncode here```",
            "Current codebase context:",
            context,
            "Conversation history:",
            ...conversationHistory.map(msg => `${msg.role}: ${msg.content}`),
            "User: " + prompt
        ].join('\n\n');

        // Generate content
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        
        // Parse the response to preserve code blocks
        const responseText = response.text();
        const blocks = [];
        let currentText = '';
        let lines = responseText.split('\n');
        let inCodeBlock = false;
        let currentBlock: any = {};
        let blockStartLine = '';

        for (let line of lines) {
            if (line.trim().startsWith('```')) {
                if (inCodeBlock) {
                    // End of code block
                    inCodeBlock = false;
                    if (currentBlock.code) {
                        // Clean up the code block
                        currentBlock.code = currentBlock.code.trim() + '\n';
                        // Parse language and file info from the opening line
                        const langAndFile = blockStartLine.slice(3).trim();
                        const fileMatch = langAndFile.match(/{file:\s*([^}]+)}/);
                        if (fileMatch) {
                            currentBlock.file = fileMatch[1].trim();
                            currentBlock.language = langAndFile.slice(0, langAndFile.indexOf('{')).trim();
                        } else {
                            currentBlock.language = langAndFile;
                        }
                        blocks.push(currentBlock);
                    }
                    currentBlock = {};
                    blockStartLine = '';
                } else {
                    // Start of code block
                    if (currentText.trim()) {
                        blocks.push({
                            type: 'text',
                            content: currentText.trim()
                        });
                        currentText = '';
                    }
                    inCodeBlock = true;
                    blockStartLine = line;
                    currentBlock = {
                        type: 'code',
                        code: ''
                    };
                }
            } else if (inCodeBlock) {
                // Inside code block - preserve all whitespace and line breaks
                currentBlock.code = (currentBlock.code || '') + line + '\n';
            } else {
                currentText += line + '\n';
            }
        }

        // Add any remaining text
        if (currentText.trim()) {
            blocks.push({
                type: 'text',
                content: currentText.trim()
            });
        }

        // Clean up code blocks and ensure proper line endings
        blocks.forEach(block => {
            if (block.type === 'code' && block.code) {
                // Normalize line endings and ensure trailing newline
                block.code = block.code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                if (!block.code.endsWith('\n')) {
                    block.code += '\n';
                }
            }
        });

        // Add assistant response to history
        conversationHistory.push({ role: 'assistant', content: responseText });

        return blocks;
    } catch (error) {
        console.error('Error in askAI:', error);
        
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                return [{ type: 'text', content: "Error: Invalid API key configuration. Please check your API key." }];
            }
            if (error.message.includes('not found') || error.message.includes('deprecated')) {
                return [{ type: 'text', content: "Error: The selected model is not available. Please try again later." }];
            }
            return [{ type: 'text', content: `Error: ${error.message}` }];
        }
        
        return [{ type: 'text', content: "Error: An unexpected error occurred." }];
    }
}

// Export types for use in other files
export type { Message, ModelName };

src/contextManager.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class ContextManager {
    private workspaceFiles: string[] = [];

    async loadWorkspaceFiles() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace folder found.");
            return;
        }

        const folderPath = workspaceFolders[0].uri.fsPath;

        try {
            this.workspaceFiles = this.getAllFiles(folderPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading workspace: ${error}`);
        }
    }

    private getAllFiles(dir: string, fileList: string[] = []): string[] {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                this.getAllFiles(fullPath, fileList);
            } else {
                fileList.push(fullPath);
            }
        }
        return fileList;
    }

    getFiles(): string[] {
        return this.workspaceFiles;
    }
}
src/extension.ts
import * as vscode from "vscode";
import { askAI } from "./api";
import { FileManager } from "./fileManager";
import { ContextManager } from "./contextManager";
import { Uri } from "vscode";
import * as path from 'path';

// Add type definitions at the top of the file
interface ResponseBlock {
    type: 'text' | 'code';
    content?: string;
    language?: string;
    file?: string;
    code?: string;
}

export function activate(context: vscode.ExtensionContext) {
    let chatPanel: vscode.WebviewPanel | undefined;
    const contextManager = new ContextManager();
    const fileManager = FileManager.getInstance();
    
    // Store last generated content for each file
    const lastGeneratedContent = new Map<string, string>();

    // Register command to get last generated content
    let getLastContentCommand = vscode.commands.registerCommand('chatCursor.getLastGeneratedContent', (fileName: string) => {
        return lastGeneratedContent.get(fileName);
    });

    // Store generated content when it's created
    const storeGeneratedContent = (fileName: string, content: string) => {
        lastGeneratedContent.set(fileName, content);
    };

    // Register view provider
    const provider = new AIChatViewProvider(context.extensionUri, contextManager, fileManager, storeGeneratedContent);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('aiChatView', provider)
    );

    let disposable = vscode.commands.registerCommand("chatCursor.showSidebar", async () => {
        // Focus the view container instead of creating a new panel
        await vscode.commands.executeCommand('workbench.view.extension.ai-chat');
    });

    context.subscriptions.push(disposable);
}

class AIChatViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _contextManager: ContextManager,
        private readonly _fileManager: FileManager,
        private readonly _storeContent: (fileName: string, content: string) => void
    ) {}

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        const workspaceFiles = await this._contextManager.loadWorkspaceFiles();
        webviewView.webview.html = getWebviewContent(this._extensionUri, webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.command) {
                    case "ask":
                        // Handle @ commands for file operations
                        if (message.text.startsWith('@')) {
                            const response = await handleFileCommand(message.text, this._fileManager, this._storeContent);
                            this._view?.webview.postMessage({ command: "response", text: response });
                            return;
                        }
                        
                        // Handle / commands
                        if (message.text.startsWith('/')) {
                            const response = await handleSlashCommand(message.text, this._fileManager, this._storeContent);
                            this._view?.webview.postMessage({ command: "response", text: response });
                            return;
                        }

                        const response = await askAI(
                            message.text, 
                            JSON.stringify(workspaceFiles),
                            message.model
                        );

                        // Process each block in the response
                        for (const block of response as ResponseBlock[]) {
                            if (block.type === 'code') {
                                if (block.file && block.code) {
                                    try {
                                        await this._fileManager.updateFile(block.file, block.code);
                                        this._view?.webview.postMessage({ 
                                            command: "response", 
                                            text: `Updated file: ${block.file}`
                                        });
                                    } catch (error) {
                                        try {
                                            await this._fileManager.createFile(block.file, block.code);
                                            this._view?.webview.postMessage({ 
                                                command: "response", 
                                                text: `Created file: ${block.file}`
                                            });
                                        } catch (createError) {
                                            this._view?.webview.postMessage({ 
                                                command: "response", 
                                                text: `Error handling file ${block.file}: ${error instanceof Error ? error.message : 'Unknown error'}`
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        // Send the formatted response
                        const formattedResponse = (response as ResponseBlock[]).map(block => {
                            if (block.type === 'text' && block.content) {
                                return block.content;
                            } else if (block.type === 'code') {
                                const fileInfo = block.file ? ` {file: ${block.file}}` : '';
                                const language = block.language || '';
                                return `\`\`\`${language}${fileInfo}\n${block.code || ''}\n\`\`\``;
                            }
                            return '';
                        }).join('\n\n');

                        this._view?.webview.postMessage({ 
                            command: "response", 
                            text: formattedResponse 
                        });
                        break;

                    case "getFileSuggestions":
                        const suggestions = await this._fileManager.getFileSuggestions(message.query);
                        this._view?.webview.postMessage({ 
                            command: "fileSuggestions", 
                            suggestions 
                        });
                        break;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                this._view?.webview.postMessage({ 
                    command: "response", 
                    text: `Error: ${errorMessage}`
                });
            }
        });
    }
}

async function handleFileCommand(text: string, fileManager: FileManager, storeContent: (fileName: string, content: string) => void): Promise<string> {
    // Format: @filename [prompt]
    const parts = text.slice(1).split(' '); // Remove @ and split
    const fileName = parts[0];
    const prompt = parts.slice(1).join(' ');
    
    // If no filename provided after @
    if (!fileName) {
        const suggestions = await fileManager.getFileSuggestions('');
        if (suggestions.length === 0) {
            return 'No files found in workspace';
        }
        return `Available files:\n${suggestions.join('\n')}`;
    }

    try {
        // Try to read the file first
        let existingContent = '';
        try {
            const fileUri = vscode.Uri.file(path.join(fileManager.getWorkspaceRoot(), fileName));
            const fileContent = await vscode.workspace.fs.readFile(fileUri);
            existingContent = fileContent.toString();
        } catch (error) {
            // File doesn't exist, will create new
        }

        // If no new prompt provided, show the current content
        if (!prompt) {
            const fileExt = path.extname(fileName).slice(1) || 'txt';
            return existingContent ? 
                `Content of ${fileName}:\n\`\`\`${fileExt}\n${existingContent}\n\`\`\`` :
                `File ${fileName} does not exist. Provide a prompt to create it.`;
        }

        // Send the prompt to Gemini
        const response = await askAI(
            prompt,
            existingContent ? `Current file content:\n${existingContent}\n\nGenerate additional code to append.` : '',
            'gemini-2.0-flash'
        );

        // Extract code from the response
        let content = '';
        if (Array.isArray(response)) {
            for (const block of response as ResponseBlock[]) {
                if (block.type === 'code' && block.code) {
                    content = block.code;
                    break;
                }
            }
        }

        if (!content) {
            return 'Failed to generate code from the prompt';
        }

        // Store the content for later use
        const finalContent = existingContent ? 
            `${existingContent}\n\n/* New code */\n${content}` : 
            content;
        storeContent(fileName, finalContent);

        // Show preview with both existing and new content
        const fileExt = path.extname(fileName).slice(1) || 'txt';
        return `${existingContent ? 'Current content:\n```' + fileExt + '\n' + existingContent + '\n```\n\n' : ''}Generated code to ${existingContent ? 'append' : 'create'}:\n\`\`\`${fileExt}\n${content}\n\`\`\`\n\n<div class="apply-button-container"><button class="apply-button" onclick="applyChanges('${fileName}')">Apply Changes</button></div>`;

    } catch (error) {
        return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function handleSlashCommand(text: string, fileManager: FileManager, storeContent: (fileName: string, content: string) => void): Promise<string> {
    const [command, ...args] = text.slice(1).split(' ');
    let fileName = args[0];
    let prompt = args.slice(1).join(' ');

    switch (command.toLowerCase()) {
        case 'apply':
            if (!fileName) {
                return 'Please provide a filename: /apply filename';
            }
            try {
                // Get the last generated content from memory
                const lastContent = await vscode.commands.executeCommand<string>('chatCursor.getLastGeneratedContent', fileName);
                if (!lastContent) {
                    return 'No generated content found for this file. Generate content first using @ or /create or /update commands.';
                }

                // Check if file exists and handle accordingly
                try {
                    const fileUri = vscode.Uri.file(path.join(fileManager.getWorkspaceRoot(), fileName));
                    let fileExists = false;
                    try {
                        await vscode.workspace.fs.stat(fileUri);
                        fileExists = true;
                    } catch {
                        fileExists = false;
                    }

                    if (fileExists) {
                        // File exists, check if this is an append operation
                        const isAppendOperation = lastContent.includes('/* New code */');
                        if (isAppendOperation) {
                            // Get only the new code part
                            const newCodeParts = lastContent.split('/* New code */');
                            if (newCodeParts.length > 1) {
                                // Update with only the new code appended
                                const existingContent = (await vscode.workspace.fs.readFile(fileUri)).toString();
                                const newContent = existingContent + '\n\n/* New code */\n' + newCodeParts[1].trim();
                                await fileManager.updateFile(fileName, newContent);
                                return `Updated file ${fileName} with the new code appended`;
                            }
                        }
                        // Not an append operation, just update the file
                        await fileManager.updateFile(fileName, lastContent);
                        return `Updated file ${fileName} with the generated content`;
                    } else {
                        // File doesn't exist, create it
                        await fileManager.createFile(fileName, lastContent);
                        return `Created file ${fileName} with the generated content`;
                    }
                } catch (error) {
                    throw new Error(`Failed to handle file operation: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            } catch (error) {
                throw new Error(`Failed to apply changes: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

        case 'create':
        case 'update':
            if (!fileName) {
                return `Please provide a filename: /${command} filename content`;
            }

            // If filename starts with @, remove it
            fileName = fileName.startsWith('@') ? fileName.slice(1) : fileName;

            // Try to read existing content first
            let existingContent = '';
            try {
                const fileUri = vscode.Uri.file(path.join(fileManager.getWorkspaceRoot(), fileName));
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                existingContent = fileContent.toString();
            } catch (error) {
                if (command === 'update') {
                    return `File ${fileName} does not exist. Use /create to create a new file.`;
                }
            }

            // If no new prompt provided, show existing content
            if (!prompt) {
                const fileExt = path.extname(fileName).slice(1) || 'txt';
                return existingContent ? 
                    `Current content of ${fileName}:\n\`\`\`${fileExt}\n${existingContent}\n\`\`\`\nProvide a prompt to update the content.` :
                    'Please provide content to create the file.';
            }

            // Send the prompt to Gemini
            const response = await askAI(
                prompt,
                existingContent ? `Current file content:\n${existingContent}\n\nGenerate additional code to append.` : '',
                'gemini-2.0-flash'
            );

            // Extract code from the response
            let content = '';
            if (Array.isArray(response)) {
                for (const block of response as ResponseBlock[]) {
                    if (block.type === 'code' && block.code) {
                        content = block.code;
                        break;
                    }
                }
            }

            if (!content) {
                return 'Failed to generate code from the prompt';
            }

            // Store the content for later use
            const finalContent = existingContent && command === 'update' ? 
                `${existingContent}\n\n/* New code */\n${content}` : 
                content;
            storeContent(fileName, finalContent);

            // Show preview with both existing and new content
            const fileExt = path.extname(fileName).slice(1) || 'txt';
            return `${existingContent ? 'Current content:\n```' + fileExt + '\n' + existingContent + '\n```\n\n' : ''}Generated code to ${existingContent ? 'append' : 'create'}:\n\`\`\`${fileExt}\n${content}\n\`\`\`\n\n<div class="apply-button-container"><button class="apply-button" onclick="applyChanges('${fileName}')">Apply Changes</button></div>`;

        case 'delete':
            if (!fileName) {
                return 'Please provide a filename: /delete filename';
            }
            try {
                await fileManager.deleteFile(fileName);
                return `Deleted file ${fileName}`;
            } catch (error) {
                throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

        default:
            return `Unknown command: ${command}. Available commands:\n` +
                   `/create filename prompt - Create a new file with AI-generated content\n` +
                   `/update @filename prompt - Update file with AI-generated content\n` +
                   `/update @filename - Show current content\n` +
                   `/delete filename - Delete a file`;
    }
}

function getFileExtension(code: string): string {
    if (code.includes('<!DOCTYPE html>') || code.includes('<html>')) return 'html';
    if (code.includes('function') || code.includes('const') || code.includes('let')) return 'js';
    if (code.includes('interface') || code.includes('type ') || code.includes('namespace')) return 'ts';
    if (code.includes('class') && code.includes('public')) return 'java';
    if (code.includes('#include')) return 'cpp';
    return 'txt';
}

async function handleCreateFileCommand(text: string, fileManager: FileManager): Promise<string> {
    // Simple natural language parsing for file creation
    const words = text.split(' ');
    const createIndex = words.findIndex(w => w.toLowerCase() === 'create');
    const fileIndex = words.findIndex(w => w.toLowerCase() === 'file');
    
    if (createIndex === -1 || fileIndex === -1) {
        return "Could not understand the file creation command. Please use format: 'create file filename with content'";
    }

    const fileName = words[Math.max(createIndex, fileIndex) + 1];
    if (!fileName) {
        return "Please specify a filename";
    }

    const contentIndex = words.findIndex(w => w.toLowerCase() === 'with');
    let content = '';
    if (contentIndex !== -1) {
        content = words.slice(contentIndex + 1).join(' ');
    }

    await fileManager.createFile(fileName, content);
    return `Created file ${fileName} successfully${content ? ' with the specified content' : ''}`;
}

function getWebviewContent(extensionUri: vscode.Uri, webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'frontend', 'sidebar.js')
    );

    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'frontend', 'styles.css')
    );

    const logoUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'asset', 'ai.png')
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AI Chat</title>
        <link rel="stylesheet" href="${styleUri}">
        <style>
            #model-selector-container {
                padding: 8px;
                background: var(--vscode-editor-background);
                border-bottom: 1px solid var(--vscode-panel-border);
                position: sticky;
                top: 0;
                z-index: 100;
            }
            #model-selector {
                width: 100%;
                padding: 4px 8px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 2px;
                outline: none;
                cursor: pointer;
            }
            #model-selector:focus {
                border-color: var(--vscode-focusBorder);
            }
            #chat-container {
                display: flex;
                flex-direction: column;
                height: 100vh;
            }
            #chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            .input-container {
                padding: 16px;
                background: var(--vscode-editor-background);
                border-top: 1px solid var(--vscode-panel-border);
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .input-wrapper {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .input-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                background: var(--vscode-editorHoverWidget-background);
                border-radius: 4px 4px 0 0;
                border: 1px solid var(--vscode-input-border);
                border-bottom: none;
            }

            .input-header-left {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .input-header-right {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .input-status {
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 3px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
            }

            #chat-input {
                width: 100%;
                min-height: 100px;
                max-height: 300px;
                padding: 12px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 0 0 4px 4px;
                font-family: var(--vscode-editor-font-family);
                font-size: var(--vscode-editor-font-size);
                line-height: 1.5;
                resize: vertical;
                transition: all 0.2s ease;
            }

            #chat-input:focus {
                border-color: var(--vscode-focusBorder);
                outline: none;
                box-shadow: 0 0 0 1px var(--vscode-focusBorder);
            }

            #chat-input.command-mode {
                border-color: var(--vscode-terminal-ansiGreen);
            }

            #chat-input.file-mode {
                border-color: var(--vscode-terminal-ansiBlue);
            }

            .input-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 8px;
                background: var(--vscode-editorHoverWidget-background);
                border-radius: 0 0 4px 4px;
                border: 1px solid var(--vscode-input-border);
                border-top: none;
            }

            .input-actions {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            #send-btn {
                padding: 6px 16px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s ease;
            }

            #send-btn:hover {
                background: var(--vscode-button-hoverBackground);
                transform: translateY(-1px);
            }

            #send-btn:active {
                transform: translateY(0);
            }

            .input-hint {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .input-shortcuts {
                display: flex;
                gap: 8px;
            }

            .shortcut-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 2px 6px;
                background: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
                border-radius: 3px;
                font-size: 11px;
            }

            .shortcut-key {
                font-family: monospace;
                font-size: 10px;
                padding: 1px 4px;
                background: var(--vscode-editor-background);
                border-radius: 2px;
            }

            #file-suggestions {
                position: absolute;
                bottom: 100%;
                left: 16px;
                right: 16px;
                background: var(--vscode-dropdown-background);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                max-height: 200px;
                overflow-y: auto;
                display: none;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            .file-suggestion {
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.2s;
            }

            .file-suggestion:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .file-suggestion.selected {
                background: var(--vscode-list-activeSelectionBackground);
                color: var(--vscode-list-activeSelectionForeground);
            }

            .file-suggestion-icon {
                font-size: 14px;
                color: var(--vscode-terminal-ansiBlue);
            }

            #command-hint {
                position: absolute;
                top: -30px;
                left: 16px;
                right: 16px;
                padding: 6px 12px;
                background: var(--vscode-editorHoverWidget-background);
                border: 1px solid var(--vscode-editorHoverWidget-border);
                border-radius: 4px;
                font-size: 12px;
                color: var(--vscode-editorHoverWidget-foreground);
                display: none;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            }

            .header-container {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: var(--vscode-editor-background);
                border-bottom: 1px solid var(--vscode-panel-border);
                position: sticky;
                top: 0;
                z-index: 100;
            }

            .header-logo {
                width: 24px;
                height: 24px;
                object-fit: contain;
            }

            .header-title {
                font-size: 14px;
                font-weight: 500;
                color: var(--vscode-foreground);
                flex: 1;
            }

            #model-selector-container {
                flex: 1;
                padding: 0;
                background: transparent;
                border: none;
            }

            #model-selector {
                width: 100%;
                padding: 4px 8px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 4px;
                outline: none;
                cursor: pointer;
                font-size: 12px;
            }

            /* Update chat container to account for new header */
            #chat-container {
                display: flex;
                flex-direction: column;
                height: 100vh;
                background: var(--vscode-editor-background);
            }
        </style>
    </head>
    <body>
        <div id="chat-container">
            <div class="header-container">
                <div class="header-title">AI Chat Assistant</div>
                <div id="model-selector-container">
                    <select id="model-selector">
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </select>
                </div>
            </div>
            <div id="chat-messages"></div>
            <div class="input-container">
                <div id="command-hint"></div>
                <div id="file-suggestions"></div>
                <div class="input-wrapper">
                    <div class="input-header">
                        <div class="input-header-left">
                            <span>AI Chat Input</span>
                            <span class="input-status">Ready</span>
                        </div>
                        <div class="input-header-right">
                            <span class="shortcut-item">
                                <span class="shortcut-key">Ctrl</span> + <span class="shortcut-key">Enter</span>
                                <span>Send</span>
                            </span>
                        </div>
                    </div>
                    <textarea
                        id="chat-input"
                        placeholder="Ask AI... (Use @ to reference files, / for commands)"
                        rows="4"
                    ></textarea>
                    <div class="input-footer">
                        <div class="input-actions">
                            <button id="send-btn">
                                <span>Send</span>
                            </button>
                        </div>
                        <div class="input-hint">
                            <div class="input-shortcuts">
                                <span class="shortcut-item">
                                    <span class="shortcut-key">@</span>
                                    <span>Files</span>
                                </span>
                                <span class="shortcut-item">
                                    <span class="shortcut-key">/</span>
                                    <span>Commands</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <script>
            function applyChanges(fileName) {
                vscode.postMessage({
                    command: 'ask',
                    text: '/apply ' + fileName
                });
            }
        </script>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}

export function deactivate() {
    console.log("Chat Cursor extension is deactivated.");
}

src/fileManager.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class FileManager {
    private static instance: FileManager;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private workspaceRoot: string | undefined;
    private readonly maxFileSize = 50 * 1024 * 1024; // 50MB limit
    private readonly forbiddenChars = /[<>:"|?*]/g;

    private constructor() {
        this.setupWorkspace();
    }

    static getInstance(): FileManager {
        if (!FileManager.instance) {
            FileManager.instance = new FileManager();
        }
        return FileManager.instance;
    }

    getWorkspaceRoot(): string {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder is open');
        }
        return this.workspaceRoot;
    }

    private setupWorkspace() {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            this.setupFileWatcher();
        }
    }

    private setupFileWatcher() {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        this.fileWatcher.onDidCreate((uri) => {
            vscode.window.showInformationMessage(`File created: ${path.basename(uri.fsPath)}`);
        });

        this.fileWatcher.onDidChange((uri) => {
            vscode.window.showInformationMessage(`File changed: ${path.basename(uri.fsPath)}`);
        });

        this.fileWatcher.onDidDelete((uri) => {
            vscode.window.showInformationMessage(`File deleted: ${path.basename(uri.fsPath)}`);
        });
    }

    private validatePath(filePath: string): string {
        if (!filePath) {
            throw new Error('File path cannot be empty');
        }

        // Remove any forbidden characters
        const sanitizedPath = filePath.replace(this.forbiddenChars, '_');
        
        // Ensure the path doesn't try to escape workspace
        const normalizedPath = path.normalize(sanitizedPath).replace(/^(\.\.(\/|\\|$))+/, '');
        
        return normalizedPath;
    }

    private async validateFileOperation(fullPath: string, content?: string): Promise<void> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder is open');
        }

        // Check if path is within workspace
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error('File operation not allowed outside workspace');
        }

        // Check content size if provided
        if (content && Buffer.byteLength(content, 'utf8') > this.maxFileSize) {
            throw new Error('File content exceeds maximum size limit');
        }

        // Check for system files
        const isSystemFile = /^(\.git|\.vscode|node_modules)/.test(relativePath);
        if (isSystemFile) {
            throw new Error('Operation not allowed on system files');
        }
    }

    private getCodeContent(content: any): string {
        console.log('=== Debug getCodeContent ===');
        console.log('Content type:', typeof content);
        console.log('Content:', content);

        // If content is a code block object from Gemini
        if (content && typeof content === 'object') {
            if (content.code) {
                return content.code;
            }
            if (content.content) {
                return content.content;
            }
        }

        // If content is a string but looks like a code block, extract the code
        if (typeof content === 'string' && content.includes('```')) {
            const matches = content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
            if (matches && matches[1]) {
                return matches[1].trim();
            }
        }

        // If it's a plain string with escaped newlines, unescape them
        if (typeof content === 'string' && content.includes('\\n')) {
            try {
                return JSON.parse(`"${content.replace(/"/g, '\\"')}"`);
            } catch (e) {
                console.warn('Failed to unescape content:', e);
            }
        }

        // Return as is
        return String(content);
    }

    private resolveFilePath(filePath: string): string {
        // If the path doesn't have an extension and we're not explicitly creating a new file,
        // try to find an existing file with that name
        if (!path.extname(filePath)) {
            const possibleExtensions = ['.go', '.js', '.ts', '.cpp', '.py', '.java'];
            for (const ext of possibleExtensions) {
                const fullPath = path.join(this.workspaceRoot!, `${filePath}${ext}`);
                if (fs.existsSync(fullPath)) {
                    return `${filePath}${ext}`;
                }
            }
        }
        return filePath;
    }

    async createFile(filePath: string, content: any): Promise<void> {
        try {
            console.log('=== Debug createFile input ===');
            console.log('Original file path:', filePath);
            console.log('Content type:', typeof content);

            // Resolve the correct file path
            const resolvedPath = this.resolveFilePath(filePath);
            console.log('Resolved file path:', resolvedPath);

            const sanitizedPath = this.validatePath(resolvedPath);
            const fullPath = path.join(this.workspaceRoot!, sanitizedPath);
            
            await this.validateFileOperation(fullPath, content);

            const directory = path.dirname(fullPath);
            await fs.promises.mkdir(directory, { recursive: true });

            // Get the actual code content with proper formatting
            const codeContent = this.getCodeContent(content);
            
            // Only normalize line endings
            const processedContent = codeContent.replace(/\r\n|\r|\n/g, process.platform === 'win32' ? '\r\n' : '\n');
            
            console.log('=== Debug final content ===');
            console.log('Final content:', processedContent);
            console.log('Line count:', processedContent.split('\n').length);

            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(fullPath),
                Buffer.from(processedContent, 'utf8')
            );

            // Open the file in editor
            const document = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(document);

            return;
        } catch (error) {
            console.error('Create file error:', error);
            throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async updateFile(filePath: string, content: any): Promise<void> {
        try {
            console.log('=== Debug updateFile input ===');
            console.log('Original file path:', filePath);
            console.log('Content type:', typeof content);

            // Resolve the correct file path
            const resolvedPath = this.resolveFilePath(filePath);
            console.log('Resolved file path:', resolvedPath);

            const sanitizedPath = this.validatePath(resolvedPath);
            const fullPath = path.join(this.workspaceRoot!, sanitizedPath);
            
            await this.validateFileOperation(fullPath, content);

            // Create file if it doesn't exist
            if (!fs.existsSync(fullPath)) {
                await this.createFile(filePath, content);
                return;
            }

            // Check if file is writable
            try {
                await fs.promises.access(fullPath, fs.constants.W_OK);
            } catch {
                throw new Error('File is not writable');
            }

            // Create backup
            const backupPath = `${fullPath}.bak`;
            await fs.promises.copyFile(fullPath, backupPath);

            try {
                // Get the actual code content with proper formatting
                const codeContent = this.getCodeContent(content);
                
                // Only normalize line endings
                const processedContent = codeContent.replace(/\r\n|\r|\n/g, process.platform === 'win32' ? '\r\n' : '\n');
                
                console.log('=== Debug final content ===');
                console.log('Final content:', processedContent);
                console.log('Line count:', processedContent.split('\n').length);

                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(fullPath),
                    Buffer.from(processedContent, 'utf8')
                );
                // Remove backup on success
                await fs.promises.unlink(backupPath);
            } catch (error) {
                // Restore from backup if update fails
                await fs.promises.copyFile(backupPath, fullPath);
                await fs.promises.unlink(backupPath);
                throw error;
            }

            // Show the updated file
            const document = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(document);

            return;
        } catch (error) {
            console.error('Update file error:', error);
            throw new Error(`Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        try {
            const sanitizedPath = this.validatePath(filePath);
            const fullPath = path.join(this.workspaceRoot!, sanitizedPath);
            
            await this.validateFileOperation(fullPath);

            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                throw new Error('File does not exist');
            }

            // Check if file is writable
            try {
                await fs.promises.access(fullPath, fs.constants.W_OK);
            } catch {
                throw new Error('File is not writable');
            }

            // Create backup before deletion
            const backupPath = `${fullPath}.bak`;
            await fs.promises.copyFile(fullPath, backupPath);

            try {
                // Delete file
                await fs.promises.unlink(fullPath);
            } catch (error) {
                // Restore from backup if deletion fails
                await fs.promises.copyFile(backupPath, fullPath);
                throw error;
            }

            // Remove backup on successful deletion
            await fs.promises.unlink(backupPath);
            return;
        } catch (error) {
            throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getFileSuggestions(query: string): Promise<string[]> {
        try {
            if (!this.workspaceRoot) {
                return [];
            }

            const files = await this.getAllFiles(this.workspaceRoot);
            
            // If query is empty or just @, return all files
            if (!query || query === '@') {
                return files.slice(0, 10); // Limit to 10 files
            }

            // Filter and sort files
            return files
                .filter(file => {
                    const fileName = path.basename(file).toLowerCase();
                    const queryLower = query.toLowerCase();
                    return fileName.includes(queryLower) || file.toLowerCase().includes(queryLower);
                })
                .sort((a, b) => {
                    const aName = path.basename(a).toLowerCase();
                    const bName = path.basename(b).toLowerCase();
                    const queryLower = query.toLowerCase();
                    
                    // Exact matches first
                    if (aName === queryLower) return -1;
                    if (bName === queryLower) return 1;
                    
                    // Then matches at start of filename
                    if (aName.startsWith(queryLower)) return -1;
                    if (bName.startsWith(queryLower)) return 1;
                    
                    // Then matches in path
                    if (a.toLowerCase().includes(queryLower)) return -1;
                    if (b.toLowerCase().includes(queryLower)) return 1;
                    
                    return a.localeCompare(b);
                })
                .slice(0, 10); // Limit to 10 suggestions
        } catch (error) {
            console.error('Error getting file suggestions:', error);
            return [];
        }
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.workspaceRoot!, fullPath);

            // Skip hidden files and specified directories
            if (entry.name.startsWith('.') || 
                entry.name === 'node_modules' || 
                entry.name === 'dist' || 
                entry.name === 'build') {
                continue;
            }

            if (entry.isDirectory()) {
                files.push(...await this.getAllFiles(fullPath));
            } else {
                files.push(relativePath);
            }
        }

        return files;
    }

    async applyCodeBlock(code: string, filePath?: string): Promise<void> {
        try {
            if (!code.trim()) {
                throw new Error('Code content cannot be empty');
            }

            if (!filePath) {
                // Create a new file if no file is specified
                const extension = this.detectFileExtension(code);
                const fileName = `generated_${Date.now()}${extension}`;
                await this.createFile(fileName, code);
                return;
            }

            // Update existing file
            await this.updateFile(filePath, code);
        } catch (error) {
            throw new Error(`Failed to apply code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private detectFileExtension(code: string): string {
        // Simple language detection based on code content
        if (code.includes('function') || code.includes('const') || code.includes('let')) {
            return '.js';
        }
        if (code.includes('interface') || code.includes('type ') || code.includes('namespace')) {
            return '.ts';
        }
        if (code.includes('class') && code.includes('public')) {
            return '.java';
        }
        if (code.includes('#include')) {
            return '.cpp';
        }
        return '.txt';
    }
}

frontend/sidebar.html
<div id="chat-container">
    <div id="chat-messages"></div>
    <input type="text" id="chat-input" placeholder="Ask AI...">
    <button id="send-btn">Send</button>
</div>

frontend/sidebar.js

// Get VS Code API
const vscode = acquireVsCodeApi();

// Available models
const AVAILABLE_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

// Command patterns
const COMMANDS = {
    CREATE: '/create',
    UPDATE: '/update',
    DELETE: '/delete'
};

// Initialize state
let state = {
    messages: [],
    selectedModel: 'gemini-2.0-flash',
    fileSuggestions: [],
    showingSuggestions: false,
    inputMode: 'normal', // 'normal', 'command', 'file'
    currentCommand: null,
    commandStep: 0
};

// Try to load previous state
const previousState = vscode.getState();
if (previousState) {
    state = {
        ...previousState,
        selectedModel: AVAILABLE_MODELS.includes(previousState.selectedModel) 
            ? previousState.selectedModel 
            : 'gemini-2.0-flash',
        showingSuggestions: false,
        inputMode: 'normal',
        currentCommand: null,
        commandStep: 0
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages');
    const modelSelector = document.getElementById('model-selector');
    const fileSuggestionsContainer = document.getElementById('file-suggestions');
    const commandHint = document.getElementById('command-hint');

    // Set initial model selection
    if (state.selectedModel) {
        modelSelector.value = state.selectedModel;
    }

    // Handle model selection change
    modelSelector.addEventListener('change', (e) => {
        if (AVAILABLE_MODELS.includes(e.target.value)) {
            state.selectedModel = e.target.value;
            vscode.setState(state);
        } else {
            e.target.value = state.selectedModel;
        }
    });

    // Handle input changes for commands and @ mentions
    chatInput.addEventListener('input', (e) => {
        const text = e.target.value;
        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPosition);
        
        // Reset command state if input is cleared
        if (!text) {
            resetCommandState();
        }

        // Handle commands
        if (text.startsWith('/')) {
            handleCommandInput(text);
        }
        // Handle @ mentions
        else if (textBeforeCursor.includes('@')) {
            handleFileMention(textBeforeCursor);
        }
        // Normal mode
        else {
            state.inputMode = 'normal';
            state.currentCommand = null;
            state.commandStep = 0;
            updateCommandHint('');
        }

        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });

    function handleCommandInput(text) {
        state.inputMode = 'command';
        const parts = text.split(' ');
        const command = parts[0];

        switch (command) {
            case COMMANDS.CREATE:
                if (parts.length === 1) {
                    updateCommandHint('Enter filename (e.g., example.js)');
                    state.commandStep = 1;
                } else if (parts.length === 2) {
                    updateCommandHint('Enter file content');
                    state.commandStep = 2;
                }
                break;

            case COMMANDS.UPDATE:
                if (parts.length === 1) {
                    updateCommandHint('Enter @filename or type @ to see available files');
                    state.commandStep = 1;
                } else if (parts[1].startsWith('@')) {
                    handleFileMention(parts[1]);
                    if (parts.length === 2) {
                        updateCommandHint('Enter new content');
                        state.commandStep = 2;
                    }
                }
                break;

            case COMMANDS.DELETE:
                if (parts.length === 1) {
                    updateCommandHint('Enter filename to delete');
                    state.commandStep = 1;
                }
                break;

            default:
                updateCommandHint('Available commands: /create, /update, /delete');
        }
    }

    function handleFileMention(textBeforeCursor) {
        state.inputMode = 'file';
        const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
        const query = textBeforeCursor.substring(lastAtSymbol + 1);
        
        // Always request suggestions when @ is typed
        vscode.postMessage({
            command: 'getFileSuggestions',
            query: query || ''  // Send empty string to get all files if no query
        });
        
        // Show suggestions container
        fileSuggestionsContainer.style.display = 'block';
        updateCommandHint('Select a file from the suggestions');
    }

    function updateCommandHint(hint) {
        commandHint.textContent = hint;
        commandHint.style.display = hint ? 'block' : 'none';
    }

    function resetCommandState() {
        state.inputMode = 'normal';
        state.currentCommand = null;
        state.commandStep = 0;
        updateCommandHint('');
        hideSuggestions();
    }

    // Handle key commands
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        } else if (e.key === 'Enter' && e.shiftKey) {
            // Allow multiline input with Shift+Enter
            return;
        } else if (e.key === 'Tab' && state.showingSuggestions) {
            e.preventDefault();
            // Handle file suggestion completion
            const selected = fileSuggestionsContainer.querySelector('.selected');
            if (selected) {
                insertFileSuggestion(selected.textContent);
            }
        } else if (e.key === 'Escape') {
            resetCommandState();
        }
    });

    // Restore previous messages
    renderMessages();

    // Handle send button click
    sendButton.addEventListener('click', sendMessage);

    // Handle message from extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'response':
                removeTypingIndicator();
                addMessage('AI', message.text);
                resetCommandState();
                break;
            case 'fileSuggestions':
                showFileSuggestions(message.suggestions);
                break;
        }
    });
});

function showFileSuggestions(suggestions) {
    const container = document.getElementById('file-suggestions');
    container.innerHTML = '';
    
    if (suggestions.length === 0) {
        const div = document.createElement('div');
        div.className = 'file-suggestion';
        div.textContent = 'No matching files';
        container.appendChild(div);
    } else {
        suggestions.forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = 'file-suggestion' + (index === 0 ? ' selected' : '');
            div.textContent = suggestion;
            div.onclick = () => insertFileSuggestion(suggestion);
            container.appendChild(div);
        });
    }
    
    container.style.display = 'block';
    state.showingSuggestions = true;
}

function hideSuggestions() {
    const container = document.getElementById('file-suggestions');
    container.style.display = 'none';
    state.showingSuggestions = false;
}

function insertFileSuggestion(suggestion) {
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value;
    const cursorPosition = chatInput.selectionStart;
    const lastAtSymbol = text.lastIndexOf('@', cursorPosition);
    
    const newText = text.substring(0, lastAtSymbol) + '@' + suggestion + text.substring(cursorPosition);
    chatInput.value = newText;
    hideSuggestions();
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value.trim();
    
    if (text) {
        addMessage('User', text);
        showTypingIndicator();
        
        vscode.postMessage({
            command: 'ask',
            text: text,
            model: state.selectedModel
        });
        
        chatInput.value = '';
        chatInput.style.height = 'auto';
        hideSuggestions();
    }
}

function addMessage(sender, text) {
    const message = {
        sender,
        text,
        timestamp: new Date().toISOString()
    };
    
    state.messages.push(message);
    vscode.setState(state);
    renderMessage(message);
    scrollToBottom();
}

function renderMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    state.messages.forEach(renderMessage);
    scrollToBottom();
}

function renderMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender.toLowerCase()}`;
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = `${message.sender} • ${formatTime(message.timestamp)}`;
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = formatMessage(message.text);
    
    // Add apply buttons to code blocks
    content.querySelectorAll('.code-block').forEach(addApplyButton);
    
    messageElement.appendChild(header);
    messageElement.appendChild(content);
    messagesContainer.appendChild(messageElement);
}

function formatMessage(text) {
    // Convert code blocks with file information
    text = text.replace(/```(\w+)?\s*(?:\{file:\s*([^}]+)\})?\n([\s\S]*?)```/g, (_, lang, file, code) => {
        const fileAttr = file ? `data-file="${escapeHtml(file)}"` : '';
        const originalCode = code.trim();
        // Store the original unformatted code in a data attribute
        return `<div class="code-block" ${fileAttr}><pre><code class="language-${lang || ''}" data-original-code="${encodeURIComponent(originalCode)}">${escapeHtml(originalCode)}</code></pre></div>`;
    });
    
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert URLs to links
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        indicator.appendChild(dot);
    }
    
    messagesContainer.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Add apply buttons to code blocks
function addApplyButton(block) {
    const actions = document.createElement('div');
    actions.className = 'actions';
    
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => {
        // Get the original code from the data attribute and decode it
        const encodedCode = block.querySelector('code').getAttribute('data-original-code');
        const code = encodedCode ? decodeURIComponent(encodedCode) : block.querySelector('code').textContent;
        
        // Send the original unformatted code
        vscode.postMessage({
            command: 'applyCode',
            code: code,
            file: block.dataset.file
        });
    };
    
    actions.appendChild(applyBtn);
    block.appendChild(actions);
}
