import * as vscode from 'vscode';
import { FileManager } from '../fileManager';
import { ContextManager } from '../contextManager';

export class CommandHandler {
    private lastGeneratedContent = new Map<string, string>();

    constructor(
        private readonly contextManager: ContextManager,
        private readonly fileManager: FileManager
    ) {}

    registerCommands(context: vscode.ExtensionContext) {
        // Register command to get last generated content
        context.subscriptions.push(
            vscode.commands.registerCommand('chatCursor.getLastGeneratedContent', (fileName: string) => {
                return this.lastGeneratedContent.get(fileName);
            })
        );

        // Register command to show sidebar
        context.subscriptions.push(
            vscode.commands.registerCommand('chatCursor.showSidebar', async () => {
                await vscode.commands.executeCommand('workbench.view.extension.ai-chat');
            })
        );

        // Register command to show file list
        context.subscriptions.push(
            vscode.commands.registerCommand('chat.showFileList', this.handleShowFileList)
        );

        // Register command to apply code
        context.subscriptions.push(
            vscode.commands.registerCommand('chat.applyCode', this.handleApplyCode)
        );
    }

    storeGeneratedContent(fileName: string, content: string) {
        this.lastGeneratedContent.set(fileName, content);
    }

    private async handleShowFileList() {
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

        if (selected) {
            return selected.label;
        }
    }

    private handleApplyCode(code: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                const position = editor.selection.active;
                editBuilder.insert(position, code);
            });
        }
    }
}