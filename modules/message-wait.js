// message-wait.js — Ожидание полной загрузки

import { CONFIG } from './config.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForMessageComplete(element) {
  console.log('⏳ Waiting for message to fully render...');
  
  let lastLength = 0;
  let stableCount = 0;
  const maxStable = CONFIG.waitStableCount;
  const checkInterval = CONFIG.waitCheckInterval;
  
  while (stableCount < maxStable) {
    const currentText = element.textContent || '';
    const currentLength = currentText.length;
    
    if (currentLength === lastLength) {
      stableCount++;
    } else {
      stableCount = 0;
      lastLength = currentLength;
    }
    
    const hasCopy = element.querySelector('button[aria-label*="copy" i], [class*="copy"]');
    if (hasCopy) {
      await sleep(500);
      break;
    }
    
    await sleep(checkInterval);
  }
  
  console.log('✅ Message fully rendered');
}