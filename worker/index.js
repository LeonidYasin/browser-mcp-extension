// worker/index.js — Минимальный прокси

let config = {
  url: 'http://127.0.0.1:8080',
  token: ''
};

chrome.storage.local.get(['mcpUrl', 'mcpToken'], (data) => {
  if (data.mcpUrl) config.url = data.mcpUrl;
  if (data.mcpToken) config.token = data.mcpToken;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PROXY') {
    fetch(config.url + message.path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
      },
      body: JSON.stringify(message.data)
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});