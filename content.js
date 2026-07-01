// content.js — ТОЛЬКО НОВЫЕ СООБЩЕНИЯ (без initial scan)

let enabled = true;
let processing = false;
let config = {
  autoSend: true,
  sendDelay: 0.5
};

// Загружаем настройки
chrome.storage.local.get(['enabled', 'autoSend', 'sendDelay'], (data) => {
  if (data.enabled !== undefined) enabled = data.enabled;
  config.autoSend = data.autoSend !== undefined ? data.autoSend : true;
  config.sendDelay = data.sendDelay || 0.5;
  console.log('🔍 MCP Bridge: Config loaded from storage', config);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoSend !== undefined) {
    config.autoSend = changes.autoSend.newValue !== false;
  }
  if (changes.sendDelay !== undefined) {
    config.sendDelay = changes.sendDelay.newValue || 0.5;
  }
});

// ==================== Утилиты ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== ПОИСК ПОЛЯ ВВОДА ====================

function findInputArea() {
  const selectors = [
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="ask"]',
    'textarea[placeholder*="Send"]',
    'textarea[placeholder*="Type"]',
    'textarea.ds-input',
    'textarea._27c9245',
    'textarea.ds-scroll-area',
    '#chat-input',
    '#prompt-textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.chat-input',
    '.ds-chat-input',
    '.message-input',
    '[class*="input"] textarea',
    '[class*="chat"] textarea',
    '[class*="message"] textarea'
  ];
  
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        console.log('✅ MCP Bridge: Found input with selector:', selector);
        return el;
      }
    } catch (e) {}
  }
  
  const textareas = document.querySelectorAll('textarea');
  if (textareas.length > 0) {
    for (const ta of textareas) {
      const rect = ta.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const isLarge = rect.width > 200 && rect.height > 30;
      if (isVisible && isLarge) {
        console.log('✅ MCP Bridge: Found textarea by visibility/size');
        return ta;
      }
    }
    console.log('✅ MCP Bridge: Found textarea, using first one');
    return textareas[0];
  }
  
  const editable = document.querySelector('[contenteditable="true"]');
  if (editable) {
    console.log('✅ MCP Bridge: Found contenteditable');
    return editable;
  }
  
  console.error('❌ MCP Bridge: No input found!');
  return null;
}

// ==================== ПОИСК КНОПКИ ОТПРАВКИ ====================

function findSendButton() {
  const selectors = [
    'button[type="submit"]',
    '[class*="send"]',
    '[class*="submit"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="Send" i]',
    '[class*="chat-send"]',
    '[class*="message-send"]',
    '[class*="input-send"]',
    '[class*="btn-send"]'
  ];
  
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        console.log('✅ MCP Bridge: Found send button with selector:', selector);
        return el;
      }
    } catch (e) {}
  }
  
  const allElements = document.querySelectorAll('div, span, button, svg, path');
  for (const el of allElements) {
    const html = el.innerHTML?.toLowerCase() || '';
    const text = el.textContent?.toLowerCase() || '';
    const aria = el.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (aria.includes('send') || aria.includes('submit') || 
        text.includes('send') || text.includes('отправить') ||
        (html.includes('svg') && (html.includes('arrow') || html.includes('paper-plane')))) {
      
      let clickable = el;
      while (clickable && !clickable.click && clickable.parentElement) {
        clickable = clickable.parentElement;
      }
      
      if (clickable && (clickable.click || clickable.tagName === 'BUTTON')) {
        console.log('✅ MCP Bridge: Found send button via SVG/icon');
        return clickable;
      }
    }
  }
  
  console.error('❌ MCP Bridge: No send button found');
  return null;
}

// ==================== ВСТАВКА В ПОЛЕ ВВОДА ====================

