import * as vscode from 'vscode';
import * as fs from 'fs';
import { OpenAIProvider, ResponseBlock } from '../core/openaiProvider';
import { getModelConfig } from '../config/aiConfig';
import { ContextManager } from '../contextManager';
import { FileManager } from '../fileManager';
import { EmbeddingProvider } from '../core/embedingProvider';

export class ChatWebviewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private aiProvider: OpenAIProvider;
  private embeddingProvider: EmbeddingProvider;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly contextManager: ContextManager,
    private readonly fileManager: FileManager,
    private readonly storeContent: (fileName: string, content: string) => void
  ) {
    // Initialize providers
    const config = getModelConfig('gemini');
    this.aiProvider = new OpenAIProvider({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      modelName: config.modelName
    });
    this.embeddingProvider = new EmbeddingProvider();
  }

  async resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken
    ) {
      this._view = webviewView;
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [this.extensionUri]
      };
  
      webviewView.webview.html = await this.getHtmlForWebview(webviewView.webview);
      this.setMessageListener(webviewView.webview);
    }

  private async setMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (data) => {
      try {

        switch (data.command) {
          case 'sendMessage':
            let newdata = data.text;
            
            // Handle file references starting with @
            if (data.text.includes('@')) {
              try {
                const matches = data.text.match(/@([^\s]+)/g);
                if (matches) {
                  const fileReferences = await Promise.all(matches.map(async (match:string) => {
                    const fileName = match.substring(1); // Remove @ symbol
                    try {
                      const fileUri = vscode.Uri.file(
                        vscode.workspace.workspaceFolders?.[0].uri.fsPath + '/' + fileName
                      );
                      const fileContent = await vscode.workspace.fs.readFile(fileUri);
                      return {
                        fileName,
                        content: Buffer.from(fileContent).toString('utf-8')
                      };
                    } catch (error) {
                      console.error(`Error reading file ${fileName}:`, error);
                      return null;
                    }
                  }));

                  // Filter out failed file reads and construct context
                  const validReferences = fileReferences.filter(ref => ref !== null);
                  if (validReferences.length > 0) {
                    const fileContexts = validReferences.map(ref => 
                      `File ${ref?.fileName}:\n${ref?.content}`
                    ).join('\n\n');
                    
                    newdata = `Context:\n${fileContexts}\n\nUser Query: ${data.text}`;
                  }
                }
              } catch (error) {
                console.error('Error processing file references:', error);
              }
            }

            const response = await this.aiProvider.generateCompletion(
              newdata,
              undefined,
              undefined,
              'You are a helpful AI coding assistant.'
            );
            
            // Process and send each response block
            for (const block of response) {
              webview.postMessage({
                command: 'receiveMessage',
                text: block.type === 'code' ? block.code : block.content,
                isCode: block.type === 'code',
                language: block.type === 'code' ? block.language : undefined
              });
            }
            break;

          case 'applyCode':
            try {
              const editor = vscode.window.activeTextEditor;
              if (editor) {
                // Instead of direct insertion, use EmbeddingProvider for merging
                const oldCode = editor.document.getText();
                const newCode = data.code;

                // Use embeddingProvider to merge the code
                const mergedCode = await this.embeddingProvider.mergeCode(oldCode, newCode);
                
                // Apply the merged code using the provider
                await this.embeddingProvider.applyMergedCode(mergedCode);

                // Show success message
                vscode.window.showInformationMessage('Code successfully merged and applied!');
              } else {
                vscode.window.showErrorMessage('No active editor found');
              }
            } catch (error) {
              console.error('Error applying code:', error);
              vscode.window.showErrorMessage(`Failed to apply code: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            break;

          case 'showFileList':
            const files = await this.getWorkspaceFiles();
            webview.postMessage({
              command: 'showFileList',
              files
            });
            break;
          
          case 'getFileSuggestions':
            const query = (data.query || '').toLowerCase();
            const allFiles = await this.getWorkspaceFiles();
            const filteredFiles = allFiles
              .filter(file => {
                const fileName = file.toLowerCase();
                return fileName.includes(query) || 
                       fileName.split('/').pop()?.includes(query);
              })
              .sort((a, b) => {
                // Prioritize files that start with the query
                const aStart = a.toLowerCase().startsWith(query);
                const bStart = b.toLowerCase().startsWith(query);
                if (aStart && !bStart) return -1;
                if (!aStart && bStart) return 1;
                return a.localeCompare(b);
              })
              .slice(0, 10); // Limit to 10 suggestions

            webview.postMessage({
              command: 'fileSuggestions',
              files: filteredFiles,
              query: query
            });
            break;
        }
      } catch (error) {
        console.error('Error in message listener:', error);
        webview.postMessage({
          command: 'receiveMessage',
          text: 'An error occurred while processing your request.',
          isCode: false
        });
      }
    });
}

private async getWorkspaceFiles(): Promise<string[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }
    
    try {
      const files = await vscode.workspace.findFiles(
        '**/*',
        '**/node_modules/**'
      );
      return files
        .map(file => vscode.workspace.asRelativePath(file))
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      console.error('Error getting workspace files:', error);
      return [];
    }
}

  // Change the method signature to async
  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'frontend', 'chat', 'main', 'chat_main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'frontend', 'chat', 'main', 'chat_main.css')
    );

    try {
      const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'frontend', 'chat', 'main', 'chat_main.html');
      console.log('Extension URI:', this.extensionUri.fsPath);
      console.log('HTML Path:', htmlPath.fsPath);
      
      try {
        const content = await vscode.workspace.fs.readFile(htmlPath);
        const htmlString = Buffer.from(content).toString('utf-8');
        return htmlString
          .replace('${scriptUri}', scriptUri.toString())
          .replace('${styleUri}', styleUri.toString());
      } catch (fsError) {
        console.error('VS Code fs error:', fsError);
        throw fsError;
      }
    } catch (error) {
      console.error('Template loading error:', error);
      // Use the existing HTML file as fallback
      const fallbackHtmlPath = vscode.Uri.joinPath(this.extensionUri, 'frontend', 'chat', 'main', 'chat_main.html');
      try {
        const content = await vscode.workspace.fs.readFile(fallbackHtmlPath);
        const htmlString = Buffer.from(content).toString('utf-8');
        return htmlString
          .replace('${scriptUri}', scriptUri.toString())
          .replace('${styleUri}', styleUri.toString());
      } catch (fallbackError) {
        console.error('Critical error: Could not load fallback HTML:', fallbackError);
        throw fallbackError;
      }
    }
  }
}