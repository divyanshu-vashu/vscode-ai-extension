import * as vscode from "vscode";
import { ExtensionService } from './services/ExtensionService';

// Add this to your existing imports
import { initializeAutoSuggestion } from './services/autosuggestion';

export function activate(context: vscode.ExtensionContext) {
    const extensionService = new ExtensionService();

    // Register all extension functionalities
    extensionService.registerCommands(context);
    extensionService.registerWebviewProvider(context);
    extensionService.registerFileListCommand(context);
    extensionService.registerCodeApplyCommand(context);
    
    // Add this line to your existing activate function
    const autoSuggestionService = initializeAutoSuggestion(context);
    
    // Add this line to your existing activate function
    extensionService.registerAutoSuggestionService(autoSuggestionService);
}

export function deactivate() {
    console.log("Chat Cursor extension is deactivated.");
}