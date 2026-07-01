// content.js — Content script для страницы чата DeepSeek

let enabled = true;
let processing = false;
let config = {
  autoSend: true,  // true = нажимать кнопку отправки после вставки, false = только вставить
  sendDelay: 0.5
};

// Загружаем настройки
chrome.storage.local.get(['enabled', 'autoSend', 'sendDelay'], (data) => {
  if (data.enabled !== undefined) enabled = data.enabled;
  config.autoSend = data.autoSend !== undefined ? data.autoSend : true;
  config.sendDelay = data.sendDelay || 0.5;
  console.log('🔍 MCP Bridge: Config loaded from storage', config);
});

// Слушаем изменения настроек
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoSend !== undefined) {
    config.autoSend = changes.autoSend.newValue !== false;
    console.log('🔍 MCP Bridge: autoSend updated to', config.autoSend);
  }
  if (changes.sendDelay !== undefined) {
    config.sendDelay = changes.sendDelay.newValue || 0.5;
  }
});

// ==================== Утилиты ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== ПОИСК ПОЛЯ ВВОДА ====================

function findInputArea() {
  console.log('🔍 MCP Bridge: Looking for input field...');
  
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
  
  const byAria = document.querySelector('[aria-label*="message" i], [aria-label*="chat" i], [aria-label*="input" i]');
  if (byAria) {
    console.log('✅ MCP Bridge: Found by aria-label');
    return byAria;
  }
  
  console.error('❌ MCP Bridge: No input found!');
  console.log('🔍 DEBUG: All textareas:', document.querySelectorAll('textarea'));
  console.log('🔍 DEBUG: All contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
  
  return null;
}

// ==================== ПОИСК КНОПКИ ОТПРАВКИ ====================

function findSendButton() {
  console.log('🔍 MCP Bridge: Looking for send button...');
  
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
  
  // Ищем по иконке
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

// ==================== ВСТАВКА В ПОЛЕ ВВОДА + ОТПРАВКА ====================

async function insertTextAndSend(text, autoSend) {
  console.log('📤 MCP Bridge: Inserting text into input field...');
  console.log('📤 Auto-send (click send button):', autoSend ? 'ON ✅' : 'OFF ❌');
  console.log('📝 Text length:', text.length);
  
  // Находим поле ввода
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
    console.log('📝 Text was:', text.substring(0, 200) + '...');
    return false;
  }

  console.log('✅ MCP Bridge: Input found, inserting text...');

  try {
    // Очищаем поле
    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = '';
    } else {
      textarea.textContent = '';
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    
    await sleep(100);

    // Вставляем текст
    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = text;
    } else {
      textarea.textContent = text;
    }
    
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    textarea.dispatchEvent(new Event('compositionend', { bubbles: true }));
    
    textarea.focus();
    
    if (textarea.setSelectionRange) {
      const len = textarea.value ? textarea.value.length : textarea.textContent?.length || 0;
      textarea.setSelectionRange(len, len);
    }
    
    console.log('✅ MCP Bridge: Text inserted into input field');
    console.log('📝 Preview:', text.substring(0, 200) + '...');
    
    // Если autoSend = true, НАЖИМАЕМ КНОПКУ ОТПРАВКИ
    if (autoSend) {
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
        // Пробуем Enter как fallback
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
      console.log('🔍 MCP Bridge: Auto-send disabled, text inserted but not sent (you can edit and send manually)');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ MCP Bridge: Failed to insert/send:', error);
    return false;
  }
}

// ==================== Обработка MCP-маркеров ====================

const AVAILABLE_TOOLS = [
  'create_or_update_file',
  'delete_file',
  'get_commit_status',
  'get_file_contents',
  'get_full_workflow_logs',
  'get_latest_workflow_error',
  'get_workflow_by_file',
  'get_workflow_run_logs',
  'list_commits'
];

const AVAILABLE_TOOLS_SET = new Set(AVAILABLE_TOOLS);

let processedAssistantMessages = new Set();

function extractMCPTags(text) {
  const tools = [];
  
  console.log('🔍 MCP Bridge: Extracting tags from text (first 200 chars):', text.substring(0, 200) + '...');
  
  for (const toolName of AVAILABLE_TOOLS) {
    const regex = new RegExp(`==MCP:${toolName}==\\s*(\\{[^]*?\\})`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const argsStr = match[1];
      console.log(`🔍 Found marker: ==MCP:${toolName}== with args: ${argsStr}`);
      try {
        const args = JSON.parse(argsStr);
        tools.push({
          toolName: toolName,
          args: args,
          original: match[0],
          type: 'marker'
        });
      } catch (e) {
        console.error(`MCP Bridge: Failed to parse args for ${toolName}`, e);
      }
    }
  }
  
  if (tools.length === 0) {
    const normalRegex = /<([a-z_]+)>\s*(\{[^]*?\})\s*<\/\1>/gi;
    let match;
    while ((match = normalRegex.exec(text)) !== null) {
      const toolName = match[1];
      if (['div', 'span', 'p', 'a', 'b', 'i', 'strong', 'em'].includes(toolName.toLowerCase())) {
        continue;
      }
      if (!AVAILABLE_TOOLS_SET.has(toolName)) {
        console.log(`⏭️ Skipping unknown XML tool: ${toolName}`);
        continue;
      }
      try {
        const args = JSON.parse(match[2]);
        tools.push({
          toolName: toolName,
          args: args,
          original: match[0],
          type: 'xml'
        });
        console.log(`🔍 Found XML tag: <${toolName}>`);
      } catch (e) {
        console.error('MCP Bridge: Failed to parse XML', toolName, e);
      }
    }
  }
  
  return tools;
}

async function processAssistantMessage(element) {
  if (!enabled || processing) return;
  
  const msgId = element.dataset.mcpId || Date.now() + '_' + Math.random().toString(36);
  if (!element.dataset.mcpId) {
    element.dataset.mcpId = msgId;
  }
  
  if (processedAssistantMessages.has(msgId)) {
    console.log(`⏭️ MCP Bridge: Message ${msgId} already processed, skipping`);
    return;
  }
  
  const fullText = element.textContent || '';
  console.log('📝 MCP Bridge: ===== FULL MESSAGE TEXT =====');
  console.log(fullText);
  console.log('📝 MCP Bridge: ===== END OF MESSAGE =====');
  
  const tools = extractMCPTags(fullText);
  
  if (tools.length === 0) {
    console.log('ℹ️ MCP Bridge: No MCP tags found in this message');
    return;
  }
  
  console.log('🔍 MCP Bridge: Found tools to execute:', tools.map(t => t.toolName));
  
  processedAssistantMessages.add(msgId);
  
  processing = true;
  
  const results = [];
  let newHtml = element.innerHTML;
  
  for (const tool of tools) {
    const placeholder = `<div class="mcp-executing">⏳ ${tool.toolName}...</div>`;
    newHtml = newHtml.replace(tool.original, placeholder);
    element.innerHTML = newHtml;
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_TOOL',
        toolName: tool.toolName,
        args: tool.args
      });
      
      const resultText = response.success 
        ? response.result 
        : `❌ ${response.error}`;
      
      const resultHtml = `<div class="mcp-result">
        <div class="mcp-result-header">🔧 ${tool.toolName}</div>
        <pre class="mcp-result-output">${escapeHtml(resultText)}</pre>
      </div>`;
      
      newHtml = newHtml.replace(placeholder, resultHtml);
      element.innerHTML = newHtml;
      
      results.push({ toolName: tool.toolName, result: resultText, ok: response.success });
    } catch (err) {
      newHtml = newHtml.replace(placeholder, `<div class="mcp-error">❌ ${err.message}</div>`);
      element.innerHTML = newHtml;
      results.push({ toolName: tool.toolName, result: err.message, ok: false });
    }
  }
  
  if (results.length > 0) {
    console.log(`📊 MCP Bridge: ${results.length} tool(s) executed`);
    
    const summary = results.map(r => {
      const prefix = r.ok ? '✅' : '❌';
      const truncated = r.result.length > 500 
        ? r.result.substring(0, 500) + '...' 
        : r.result;
      return `${prefix} ${r.toolName}: ${truncated}`;
    }).join('\n\n');
    
    const message = `[MCP Tools Executed]\n\n${summary}`;
    
    console.log(`📤 Auto-send (click send button) is: ${config.autoSend ? 'ON ✅' : 'OFF ❌'}`);
    
    // ВСЕГДА вставляем текст в поле ввода
    // Если autoSend = true — ещё и нажимаем кнопку отправки
    const delayMs = config.sendDelay * 1000;
    if (delayMs > 0) {
      console.log(`⏳ Waiting ${config.sendDelay}s before inserting...`);
      await sleep(delayMs);
    }
    
    await insertTextAndSend(message, config.autoSend);
  }
  
  processing = false;
}

