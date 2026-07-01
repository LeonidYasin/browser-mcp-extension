// content.js — Content script для страницы чата DeepSeek

let enabled = true;
let processing = false;
let config = {
  autoSend: true,
  sendDelay: 1
};

// Загружаем настройки
chrome.storage.local.get(['enabled', 'autoSend', 'sendDelay'], (data) => {
  if (data.enabled !== undefined) enabled = data.enabled;
  config.autoSend = data.autoSend !== false;
  config.sendDelay = data.sendDelay || 1;
  console.log('🔍 MCP Bridge: Config loaded', config);
});

// Слушаем изменения настроек
chrome.storage.onChanged.addListener((changes) => {
  if (changes.autoSend) config.autoSend = changes.autoSend.newValue;
  if (changes.sendDelay) config.sendDelay = changes.sendDelay.newValue || 1;
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

// ==================== Поиск элементов чата ====================

function findInputArea() {
  const selectors = [
    'textarea',
    '[contenteditable="true"]',
    '#chat-input',
    '.chat-input',
    '[class*="input"] textarea',
    '[class*="chat"] textarea',
    '[class*="message-input"]',
    '[role="textbox"]',
    '.ds-input',
    '#prompt-textarea',
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="ask"]'
  ];
  
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        console.log('🔍 MCP Bridge: Found input with selector:', selector);
        return el;
      }
    } catch (e) {}
  }
  
  const textareas = document.querySelectorAll('textarea');
  if (textareas.length > 0) {
    console.log('🔍 MCP Bridge: Found textarea, using first one');
    return textareas[0];
  }
  
  console.error('🔍 MCP Bridge: No input found');
  return null;
}

function findSendButton() {
  const byAria = document.querySelector('[aria-label*="send" i], [aria-label*="Send" i]');
  if (byAria) {
    console.log('🔍 MCP Bridge: Found send button by aria-label');
    return byAria;
  }
  
  const classSelectors = [
    '[class*="send"]',
    '[class*="submit"]',
    '[class*="chat-send"]',
    '[class*="message-send"]',
    '[class*="input-send"]',
    '[class*="btn-send"]'
  ];
  
  for (const selector of classSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        console.log('🔍 MCP Bridge: Found send button with selector:', selector);
        return el;
      }
    } catch (e) {}
  }
  
  const allElements = document.querySelectorAll('div, span, svg, path');
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
      
      if (clickable && clickable.click) {
        console.log('🔍 MCP Bridge: Found send button via SVG/icon');
        return clickable;
      }
    }
  }
  
  const allWithClass = document.querySelectorAll('[class]');
  for (const el of allWithClass) {
    const className = el.className?.toString()?.toLowerCase() || '';
    if (className.includes('send') || className.includes('submit') || 
        className.includes('chat-send') || className.includes('message-send')) {
      console.log('🔍 MCP Bridge: Found send button by class name:', className);
      return el;
    }
  }
  
  console.error('🔍 MCP Bridge: No send button found');
  return null;
}

// ==================== Отправка результата (быстрая) ====================

