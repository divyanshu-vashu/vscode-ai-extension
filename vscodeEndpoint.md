vscode.workspace.applyEdit(edit: WorkspaceEdit): Applies a set of text edits across one or more files in the workspace.
vscode.workspace.openTextDocument(uri: Uri): Opens a text document from the given URI for reading and editing.
vscode.window.showTextDocument(document: TextDocument): Displays an opened text document in an editor pane.
vscode.commands.executeCommand(command: string, ...args: any[]): Executes a registered VS Code command by its identifier.
vscode.workspace.getConfiguration(section?: string, scope?: Uri): Retrieves configuration settings for a specific section or scope.
vscode.window.createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): Creates a status bar item for displaying custom UI information.
vscode.workspace.findFiles(include: GlobPattern, exclude?: GlobPattern, maxResults?: number): Searches for files in the workspace that match the given glob patterns.
vscode.window.registerWebviewViewProvider(viewId: string, provider: WebviewViewProvider, options?: WebviewViewOptions): Registers a provider that supplies content for custom webviews.
vscode.window.showInformationMessage(message: string, ...items: string[]): Shows an informational popup message with optional action buttons.
vscode.window.showErrorMessage(message: string, ...items: string[]): Displays an error message to alert the user of issues.
vscode.window.showQuickPick(items: string[] | Thenable<string[]>, options?: QuickPickOptions): Presents a dropdown list for the user to select from multiple options.
vscode.window.showInputBox(options?: InputBoxOptions): Prompts the user with an input box to enter text.
vscode.workspace.updateWorkspaceFolders(start: number, deleteCount?: number, ...workspaceFolders: WorkspaceFolder[]): Adds or removes workspace folders from the current VS Code session.
vscode.Uri.file(path: string): Creates a VS Code URI from a local file system path.
These endpoints form the backbone of many VS Code extensions, enabling file manipulation, UI updates, configuration management, and more.

- **vscode.workspace.onDidChangeTextDocument(listener: (e: TextDocumentChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: Registers an event listener that is triggered whenever a text document is changed.

- **vscode.workspace.onDidOpenTextDocument(listener: (document: TextDocument) => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: Registers an event listener that is triggered when a text document is opened.

- **vscode.workspace.onDidCloseTextDocument(listener: (document: TextDocument) => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: Registers an event listener that is triggered when a text document is closed.

- **vscode.workspace.onDidSaveTextDocument(listener: (document: TextDocument) => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: Registers an event listener that is triggered when a text document is saved.

- **vscode.window.createOutputChannel(name: string): OutputChannel**: Creates a new output channel with the given name for displaying output.

- **vscode.window.createQuickPick<T extends QuickPickItem>(): QuickPick<T>**: Creates a QuickPick to let the user pick an item from a list of items.

- **vscode.window.createInputBox(): InputBox**: Creates an InputBox to let the user enter some text input.

- **vscode.window.createWebviewPanel(viewType: string, title: string, showOptions: ViewColumn | { viewColumn: ViewColumn, preserveFocus?: boolean }, options?: WebviewPanelOptions & WebviewOptions): WebviewPanel**: Creates and shows a new webview panel.

- **vscode.env.openExternal(target: Uri): Thenable<boolean>**: Opens a URI with the system's default application.

- **vscode.env.clipboard.readText(): Thenable<string>**: Reads the current clipboard contents as text.

- **vscode.env.clipboard.writeText(value: string): Thenable<void>**: Writes text to the system clipboard.

- **vscode.extensions.getExtension(extensionId: string): Extension<any> | undefined**: Returns an extension with the given identifier.

- **vscode.extensions.onDidChange(listener: () => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: An event which fires when extensions are added or removed.

- **vscode.debug.startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration, parentSessionOrOptions?: DebugSession | DebugSessionOptions): Thenable<boolean>**: Starts a debugging session.

- **vscode.debug.registerDebugAdapterDescriptorFactory(debugType: string, factory: DebugAdapterDescriptorFactory): Disposable**: Registers a debug adapter descriptor factory for a specific debug type.

- **vscode.debug.registerDebugConfigurationProvider(debugType: string, provider: DebugConfigurationProvider, triggerKind?: DebugConfigurationProviderTriggerKind): Disposable**: Registers a debug configuration provider for a specific debug type.

- **vscode.languages.registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, ...triggerCharacters: string[]): Disposable**: Registers a completion item provider.

- **vscode.languages.registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable**: Registers a definition provider.

- **vscode.languages.registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable**: Registers a hover provider.

- **vscode.tasks.registerTaskProvider(type: string, provider: TaskProvider): Disposable**: Registers a task provider.

- **vscode.commands.registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable**: Registers a command that can be invoked via a keyboard shortcut, a menu item, or directly.

- **vscode.commands.registerTextEditorCommand(command: string, callback: (textEditor: TextEditor, edit: TextEditorEdit, ...args: any[]) => void, thisArg?: any): Disposable**: Registers a text editor command that can be invoked via a keyboard shortcut, a menu item, or directly.

- **vscode.commands.getCommands(filterInternal?: boolean): Thenable<string[]>**: Returns a list of all commands.

- **vscode.workspace.registerFileSystemProvider(scheme: string, provider: FileSystemProvider, options?: { isCaseSensitive?: boolean, isReadonly?: boolean }): Disposable**: Registers a filesystem provider for a given scheme.

- **vscode.workspace.registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable**: Registers a text document content provider for a given scheme.

- **vscode.workspace.registerTaskProvider(type: string, provider: TaskProvider): Disposable**: Registers a task provider.

- **vscode.workspace.registerFileDecorationProvider(provider: FileDecorationProvider): Disposable**: Registers a file decoration provider.

- **vscode.workspace.getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined**: Returns the workspace folder that contains a given URI.

- **vscode.workspace.asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string**: Returns a path relative to the workspace folder or folders.

- **vscode.workspace.saveAll(includeUntitled?: boolean): Thenable<boolean>**: Saves all dirty files.

- **vscode.workspace.onDidChangeWorkspaceFolders(listener: (e: WorkspaceFoldersChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: An event that is emitted when the workspace folders change.

- **vscode.workspace.onDidChangeConfiguration(listener: (e: ConfigurationChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]): Disposable**: An event that is emitted when the configuration changes.

- **vscode.workspace.onDidChangeTextDocument(listener: (e: TextDocumentChangeEvent 