// Get VS Code API
const vscode = acquireVsCodeApi();

// Available models
const AVAILABLE_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];

// Command patterns
const COMMANDS = {
    CREATE: '/create',
    UPDATE: '/update',
    DELETE: '/delete'
};

// Initialize state
let state = {
    messages: [],
    selectedModel: 'gemini-2.0-flash',
    fileSuggestions: [],
    showingSuggestions: false,
    inputMode: 'normal', // 'normal', 'command', 'file'
    currentCommand: null,
    commandStep: 0
};

// Try to load previous state
const previousState = vscode.getState();
if (previousState) {
    state = {
        ...previousState,
        selectedModel: AVAILABLE_MODELS.includes(previousState.selectedModel) 
            ? previousState.selectedModel 
            : 'gemini-2.0-flash',
        showingSuggestions: false,
        inputMode: 'normal',
        currentCommand: null,
        commandStep: 0
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('chat-messages');
    const modelSelector = document.getElementById('model-selector');
    const fileSuggestionsContainer = document.getElementById('file-suggestions');
    const commandHint = document.getElementById('command-hint');

    // Set initial model selection
    if (state.selectedModel) {
        modelSelector.value = state.selectedModel;
    }

    // Handle model selection change
    modelSelector.addEventListener('change', (e) => {
        if (AVAILABLE_MODELS.includes(e.target.value)) {
            state.selectedModel = e.target.value;
            vscode.setState(state);
        } else {
            e.target.value = state.selectedModel;
        }
    });

    // Handle input changes for commands and @ mentions
    chatInput.addEventListener('input', (e) => {
        const text = e.target.value;
        const cursorPosition = e.target.selectionStart;
        const textBeforeCursor = text.substring(0, cursorPosition);
        
        // Reset command state if input is cleared
        if (!text) {
            resetCommandState();
        }

        // Handle commands
        if (text.startsWith('/')) {
            handleCommandInput(text);
        }
        // Handle @ mentions
        else if (textBeforeCursor.includes('@')) {
            handleFileMention(textBeforeCursor);
        }
        // Normal mode
        else {
            state.inputMode = 'normal';
            state.currentCommand = null;
            state.commandStep = 0;
            updateCommandHint('');
        }

        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });

    function handleCommandInput(text) {
        state.inputMode = 'command';
        const parts = text.split(' ');
        const command = parts[0];

        switch (command) {
            case COMMANDS.CREATE:
                if (parts.length === 1) {
                    updateCommandHint('Enter filename (e.g., example.js)');
                    state.commandStep = 1;
                } else if (parts.length === 2) {
                    updateCommandHint('Enter file content');
                    state.commandStep = 2;
                }
                break;

            case COMMANDS.UPDATE:
                if (parts.length === 1) {
                    updateCommandHint('Enter @filename or type @ to see available files');
                    state.commandStep = 1;
                } else if (parts[1].startsWith('@')) {
                    handleFileMention(parts[1]);
                    if (parts.length === 2) {
                        updateCommandHint('Enter new content');
                        state.commandStep = 2;
                    }
                }
                break;

            case COMMANDS.DELETE:
                if (parts.length === 1) {
                    updateCommandHint('Enter filename to delete');
                    state.commandStep = 1;
                }
                break;

            default:
                updateCommandHint('Available commands: /create, /update, /delete');
        }
    }

    function handleFileMention(textBeforeCursor) {
        state.inputMode = 'file';
        const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
        const query = textBeforeCursor.substring(lastAtSymbol + 1);
        
        // Always request suggestions when @ is typed
        vscode.postMessage({
            command: 'getFileSuggestions',
            query: query || ''  // Send empty string to get all files if no query
        });
        
        // Show suggestions container
        fileSuggestionsContainer.style.display = 'block';
        updateCommandHint('Select a file from the suggestions');
    }

    function updateCommandHint(hint) {
        commandHint.textContent = hint;
        commandHint.style.display = hint ? 'block' : 'none';
    }

    function resetCommandState() {
        state.inputMode = 'normal';
        state.currentCommand = null;
        state.commandStep = 0;
        updateCommandHint('');
        hideSuggestions();
    }

    // Handle key commands
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        } else if (e.key === 'Enter' && e.shiftKey) {
            // Allow multiline input with Shift+Enter
            return;
        } else if (e.key === 'Tab' && state.showingSuggestions) {
            e.preventDefault();
            // Handle file suggestion completion
            const selected = fileSuggestionsContainer.querySelector('.selected');
            if (selected) {
                insertFileSuggestion(selected.textContent);
            }
        } else if (e.key === 'Escape') {
            resetCommandState();
        }
    });

    // Restore previous messages
    renderMessages();

    // Handle send button click
    sendButton.addEventListener('click', sendMessage);

    // Handle message from extension
    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'response':
                removeTypingIndicator();
                addMessage('AI', message.text);
                resetCommandState();
                break;
            case 'fileSuggestions':
                showFileSuggestions(message.suggestions);
                break;
        }
    });
});