async function sendMessageAsHuman(text) {
  const textarea = findInputArea();
  const sendBtn = findSendButton();
  
  if (!textarea) {
    console.error('❌ MCP Bridge: Cannot find input');
    return false;
  }

  console.log('✅ MCP Bridge: Input found, sending message...');

  if (textarea.tagName === 'TEXTAREA') {
    textarea.value = '';
  } else {
    textarea.textContent = '';
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  
  await sleep(100);

  // Вставляем текст МГНОВЕННО
  if (textarea.tagName === 'TEXTAREA') {
    textarea.value = text;
  } else {
    textarea.textContent = text;
  }
  textarea.dispatchEvent(new Event('input', { bubbles: true }));

  const delayMs = config.sendDelay * 1000;
  console.log(`🔍 MCP Bridge: Waiting ${config.sendDelay}s before sending...`);
  await sleep(delayMs);

  console.log('🔍 MCP Bridge: Sending...');
  const enterEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  textarea.dispatchEvent(enterEvent);
  
  await sleep(100);
  
  if (sendBtn) {
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
  }
  
  return true;
}

// ==================== Обработка XML-тегов ====================

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

const HTML_TAGS = new Set([
  'div', 'span', 'p', 'a', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th',
  'thead', 'tbody', 'section', 'article', 'header', 'footer', 'nav',
  'main', 'aside', 'figure', 'figcaption', 'blockquote', 'pre', 'code',
  'br', 'hr', 'img', 'video', 'audio', 'canvas', 'svg', 'path',
  'circle', 'rect', 'button', 'input', 'form', 'label', 'select',
  'option', 'textarea', 'style', 'script', 'iframe', 'object',
  'embed', 'param', 'meta', 'link', 'title', 'head', 'body', 'html'
]);

function extractMCPTags(html) {
  const tools = [];
  
  const normalRegex = /<([a-z_]+)>\s*(\{[^]*?\})\s*<\/\1>/gi;
  let match;
  
  while ((match = normalRegex.exec(html)) !== null) {
    const tagName = match[1];
    if (HTML_TAGS.has(tagName.toLowerCase())) {
      console.log(`⏭️ Skipping HTML tag: <${tagName}>`);
      continue;
    }
    
    try {
      const args = JSON.parse(match[2]);
      tools.push({
        toolName: tagName,
        args: args,
        original: match[0],
        isEscaped: false
      });
    } catch (e) {
      console.error('MCP Bridge: Failed to parse', tagName, e);
    }
  }
  
  if (tools.length === 0) {
    const escapedRegex = /&lt;([a-z_]+)&gt;\s*(\{[^]*?\})\s*&lt;\/\1&gt;/gi;
    while ((match = escapedRegex.exec(html)) !== null) {
      const tagName = match[1];
      if (HTML_TAGS.has(tagName.toLowerCase())) {
        continue;
      }
      
      try {
        const args = JSON.parse(match[2]);
        tools.push({
          toolName: tagName,
          args: args,
          original: match[0],
          isEscaped: true
        });
        console.log(`🔍 Found escaped tag: &lt;${tagName}&gt;`);
      } catch (e) {
        console.error('MCP Bridge: Failed to parse escaped', tagName, e);
      }
    }
  }
  
  return tools;
}

async function processMessageElement(element, source = 'unknown') {
  if (!enabled || processing) return;
  
  const html = element.innerHTML;
  const text = element.textContent || '';
  
  console.log(`🔍 Processing ${source} message...`);
  
  let tools = extractMCPTags(html);
  
  if (tools.length === 0) {
    tools = extractMCPTags(text);
  }
  
  if (tools.length === 0) {
    if (text.includes('&lt;') || text.includes('<')) {
      console.log('🔍 Found potential tags but no valid MCP tools in', source);
    }
    return;
  }
  
  console.log('🔍 MCP Bridge: Found tools to execute:', tools.map(t => t.toolName));
  
  const unknownTools = tools.filter(t => !AVAILABLE_TOOLS_SET.has(t.toolName));
  if (unknownTools.length > 0) {
    const names = unknownTools.map(t => t.toolName).join(', ');
    console.warn(`⚠️ MCP Bridge: Unknown tools: ${names}. Available: ${AVAILABLE_TOOLS.join(', ')}`);
    
    let newHtml = element.innerHTML;
    for (const tool of unknownTools) {
      const errorHtml = `<div class="mcp-error">❌ Unknown tool: "${tool.toolName}". Available: ${AVAILABLE_TOOLS.join(', ')}</div>`;
      newHtml = newHtml.replace(tool.original, errorHtml);
    }
    element.innerHTML = newHtml;
    
    const validTools = tools.filter(t => AVAILABLE_TOOLS_SET.has(t.toolName));
    if (validTools.length === 0) return;
    tools = validTools;
  }
  
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
  
  if (results.length > 0 && config.autoSend) {
    const summary = results.map(r => {
      const prefix = r.ok ? '✅' : '❌';
      const truncated = r.result.length > 500 
        ? r.result.substring(0, 500) + '...' 
        : r.result;
      return `${prefix} ${r.toolName}: ${truncated}`;
    }).join('\n\n');
    
    const message = `[MCP Tools Executed]\n\n${summary}`;
    
    await sleep(300);
    await sendMessageAsHuman(message);
  } else if (results.length > 0 && !config.autoSend) {
    console.log('🔍 MCP Bridge: Auto-send disabled, result shown only in chat');
  }
  
  processing = false;
}

// ==================== ПОИСК СООБЩЕНИЙ (автоматический) ====================

function findMessagesWithMCPTags() {
  console.log('🔍 MCP Bridge: Scanning for messages with MCP tags...');
  
  // Ищем ВСЕ возможные контейнеры сообщений
  const allElements = document.querySelectorAll('div, section, article, .ds-message, [class*="message"], [class*="assistant"], [class*="bot"], [class*="user"]');
  
  let found = 0;
  for (const el of allElements) {
    const text = el.textContent || '';
    if (!text.includes('</') && !text.includes('&lt;/')) continue;
    if (!text.includes('{')) continue;
    
    // Проверяем, что это действительно сообщение (а не навигация, сайдбар и т.д.)
    const isMessage = 
      el.className?.toString()?.includes('message') ||
      el.className?.toString()?.includes('assistant') ||
      el.className?.toString()?.includes('bot') ||
      el.className?.toString()?.includes('user') ||
      el.matches?.('.ds-message') ||
      el.id?.includes('message');
    
    if (!isMessage) continue;
    
    if (!pendingMessages.has(el)) {
      pendingMessages.add(el);
      found++;
      const source = el.className?.includes('assistant') ? 'assistant' : 
                     el.className?.includes('user') ? 'user' : 'unknown';
      console.log(`🔍 Found ${source} message with MCP tags`);
      
      setTimeout(() => {
        processMessageElement(el, source);
        pendingMessages.delete(el);
      }, 500);
    }
  }
  
  return found;
}

// ==================== ОСНОВНОЙ ЦИКЛ АВТОМАТИЧЕСКОГО СКАНИРОВАНИЯ ====================

let scanInterval = null;

function startAutoScan() {
  // Первое сканирование через 2 секунды
  setTimeout(() => {
    const count = findMessagesWithMCPTags();
    console.log(`🔍 Initial scan: found ${count} messages with MCP tags`);
  }, 2000);
  
  // Повторное сканирование через 5 секунд
  setTimeout(() => {
    const count = findMessagesWithMCPTags();
    console.log(`🔍 Second scan: found ${count} messages with MCP tags`);
  }, 5000);
  
  // Запускаем периодическое сканирование каждые 3 секунды
  // Это гарантирует, что новые сообщения от ассистента будут найдены
  scanInterval = setInterval(() => {
    const count = findMessagesWithMCPTags();
    if (count > 0) {
      console.log(`🔍 Periodic scan: found ${count} messages with MCP tags`);
    }
  }, 3000);
}

// ==================== DOM Observer (дополнительный) ====================

let pendingMessages = new Set();

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    // Проверяем добавленные узлы
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1) continue;
      
      const text = node.textContent || '';
      if (!text.includes('</') && !text.includes('&lt;/')) continue;
      if (!text.includes('{')) continue;
      
      // Ищем родительское сообщение
      let msgElement = node;
      let attempts = 0;
      while (msgElement && attempts < 20) {
        attempts++;
        const classes = msgElement.className?.toString() || '';
        if (classes.includes('message') || 
            classes.includes('user') || 
            classes.includes('assistant') || 
            classes.includes('bot') ||
            classes.includes('chat-message') ||
            classes.includes('ds-message')) {
          break;
        }
        msgElement = msgElement.parentElement;
      }
      
      if (msgElement && !pendingMessages.has(msgElement)) {
        pendingMessages.add(msgElement);
        const source = msgElement.className?.includes('assistant') ? 'assistant' : 
                       msgElement.className?.includes('user') ? 'user' : 'unknown';
        console.log(`🔍 MutationObserver: found new ${source} message`);
        setTimeout(() => {
          processMessageElement(msgElement, source);
          pendingMessages.delete(msgElement);
        }, 1500);
      }
    }
    
    // Проверяем изменения атрибутов (DeepSeek может обновлять существующие элементы)
    if (mutation.type === 'attributes') {
      const target = mutation.target;
      const text = target.textContent || '';
      if ((text.includes('</') || text.includes('&lt;/')) && text.includes('{')) {
        const classes = target.className?.toString() || '';
        if (classes.includes('message') || classes.includes('assistant') || classes.includes('ds-message')) {
          if (!pendingMessages.has(target)) {
            pendingMessages.add(target);
            console.log('🔍 MutationObserver: attribute change on message');
            setTimeout(() => {
              processMessageElement(target, 'assistant');
              pendingMessages.delete(target);
            }, 1000);
          }
        }
      }
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'style']
});

// ==================== Обработка сообщений от popup ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_MESSAGES') {
    console.log('🔍 Manual scan triggered from popup');
    try {
      const count = findMessagesWithMCPTags();
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

// Запускаем автоматическое сканирование
startAutoScan();

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