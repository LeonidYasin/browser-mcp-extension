// storage.js — Работа с chrome.storage

import { CONFIG } from './config.js';

export async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['enabled', 'autoSend', 'sendDelay'], (data) => {
      if (data.autoSend !== undefined) {
        CONFIG.autoSend = data.autoSend !== false;
      }
      if (data.sendDelay !== undefined) {
        CONFIG.sendDelay = data.sendDelay || 0.5;
      }
      console.log('🔍 MCP Bridge: Config loaded', CONFIG);
      resolve(CONFIG);
    });
  });
}

export function listenStorageChanges() {
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoSend) {
      CONFIG.autoSend = changes.autoSend.newValue !== false;
    }
    if (changes.sendDelay) {
      CONFIG.sendDelay = changes.sendDelay.newValue || 0.5;
    }
  });
}