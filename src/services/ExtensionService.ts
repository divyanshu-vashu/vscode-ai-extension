import * as vscode from 'vscode';
import { IExtensionService } from '../interfaces/IExtensionService';
import { ContextManager } from '../contextManager';
import { FileManager } from '../fileManager';
import { ChatWebviewProvider } from '../gui/ChatWebviewProvider';
import { AutoSuggestionService } from './autosuggestion';

export class ExtensionService implements IExtensionService {
    private readonly contextManager: ContextManager;
    private readonly fileManager: FileManager;
    private lastGeneratedContent: Map<string, string>;

    constructor() {
        this.contextManager = new ContextManager();
        this.fileManager = FileManager.getInstance();
        this.lastGeneratedContent = new Map<string, string>();
    }

    public registerCommands(context: vscode.ExtensionContext): void {
        // Register command to get last generated content
        context.subscriptions.push(
            vscode.commands.registerCommand('chatCursor.getLastGeneratedContent', 
                (fileName: string) => this.lastGeneratedContent.get(fileName)
            )
        );

        // Register sidebar command
        context.subscriptions.push(
            vscode.commands.registerCommand("chatCursor.showSidebar", 
                async () => this.showSidebar()
            )
        );
    }

    public registerWebviewProvider(context: vscode.ExtensionContext): void {
        try {
            const provider = new ChatWebviewProvider(
                context.extensionUri,
                this.contextManager,
                this.fileManager,
                this.storeGeneratedContent.bind(this)
            );

            context.subscriptions.push(
                vscode.window.registerWebviewViewProvider('aiChatView', provider)
            );
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to register webview provider: ${errorMessage}`);
        }
    }

    public registerFileListCommand(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('chat.showFileList', 
                async () => this.handleFileList()
            )
        );
    }

    public registerCodeApplyCommand(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('chat.applyCode',
                (code: string) => this.handleCodeApply(code)
            )
        );
    }

    public registerAutoSuggestionService(service: AutoSuggestionService): void {
        try {
            // The service is already activated in the initialization,
            // but we can add any additional integration here
            vscode.window.showInformationMessage('Code suggestion service activated');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            vscode.window.showErrorMessage(`Failed to register auto-suggestion service: ${errorMessage}`);
        }
    }

    private async showSidebar(): Promise<void> {
        await vscode.commands.executeCommand('workbench.view.extension.ai-chat');
    }

    private storeGeneratedContent(fileName: string, content: string): void {
        this.lastGeneratedContent.set(fileName, content);
    }

    private async handleFileList(): Promise<string | undefined> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
        const fileItems = files.map(file => ({
            label: vscode.workspace.asRelativePath(file),
            description: file.fsPath
        }));

        const selected = await vscode.window.showQuickPick(fileItems, {
            placeHolder: 'Select a file to reference'
        });

        return selected?.label;
    }

    private handleCodeApply(code: string): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                const position = editor.selection.active;
                editBuilder.insert(position, code);
            });
        }
    }
}