// sidepanel.js — управление настройками и статусом в боковой панели

// ============================================================
// Загрузка настроек
// ============================================================
chrome.storage.local.get(['mcpUrl', 'mcpToken', 'bridgeUrl', 'autoSend', 'sendDelay', 'processedCount'], (data) => {
  if (data.mcpUrl) document.getElementById('mcpUrl').value = data.mcpUrl;
  if (data.mcpToken) document.getElementById('token').value = data.mcpToken;
  if (data.bridgeUrl) document.getElementById('bridgeUrl').value = data.bridgeUrl;
  document.getElementById('autoSend').checked = data.autoSend !== false;
  document.getElementById('sendDelay').value = data.sendDelay || 1;
  if (data.processedCount) {
    document.getElementById('processedCount').textContent = data.processedCount;
  }
  updateStatus('Settings loaded');
  updatePopupStatus('idle', '🟢 Idle');
});

// ============================================================
// Сохранение настроек
// ============================================================
document.getElementById('save').addEventListener('click', () => {
  const bridgeUrl = document.getElementById('bridgeUrl').value.trim();
  const mcpUrl = document.getElementById('mcpUrl').value.trim();
  const token = document.getElementById('token').value.trim();
  const autoSend = document.getElementById('autoSend').checked;
  const sendDelay = parseFloat(document.getElementById('sendDelay').value) || 1;
  
  if (!bridgeUrl) {
    updateStatus('❌ Please enter Bridge Server URL');
    return;
  }
  if (!mcpUrl) {
    updateStatus('❌ Please enter MCP Server URL');
    return;
  }
  if (!token) {
    updateStatus('❌ Please enter GitHub token');
    return;
  }
  
  chrome.storage.local.set({
    mcpUrl: mcpUrl,
    mcpToken: token,
    bridgeUrl: bridgeUrl,
    autoSend: autoSend,
    sendDelay: sendDelay
  }, () => {
    updateStatus('✅ Settings saved!');
    setTimeout(() => updateStatus('Ready'), 2000);
  });
});

// ============================================================
// Тест соединения
// ============================================================
document.getElementById('test').addEventListener('click', async () => {
  const bridgeUrl = document.getElementById('bridgeUrl').value.trim();
  const mcpUrl = document.getElementById('mcpUrl').value.trim();
  const token = document.getElementById('token').value.trim();
  
  if (!bridgeUrl || !mcpUrl || !token) {
    updateStatus('❌ Please fill all fields');
    return;
  }
  
  updateStatus('⏳ Testing Bridge...');
  updatePopupStatus('processing', 'Testing connection...');
  
  try {
    const bridgeRes = await fetch(`${bridgeUrl}/health`);
    if (!bridgeRes.ok) throw new Error(`Bridge HTTP ${bridgeRes.status}`);
    await bridgeRes.json();
    
    updateStatus('✅ Bridge OK, testing MCP...');
    
    const mcpRes = await fetch(`${bridgeUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '==MCP:list_commits== {"owner":"LeonidYasin","repo":"synapse"}',
        config: {},
        token: token,
        url: mcpUrl
      })
    });
    
    if (!mcpRes.ok) throw new Error(`MCP HTTP ${mcpRes.status}`);
    const data = await mcpRes.json();
    if (data.error) throw new Error(data.error);
    
    const tools = data.tools || [];
    const successCount = tools.filter(t => t.success).length;
    updateStatus(`✅ Connected! ${successCount}/${tools.length} tools OK`);
    updatePopupStatus('done', `✅ ${successCount} tools available`);
    
  } catch (error) {
    updateStatus(`❌ ${error.message}`);
    updatePopupStatus('error', `❌ ${error.message}`);
  }
});

// ============================================================
// Ручное сканирование
// ============================================================
document.getElementById('scan').addEventListener('click', () => {
  updateStatus('⏳ Scanning messages...');
  updatePopupStatus('processing', 'Scanning for markers...');
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs[0] || !tabs[0].id) {
      updateStatus('❌ No active tab found');
      updatePopupStatus('error', 'No active tab');
      return;
    }
    
    if (!tabs[0].url || !tabs[0].url.includes('chat.deepseek.com')) {
      updateStatus('❌ Please open chat.deepseek.com first');
      updatePopupStatus('error', 'Not on DeepSeek');
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, {type: 'SCAN_MESSAGES'}, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Content script not responding, trying to inject...');
        updateStatus('⏳ Injecting content script...');
        updatePopupStatus('processing', 'Injecting script...');
        
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            updateStatus('❌ ' + chrome.runtime.lastError.message);
            updatePopupStatus('error', 'Injection failed');
            return;
          }
          
          setTimeout(() => {
            chrome.tabs.sendMessage(tabs[0].id, {type: 'SCAN_MESSAGES'}, (response2) => {
              if (chrome.runtime.lastError) {
                updateStatus('❌ Still cannot connect. Please refresh the page.');
                updatePopupStatus('error', 'Still cannot connect');
                return;
              }
              if (response2?.success) {
                updateStatus(`✅ Found ${response2.count} messages with MCP tags`);
                updatePopupStatus('done', `✅ ${response2.count} messages found`);
                setTimeout(() => updateStatus('Ready'), 3000);
              } else {
                updateStatus('❌ Scan failed');
                updatePopupStatus('error', 'Scan failed');
              }
            });
          }, 500);
        });
        return;
      }
      
      if (response?.success) {
        updateStatus(`✅ Found ${response.count} messages with MCP tags`);
        updatePopupStatus('done', `✅ ${response.count} messages found`);
        setTimeout(() => updateStatus('Ready'), 3000);
      } else {
        updateStatus('❌ Scan failed');
        updatePopupStatus('error', 'Scan failed');
      }
    });
  });
});

// ============================================================
// Вспомогательные функции
// ============================================================
function updatePopupStatus(type, message) {
  const box = document.getElementById('statusBox');
  const text = document.getElementById('statusText');
  const detail = document.getElementById('statusDetail');
  
  box.className = 'status-box ' + type;
  text.textContent = message;
  
  switch(type) {
    case 'idle':
      detail.textContent = 'Waiting for messages...';
      break;
    case 'processing':
      detail.textContent = '⏳ Please wait...';
      break;
    case 'done':
      detail.textContent = '✅ Ready to send!';
      break;
    case 'error':
      detail.textContent = '❌ Check logs for details';
      break;
  }
}

function updateStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = '';
  if (message.includes('✅')) status.classList.add('status-success');
  else if (message.includes('❌')) status.classList.add('status-error');
  else if (message.includes('⏳')) status.classList.add('status-info');
  else status.classList.add('status-empty');
}

// ============================================================
// Обновление статистики из content script
// ============================================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_STATS') {
    document.getElementById('processedCount').textContent = message.count || 0;
    if (message.status) {
      updatePopupStatus(message.status, message.statusText);
    }
    sendResponse({ success: true });
  }
});

// ============================================================
// Инициализация
// ============================================================
updatePopupStatus('idle', '🟢 Idle');