// worker/index.js — Service Worker для HTTP-запросов

let serverConfig = {
  url: 'http://127.0.0.1:3001/mcp',
  token: ''
};

// Загружаем конфиг при старте
chrome.storage.local.get(['mcpUrl', 'mcpToken'], (data) => {
  console.log('🔌 MCP Bridge: Storage data loaded:', {
    mcpUrl: data.mcpUrl,
    mcpToken: data.mcpToken ? 'present' : 'missing'
  });
  
  if (data.mcpUrl) serverConfig.url = data.mcpUrl;
  if (data.mcpToken) serverConfig.token = data.mcpToken;
  
  console.log('🔌 MCP Bridge: Config loaded', {
    url: serverConfig.url,
    token: serverConfig.token ? 'present' : 'missing'
  });
});

// Слушаем изменения конфига
chrome.storage.onChanged.addListener((changes) => {
  console.log('🔌 MCP Bridge: Storage changed:', changes);
  if (changes.mcpUrl) {
    serverConfig.url = changes.mcpUrl.newValue;
    console.log('🔌 MCP Bridge: URL updated to', serverConfig.url);
  }
  if (changes.mcpToken) {
    serverConfig.token = changes.mcpToken.newValue;
    console.log('🔌 MCP Bridge: Token updated');
  }
});

// Выполнить вызов инструмента
async function executeToolCall(toolName, args) {
  const url = serverConfig.url;
  const token = serverConfig.token;
  
  console.log('🔌 MCP Bridge: Executing tool', toolName, 'at', url);
  console.log('🔌 MCP Bridge: Token present?', token ? '✅' : '❌');
  console.log('🔌 MCP Bridge: Token length:', token ? token.length : 0);

  if (!token) {
    throw new Error('GitHub token is not configured. Please set it in extension settings.');
  }

  try {
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now().toString(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });
    console.log('🔌 MCP Bridge: Request body:', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: requestBody
    });

    console.log('🔌 MCP Bridge: Response status:', response.status);

    const contentType = response.headers.get('content-type') || '';
    console.log('🔌 MCP Bridge: Content-Type:', contentType);
    
    if (contentType.includes('text/html')) {
      const html = await response.text();
      console.error('🔌 MCP Bridge: Got HTML instead of JSON');
      console.error('🔌 MCP Bridge: HTML preview:', html.substring(0, 500));
      throw new Error(`Server returned HTML. Make sure the MCP server is running at ${url}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('🔌 MCP Bridge: Response received');
    console.log('🔌 MCP Bridge: Full response:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.error('🔌 MCP Bridge: Error in response:', data.error);
      throw new Error(data.error.message || 'Unknown MCP error');
    }

    // ИЗВЛЕКАЕМ ТЕКСТ ИЗ ОТВЕТА
    let resultText = '';
    
    if (data.result && data.result.content) {
      const content = data.result.content;
      console.log('🔌 MCP Bridge: Content from response:', JSON.stringify(content, null, 2));
      
      if (Array.isArray(content) && content.length > 0) {
        const firstContent = content[0];
        if (firstContent && typeof firstContent === 'object' && firstContent.text) {
          resultText = firstContent.text;
          console.log('🔌 MCP Bridge: Extracted text from content[0].text');
        } else if (typeof firstContent === 'string') {
          resultText = firstContent;
          console.log('🔌 MCP Bridge: Extracted string from content[0]');
        } else {
          resultText = JSON.stringify(content, null, 2);
          console.log('🔌 MCP Bridge: Converted content to JSON');
        }
      } else if (typeof content === 'string') {
        resultText = content;
        console.log('🔌 MCP Bridge: Extracted string content');
      } else {
        resultText = JSON.stringify(content, null, 2);
        console.log('🔌 MCP Bridge: Converted content to JSON');
      }
    } else if (data.result && typeof data.result === 'object') {
      try {
        resultText = JSON.stringify(data.result, null, 2);
        console.log('🔌 MCP Bridge: Converted result to JSON');
      } catch (e) {
        resultText = String(data.result);
        console.log('🔌 MCP Bridge: Converted result to string');
      }
    } else {
      resultText = String(data.result || '');
      console.log('🔌 MCP Bridge: Used default string conversion');
    }
    
    console.log('🔌 MCP Bridge: Extracted text:', resultText);
    console.log('🔌 MCP Bridge: Extracted text length:', resultText.length);
    
    return resultText;

  } catch (error) {
    console.error('🔌 MCP Bridge: Error:', error);
    throw error;
  }
}

// Получить список инструментов
async function listTools() {
  const url = serverConfig.url;
  const token = serverConfig.token;

  console.log('🔌 MCP Bridge: listTools called, token present?', token ? '✅' : '❌');

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
      .then(result => {
        console.log('🔌 MCP Bridge: Sending result to content script');
        console.log('🔌 MCP Bridge: Result type:', typeof result);
        console.log('🔌 MCP Bridge: Result:', result);
        sendResponse({ success: true, result: result });
      })
      .catch(err => {
        console.error('🔌 MCP Bridge: Error:', err);
        sendResponse({ success: false, error: err.message });
      });
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