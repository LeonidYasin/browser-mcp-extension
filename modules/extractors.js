// extractors.js — Извлечение MCP-маркеров

export let AVAILABLE_TOOLS = [];
export let AVAILABLE_TOOLS_SET = new Set();

export function setAvailableTools(tools) {
  AVAILABLE_TOOLS = tools;
  AVAILABLE_TOOLS_SET = new Set(tools);
}

export function extractMCPTags(text) {
  const tools = [];
  
  let cleanText = text;
  cleanText = cleanText.replace(/```[\s\S]*?```/g, '');
  cleanText = cleanText.replace(/textCopyDownload[\s\S]*?(?=```|$)/g, '');
  
  for (const toolName of AVAILABLE_TOOLS) {
    const regex = new RegExp(`==MCP:${toolName}==\\s*(\\{[^]*?\\})`, 'gi');
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      try {
        const args = JSON.parse(match[1]);
        tools.push({
          toolName: toolName,
          args: args,
          original: match[0]
        });
        console.log(`🔍 Found marker: ==MCP:${toolName}==`);
      } catch (e) {
        console.error(`Failed to parse args for ${toolName}`, e);
      }
    }
  }
  
  return tools;
}