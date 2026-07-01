// popup.js — Настройки

// Загружаем сохранённое
chrome.storage.local.get(['bridgeUrl', 'mcpUrl', 'mcpToken', 'autoSend', 'sendDelay'], (data) => {
  if (data.bridgeUrl) document.getElementById('bridgeUrl').value = data.bridgeUrl;
  if (data.mcpUrl) document.getElementById('mcpUrl').value = data.mcpUrl;
  if (data.mcpToken) document.getElementById('token').value = data.mcpToken;
  document.getElementById('autoSend').checked = data.autoSend !== false;
  document.getElementById('sendDelay').value = data.sendDelay || 1;
  updateStatus('Settings loaded');
});

// Сохраняем
document.getElementById('save').addEventListener('click', () => {
  const bridgeUrl = document.getElementById('bridgeUrl').value.trim() || 'http://127.0.0.1:8080';
  const mcpUrl = document.getElementById('mcpUrl').value.trim() || 'http://127.0.0.1:3001/mcp';
  const token = document.getElementById('token').value.trim();
  
  if (!token) {
    updateStatus('❌ Please enter GitHub token');
    return;
  }
  
  chrome.storage.local.set({
    bridgeUrl: bridgeUrl,
    mcpUrl: mcpUrl,
    mcpToken: token,
    autoSend: document.getElementById('autoSend').checked,
    sendDelay: parseFloat(document.getElementById('sendDelay').value) || 1
  }, () => {
    updateStatus('✅ Saved!');
    setTimeout(() => updateStatus('Ready'), 2000);
  });
});

// Тест соединения
document.getElementById('test').addEventListener('click', async () => {
  const bridgeUrl = document.getElementById('bridgeUrl').value || 'http://127.0.0.1:8080';
  const token = document.getElementById('token').value;
  const status = document.getElementById('status');
  
  if (!token) {
    updateStatus('❌ Please enter GitHub token');
    return;
  }
  
  updateStatus('⏳ Testing...');
  
  try {
    // Проверяем Bridge
    const bridgeRes = await fetch(`${bridgeUrl}/health`);
    if (!bridgeRes.ok) throw new Error(`Bridge HTTP ${bridgeRes.status}`);
    await bridgeRes.json();
    
    // Проверяем MCP через Bridge
    const mcpRes = await fetch(`${bridgeUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '==MCP:list_commits== {"owner":"LeonidYasin","repo":"synapse"}',
        config: {},
        token: token  // ← передаём токен
      })
    });
    
    const data = await mcpRes.json();
    if (data.error) throw new Error(data.error);
    
    const tools = data.tools || [];
    const successCount = tools.filter(t => t.success).length;
    updateStatus(`✅ Connected! ${successCount}/${tools.length} tools OK`);
    
  } catch (error) {
    updateStatus(`❌ ${error.message}`);
  }
});

// Сканирование
document.getElementById('scan').addEventListener('click', () => {
  updateStatus('⏳ Scanning...');
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0] || !tabs[0].id) {
      updateStatus('❌ No active tab');
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, {type: 'SCAN'}, (response) => {
      if (chrome.runtime.lastError) {
        updateStatus('❌ ' + chrome.runtime.lastError.message);
        return;
      }
      updateStatus(response?.success ? '✅ Scanned!' : '❌ Failed');
    });
  });
});

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}