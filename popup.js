// popup.js — Управление настройками

// Загружаем сохранённое
chrome.storage.local.get(['mcpUrl', 'mcpToken', 'autoSend', 'sendDelay'], (data) => {
  if (data.mcpUrl) document.getElementById('url').value = data.mcpUrl;
  if (data.mcpToken) document.getElementById('token').value = data.mcpToken;
  document.getElementById('autoSend').checked = data.autoSend !== false;
  document.getElementById('sendDelay').value = data.sendDelay || 1;
  updateStatus('info', 'Settings loaded');
});

// Сохраняем
document.getElementById('save').addEventListener('click', () => {
  const url = document.getElementById('url').value.trim();
  const token = document.getElementById('token').value.trim();
  const autoSend = document.getElementById('autoSend').checked;
  const sendDelay = parseFloat(document.getElementById('sendDelay').value) || 1;
  
  if (!url) {
    updateStatus('error', '❌ Please enter server URL');
    return;
  }
  
  if (!token) {
    updateStatus('error', '❌ Please enter GitHub token');
    return;
  }
  
  chrome.storage.local.set({
    mcpUrl: url,
    mcpToken: token,
    autoSend: autoSend,
    sendDelay: sendDelay
  }, () => {
    updateStatus('success', '✅ Settings saved!');
    setTimeout(() => updateStatus('info', 'Ready'), 2000);
  });
});

// Тест соединения
document.getElementById('test').addEventListener('click', async () => {
  const url = document.getElementById('url').value.trim();
  const token = document.getElementById('token').value.trim();
  
  if (!url || !token) {
    updateStatus('error', '❌ Please enter both URL and token');
    return;
  }
  
  updateStatus('info', '⏳ Testing connection...');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'test',
        method: 'tools/list',
        params: {}
      })
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      updateStatus('error', '❌ Server returned HTML. Check URL and server status.');
      return;
    }

    if (!response.ok) {
      updateStatus('error', `❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    
    if (data.error) {
      updateStatus('error', `❌ ${data.error.message}`);
      return;
    }

    const tools = data.result?.tools || [];
    updateStatus('success', `✅ Connected! ${tools.length} tools available`);
    
  } catch (error) {
    updateStatus('error', `❌ ${error.message}`);
  }
});

// Ручное сканирование (для отладки, но можно оставить)
document.getElementById('scan').addEventListener('click', () => {
  updateStatus('info', '⏳ Scanning messages...');
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0] || !tabs[0].id) {
      updateStatus('error', '❌ No active tab found');
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, {type: 'SCAN_MESSAGES'}, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('error', '❌ ' + chrome.runtime.lastError.message);
        return;
      }
      
      if (response?.success) {
        updateStatus('success', `✅ Found ${response.count} messages with MCP tags`);
        setTimeout(() => updateStatus('info', 'Ready (auto-scan every 3s)'), 3000);
      } else {
        updateStatus('error', '❌ Scan failed');
      }
    });
  });
});

function updateStatus(type, message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = '';
  if (type === 'success') status.classList.add('status-success');
  else if (type === 'error') status.classList.add('status-error');
  else if (type === 'info') status.classList.add('status-info');
  else status.classList.add('status-empty');
}