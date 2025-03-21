(function() {
  const vscode = acquireVsCodeApi();
  const chatOutput = document.getElementById('chat-output');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const fileSuggestionsContainer = document.getElementById('file-suggestions');
  let fileSuggestionsVisible = false;

  // State management
  const state = {
    messages: [],
    selectedModel: 'gemini-2.0-flash'
  };

  function createMessageElement(content, isUser) {
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
    div.innerHTML = content;
    return div;
  }

  function createCodeBlock(code, language) {
    const div = document.createElement('div');
    div.className = 'code-block';
    div.innerHTML = `
      <pre><code class="${language}">${escapeHtml(code)}</code></pre>
      <div class="code-actions">
        <button onclick="copyCode(this)">Copy</button>
        <button onclick="applyCode(this)">Apply</button>
      </div>
    `;
    return div;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.copyCode = function(button) {
    const code = button.closest('.code-block').querySelector('code').textContent;
    navigator.clipboard.writeText(code);
  };

  window.applyCode = function(button) {
    const code = button.closest('.code-block').querySelector('code').textContent;
    vscode.postMessage({ command: 'applyCode', code });
  };

  chatInput.addEventListener('input', (e) => {
    const text = e.target.value;
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPosition);
    
    const match = textBeforeCursor.match(/@([^@\s]*?)$/);
    if (match) {
      const query = match[1];
      vscode.postMessage({
        command: 'getFileSuggestions',
        query: query
      });
      fileSuggestionsVisible = true;
    } else {
      hideFileSuggestions();
    }
  });

  function showFileSuggestions(files) {
    if (!files.length) {
      hideFileSuggestions();
      return;
    }

    fileSuggestionsContainer.innerHTML = '';
    files.forEach(file => {
      const div = document.createElement('div');
      div.className = 'file-suggestion';
      const fileName = file.split('/').pop();
      const filePath = file.substring(0, file.length - fileName.length);
      
      div.innerHTML = `
        <span class="file-icon">📄</span>
        <div class="file-info">
          <span class="file-name">${escapeHtml(fileName)}</span>
          <span class="file-path">${escapeHtml(filePath)}</span>
        </div>
      `;
      div.onclick = () => insertFileReference(file);
      fileSuggestionsContainer.appendChild(div);
    });
    fileSuggestionsContainer.style.display = 'block';
  }

  function hideFileSuggestions() {
    fileSuggestionsContainer.style.display = 'none';
    fileSuggestionsVisible = false;
  }

  function insertFileReference(fileName) {
    const text = chatInput.value;
    const cursorPosition = chatInput.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const textAfterCursor = text.substring(cursorPosition);
    
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const newText = textBeforeCursor.substring(0, lastAtIndex) + '@' + fileName + textAfterCursor;
    
    chatInput.value = newText;
    hideFileSuggestions();
    chatInput.focus();
  }

  sendBtn.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (text) {
      chatOutput.appendChild(createMessageElement(text, true));
      vscode.postMessage({ command: 'sendMessage', text });
      chatInput.value = '';
    }
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'receiveMessage':
        if (message.isCode) {
          chatOutput.appendChild(createCodeBlock(message.text, message.language || 'plaintext'));
        } else {
          chatOutput.appendChild(createMessageElement(message.text, false));
        }
        chatOutput.scrollTop = chatOutput.scrollHeight;
        break;
      case 'fileSuggestions':
        showFileSuggestions(message.files);
        break;
    }
  });
})();