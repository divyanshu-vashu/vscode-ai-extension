import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class FileManager {
    private static instance: FileManager;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private workspaceRoot: string | undefined;
    private readonly maxFileSize = 50 * 1024 * 1024; // 50MB limit
    private readonly forbiddenChars = /[<>:"|?*]/g;

    private constructor() {
        this.setupWorkspace();
    }

    static getInstance(): FileManager {
        if (!FileManager.instance) {
            FileManager.instance = new FileManager();
        }
        return FileManager.instance;
    }

    getWorkspaceRoot(): string {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder is open');
        }
        return this.workspaceRoot;
    }

    private setupWorkspace() {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            this.workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            this.setupFileWatcher();
        }
    }

    private setupFileWatcher() {
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        this.fileWatcher.onDidCreate((uri) => {
            vscode.window.showInformationMessage(`File created: ${path.basename(uri.fsPath)}`);
        });

        this.fileWatcher.onDidChange((uri) => {
            vscode.window.showInformationMessage(`File changed: ${path.basename(uri.fsPath)}`);
        });

        this.fileWatcher.onDidDelete((uri) => {
            vscode.window.showInformationMessage(`File deleted: ${path.basename(uri.fsPath)}`);
        });
    }

    private validatePath(filePath: string): string {
        if (!filePath) {
            throw new Error('File path cannot be empty');
        }

        // Remove any forbidden characters
        const sanitizedPath = filePath.replace(this.forbiddenChars, '_');
        
        // Ensure the path doesn't try to escape workspace
        const normalizedPath = path.normalize(sanitizedPath).replace(/^(\.\.(\/|\\|$))+/, '');
        
        return normalizedPath;
    }

    private async validateFileOperation(fullPath: string, content?: string): Promise<void> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder is open');
        }

        // Check if path is within workspace
        const relativePath = path.relative(this.workspaceRoot, fullPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            throw new Error('File operation not allowed outside workspace');
        }

        // Check content size if provided
        if (content && Buffer.byteLength(content, 'utf8') > this.maxFileSize) {
            throw new Error('File content exceeds maximum size limit');
        }

        // Check for system files
        const isSystemFile = /^(\.git|\.vscode|node_modules)/.test(relativePath);
        if (isSystemFile) {
            throw new Error('Operation not allowed on system files');
        }
    }

    private getCodeContent(content: any): string {
        console.log('=== Debug getCodeContent ===');
        console.log('Content type:', typeof content);
        console.log('Content:', content);

        // If content is a code block object from Gemini
        if (content && typeof content === 'object') {
            if (content.code) {
                return content.code;
            }
            if (content.content) {
                return content.content;
            }
        }

        // If content is a string but looks like a code block, extract the code
        if (typeof content === 'string' && content.includes('```')) {
            const matches = content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
            if (matches && matches[1]) {
                return matches[1].trim();
            }
        }

        // If it's a plain string with escaped newlines, unescape them
        if (typeof content === 'string' && content.includes('\\n')) {
            try {
                return JSON.parse(`"${content.replace(/"/g, '\\"')}"`);
            } catch (e) {
                console.warn('Failed to unescape content:', e);
            }
        }

        // Return as is
        return String(content);
    }

    private resolveFilePath(filePath: string): string {
        // If the path doesn't have an extension and we're not explicitly creating a new file,
        // try to find an existing file with that name
        if (!path.extname(filePath)) {
            const possibleExtensions = ['.go', '.js', '.ts', '.cpp', '.py', '.java'];
            for (const ext of possibleExtensions) {
                const fullPath = path.join(this.workspaceRoot!, `${filePath}${ext}`);
                if (fs.existsSync(fullPath)) {
                    return `${filePath}${ext}`;
                }
            }
        }
        return filePath;
    }

    async createFile(filePath: string, content: any): Promise<void> {
        try {
            console.log('=== Debug createFile input ===');
            console.log('Original file path:', filePath);
            console.log('Content type:', typeof content);

            // Resolve the correct file path
            const resolvedPath = this.resolveFilePath(filePath);
            console.log('Resolved file path:', resolvedPath);

            const sanitizedPath = this.validatePath(resolvedPath);
            const fullPath = path.join(this.workspaceRoot!, sanitizedPath);
            
            await this.validateFileOperation(fullPath, content);

            const directory = path.dirname(fullPath);
            await fs.promises.mkdir(directory, { recursive: true });

            // Get the actual code content with proper formatting
            const codeContent = this.getCodeContent(content);
            
            // Only normalize line endings
            const processedContent = codeContent.replace(/\r\n|\r|\n/g, process.platform === 'win32' ? '\r\n' : '\n');
            
            console.log('=== Debug final content ===');
            console.log('Final content:', processedContent);
            console.log('Line count:', processedContent.split('\n').length);

            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(fullPath),
                Buffer.from(processedContent, 'utf8')
            );

            // Open the file in editor
            const document = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(document);

            return;
        } catch (error) {
            console.error('Create file error:', error);
            throw new Error(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async updateFile(filePath: string, content: any): Promise<void> {
        try {
            console.log('=== Debug updateFile input ===');
            console.log('Original file path:', filePath);
            console.log('Content type:', typeof content);

            // Resolve the correct file path
            const resolvedPath = this.resolveFilePath(filePath);
            console.log('Resolved file path:', resolvedPath);

            const sanitizedPath = this.validatePath(resolvedPath);
            const fullPath = path.join(this.workspaceRoot!, sanitizedPath);
            
            await this.validateFileOperation(fullPath, content);

            // Create file if it doesn't exist
            if (!fs.existsSync(fullPath)) {
                await this.createFile(filePath, content);
                return;
            }

            // Check if file is writable
            try {
                await fs.promises.access(fullPath, fs.constants.W_OK);
            } catch {
                throw new Error('File is not writable');
            }

            // Create backup
            const backupPath = `${fullPath}.bak`;
            await fs.promises.copyFile(fullPath, backupPath);

            try {
                // Get the actual code content with proper formatting
                const codeContent = this.getCodeContent(content);
                
                // Only normalize line endings
                const processedContent = codeContent.replace(/\r\n|\r|\n/g, process.platform === 'win32' ? '\r\n' : '\n');
                
                console.log('=== Debug final content ===');
                console.log('Final content:', processedContent);
                console.log('Line count:', processedContent.split('\n').length);

                await vscode.workspace.fs.writeFile(
                    vscode.Uri.file(fullPath),
                    Buffer.from(processedContent, 'utf8')
                );
                // Remove backup on success
                await fs.promises.unlink(backupPath);
            } catch (error) {
                // Restore from backup if update fails
                await fs.promises.copyFile(backupPath, fullPath);
                await fs.promises.unlink(backupPath);
                throw error;
            }

            // Show the updated file
            const document = await vscode.workspace.openTextDocument(fullPath);
            await vscode.window.showTextDocument(document);

            return;
        } catch (error) {
            console.error('Update file error:', error);
            throw new Error(`Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        try {
            const sanitizedPath = this.validatePath(filePath);
            const fullPath = path.join(this.workspaceRoot!, sanitizedPath);
            
            await this.validateFileOperation(fullPath);

            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                throw new Error('File does not exist');
            }

            // Check if file is writable
            try {
                await fs.promises.access(fullPath, fs.constants.W_OK);
            } catch {
                throw new Error('File is not writable');
            }

            // Create backup before deletion
            const backupPath = `${fullPath}.bak`;
            await fs.promises.copyFile(fullPath, backupPath);

            try {
                // Delete file
                await fs.promises.unlink(fullPath);
            } catch (error) {
                // Restore from backup if deletion fails
                await fs.promises.copyFile(backupPath, fullPath);
                throw error;
            }

            // Remove backup on successful deletion
            await fs.promises.unlink(backupPath);
            return;
        } catch (error) {
            throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async getFileSuggestions(query: string): Promise<string[]> {
        try {
            if (!this.workspaceRoot) {
                return [];
            }

            const files = await this.getAllFiles(this.workspaceRoot);
            
            // If query is empty or just @, return all files
            if (!query || query === '@') {
                return files.slice(0, 10); // Limit to 10 files
            }

            // Filter and sort files
            return files
                .filter(file => {
                    const fileName = path.basename(file).toLowerCase();
                    const queryLower = query.toLowerCase();
                    return fileName.includes(queryLower) || file.toLowerCase().includes(queryLower);
                })
                .sort((a, b) => {
                    const aName = path.basename(a).toLowerCase();
                    const bName = path.basename(b).toLowerCase();
                    const queryLower = query.toLowerCase();
                    
                    // Exact matches first
                    if (aName === queryLower) return -1;
                    if (bName === queryLower) return 1;
                    
                    // Then matches at start of filename
                    if (aName.startsWith(queryLower)) return -1;
                    if (bName.startsWith(queryLower)) return 1;
                    
                    // Then matches in path
                    if (a.toLowerCase().includes(queryLower)) return -1;
                    if (b.toLowerCase().includes(queryLower)) return 1;
                    
                    return a.localeCompare(b);
                })
                .slice(0, 10); // Limit to 10 suggestions
        } catch (error) {
            console.error('Error getting file suggestions:', error);
            return [];
        }
    }

    private async getAllFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(this.workspaceRoot!, fullPath);

            // Skip hidden files and specified directories
            if (entry.name.startsWith('.') || 
                entry.name === 'node_modules' || 
                entry.name === 'dist' || 
                entry.name === 'build') {
                continue;
            }

            if (entry.isDirectory()) {
                files.push(...await this.getAllFiles(fullPath));
            } else {
                files.push(relativePath);
            }
        }

        return files;
    }

    async applyCodeBlock(code: string, filePath?: string): Promise<void> {
        try {
            if (!code.trim()) {
                throw new Error('Code content cannot be empty');
            }

            if (!filePath) {
                // Create a new file if no file is specified
                const extension = this.detectFileExtension(code);
                const fileName = `generated_${Date.now()}${extension}`;
                await this.createFile(fileName, code);
                return;
            }

            // Update existing file
            await this.updateFile(filePath, code);
        } catch (error) {
            throw new Error(`Failed to apply code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private detectFileExtension(code: string): string {
        // Simple language detection based on code content
        if (code.includes('function') || code.includes('const') || code.includes('let')) {
            return '.js';
        }
        if (code.includes('interface') || code.includes('type ') || code.includes('namespace')) {
            return '.ts';
        }
        if (code.includes('class') && code.includes('public')) {
            return '.java';
        }
        if (code.includes('#include')) {
            return '.cpp';
        }
        return '.txt';
    }
}
