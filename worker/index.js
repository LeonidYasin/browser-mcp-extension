// worker/index.js — Service Worker для HTTP-запросов

let serverConfig = {
  url: 'http://127.0.0.1:3001/mcp',
  token: ''
};

// Загружаем конфиг при старте
chrome.storage.local.get(['mcpUrl', 'mcpToken'], (data) => {
  if (data.mcpUrl) serverConfig.url = data.mcpUrl;
  if (data.mcpToken) serverConfig.token = data.mcpToken;
  console.log('🔌 MCP Bridge: config loaded', {
    url: serverConfig.url,
    token: serverConfig.token ? 'present' : 'missing'
  });
});

// Слушаем изменения конфига
chrome.storage.onChanged.addListener((changes) => {
  if (changes.mcpUrl) serverConfig.url = changes.mcpUrl.newValue;
  if (changes.mcpToken) serverConfig.token = changes.mcpToken.newValue;
  console.log('🔌 MCP Bridge: config updated');
});

// Выполнить вызов инструмента
async function executeToolCall(toolName, args) {
  const url = serverConfig.url;
  const token = serverConfig.token;
  
  console.log('🔌 MCP Bridge: Executing tool', toolName, 'at', url);
  console.log('🔌 MCP Bridge: Token present?', token ? '✅' : '❌');

  if (!token) {
    throw new Error('GitHub token is not configured. Please set it in extension settings.');
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now().toString(),
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      })
    });

    console.log('🔌 MCP Bridge: Response status:', response.status);

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const html = await response.text();
      console.error('🔌 MCP Bridge: Got HTML instead of JSON');
      throw new Error(`Server returned HTML. Make sure the MCP server is running at ${url}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('🔌 MCP Bridge: Response received');

    if (data.error) {
      throw new Error(data.error.message || 'Unknown MCP error');
    }

    const content = data.result?.content;
    if (Array.isArray(content)) {
      return content.map(c => c.text).join('\n');
    }

    return JSON.stringify(data.result, null, 2);
  } catch (error) {
    console.error('🔌 MCP Bridge: Error:', error);
    throw error;
  }
}

// Получить список инструментов
async function listTools() {
  const url = serverConfig.url;
  const token = serverConfig.token;

  if (!token) {
    throw new Error('GitHub token is not configured.');
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'list',
        method: 'tools/list',
        params: {}
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('Server returned HTML. Make sure the MCP server is running.');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result?.tools || [];
  } catch (error) {
    console.error('🔌 MCP Bridge: List tools error:', error);
    throw error;
  }
}

// Обработка сообщений от content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔌 MCP Bridge: Received message', message.type);
  
  if (message.type === 'EXECUTE_TOOL') {
    executeToolCall(message.toolName, message.args)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'LIST_TOOLS') {
    listTools()
      .then(tools => sendResponse({ success: true, tools }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_CONFIG') {
    sendResponse({
      success: true,
      config: {
        url: serverConfig.url,
        token: serverConfig.token ? 'present' : 'missing'
      }
    });
    return true;
  }
});

console.log('🔌 MCP Bridge: Service Worker started');