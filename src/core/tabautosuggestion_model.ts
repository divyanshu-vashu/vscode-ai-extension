import * as vscode from 'vscode';

export interface TabAutocompleteModelConfig {
  title: string;
  provider: string;
  model: string;
  apiBase?: string;
}

export interface SuggestionResponse {
  response: string;
  metadata?: {
    language?: string;
    confidence?: number;
  };
}

// Add interface for Ollama API response
interface OllamaResponse {
  response: string;
  confidence?: number;
  model: string;
  created_at: string;
}

export class TabAutocompleteModel {
  private config: TabAutocompleteModelConfig;
  private apiBase: string;

  constructor(config: TabAutocompleteModelConfig) {
    this.config = config;
    this.apiBase = config.apiBase || "http://localhost:11434/api";
  }

  public async getSuggestion(context: {
    prefix: string,
    currentLine: string,
    fileContent: string,
    language: string
  }): Promise<SuggestionResponse> {
    const prompt = this.generatePrompt(context);

    try {
      const response = await fetch(`${this.apiBase}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.95,
            max_tokens: 100
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as OllamaResponse;
      return {
        response: data.response,
        metadata: {
          language: context.language,
          confidence: data.confidence || 1.0
        }
      };
    } catch (error) {
      console.error("Ollama API error:", error);
      throw error;
    }
  }

  private generatePrompt(context: {
    prefix: string,
    currentLine: string,
    fileContent: string,
    language: string
  }): string {
    return `Complete the following code in ${context.language}:
Current line: ${context.currentLine}
Previous context:
${context.fileContent}
Completion for: ${context.prefix}`;
  }
}