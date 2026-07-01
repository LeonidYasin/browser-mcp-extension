// dom-utils.js — Поиск элементов в DOM

export function findInputArea() {
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
        console.log('✅ Found input with selector:', selector);
        return el;
      }
    } catch (e) {}
  }
  
  const textareas = document.querySelectorAll('textarea');
  if (textareas.length > 0) {
    for (const ta of textareas) {
      const rect = ta.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 30) {
        console.log('✅ Found textarea by visibility/size');
        return ta;
      }
    }
    return textareas[0];
  }
  
  console.error('❌ No input found!');
  return null;
}

export function findSendButton() {
  const selectors = [
    'button[type="submit"]',
    '[class*="send"]',
    '[class*="submit"]',
    'button[aria-label*="send" i]',
    '[class*="chat-send"]',
    '[class*="message-send"]',
    '[class*="btn-send"]'
  ];
  
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el) return el;
    } catch (e) {}
  }
  
  const allElements = document.querySelectorAll('div, span, button, svg, path');
  for (const el of allElements) {
    const html = el.innerHTML?.toLowerCase() || '';
    const aria = el.getAttribute('aria-label')?.toLowerCase() || '';
    if (aria.includes('send') || aria.includes('submit') ||
        (html.includes('svg') && (html.includes('arrow') || html.includes('paper-plane')))) {
      let clickable = el;
      while (clickable && !clickable.click && clickable.parentElement) {
        clickable = clickable.parentElement;
      }
      if (clickable && (clickable.click || clickable.tagName === 'BUTTON')) {
        return clickable;
      }
    }
  }
  
  return null;
}