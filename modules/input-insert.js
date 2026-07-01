// input-insert.js — Вставка в поле ввода

import { CONFIG } from './config.js';
import { findInputArea, findSendButton } from './dom-utils.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function insertTextToInput(text) {
  console.log('📤 Inserting text into input field...');
  
  let textarea = null;
  let attempts = 0;
  
  while (attempts < CONFIG.maxAttempts) {
    textarea = findInputArea();
    if (textarea) break;
    await sleep(500);
    attempts++;
  }
  
  if (!textarea) {
    console.error('❌ Cannot find input');
    return false;
  }

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
    
    console.log('✅ Text inserted');
    
    if (CONFIG.autoSend) {
      await sleep(200);
      const sendBtn = findSendButton();
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
        console.log('✅ Sent!');
      } else {
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });
        textarea.dispatchEvent(enterEvent);
        console.log('✅ Enter key sent!');
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to insert:', error);
    return false;
  }
}