async function insertTextToInput(text) {
  console.log('📤 MCP Bridge: Inserting text into input field...');
  console.log('📤 Text length:', text.length);
  console.log('📤 Text preview:', text.substring(0, 200) + '...');
  
  let textarea = null;
  let attempts = 0;
  
  while (attempts < 5) {
    textarea = findInputArea();
    if (textarea) break;
    console.log(`⏳ Attempt ${attempts + 1}/5: Input not found, waiting...`);
    await sleep(500);
    attempts++;
  }
  
  if (!textarea) {
    console.error('❌ MCP Bridge: Cannot find input after 5 attempts');
    return false;
  }

  console.log('✅ MCP Bridge: Input found, inserting text...');

  try {
    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = '';
    } else {
      textarea.textContent = '';
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    await sleep(100);

    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = text;
    } else {
      textarea.textContent = text;
    }
    
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    textarea.dispatchEvent(new Event('compositionend', { bubbles: true }));
    
    textarea.focus();
    
    if (textarea.setSelectionRange) {
      const len = textarea.value ? textarea.value.length : textarea.textContent?.length || 0;
      textarea.setSelectionRange(len, len);
    }
    
    console.log('✅ MCP Bridge: Text inserted into input field');
    
    if (config.autoSend) {
      console.log('🔍 MCP Bridge: Auto-send enabled, looking for send button...');
      
      await sleep(200);
      
      const sendBtn = findSendButton();
      if (sendBtn) {
        console.log('✅ MCP Bridge: Send button found, clicking...');
        if (sendBtn.click) {
          sendBtn.click();
        } else {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          sendBtn.dispatchEvent(clickEvent);
        }
        console.log('✅ MCP Bridge: Send button clicked!');
      } else {
        console.log('⚠️ MCP Bridge: Send button not found, trying Enter key...');
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        textarea.dispatchEvent(enterEvent);
        console.log('✅ MCP Bridge: Enter key sent!');
      }
    } else {
      console.log('🔍 MCP Bridge: Auto-send disabled — text inserted, you can edit and send manually');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ MCP Bridge: Failed to insert text:', error);
    return false;
  }
}

// ==================== Обработка MCP-маркеров ====================

let AVAILABLE_TOOLS = [];
let AVAILABLE_TOOLS_SET = new Set();

async function loadToolsList() {
  try {
    console.log('🔍 MCP Bridge: Requesting tools list from server...');
    const response = await chrome.runtime.sendMessage({ type: 'LIST_TOOLS' });
    if (response && response.success && response.tools) {
      AVAILABLE_TOOLS = response.tools.map(t => t.name);
      AVAILABLE_TOOLS_SET = new Set(AVAILABLE_TOOLS);
      console.log('📦 Available tools (from server):', AVAILABLE_TOOLS.join(', '));
    }
  } catch (error) {
    console.error('❌ MCP Bridge: Error loading tools list:', error);
  }
}

loadToolsList();

// Кэш обработанных сообщений
let processedMessages = new Set();

function extractMCPTags(text) {
  const tools = [];
  
  console.log('🔍 MCP Bridge: Extracting tags from text...');
  
  for (const toolName of AVAILABLE_TOOLS) {
    const regex = new RegExp(`==MCP:${toolName}==\\s*(\\{[^]*?\\})`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[1]);
        tools.push({
          toolName: toolName,
          args: args,
          original: match[0]
        });
        console.log(`🔍 Found marker: ==MCP:${toolName}==`);
      } catch (e) {
        console.error(`MCP Bridge: Failed to parse args for ${toolName}`, e);
      }
    }
  }
  
  return tools;
}

// ==================== ПОИСК НОВЫХ СООБЩЕНИЙ ====================

