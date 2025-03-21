import * as assert from 'assert';
import * as vscode from 'vscode';
import { EmbeddingProvider } from '../core/embedingProvider';
import { before, after, describe, it } from 'mocha';
import * as path from 'path';
import * as fs from 'fs';

suite('Python Apply Test Suite', function() {
    let embeddingProvider: EmbeddingProvider;
    let testDocument: vscode.TextDocument;
    let testEditor: vscode.TextEditor;
    let testFilePath: string;

    before(async () => {
        embeddingProvider = new EmbeddingProvider();
        
        // Create a temporary test file
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        testFilePath = path.join(tempDir, 'test.py');
        const initialContent = `class Calculator:
    def __init__(self):
        self.result = 0

    def add(self, number):
        self.result += number
        return self

    def subtract(self, number):
        self.result -= number
        return self

    def reset(self):
        self.result = 0
        return self

    def get_result(self):
        return self.result
`;
        
        fs.writeFileSync(testFilePath, initialContent);
        
        // Open the test file
        testDocument = await vscode.workspace.openTextDocument(testFilePath);
        testEditor = await vscode.window.showTextDocument(testDocument);
    });

    after(() => {
        // Clean up the temporary file
        if (fs.existsSync(testFilePath)) {
            fs.unlinkSync(testFilePath);
        }
    });

    // Increase timeout for all tests
    this.timeout(10000);

    test('should apply square function to Calculator class', async () => {
        // The new code to be added (square function)
        const newCode = `
    def square(self, number):
        """
        Square the given number and add it to the result
        """
        squared = number * number
        self.result += squared
        return self`;

        try {
            // Position where we want to add the new function (after the last method)
            const lastLine = testDocument.lineCount;
            const position = new vscode.Position(lastLine - 1, 0);
            
            // Create a selection at the insertion point
            testEditor.selection = new vscode.Selection(position, position);
            
            // Set the clipboard content
            await vscode.env.clipboard.writeText(newCode);

            // Apply the changes
            await embeddingProvider.handleApplyButton();
            
            // Wait for the editor to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get the updated content
            const editorContent = testEditor.document.getText();
            
            // Verify the changes
            assert.ok(editorContent.includes('def square(self, number):'), 'Square function should be added');
            assert.ok(editorContent.includes('squared = number * number'), 'Square calculation should be present');
            assert.ok(editorContent.includes('self.result += squared'), 'Result update should be present');
            
            // Verify the class structure is maintained
            assert.ok(editorContent.includes('class Calculator:'), 'Class definition should be preserved');
            assert.ok(editorContent.includes('def add(self, number):'), 'Existing add method should be preserved');
            assert.ok(editorContent.includes('def subtract(self, number):'), 'Existing subtract method should be preserved');
            
            // Verify indentation
            const squareLineIndex = editorContent.split('\n').findIndex(line => line.includes('def square'));
            assert.ok(squareLineIndex > 0, 'Square function should be found in the content');
            const squareLine = editorContent.split('\n')[squareLineIndex];
            assert.ok(squareLine.startsWith('    '), 'Square function should have correct indentation');
            
        } catch (error) {
            assert.fail(`Failed to apply square function: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });

    test('should verify square function works with Calculator class structure', async () => {
        try {
            const editorContent = testEditor.document.getText();
            
            // Verify the complete class structure
            const expectedClassStructure = [
                'class Calculator:',
                'def __init__(self):',
                'def add(self, number):',
                'def subtract(self, number):',
                'def reset(self):',
                'def get_result(self):',
                'def square(self, number):'
            ];
            
            expectedClassStructure.forEach(line => {
                assert.ok(
                    editorContent.includes(line), 
                    `Class should contain ${line}`
                );
            });
            
            // Verify method ordering and structure
            const lines = editorContent.split('\n');
            const methodIndices = expectedClassStructure.map(method => 
                lines.findIndex(line => line.trim().startsWith(method))
            );
            
            // Verify methods are in correct order
            for (let i = 0; i < methodIndices.length - 1; i++) {
                assert.ok(
                    methodIndices[i] < methodIndices[i + 1],
                    `Methods should be in correct order: ${expectedClassStructure[i]} should come before ${expectedClassStructure[i + 1]}`
                );
            }
            
        } catch (error) {
            assert.fail(`Failed to verify class structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    });
}); 