// executor.js — Выполнение инструментов

import { CONFIG, enabled, processing, setProcessing } from './config.js';
import { extractMCPTags } from './extractors.js';
import { waitForMessageComplete } from './message-wait.js';
import { insertTextToInput } from './input-insert.js';

let processedMessages = new Set();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function processMessage(element) {
  if (!enabled || processing) return;
  
  const fullText = element.textContent || '';
  const msgHash = fullText.substring(0, 100) + '_' + fullText.length;
  const msgId = element.dataset.mcpId || msgHash;
  
  if (!element.dataset.mcpId) {
    element.dataset.mcpId = msgId;
  }
  
  if (processedMessages.has(msgId)) {
    console.log('⏭️ Already processed');
    return;
  }
  
  await waitForMessageComplete(element);
  
  const tools = extractMCPTags(element.textContent || '');
  if (tools.length === 0) return;
  
  console.log('🔍 Tools to execute:', tools.map(t => t.toolName));
  
  processedMessages.add(msgId);
  setProcessing(true);
  
  const results = [];
  
  for (const tool of tools) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_TOOL',
        toolName: tool.toolName,
        args: tool.args
      });
      
      let resultText;
      if (response.success) {
        const result = response.result;
        if (typeof result === 'string') {
          resultText = result;
        } else if (result?.content && Array.isArray(result.content)) {
          resultText = result.content.map(c => c.text || '').join('\n');
        } else {
          resultText = JSON.stringify(result, null, 2);
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
    const summary = results.map(r => 
      `${r.ok ? '✅' : '❌'} ${r.toolName}: ${r.result.substring(0, 500)}`
    ).join('\n\n');
    
    const message = `[MCP Tools Executed]\n\n${summary}`;
    
    if (CONFIG.sendDelay > 0) {
      await sleep(CONFIG.sendDelay * 1000);
    }
    
    await insertTextToInput(message);
  }
  
  setProcessing(false);
}