import * as vscode from 'vscode';
import { OpenAIProvider } from './openaiProvider';
import { getModelConfig } from '../config/aiConfig';

export class EmbeddingProvider {
    private aiProvider: OpenAIProvider;

    constructor() {
        const config = getModelConfig('gemini');
        this.aiProvider = new OpenAIProvider({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            modelName: config.modelName
        });
    }

    /**
     * Analyzes and merges old code with new generated code
     */
    public async mergeCode(oldCode: string, newCode: string): Promise<string> {
        try {
            const response = await this.aiProvider.generateCompletion(
                this.constructPrompt(oldCode, newCode),
                undefined,
                undefined,
                this.getSystemPrompt()
            );

            if (!response || response.length === 0) {
                throw new Error('No response received from AI provider');
            }

            // Extract the code from the response with proper type checking
            const mergedCode = response[0].type === 'code' ? 
                response[0].code || '' : 
                response[0].content || '';

            if (!mergedCode) {
                throw new Error('Empty response received from AI provider');
            }

            return mergedCode;

        } catch (error) {
            console.error('Error in mergeCode:', error);
            throw new Error(`Failed to merge code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Applies merged code to the current active editor
     */
    public async applyMergedCode(mergedCode: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No active editor found');
        }

        try {
            await editor.edit(editBuilder => {
                // Replace the entire content of the file
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(editor.document.getText().length)
                );
                editBuilder.replace(fullRange, mergedCode);
            });
        } catch (error) {
            console.error('Error applying merged code:', error);
            throw new Error(`Failed to apply merged code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Main method to handle the apply button click
     */
    public async handleApplyButton(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                throw new Error('No active editor found');
            }

            // Get old code (current file content)
            const oldCode = editor.document.getText();

            // Get new code (from selection or clipboard)
            const newCode = editor.selection.isEmpty ? 
                await vscode.env.clipboard.readText() : 
                editor.document.getText(editor.selection);

            if (!newCode) {
                throw new Error('No new code found in selection or clipboard');
            }

            // Merge the codes
            const mergedCode = await this.mergeCode(oldCode, newCode);

            // Apply the merged code
            await this.applyMergedCode(mergedCode);

            // Show success message
            vscode.window.showInformationMessage('Code successfully merged and applied!');

        } catch (error) {
            console.error('Error in handleApplyButton:', error);
            vscode.window.showErrorMessage(`Failed to apply code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private getSystemPrompt(): string {
        return `You are a coder tasked with comparing and merging old code with new corrected code.
               Follow these rules:
               1. Analyze both old and new code carefully
               2. The new code might be a complete file or just a portion
               3. Merge the codes while preserving the original structure
               4. Return only the merged code without any explanations or summaries`;
    }

    private constructPrompt(oldCode: string, newCode: string): string {
        return `Compare and merge these code versions:

               OLD CODE:
               ${oldCode}

               NEW CODE:
               ${newCode}

               Please merge these codes following best practices and return only the merged code.`;
    }
}