function showFileSuggestions(suggestions) {
    const container = document.getElementById('file-suggestions');
    container.innerHTML = '';
    
    if (suggestions.length === 0) {
        const div = document.createElement('div');
        div.className = 'file-suggestion';
        div.textContent = 'No matching files';
        container.appendChild(div);
    } else {
        suggestions.forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = 'file-suggestion' + (index === 0 ? ' selected' : '');
            div.textContent = suggestion;
            div.onclick = () => insertFileSuggestion(suggestion);
            container.appendChild(div);
        });
    }
    
    container.style.display = 'block';
    state.showingSuggestions = true;
}

function hideSuggestions() {
    const container = document.getElementById('file-suggestions');
    container.style.display = 'none';
    state.showingSuggestions = false;
}

function insertFileSuggestion(suggestion) {
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value;
    const cursorPosition = chatInput.selectionStart;
    const lastAtSymbol = text.lastIndexOf('@', cursorPosition);
    
    const newText = text.substring(0, lastAtSymbol) + '@' + suggestion + text.substring(cursorPosition);
    chatInput.value = newText;
    hideSuggestions();
}

function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const text = chatInput.value.trim();
    
    if (text) {
        addMessage('User', text);
        showTypingIndicator();
        
        vscode.postMessage({
            command: 'ask',
            text: text,
            model: state.selectedModel
        });
        
        chatInput.value = '';
        chatInput.style.height = 'auto';
        hideSuggestions();
    }
}

function addMessage(sender, text) {
    const message = {
        sender,
        text,
        timestamp: new Date().toISOString()
    };
    
    state.messages.push(message);
    vscode.setState(state);
    renderMessage(message);
    scrollToBottom();
}

function renderMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
    state.messages.forEach(renderMessage);
    scrollToBottom();
}

function renderMessage(message) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender.toLowerCase()}`;
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = `${message.sender} • ${formatTime(message.timestamp)}`;
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = formatMessage(message.text);
    
    // Add apply buttons to code blocks
    content.querySelectorAll('.code-block').forEach(addApplyButton);
    
    messageElement.appendChild(header);
    messageElement.appendChild(content);
    messagesContainer.appendChild(messageElement);
}

function formatMessage(text) {
    // Convert code blocks with file information
    text = text.replace(/```(\w+)?\s*(?:\{file:\s*([^}]+)\})?\n([\s\S]*?)```/g, (_, lang, file, code) => {
        const fileAttr = file ? `data-file="${escapeHtml(file)}"` : '';
        const originalCode = code.trim();
        // Store the original unformatted code in a data attribute
        return `<div class="code-block" ${fileAttr}><pre><code class="language-${lang || ''}" data-original-code="${encodeURIComponent(originalCode)}">${escapeHtml(originalCode)}</code></pre></div>`;
    });
    
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert URLs to links
    text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('div');
        dot.className = 'typing-dot';
        indicator.appendChild(dot);
    }
    
    messagesContainer.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Add apply buttons to code blocks
function addApplyButton(block) {
    const actions = document.createElement('div');
    actions.className = 'actions';
    
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => {
        // Get the original code from the data attribute and decode it
        const encodedCode = block.querySelector('code').getAttribute('data-original-code');
        const code = encodedCode ? decodeURIComponent(encodedCode) : block.querySelector('code').textContent;
        
        // Send the original unformatted code
        vscode.postMessage({
            command: 'applyCode',
            code: code,
            file: block.dataset.file
        });
    };
    
    actions.appendChild(applyBtn);
    block.appendChild(actions);
}
