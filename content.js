// content.js — обрабатывает только последнее сообщение ассистента

let BRIDGE_URL = 'http://127.0.0.1:8080';
let config = { autoSend: false, sendDelay: 1 };
let token = '';
let processing = false;

// Глобальный кэш обработанных сообщений
let processedMessages = new Set();

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function insertText(text) {
  const input = findInput();
  if (!input) return false;
  
  if (input.value === text) {
    console.log('⏭️ Text already inserted, skipping');
    return false;
  }
  
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

// ============================================================
// НАХОДИМ ПОСЛЕДНЕЕ СООБЩЕНИЕ АССИСТЕНТА
// ============================================================
function getLastAssistantMessage() {
  // Находим все сообщения ассистента
  const allMessages = document.querySelectorAll('.ds-message, [class*="message"], [class*="assistant"], [class*="bot"]');
  
  // Фильтруем только сообщения ассистента (не пользователя)
  const assistantMessages = [];
  for (const el of allMessages) {
    const isUser = el.className?.toString()?.includes('user') || 
                   el.className?.toString()?.includes('User');
    if (!isUser) {
      assistantMessages.push(el);
    }
  }
  
  if (assistantMessages.length === 0) {
    console.log('ℹ️ No assistant messages found');
    return null;
  }
  
  // Берём ПОСЛЕДНЕЕ сообщение (по индексу)
  const lastMessage = assistantMessages[assistantMessages.length - 1];
  console.log(`📨 Found ${assistantMessages.length} assistant messages, taking the last one`);
  
  return lastMessage;
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА — только последнее сообщение
// ============================================================
async function processLastMessage() {
  if (!token) {
    console.warn('⚠️ No token, skipping');
    return;
  }
  
  if (processing) {
    console.log('⏳ Already processing, skipping');
    return;
  }
  
  const element = getLastAssistantMessage();
  if (!element) return;
  
  const text = element.textContent || '';
  if (!text.includes('==MCP:')) {
    console.log('ℹ️ Last message has no markers');
    return;
  }
  
  // Генерируем ID на основе содержимого
  const msgId = text.substring(0, 100) + '_' + text.length;
  
  // Проверяем, не обрабатывали ли уже это сообщение
  if (processedMessages.has(msgId)) {
    console.log('⏭️ Already processed this message, skipping');
    return;
  }
  
  console.log('📨 Processing LAST assistant message...');
  processing = true;
  
  try {
    const response = await fetch(`${BRIDGE_URL}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        config: config,
        token: token
      })
    });
    
    const result = await response.json();
    console.log('✅ Result:', result);
    
    if (result.result) {
      const finalResult = result.result + '\n\n---\n✅ Done! You can press Enter to send.';
      await insertText(finalResult);
      processedMessages.add(msgId);
      console.log('✅ Message marked as processed');
    } else if (result.error) {
      console.error('❌ Server error:', result.error);
      const errorMsg = `❌ Error: ${result.error}\n\n---\n⚠️ Please check server logs.`;
      await insertText(errorMsg);
    } else {
      console.log('ℹ️ No results');
    }
    
  } catch (error) {
    console.error('❌ Server error:', error);
    const errorMsg = `❌ Connection error: ${error.message}\n\n---\n⚠️ Please check that Bridge server is running.`;
    await insertText(errorMsg);
  }
  
  processing = false;
}

// ============================================================
// MutationObserver — следим за НОВЫМИ сообщениями
// ============================================================
let observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      
      const text = node.textContent || '';
      if (!text.includes('==MCP:')) continue;
      
      // Проверяем, что это сообщение ассистента
      const isAssistant = node.className?.toString()?.includes('assistant') ||
                          node.className?.toString()?.includes('bot');
      
      if (isAssistant) {
        console.log('📨 New assistant message detected, processing...');
        setTimeout(() => {
          processLastMessage();
        }, 1500);
        break;
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// ============================================================
// ЗАПУСК
// ============================================================
console.log('✅ MCP Bridge content script loaded (processing only LAST assistant message)');

// Очищаем кэш при загрузке
processedMessages = new Set();
console.log('🔄 Cache cleared');

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCAN_MESSAGES') {
    processLastMessage().then(() => sendResponse({ success: true }));
    return true;
  }
});