function findNewMessagesWithMCPTags() {
  console.log('🔍 MCP Bridge: Looking for NEW messages with MCP tags...');
  
  const allElements = document.querySelectorAll('.ds-message, [class*="message"], [class*="assistant"], [class*="bot"], [class*="markdown"]');
  let found = 0;
  
  for (const el of allElements) {
    const fullText = el.textContent || '';
    
    let hasTool = false;
    for (const tool of AVAILABLE_TOOLS) {
      if (fullText.includes(`==MCP:${tool}==`)) {
        hasTool = true;
        break;
      }
    }
    if (!hasTool) continue;
    
    const isUser = el.className?.toString()?.includes('user') || 
                   el.className?.toString()?.includes('User');
    if (isUser) continue;
    
    // Проверяем, не обрабатывали ли уже это сообщение
    const msgHash = fullText.substring(0, 100) + '_' + fullText.length;
    const msgId = el.dataset.mcpId || msgHash;
    
    if (processedMessages.has(msgId)) continue;
    
    el.dataset.mcpId = msgId;
    found++;
    console.log(`🔍 Found NEW message with MCP tag, processing...`);
    processMessage(el);
  }
  
  if (found === 0) {
    console.log('ℹ️ MCP Bridge: No NEW messages with MCP tags found');
  }
  
  return found;
}

async function processMessage(element) {
  if (!enabled || processing) return;
  
  const fullText = element.textContent || '';
  const msgHash = fullText.substring(0, 100) + '_' + fullText.length;
  const msgId = element.dataset.mcpId || msgHash;
  
  if (!element.dataset.mcpId) {
    element.dataset.mcpId = msgId;
  }
  
  if (processedMessages.has(msgId)) {
    console.log(`⏭️ MCP Bridge: Message already processed, skipping`);
    return;
  }
  
  console.log('📝 MCP Bridge: ===== FULL MESSAGE TEXT =====');
  console.log(fullText);
  console.log('📝 MCP Bridge: ===== END OF MESSAGE =====');
  
  const tools = extractMCPTags(fullText);
  
  if (tools.length === 0) {
    console.log('ℹ️ MCP Bridge: No MCP tags found in this message');
    return;
  }
  
  console.log('🔍 MCP Bridge: Found tools to execute:', tools.map(t => t.toolName));
  
  processedMessages.add(msgId);
  processing = true;
  
  const results = [];
  
  for (const tool of tools) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_TOOL',
        toolName: tool.toolName,
        args: tool.args
      });
      
      console.log('🔍 MCP Bridge: Response from service worker:', response);
      
      let resultText;
      if (response.success) {
        const result = response.result;
        if (typeof result === 'string') {
          resultText = result;
        } else if (result && typeof result === 'object') {
          if (result.content && Array.isArray(result.content)) {
            resultText = result.content.map(c => c.text || '').join('\n');
          } else {
            resultText = JSON.stringify(result, null, 2);
          }
        } else {
          resultText = String(result);
        }
      } else {
        resultText = `Error: ${response.error}`;
      }
      
      results.push({ toolName: tool.toolName, result: resultText, ok: response.success });
    } catch (err) {
      results.push({ toolName: tool.toolName, result: err.message, ok: false });
    }
  }
  
  if (results.length > 0) {
    const summary = results.map(r => {
      const prefix = r.ok ? '✅' : '❌';
      const truncated = r.result.length > 500 ? r.result.substring(0, 500) + '...' : r.result;
      return `${prefix} ${r.toolName}: ${truncated}`;
    }).join('\n\n');
    
    const message = `[MCP Tools Executed]\n\n${summary}`;
    
    console.log(`📤 Auto-send is: ${config.autoSend ? 'ON ✅' : 'OFF ❌'}`);
    
    const delayMs = config.sendDelay * 1000;
    if (delayMs > 0) {
      console.log(`⏳ Waiting ${config.sendDelay}s before inserting...`);
      await sleep(delayMs);
    }
    
    await insertTextToInput(message);
  }
  
  processing = false;
}

// ==================== ТАЙМЕР (только новые сообщения) ====================

console.log('🔍 MCP Bridge: Starting periodic scan (every 2 seconds)...');

setInterval(() => {
  const count = findNewMessagesWithMCPTags();
  if (count > 0) {
    console.log(`⏰ Timer scan: found ${count} new message(s) with MCP tags`);
  }
}, 2000);

// ==================== ЗАПУСК ====================

console.log('✅ MCP Browser Bridge loaded');
console.log('⚙️ Config:', config);

// НЕТ initial scan — только новые сообщения!