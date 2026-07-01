// config.js — Настройки плагина

export const CONFIG = {
  autoSend: true,
  sendDelay: 0.5,
  scanInterval: 2000,
  maxAttempts: 5,
  waitStableCount: 3,
  waitCheckInterval: 500
};

export let enabled = true;
export let processing = false;

export function setProcessing(value) {
  processing = value;
}