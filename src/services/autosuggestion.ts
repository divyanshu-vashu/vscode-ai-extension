import * as vscode from 'vscode';
import { TabAutocompleteModel, TabAutocompleteModelConfig } from "../core/tabautosuggestion_model";

export class AutoSuggestionService {
  private model: TabAutocompleteModel;
  private disposables: vscode.Disposable[] = [];
  private debounceTimeout: NodeJS.Timeout | undefined;

  constructor() {
    const modelConfig: TabAutocompleteModelConfig = {
      title: "Qwen2.5-Coder 1.5B",
      provider: "ollama",
      model: "qwen2.5-coder:1.5b-base",
    };
    this.model = new TabAutocompleteModel(modelConfig);
  }

  public activate(context: vscode.ExtensionContext) {
    // Register the suggestion provider
    const provider = vscode.languages.registerInlineCompletionItemProvider(
      { pattern: '**' },
      {
        provideInlineCompletionItems: async (document, position, context, token) => {
          return this.provideSuggestions(document, position, context, token);
        }
      }
    );

    this.disposables.push(provider);
    context.subscriptions.push(...this.disposables);
  }

  private async provideSuggestions(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionList | null> {
    try {
      const currentLine = document.lineAt(position.line).text;
      const prefix = currentLine.substring(0, position.character);
      
      // Get the relevant context (previous N lines)
      const startLine = Math.max(0, position.line - 10);
      const contextRange = new vscode.Range(
        new vscode.Position(startLine, 0),
        position
      );
      const fileContent = document.getText(contextRange);

      const suggestion = await this.model.getSuggestion({
        prefix,
        currentLine,
        fileContent,
        language: document.languageId
      });

      if (!suggestion.response) {
        return null;
      }

      return {
        items: [
          {
            insertText: suggestion.response,
            range: new vscode.Range(position, position)
          }
        ]
      };
    } catch (error) {
      console.error('Error providing suggestions:', error);
      return null;
    }
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}

export function initializeAutoSuggestion(context: vscode.ExtensionContext): AutoSuggestionService {
    const service = new AutoSuggestionService();
    service.activate(context);
    return service;
}