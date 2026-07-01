// message-finder.js — Поиск новых сообщений

import { AVAILABLE_TOOLS } from './extractors.js';
import { processMessage } from './executor.js';

let processedMessages = new Set();

export function findNewAssistantMessages() {
  const allElements = document.querySelectorAll('.ds-message, [class*="message"], [class*="assistant"], [class*="bot"], [class*="markdown"]');
  let found = 0;
  
  for (const el of allElements) {
    const isUser = el.className?.toString()?.includes('user') || 
                   el.className?.toString()?.includes('User');
    if (isUser) continue;
    
    const fullText = el.textContent || '';
    let hasMarker = false;
    for (const tool of AVAILABLE_TOOLS) {
      if (fullText.includes(`==MCP:${tool}==`)) {
        hasMarker = true;
        break;
      }
    }
    if (!hasMarker) continue;
    
    const msgHash = fullText.substring(0, 100) + '_' + fullText.length;
    const msgId = el.dataset.mcpId || msgHash;
    if (processedMessages.has(msgId)) continue;
    
    el.dataset.mcpId = msgId;
    found++;
    console.log(`🔍 Found NEW assistant message, processing...`);
    processMessage(el);
  }
  
  return found;
}

export function clearProcessedMessages() {
  processedMessages = new Set();
}