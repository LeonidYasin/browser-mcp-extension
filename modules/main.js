// main.js — Запуск и инициализация

import { CONFIG } from './config.js';
import { loadSettings, listenStorageChanges } from './storage.js';
import { setAvailableTools } from './extractors.js';
import { findNewAssistantMessages, clearProcessedMessages } from './message-finder.js';

async function loadToolsList() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'LIST_TOOLS' });
    if (response?.success && response.tools) {
      const tools = response.tools.map(t => t.name);
      setAvailableTools(tools);
      console.log('📦 Available tools:', tools.join(', '));
    }
  } catch (error) {
    console.error('❌ Error loading tools:', error);
  }
}

export async function init() {
  console.log('✅ MCP Browser Bridge loaded');
  
  await loadSettings();
  listenStorageChanges();
  await loadToolsList();
  clearProcessedMessages();
  
  console.log(`🔍 Scanning every ${CONFIG.scanInterval}ms...`);
  setInterval(() => {
    const count = findNewAssistantMessages();
    if (count > 0) {
      console.log(`⏰ Found ${count} new message(s)`);
    }
  }, CONFIG.scanInterval);
}

// Обработка сообщений от popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_MESSAGES') {
    try {
      const count = findNewAssistantMessages();
      sendResponse({ success: true, count });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
});

init();