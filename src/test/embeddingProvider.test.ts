import * as assert from 'assert';
import * as vscode from 'vscode';
import { EmbeddingProvider } from '../core/embedingProvider';
import { before, describe, it } from 'mocha';

suite('EmbeddingProvider Test Suite', function() {
    let embeddingProvider: EmbeddingProvider;
    let testDocument: vscode.TextDocument;
    let testEditor: vscode.TextEditor;

    before(async () => {
        embeddingProvider = new EmbeddingProvider();
        
        // Create a test document
        testDocument = await vscode.workspace.openTextDocument({
            content: 'function test() {\n    return "old code";\n}',
            language: 'typescript'
        });
        
        testEditor = await vscode.window.showTextDocument(testDocument);
    });

    // Increase timeout for all tests
    this.timeout(10000);

    test('mergeCode should successfully merge old and new code', async () => {
        const oldCode = 'function test() {\n    return "old code";\n}';
        const newCode = 'function test() {\n    return "new code";\n}';

        try {
            const mergedCode = await embeddingProvider.mergeCode(oldCode, newCode);
            assert.ok(mergedCode, 'Merged code should not be empty');
            assert.ok(mergedCode.includes('function test'), 'Merged code should contain function definition');
        } catch (error) {
            assert.fail(`mergeCode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    test('applyMergedCode should update editor content', async () => {
        const mergedCode = 'function test() {\n    return "merged code";\n}';

        try {
            await embeddingProvider.applyMergedCode(mergedCode);
            // Wait for the editor to update
            await new Promise(resolve => setTimeout(resolve, 100));
            const editorContent = testEditor.document.getText();
            assert.strictEqual(editorContent, mergedCode, 'Editor content should match merged code');
        } catch (error) {
            assert.fail(`applyMergedCode failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    test('handleApplyButton should process clipboard content when no selection', async () => {
        // Set up clipboard content
        const clipboardContent = 'function test() {\n    return "clipboard code";\n}';
        await vscode.env.clipboard.writeText(clipboardContent);

        try {
            // Clear selection
            testEditor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
            
            await embeddingProvider.handleApplyButton();
            // Wait for the editor to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const editorContent = testEditor.document.getText();
            assert.ok(editorContent.length > 0, 'Editor should have content after apply');
            assert.ok(editorContent.includes('function'), 'Applied content should contain function');
        } catch (error) {
            assert.fail(`handleApplyButton failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    test('handleApplyButton should process selected content', async () => {
        // Set up a selection in the editor
        const selectedText = 'function test() {\n    return "selected code";\n}';
        
        try {
            await testEditor.edit(editBuilder => {
                const fullRange = new vscode.Range(
                    new vscode.Position(0, 0),
                    testEditor.document.lineAt(testEditor.document.lineCount - 1).range.end
                );
                editBuilder.replace(fullRange, selectedText);
            });

            // Wait for the editor to update
            await new Promise(resolve => setTimeout(resolve, 100));

            // Select all text
            testEditor.selection = new vscode.Selection(
                new vscode.Position(0, 0),
                new vscode.Position(testEditor.document.lineCount - 1, 0)
            );

            await embeddingProvider.handleApplyButton();
            // Wait for the editor to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const editorContent = testEditor.document.getText();
            assert.ok(editorContent.length > 0, 'Editor should have content after apply');
            assert.ok(editorContent.includes('function'), 'Applied content should contain function');
        } catch (error) {
            assert.fail(`handleApplyButton failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}); 