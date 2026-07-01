// content.js — с передачей токена

let BRIDGE_URL = 'http://127.0.0.1:8080';
let config = { autoSend: false, sendDelay: 1 };
let token = '';

// Загружаем настройки
chrome.storage.local.get(['bridgeUrl', 'autoSend', 'sendDelay', 'mcpToken'], (data) => {
  if (data.bridgeUrl) BRIDGE_URL = data.bridgeUrl;
  if (data.autoSend !== undefined) config.autoSend = data.autoSend;
  if (data.sendDelay !== undefined) config.sendDelay = data.sendDelay;
  if (data.mcpToken) token = data.mcpToken;
  console.log('🔌 MCP Bridge: Config loaded', { ...config, token: token ? 'present' : 'missing' });
});

function findInput() {
  return document.querySelector('textarea') || 
         document.querySelector('[contenteditable="true"]') ||
         document.querySelector('[class*="input"] textarea');
}

function findSendButton() {
  return document.querySelector('button[type="submit"]') ||
         document.querySelector('[class*="send"]');
}

async function insertText(text) {
  const input = findInput();
  if (!input) return false;
  
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  
  if (config.autoSend) {
    await sleep(config.sendDelay * 1000);
    const btn = findSendButton();
    if (btn) btn.click();
    else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }
  }
  
  return true;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Сканируем сообщения
async function scanMessages() {
  if (!token) {
    console.warn('⚠️ No token, skipping scan');
    return;
  }
  
  const elements = document.querySelectorAll('.ds-message, [class*="message"], [class*="assistant"]');
  const processed = new Set();
  
  for (const el of elements) {
    const text = el.textContent || '';
    if (!text.includes('==MCP:')) continue;
    
    const id = el.dataset.mcpId || text.substring(0, 50);
    if (processed.has(id)) continue;
    el.dataset.mcpId = id;
    processed.add(id);
    
    console.log('📨 Processing message...');
    
    try {
      const response = await fetch(`${BRIDGE_URL}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          config: config,
          token: token  // ← передаём токен
        })
      });
      
      const result = await response.json();
      console.log('✅ Result:', result);
      
      if (result.result) {
        await insertText(result.result);
      }
    } catch (error) {
      console.error('❌ Server error:', error);
    }
  }
}

// Запускаем сканирование
setInterval(scanMessages, 3000);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCAN') {
    scanMessages().then(() => sendResponse({ success: true }));
    return true;
  }
});

console.log('✅ MCP Bridge content script loaded');