// ==================== ПОИСК СООБЩЕНИЙ АССИСТЕНТА ====================

function findAndProcessNewAssistantMessages() {
  console.log('🔍 MCP Bridge: Scanning for new assistant messages...');
  
  const selectors = [
    '.ds-message',
    '[class*="assistant"]',
    '[class*="bot"]',
    '[class*="message"][class*="assistant"]'
  ];
  
  let found = 0;
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const isAssistant = 
          el.className?.toString()?.includes('assistant') ||
          el.className?.toString()?.includes('bot');
        
        if (!isAssistant) continue;
        
        const text = el.textContent || '';
        let hasValidTool = false;
        for (const tool of AVAILABLE_TOOLS) {
          if (text.includes(`==MCP:${tool}==`) || text.includes(`<${tool}>`)) {
            hasValidTool = true;
            break;
          }
        }
        if (!hasValidTool) continue;
        if (!text.includes('{')) continue;
        
        const msgId = el.dataset.mcpId || '';
        if (processedAssistantMessages.has(msgId)) continue;
        
        found++;
        console.log(`🔍 Found NEW assistant message with MCP tags, processing...`);
        processAssistantMessage(el);
      }
    } catch (e) {}
  }
  
  return found;
}

// ==================== DOM Observer ====================

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      
      const text = node.textContent || '';
      
      let hasValidTool = false;
      for (const tool of AVAILABLE_TOOLS) {
        if (text.includes(`==MCP:${tool}==`) || text.includes(`<${tool}>`)) {
          hasValidTool = true;
          break;
        }
      }
      if (!hasValidTool) continue;
      if (!text.includes('{')) continue;
      
      let msgElement = node;
      let attempts = 0;
      while (msgElement && attempts < 20) {
        attempts++;
        const classes = msgElement.className?.toString() || '';
        if (classes.includes('assistant') || classes.includes('bot')) {
          break;
        }
        msgElement = msgElement.parentElement;
      }
      
      if (!msgElement) continue;
      
      const msgId = msgElement.dataset.mcpId || '';
      if (processedAssistantMessages.has(msgId)) continue;
      
      console.log('🔍 MutationObserver: Found NEW assistant message, processing...');
      processAssistantMessage(msgElement);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// ==================== Обработка сообщений от popup ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_MESSAGES') {
    console.log('🔍 Manual scan triggered from popup');
    try {
      const count = findAndProcessNewAssistantMessages();
      sendResponse({ success: true, count: count });
    } catch (error) {
      console.error('Scan error:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

// ==================== ЗАПУСК ====================

console.log('✅ MCP Browser Bridge loaded');
console.log('📦 Available tools:', AVAILABLE_TOOLS.join(', '));
console.log('⚙️ Config:', config);

setTimeout(() => {
  const count = findAndProcessNewAssistantMessages();
  console.log(`🔍 Initial scan: found ${count} new assistant messages with MCP tags`);
}, 2000);

setTimeout(() => {
  const count = findAndProcessNewAssistantMessages();
  console.log(`🔍 Second scan: found ${count} new assistant messages with MCP tags`);
}, 5000);

// ==================== Стили ====================

const style = document.createElement('style');
style.textContent = `
  .mcp-executing {
    background: #e3f2fd;
    border: 1px solid #64b5f6;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px 0;
    font-family: monospace;
    font-size: 13px;
    animation: mcp-pulse 1.5s infinite;
  }
  @keyframes mcp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  .mcp-result {
    background: #f5f5f5;
    border: 1px solid #66bb6a;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px 0;
  }
  .mcp-result-header {
    font-weight: bold;
    margin-bottom: 4px;
    color: #2e7d32;
  }
  .mcp-result-output {
    background: #fff;
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
    max-height: 300px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .mcp-error {
    background: #ffebee;
    border: 1px solid #ef5350;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 4px 0;
    color: #c62828;
    font-family: monospace;
  }
`;
document.head.appendChild(style);