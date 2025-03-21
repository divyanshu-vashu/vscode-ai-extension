import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class ContextManager {
    private workspaceFiles: string[] = [];

    async loadWorkspaceFiles() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace folder found.");
            return;
        }

        const folderPath = workspaceFolders[0].uri.fsPath;

        try {
            this.workspaceFiles = this.getAllFiles(folderPath);
        } catch (error) {
            vscode.window.showErrorMessage(`Error reading workspace: ${error}`);
        }
    }

    private getAllFiles(dir: string, fileList: string[] = []): string[] {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                this.getAllFiles(fullPath, fileList);
            } else {
                fileList.push(fullPath);
            }
        }
        return fileList;
    }

    getFiles(): string[] {
        return this.workspaceFiles;
    }
}
