import * as vscode from 'vscode';
import { ContextManager } from '../contextManager';
import { FileManager } from '../fileManager';
import { AutoSuggestionService } from '../services/autosuggestion';

export interface IExtensionService {
    registerCommands(context: vscode.ExtensionContext): void;
    registerWebviewProvider(context: vscode.ExtensionContext): void;
    registerFileListCommand(context: vscode.ExtensionContext): void;
    registerCodeApplyCommand(context: vscode.ExtensionContext): void;
    registerAutoSuggestionService(service: AutoSuggestionService): void;
}