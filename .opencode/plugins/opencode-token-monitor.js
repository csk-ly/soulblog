// @bun
// plugin/index.ts
import { tool } from "@opencode-ai/plugin";

// lib/aggregation.ts
function aggregateTokens(messages) {
  const totals = messages.reduce((acc, msg) => {
    const tokens = msg.tokens || {};
    const cache = tokens.cache || {};
    acc.input += tokens.input || 0;
    acc.output += tokens.output || 0;
    acc.reasoning += tokens.reasoning || 0;
    acc.cache.read += cache.read || 0;
    acc.cache.write += cache.write || 0;
    return acc;
  }, {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: {
      read: 0,
      write: 0
    }
  });
  return {
    input: totals.input,
    output: totals.output,
    total: totals.input + totals.output,
    reasoning: totals.reasoning,
    cache: {
      read: totals.cache.read,
      write: totals.cache.write
    }
  };
}
function aggregateTokensByModel(messages) {
  const byModel = {};
  for (const msg of messages) {
    const modelKey = `${msg.providerID}/${msg.modelID}`;
    if (!byModel[modelKey]) {
      byModel[modelKey] = {
        input: 0,
        output: 0,
        total: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0
        }
      };
    }
    const tokens = msg.tokens || {};
    const cache = tokens.cache || {};
    byModel[modelKey].input += tokens.input || 0;
    byModel[modelKey].output += tokens.output || 0;
    byModel[modelKey].reasoning += tokens.reasoning || 0;
    byModel[modelKey].cache.read += cache.read || 0;
    byModel[modelKey].cache.write += cache.write || 0;
    byModel[modelKey].total = byModel[modelKey].input + byModel[modelKey].output;
  }
  return byModel;
}
function aggregateTokensByAgent(messages) {
  const byAgent = {};
  for (const msg of messages) {
    const agentKey = msg.mode && msg.mode.trim() !== "" ? msg.mode : "unknown";
    if (!byAgent[agentKey]) {
      byAgent[agentKey] = {
        input: 0,
        output: 0,
        total: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0
        },
        messageCount: 0
      };
    }
    const tokens = msg.tokens || {};
    const cache = tokens.cache || {};
    byAgent[agentKey].input += tokens.input || 0;
    byAgent[agentKey].output += tokens.output || 0;
    byAgent[agentKey].reasoning += tokens.reasoning || 0;
    byAgent[agentKey].cache.read += cache.read || 0;
    byAgent[agentKey].cache.write += cache.write || 0;
    byAgent[agentKey].total = byAgent[agentKey].input + byAgent[agentKey].output;
    byAgent[agentKey].messageCount += 1;
  }
  return byAgent;
}
function aggregateTokensByAgentModel(messages) {
  const byAgentModel = {};
  for (const msg of messages) {
    const agentKey = msg.mode && msg.mode.trim() !== "" ? msg.mode : "unknown";
    const modelKey = `${msg.providerID}/${msg.modelID}`;
    const agentModelKey = `${agentKey}|${modelKey}`;
    if (!byAgentModel[agentModelKey]) {
      byAgentModel[agentModelKey] = {
        agent: agentKey,
        model: modelKey,
        input: 0,
        output: 0,
        total: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0
        },
        messageCount: 0
      };
    }
    const tokens = msg.tokens || {};
    const cache = tokens.cache || {};
    byAgentModel[agentModelKey].input += tokens.input || 0;
    byAgentModel[agentModelKey].output += tokens.output || 0;
    byAgentModel[agentModelKey].reasoning += tokens.reasoning || 0;
    byAgentModel[agentModelKey].cache.read += cache.read || 0;
    byAgentModel[agentModelKey].cache.write += cache.write || 0;
    byAgentModel[agentModelKey].total = byAgentModel[agentModelKey].input + byAgentModel[agentModelKey].output;
    byAgentModel[agentModelKey].messageCount += 1;
  }
  return byAgentModel;
}
function aggregateToolAttribution(parts) {
  const byTool = {};
  for (let i = 0;i < parts.length; i++) {
    const part = parts[i];
    if (!part || part.type !== "tool") {
      continue;
    }
    const state = part.state || {};
    if (state.status !== "completed") {
      continue;
    }
    const toolName = typeof part.tool === "string" && part.tool.trim() !== "" ? part.tool : "unknown";
    const rawTitle = typeof state.title === "string" ? state.title : toolName;
    const title = rawTitle.length > 60 ? `${rawTitle.slice(0, 57)}...` : rawTitle;
    if (!byTool[toolName]) {
      byTool[toolName] = {
        tool: toolName,
        title,
        callCount: 0,
        tokens: {
          input: 0,
          output: 0,
          total: 0,
          reasoning: 0,
          cache: {
            read: 0,
            write: 0
          }
        },
        cost: 0
      };
    }
    const nextPart = parts[i + 1];
    const prevPart = parts[i - 1];
    const stepFinishPart = nextPart && nextPart.type === "step-finish" ? nextPart : prevPart && prevPart.type === "step-finish" ? prevPart : undefined;
    const tokens = stepFinishPart?.tokens || {};
    const cache = tokens.cache || {};
    byTool[toolName].callCount += 1;
    byTool[toolName].tokens.input += tokens.input || 0;
    byTool[toolName].tokens.output += tokens.output || 0;
    byTool[toolName].tokens.reasoning += tokens.reasoning || 0;
    byTool[toolName].tokens.cache.read += cache.read || 0;
    byTool[toolName].tokens.cache.write += cache.write || 0;
    byTool[toolName].tokens.total = byTool[toolName].tokens.input + byTool[toolName].tokens.output;
    byTool[toolName].cost += stepFinishPart?.cost || 0;
  }
  return { byTool };
}
function aggregateTokensByInitiator(messages, userMessages) {
  const byInitiator = {};
  const parentIdToAgentMap = new Map;
  for (const userMsg of userMessages) {
    parentIdToAgentMap.set(userMsg.id, userMsg.agent);
  }
  for (const msg of messages) {
    const userAgent = parentIdToAgentMap.get(msg.parentID);
    const agentKey = userAgent && userAgent.trim() !== "" ? userAgent : "unknown";
    if (!byInitiator[agentKey]) {
      byInitiator[agentKey] = {
        input: 0,
        output: 0,
        total: 0,
        reasoning: 0,
        cache: {
          read: 0,
          write: 0
        },
        messageCount: 0
      };
    }
    const tokens = msg.tokens || {};
    const cache = tokens.cache || {};
    byInitiator[agentKey].input += tokens.input || 0;
    byInitiator[agentKey].output += tokens.output || 0;
    byInitiator[agentKey].reasoning += tokens.reasoning || 0;
    byInitiator[agentKey].cache.read += cache.read || 0;
    byInitiator[agentKey].cache.write += cache.write || 0;
    byInitiator[agentKey].total = byInitiator[agentKey].input + byInitiator[agentKey].output;
    byInitiator[agentKey].messageCount += 1;
  }
  return byInitiator;
}
function topNAgents(stats, costMap, n, sortBy) {
  const agents = Object.keys(stats);
  if (agents.length === 0) {
    return { rows: [] };
  }
  const allRows = agents.map((agent) => ({
    agent,
    stats: stats[agent],
    cost: costMap[agent] || 0
  }));
  allRows.sort((a, b) => {
    if (sortBy === "cost") {
      if (b.cost !== a.cost) {
        return b.cost - a.cost;
      }
    } else {
      if (b.stats.total !== a.stats.total) {
        return b.stats.total - a.stats.total;
      }
    }
    return a.agent.localeCompare(b.agent);
  });
  if (n <= 0 || agents.length <= n) {
    return { rows: allRows };
  }
  const topRows = allRows.slice(0, n);
  const remainingRows = allRows.slice(n);
  const othersStats = {
    input: 0,
    output: 0,
    total: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
    messageCount: 0
  };
  let othersCost = 0;
  for (const row of remainingRows) {
    othersStats.input += row.stats.input;
    othersStats.output += row.stats.output;
    othersStats.total += row.stats.total;
    othersStats.reasoning += row.stats.reasoning;
    othersStats.cache.read += row.stats.cache.read;
    othersStats.cache.write += row.stats.cache.write;
    othersStats.messageCount += row.stats.messageCount;
    othersCost += row.cost;
  }
  return {
    rows: topRows,
    others: {
      agent: "Others",
      stats: othersStats,
      cost: othersCost,
      count: remainingRows.length
    }
  };
}

// lib/cost-calculator.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var DEFAULT_PRICING = {
  "anthropic/claude-sonnet-4": {
    input_per_million: 3,
    output_per_million: 15,
    cache_read_per_million: 0.3,
    cache_write_per_million: 3.75
  },
  "anthropic/claude-opus-4": {
    input_per_million: 15,
    output_per_million: 75,
    cache_read_per_million: 1.5,
    cache_write_per_million: 18.75
  },
  "anthropic/claude-opus-4.5": {
    input_per_million: 5,
    output_per_million: 25,
    cache_read_per_million: 0.5,
    cache_write_per_million: 6.25
  },
  "anthropic/claude-sonnet-4.5": {
    input_per_million: 3,
    output_per_million: 15,
    cache_read_per_million: 0.3,
    cache_write_per_million: 3.75
  },
  "anthropic/claude-haiku-4.5": {
    input_per_million: 1,
    output_per_million: 5,
    cache_read_per_million: 0.1,
    cache_write_per_million: 1.25
  },
  "anthropic/claude-3-5-sonnet": {
    input_per_million: 3,
    output_per_million: 15,
    cache_read_per_million: 0.3,
    cache_write_per_million: 3.75
  },
  "anthropic/claude-3-5-haiku": {
    input_per_million: 0.8,
    output_per_million: 4,
    cache_read_per_million: 0.08,
    cache_write_per_million: 1
  },
  "google/antigravity-claude-opus-4-5-thinking": {
    input_per_million: 5,
    output_per_million: 25,
    cache_read_per_million: 0.5,
    cache_write_per_million: 6.25
  },
  "google/antigravity-claude-opus-4-6-thinking": {
    input_per_million: 5,
    output_per_million: 25,
    cache_read_per_million: 0.5,
    cache_write_per_million: 6.25
  },
  "google/antigravity-claude-sonnet-4-5-thinking": {
    input_per_million: 3,
    output_per_million: 15,
    cache_read_per_million: 0.3,
    cache_write_per_million: 3.75
  },
  "google/antigravity-claude-sonnet-4-5": {
    input_per_million: 3,
    output_per_million: 15,
    cache_read_per_million: 0.3,
    cache_write_per_million: 3.75
  },
  "openai/gpt-4o": {
    input_per_million: 2.5,
    output_per_million: 10,
    cache_read_per_million: 1.25
  },
  "openai/gpt-4-turbo": {
    input_per_million: 10,
    output_per_million: 30
  },
  "openai/gpt-5.2": {
    input_per_million: 1.75,
    output_per_million: 14,
    cache_read_per_million: 0.175
  },
  "openai/gpt-5.3-codex": {
    input_per_million: 1.75,
    output_per_million: 14,
    cache_read_per_million: 0.175
  },
  "openai/gpt-5-mini": {
    input_per_million: 0.25,
    output_per_million: 2,
    cache_read_per_million: 0.025
  },
  "openai/o1": {
    input_per_million: 15,
    output_per_million: 60,
    cache_read_per_million: 7.5
  },
  "openai/o3": {
    input_per_million: 2,
    output_per_million: 8,
    cache_read_per_million: 0.5
  },
  "openai/o4-mini": {
    input_per_million: 1.1,
    output_per_million: 4.4,
    cache_read_per_million: 0.275
  },
  "google/gemini-3-flash": {
    input_per_million: 0.5,
    output_per_million: 3,
    cache_read_per_million: 0.05
  },
  "google/antigravity-gemini-3-flash": {
    input_per_million: 0.5,
    output_per_million: 3,
    cache_read_per_million: 0.05
  },
  "google/gemini-pro": {
    input_per_million: 1.25,
    output_per_million: 10,
    cache_read_per_million: 0.125
  },
  "google/gemini-1.5-pro": {
    input_per_million: 1.25,
    output_per_million: 10,
    cache_read_per_million: 0.125
  },
  "google/gemini-1.5-flash": {
    input_per_million: 0.15,
    output_per_million: 0.6,
    cache_read_per_million: 0.015
  },
  "google/gemini-2.0-flash": {
    input_per_million: 0.1,
    output_per_million: 0.4
  },
  "google/gemini-2.5-pro": {
    input_per_million: 1.25,
    output_per_million: 10,
    cache_read_per_million: 0.125
  }
};
function loadPricingConfig(configPath) {
  const searchPaths = configPath ? [configPath] : [
    join(process.cwd(), "pricing.json"),
    join(homedir(), ".opencode", "pricing.json"),
    join(homedir(), ".config", "opencode", "pricing.json")
  ];
  for (const path of searchPaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, "utf-8");
        return JSON.parse(content);
      } catch (error) {
        console.warn(`Failed to load pricing config from ${path}:`, error);
      }
    }
  }
  return {};
}
function calculateCost(stats, customPricing) {
  const pricing = { ...DEFAULT_PRICING, ...customPricing };
  const byModel = {};
  const warnings = [];
  let totalCost = 0;
  for (const [modelKey, tokenStats] of Object.entries(stats)) {
    const modelPricing = pricing[modelKey];
    if (!modelPricing) {
      warnings.push(`No pricing data available for model: ${modelKey}. Cost set to $0.`);
      byModel[modelKey] = 0;
      continue;
    }
    const inputCost = tokenStats.input / 1e6 * modelPricing.input_per_million;
    const outputCost = tokenStats.output / 1e6 * modelPricing.output_per_million;
    const cacheReadCost = modelPricing.cache_read_per_million ? tokenStats.cache.read / 1e6 * modelPricing.cache_read_per_million : 0;
    const cacheWriteCost = modelPricing.cache_write_per_million ? tokenStats.cache.write / 1e6 * modelPricing.cache_write_per_million : 0;
    const modelCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;
    byModel[modelKey] = modelCost;
    totalCost += modelCost;
  }
  return {
    totalCost,
    byModel,
    warnings
  };
}

// lib/history.ts
import { existsSync as existsSync2, readFileSync as readFileSync2, writeFileSync, mkdirSync, renameSync } from "fs";
import { join as join2 } from "path";
import { homedir as homedir2 } from "os";
function getShardPath(date, baseDir) {
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Invalid date passed to getShardPath: ${date}`);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const filename = `${year}-${month}.json`;
  const dir = baseDir ? baseDir : resolveBaseDir();
  return join2(dir, filename);
}
function resolveBaseDir() {
  const searchPaths = [
    join2(process.cwd(), "token-history"),
    join2(homedir2(), ".opencode", "token-history"),
    join2(homedir2(), ".config", "opencode", "token-history")
  ];
  for (const path of searchPaths) {
    if (existsSync2(path)) {
      return path;
    }
  }
  return join2(homedir2(), ".opencode", "token-history");
}
async function saveSessionRecord(record, baseDir) {
  if (typeof record.timestamp !== "number" || !Number.isFinite(record.timestamp)) {
    throw new Error(`Invalid timestamp for session ${record.sessionID}: ${record.timestamp}`);
  }
  const shardPath = getShardPath(new Date(record.timestamp), baseDir);
  const dir = shardPath.substring(0, shardPath.lastIndexOf("/"));
  if (!existsSync2(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  let records = [];
  if (existsSync2(shardPath)) {
    try {
      const content = readFileSync2(shardPath, "utf-8");
      records = JSON.parse(content);
      if (!Array.isArray(records)) {
        console.warn(`Shard ${shardPath} does not contain an array, resetting to empty array`);
        records = [];
      }
    } catch (error) {
      console.warn(`Failed to parse ${shardPath}, resetting to empty array:`, error);
      records = [];
    }
  }
  const existingIndex = records.findIndex((r) => r.sessionID === record.sessionID);
  if (existingIndex !== -1) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }
  const tempPath = `${shardPath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(records, null, 2), "utf-8");
  renameSync(tempPath, shardPath);
}
async function loadHistoryForRange(from, to, baseDir, projectID) {
  const allRecords = [];
  const shards = getShardsBetween(from, to);
  for (const shardDate of shards) {
    const shardPath = getShardPath(shardDate, baseDir);
    if (!existsSync2(shardPath)) {
      continue;
    }
    try {
      const content = readFileSync2(shardPath, "utf-8");
      const records = JSON.parse(content);
      if (!Array.isArray(records)) {
        console.warn(`Shard ${shardPath} does not contain an array, skipping`);
        continue;
      }
      for (const record of records) {
        if (record.timestamp >= from.getTime() && record.timestamp <= to.getTime()) {
          if (projectID !== undefined) {
            if (record.projectID === projectID) {
              allRecords.push(record);
            }
          } else {
            allRecords.push(record);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to parse ${shardPath}, skipping:`, error);
    }
  }
  allRecords.sort((a, b) => a.timestamp - b.timestamp);
  return allRecords;
}
function getShardsBetween(from, to) {
  const shards = [];
  const current = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (current <= end) {
    shards.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }
  return shards;
}

// lib/export.ts
function exportToJSON(records) {
  return JSON.stringify(records, null, 2);
}
function escapeCSVField(field) {
  if (field.includes(",") || field.includes('"') || field.includes(`
`)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
function exportToCSV(records) {
  const header = "sessionID,projectID,timestamp,input,output,total,reasoning,cache_read,cache_write,cost";
  if (records.length === 0) {
    return header;
  }
  const rows = records.map((record) => {
    const sessionID = escapeCSVField(record.sessionID);
    const projectID = escapeCSVField(record.projectID ?? "");
    const timestamp = new Date(record.timestamp).toISOString();
    const input = record.totals.input;
    const output = record.totals.output;
    const total = record.totals.total;
    const reasoning = record.totals.reasoning;
    const cacheRead = record.totals.cache.read;
    const cacheWrite = record.totals.cache.write;
    const cost = record.cost;
    return `${sessionID},${projectID},${timestamp},${input},${output},${total},${reasoning},${cacheRead},${cacheWrite},${cost}`;
  });
  return [header, ...rows].join(`
`);
}
function exportToMarkdown(records) {
  let output = `| Session ID | Project ID | Date | Input | Output | Total | Reasoning | Cache R/W | Cost |
`;
  output += `|------------|------------|------|-------|--------|-------|-----------|-----------|------|
`;
  if (records.length === 0) {
    output += `
No records to display
`;
    return output;
  }
  for (const record of records) {
    const sessionIDShort = record.sessionID.substring(0, 10) + "...";
    const projectIDShort = record.projectID ? record.projectID.substring(0, 10) + "..." : "\u2014";
    const date = new Date(record.timestamp).toISOString().split("T")[0];
    const input = record.totals.input.toLocaleString();
    const output_tokens = record.totals.output.toLocaleString();
    const total = record.totals.total.toLocaleString();
    const reasoning = record.totals.reasoning.toLocaleString();
    const cacheRW = `${record.totals.cache.read}/${record.totals.cache.write}`;
    const cost = `$${record.cost.toFixed(4)}`;
    output += `| ${sessionIDShort} | ${projectIDShort} | ${date} | ${input} | ${output_tokens} | ${total} | ${reasoning} | ${cacheRW} | ${cost} |
`;
  }
  return output;
}
function exportData(records, format) {
  switch (format) {
    case "json":
      return exportToJSON(records);
    case "csv":
      return exportToCSV(records);
    case "markdown":
      return exportToMarkdown(records);
  }
}

// lib/provider-stability.ts
var DEFAULT_STABILITY_CONFIG = {
  maxChars: 20000,
  maxTableRows: 50,
  maxChartPoints: 14
};
function truncateOutput(content, config = {}) {
  const mergedConfig = { ...DEFAULT_STABILITY_CONFIG, ...config };
  const originalLength = content.length;
  if (originalLength <= mergedConfig.maxChars) {
    return {
      content,
      truncated: false,
      originalLength
    };
  }
  const truncatedContent = content.slice(0, mergedConfig.maxChars);
  const message = `

---
\u26A0\uFE0F Output truncated (${originalLength} \u2192 ${mergedConfig.maxChars} chars). Use \`token_export\` tool for full data.`;
  return {
    content: truncatedContent + message,
    truncated: true,
    originalLength,
    message
  };
}
function limitTableRows(rows, config = {}) {
  const mergedConfig = { ...DEFAULT_STABILITY_CONFIG, ...config };
  const totalCount = rows.length;
  if (totalCount <= mergedConfig.maxTableRows) {
    return {
      rows,
      truncated: false,
      totalCount
    };
  }
  return {
    rows: rows.slice(0, mergedConfig.maxTableRows),
    truncated: true,
    totalCount
  };
}
function getDebugInfo(sections) {
  if (sections.length === 0) {
    return "Debug Info: 0 sections";
  }
  const sectionStats = sections.map((section, index) => {
    const lines = section.split(`
`).length;
    return `Section ${index}: length: ${section.length}, lines: ${lines}`;
  }).join(`
`);
  return `Debug Info: ${sections.length} sections
${sectionStats}`;
}

// lib/renderer.ts
function renderHeader(sessionID, models, isAntigravity, isCompact) {
  let output = `# Token Usage Statistics

`;
  output += `**Session:** ${sessionID}
`;
  const MAX_MODELS_IN_HEADER = 5;
  const modelLabel = models.length <= MAX_MODELS_IN_HEADER ? models.join(", ") : `${models.slice(0, MAX_MODELS_IN_HEADER).join(", ")} ... (+${models.length - MAX_MODELS_IN_HEADER} more)`;
  output += `**Models:** ${modelLabel}

`;
  if (isAntigravity && !isCompact) {
    output += `_\u2139\uFE0F Compact mode auto-applied for Antigravity provider._

`;
  }
  return output;
}
function renderTotals(totalStats) {
  const cacheTotal = totalStats.cache.read + totalStats.input;
  const cacheHitRate = cacheTotal > 0 ? `${(totalStats.cache.read / cacheTotal * 100).toFixed(1)}%` : "N/A";
  let output = `## Totals
`;
  output += `- Input: ${totalStats.input.toLocaleString()} tokens
`;
  output += `- Output: ${totalStats.output.toLocaleString()} tokens
`;
  output += `- Total: ${totalStats.total.toLocaleString()} tokens
`;
  output += `- Reasoning: ${totalStats.reasoning.toLocaleString()} tokens
`;
  output += `- Cache (read/write): ${totalStats.cache.read.toLocaleString()}/${totalStats.cache.write.toLocaleString()} tokens
`;
  output += `- Cache hit rate: ${cacheHitRate}

`;
  return output;
}
function renderEstimatedCost(totalCost) {
  return `## Estimated Cost
- Total: $${totalCost.toFixed(4)}

`;
}
function renderModelTable(statsByModel, costByModel, tableConfig = {}) {
  let output = "## Per-Model Breakdown\\n";
  output += "| Model | Input | Output | Total | Cost |\\n";
  output += "|-------|-------|--------|-------|------|\\n";
  const modelEntries = Object.entries(statsByModel);
  const {
    rows: limitedModels,
    truncated: modelsTruncated,
    totalCount: modelsTotal
  } = limitTableRows(modelEntries, tableConfig);
  for (const [model, stats] of limitedModels) {
    const cost = costByModel[model] || 0;
    output += `| ${model} | ${stats.input.toLocaleString()} | ${stats.output.toLocaleString()} | ${stats.total.toLocaleString()} | $${cost.toFixed(4)} |\\n`;
  }
  if (modelsTruncated) {
    output += `\\n_...and ${modelsTotal - limitedModels.length} more rows. Use \`token_export\` for full data._\\n`;
  }
  return output;
}
function renderAgentTable(title, rows, totalCost) {
  let output = `
## ${title}
`;
  output += `| Agent | Input | Output | Total | Msgs | Cost | %Cost |
`;
  output += `|-------|-------|--------|-------|------|------|-------|
`;
  for (const row of rows.rows) {
    const pctCost = totalCost > 0 ? `${(row.cost / totalCost * 100).toFixed(1)}%` : "-";
    output += `| ${row.agent} | ${row.stats.input.toLocaleString()} | ${row.stats.output.toLocaleString()} | ${row.stats.total.toLocaleString()} | ${row.stats.messageCount} | $${row.cost.toFixed(4)} | ${pctCost} |
`;
  }
  if (rows.others) {
    const pctCost = totalCost > 0 ? `${(rows.others.cost / totalCost * 100).toFixed(1)}%` : "-";
    output += `| Others (${rows.others.count}) | ${rows.others.stats.input.toLocaleString()} | ${rows.others.stats.output.toLocaleString()} | ${rows.others.stats.total.toLocaleString()} | ${rows.others.stats.messageCount} | $${rows.others.cost.toFixed(4)} | ${pctCost} |
`;
  }
  return output;
}
function renderAgentModelTable(statsByAgentModel, totalCost) {
  let output = `
## Agent \xD7 Model
`;
  output += `| Agent | Model | Msgs | Input | Output | Total | Cost | %Cost |
`;
  output += `|-------|-------|------|-------|--------|-------|------|-------|
`;
  const rows = Object.values(statsByAgentModel).map((entry) => ({
    ...entry,
    cost: entry.cost || 0
  })).sort((a, b) => {
    if (b.cost !== a.cost) {
      return b.cost - a.cost;
    }
    const agentCmp = a.agent.localeCompare(b.agent);
    if (agentCmp !== 0) {
      return agentCmp;
    }
    return a.model.localeCompare(b.model);
  });
  const { rows: limitedRows, truncated, totalCount } = limitTableRows(rows);
  for (const row of limitedRows) {
    const pctCost = totalCost > 0 ? `${(row.cost / totalCost * 100).toFixed(1)}%` : "-";
    output += `| ${row.agent} | ${row.model} | ${row.messageCount} | ${row.input.toLocaleString()} | ${row.output.toLocaleString()} | ${row.total.toLocaleString()} | $${row.cost.toFixed(4)} | ${pctCost} |
`;
  }
  if (truncated) {
    output += `
_...and ${totalCount - limitedRows.length} more rows. Use \`token_export\` for full data._
`;
  }
  return output;
}
function renderToolCommandTable(attribution, totalCost) {
  const rows = Object.values(attribution.byTool);
  if (rows.length === 0) {
    return "";
  }
  let output = `
## Tool \xD7 Command
`;
  output += `| Tool | Summary | Calls | Input | Output | Total | Cost | %Cost |
`;
  output += `|------|---------|-------|-------|--------|-------|------|-------|
`;
  const sortedRows = [...rows].sort((a, b) => {
    if (b.cost !== a.cost) {
      return b.cost - a.cost;
    }
    return a.tool.localeCompare(b.tool);
  });
  const { rows: limitedRows, truncated, totalCount } = limitTableRows(sortedRows);
  for (const row of limitedRows) {
    const pctCost = totalCost > 0 ? `${(row.cost / totalCost * 100).toFixed(1)}%` : "-";
    output += `| ${row.tool} | ${row.title} | ${row.callCount} | ${row.tokens.input.toLocaleString()} | ${row.tokens.output.toLocaleString()} | ${row.tokens.total.toLocaleString()} | $${row.cost.toFixed(4)} | ${pctCost} |
`;
  }
  if (truncated) {
    output += `
_...and ${totalCount - limitedRows.length} more rows. Use \`token_export\` for full data._
`;
  }
  return output;
}
function renderToolUsageChart(attribution) {
  const rows = Object.values(attribution.byTool);
  if (rows.length === 0) {
    return "";
  }
  const sortedRows = [...rows].sort((a, b) => {
    if (b.callCount !== a.callCount) {
      return b.callCount - a.callCount;
    }
    return a.tool.localeCompare(b.tool);
  });
  const { rows: limitedRows, truncated, totalCount } = limitTableRows(sortedRows, {
    maxTableRows: 20
  });
  const maxCalls = Math.max(...limitedRows.map((row) => row.callCount));
  const totalCalls = rows.reduce((sum, row) => sum + row.callCount, 0);
  const nameWidth = Math.max(...limitedRows.map((row) => row.tool.length));
  let output = `
## Tool Usage
`;
  for (const row of limitedRows) {
    const barLength = maxCalls > 0 && row.callCount > 0 ? Math.max(1, Math.round(row.callCount / maxCalls * 20)) : 0;
    const bar = "\u2588".repeat(barLength).padEnd(20, " ");
    const percentage = totalCalls > 0 ? `${(row.callCount / totalCalls * 100).toFixed(1)}%` : "0.0%";
    output += `${row.tool.padEnd(nameWidth)} ${bar} ${row.callCount.toLocaleString()} (${percentage.padStart(5, " ")})
`;
  }
  if (truncated) {
    output += `
_...and ${totalCount - limitedRows.length} more tools._
`;
  }
  return output;
}
function renderWarnings(warnings) {
  if (warnings.length === 0) {
    return "";
  }
  let output = `
## Warnings
`;
  for (const warning of warnings) {
    output += `- ${warning}
`;
  }
  return output;
}

// lib/quota.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, readdirSync, statSync } from "fs";
import { join as join3 } from "path";
import { homedir as homedir3 } from "os";
function getSeverity(remainingFraction) {
  if (remainingFraction >= 0.5)
    return "info";
  if (remainingFraction >= 0.2)
    return "warning";
  return "error";
}
function loadAntigravityQuota(basePath) {
  const configPath = basePath ?? join3(homedir3(), ".config", "opencode", "antigravity-accounts.json");
  if (!existsSync3(configPath)) {
    return [];
  }
  try {
    const content = readFileSync3(configPath, "utf-8");
    const config = JSON.parse(content);
    const byScope = new Map;
    if (!config.accounts || !Array.isArray(config.accounts)) {
      return [];
    }
    for (const account of config.accounts) {
      if (account && typeof account === "object" && "enabled" in account && account.enabled === false) {
        continue;
      }
      const cachedQuota = account?.cachedQuota;
      if (!cachedQuota || typeof cachedQuota !== "object") {
        continue;
      }
      for (const [scope, quotaData] of Object.entries(cachedQuota)) {
        if (quotaData && typeof quotaData === "object" && "remainingFraction" in quotaData && typeof quotaData.remainingFraction === "number") {
          const remainingFraction = quotaData.remainingFraction;
          const resetsAt = "resetTime" in quotaData && typeof quotaData.resetTime === "string" ? quotaData.resetTime : undefined;
          const next = {
            source: "antigravity",
            scope,
            remainingFraction,
            resetsAt,
            severity: getSeverity(remainingFraction)
          };
          const existing = byScope.get(scope);
          if (!existing) {
            byScope.set(scope, next);
            continue;
          }
          if (next.remainingFraction > existing.remainingFraction) {
            byScope.set(scope, next);
            continue;
          }
          if (next.remainingFraction === existing.remainingFraction && !existing.resetsAt && next.resetsAt) {
            byScope.set(scope, next);
          }
        }
      }
    }
    return Array.from(byScope.values()).sort((a, b) => a.scope.localeCompare(b.scope));
  } catch (error) {
    console.warn(`Failed to load Antigravity quota from ${configPath}:`, error);
    return [];
  }
}

// lib/budget.ts
import { existsSync as existsSync4, readFileSync as readFileSync4 } from "fs";
import { join as join4 } from "path";
import { homedir as homedir4 } from "os";
function loadBudgetConfig(basePath) {
  const searchPaths = basePath ? [basePath] : [
    join4(process.cwd(), "token-monitor.json"),
    join4(homedir4(), ".opencode", "token-monitor.json"),
    join4(homedir4(), ".config", "opencode", "token-monitor.json")
  ];
  for (const path of searchPaths) {
    if (!existsSync4(path)) {
      continue;
    }
    try {
      const content = readFileSync4(path, "utf-8");
      const config = JSON.parse(content);
      if (config.budget && typeof config.budget === "object") {
        const budget = {};
        if (typeof config.budget.daily === "number") {
          budget.daily = config.budget.daily;
        }
        if (typeof config.budget.weekly === "number") {
          budget.weekly = config.budget.weekly;
        }
        if (typeof config.budget.monthly === "number") {
          budget.monthly = config.budget.monthly;
        }
        if (config.budget.thresholds && typeof config.budget.thresholds === "object") {
          budget.thresholds = {};
          if (typeof config.budget.thresholds.warning === "number") {
            budget.thresholds.warning = config.budget.thresholds.warning;
          }
          if (typeof config.budget.thresholds.error === "number") {
            budget.thresholds.error = config.budget.thresholds.error;
          }
        }
        return budget;
      }
    } catch (error) {
      console.warn(`Failed to load budget config from ${path}:`, error);
      continue;
    }
  }
  return {};
}
function computeSpend(records, period) {
  const now = Date.now();
  const windowMs = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000
  };
  const cutoff = now - windowMs[period];
  return records.filter((record) => record.timestamp >= cutoff).reduce((sum, record) => sum + record.cost, 0);
}
function getBudgetStatus(records, config) {
  const statuses = [];
  let warningPct = config.thresholds?.warning ?? 50;
  let errorPct = config.thresholds?.error ?? 95;
  const invalidRange = warningPct < 0 || warningPct > 100 || errorPct < 0 || errorPct > 100;
  if (invalidRange || warningPct >= errorPct) {
    warningPct = 50;
    errorPct = 95;
  }
  const periods = [
    "daily",
    "weekly",
    "monthly"
  ];
  for (const period of periods) {
    const limitValue = config[period];
    if (limitValue === undefined || limitValue === null) {
      continue;
    }
    const limit = limitValue;
    const spent = computeSpend(records, period);
    const remaining = limit - spent;
    const percentage = Math.round(spent / limit * 100);
    let severity;
    if (percentage >= errorPct) {
      severity = "error";
    } else if (percentage >= warningPct) {
      severity = "warning";
    } else {
      severity = "info";
    }
    statuses.push({
      period,
      limit,
      spent,
      remaining,
      percentage,
      severity
    });
  }
  return statuses;
}
function formatBudgetSection(statuses) {
  if (statuses.length === 0) {
    return "";
  }
  const lines = [];
  for (const status of statuses) {
    const icon = status.severity === "error" ? "\uD83D\uDEA8" : status.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
    const periodLabel = status.period.charAt(0).toUpperCase() + status.period.slice(1);
    lines.push(`- ${icon} ${periodLabel}: $${status.spent.toFixed(2)} / $${status.limit.toFixed(2)} (${status.percentage}%)`);
  }
  return lines.join(`
`);
}

// lib/optimization.ts
function analyzeModelCosts(byModel, pricing) {
  const costResult = calculateCost(byModel, pricing);
  const { totalCost, byModel: modelCosts } = costResult;
  if (totalCost === 0 || Object.keys(modelCosts).length === 0) {
    return [];
  }
  const modelCostEntries = Object.entries(modelCosts).sort(([, costA], [, costB]) => costB - costA);
  const topEntry = modelCostEntries[0];
  if (!topEntry) {
    return [];
  }
  const topModel = topEntry[0];
  const topCost = topEntry[1];
  const percentage = topCost / totalCost * 100;
  if (percentage > 70) {
    return [
      {
        id: "model_cost_high_concentration",
        message: `${topModel} accounts for ${percentage.toFixed(0)}% ($${topCost.toFixed(4)}) of costs. Consider lower-cost alternatives.`,
        metric: "model_cost_distribution",
        severity: "warning"
      }
    ];
  }
  return [];
}
function analyzeCacheEfficiency(stats) {
  const { cache } = stats;
  if (cache.write < 1000) {
    return [];
  }
  const ratio = cache.read === 0 ? Infinity : cache.write / cache.read;
  if (ratio > 2) {
    const readPart = cache.read === 0 ? "0" : "1";
    const writePart = cache.read === 0 ? "\u221E" : Math.round(ratio).toString();
    return [
      {
        id: "cache_write_heavy",
        message: `Cache write/read ratio is ${writePart}:${readPart} (${cache.write.toLocaleString()} writes, ${cache.read.toLocaleString()} reads). Review caching strategy.`,
        metric: "cache_efficiency",
        severity: "warning"
      }
    ];
  }
  return [];
}
function analyzeReasoningUsage(byModel) {
  const suggestions = [];
  for (const [modelKey, stats] of Object.entries(byModel)) {
    if (stats.output === 0) {
      continue;
    }
    const reasoningPercentage = stats.reasoning / stats.output * 100;
    if (reasoningPercentage > 50) {
      suggestions.push({
        id: `reasoning_heavy_${modelKey.replace(/[^a-z0-9]/gi, "_")}`,
        message: `${modelKey} uses ${reasoningPercentage.toFixed(0)}% reasoning tokens (${stats.reasoning.toLocaleString()} of ${stats.output.toLocaleString()} output). Consider non-reasoning model for simpler tasks.`,
        metric: "reasoning_usage",
        severity: "info"
      });
    }
  }
  return suggestions;
}
function generateOptimizationSuggestions(stats, byModel, pricing) {
  const all = [
    ...analyzeModelCosts(byModel, pricing),
    ...analyzeCacheEfficiency(stats),
    ...analyzeReasoningUsage(byModel)
  ];
  const sorted = all.sort((a, b) => {
    const severityOrder = { warning: 0, info: 1 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted.slice(0, 3);
}
function formatOptimizationSection(suggestions) {
  if (suggestions.length === 0) {
    return "";
  }
  const header = `## Cost Optimization

`;
  const items = suggestions.map((s) => `- ${s.message}`).join(`
`);
  return header + items;
}

// lib/trends.ts
function computeCacheHitRatePercent(input, cacheRead) {
  const denom = input + cacheRead;
  if (denom <= 0) {
    return null;
  }
  return cacheRead / denom * 100;
}
function providerFromModelKey(modelKey) {
  const idx = modelKey.indexOf("/");
  if (idx <= 0) {
    return "unknown";
  }
  return modelKey.slice(0, idx);
}
function bucketByDay(records) {
  if (records.length === 0) {
    return [];
  }
  const bucketMap = new Map;
  for (const record of records) {
    const date = new Date(record.timestamp);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const existing = bucketMap.get(dateKey);
    if (existing) {
      existing.cost += record.cost;
      existing.tokens += record.totals.total;
      existing.sessions += 1;
    } else {
      bucketMap.set(dateKey, {
        date: dateKey,
        cost: record.cost,
        tokens: record.totals.total,
        sessions: 1
      });
    }
  }
  const buckets = Array.from(bucketMap.values());
  buckets.sort((a, b) => a.date.localeCompare(b.date));
  return buckets;
}
function bucketCacheHitRateByDay(records) {
  if (records.length === 0) {
    return [];
  }
  const bucketMap = new Map;
  for (const record of records) {
    const date = new Date(record.timestamp);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    let bucket = bucketMap.get(dateKey);
    if (!bucket) {
      bucket = {
        date: dateKey,
        input: 0,
        cacheRead: 0,
        byProvider: {}
      };
      bucketMap.set(dateKey, bucket);
    }
    bucket.input += record.totals.input;
    bucket.cacheRead += record.totals.cache.read;
    for (const [modelKey, stats] of Object.entries(record.byModel)) {
      const provider = providerFromModelKey(modelKey);
      const providerBucket = bucket.byProvider[provider] ?? { input: 0, cacheRead: 0 };
      providerBucket.input += stats.input;
      providerBucket.cacheRead += stats.cache.read;
      bucket.byProvider[provider] = providerBucket;
    }
  }
  const buckets = Array.from(bucketMap.values());
  buckets.sort((a, b) => a.date.localeCompare(b.date));
  return buckets.map((bucket) => {
    const byProvider = {};
    for (const [provider, stats] of Object.entries(bucket.byProvider)) {
      byProvider[provider] = {
        input: stats.input,
        cacheRead: stats.cacheRead,
        hitRate: computeCacheHitRatePercent(stats.input, stats.cacheRead)
      };
    }
    return {
      date: bucket.date,
      input: bucket.input,
      cacheRead: bucket.cacheRead,
      hitRate: computeCacheHitRatePercent(bucket.input, bucket.cacheRead),
      byProvider
    };
  });
}
function computeWeekOverWeek(buckets) {
  if (buckets.length < 14) {
    return 0;
  }
  const last7 = buckets.slice(-7);
  const prev7 = buckets.slice(-14, -7);
  const currentWeekTotal = last7.reduce((sum, bucket) => sum + bucket.cost, 0);
  const prevWeekTotal = prev7.reduce((sum, bucket) => sum + bucket.cost, 0);
  if (prevWeekTotal === 0) {
    return 0;
  }
  return (currentWeekTotal - prevWeekTotal) / prevWeekTotal;
}
function detectSpikes(buckets, threshold = 2) {
  if (buckets.length <= 1) {
    return [];
  }
  const costs = buckets.map((b) => b.cost);
  const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) {
    return [];
  }
  const spikes = [];
  for (const bucket of buckets) {
    const zScore = (bucket.cost - mean) / stdDev;
    if (zScore > threshold) {
      spikes.push(bucket.date);
    }
  }
  return spikes;
}
function analyzeTrends(records) {
  const buckets = bucketByDay(records);
  return {
    buckets,
    weekOverWeekDelta: computeWeekOverWeek(buckets),
    spikes: detectSpikes(buckets)
  };
}

// lib/ascii-charts.ts
function renderBarChart(values, labels, options = {}) {
  if (values.length === 0 || labels.length === 0) {
    return "";
  }
  const maxPoints = options.maxPoints ?? DEFAULT_STABILITY_CONFIG.maxChartPoints;
  const width = options.width ?? 40;
  const minLength = Math.min(values.length, labels.length);
  const effectiveLength = Math.min(minLength, maxPoints);
  const effectiveValues = values.slice(0, effectiveLength);
  const effectiveLabels = labels.slice(0, effectiveLength);
  const maxValue = Math.max(...effectiveValues);
  if (maxValue === 0) {
    return effectiveLabels.map((label) => `${label} | `).join(`
`);
  }
  const lines = [];
  for (let i = 0;i < effectiveLength; i++) {
    const value = effectiveValues[i] ?? 0;
    const label = effectiveLabels[i] ?? "";
    const barLength = Math.max(1, Math.round(value / maxValue * width));
    const bar = "#".repeat(barLength);
    lines.push(`${label} | ${bar}`);
  }
  return lines.join(`
`);
}
function renderSparkline(values, options = {}) {
  if (values.length === 0) {
    return "";
  }
  const maxPoints = options.maxPoints ?? DEFAULT_STABILITY_CONFIG.maxChartPoints;
  const effectiveValues = values.slice(-maxPoints);
  if (effectiveValues.length === 1) {
    const v = effectiveValues[0];
    return typeof v === "number" && Number.isFinite(v) ? "\u2584" : ".";
  }
  const finiteValues = effectiveValues.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (finiteValues.length === 0) {
    return "";
  }
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  if (min === max) {
    return effectiveValues.map((v) => typeof v === "number" && Number.isFinite(v) ? "\u2584" : ".").join("");
  }
  const chars = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];
  const range = max - min;
  return effectiveValues.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return ".";
    }
    const normalized = (value - min) / range;
    const index = Math.min(chars.length - 1, Math.floor(normalized * chars.length));
    return chars[index];
  }).join("");
}

// lib/session-tree.ts
async function fetchMessagesForSession(sessionID, client) {
  try {
    const response = await client.session.messages({
      path: { id: sessionID }
    });
    if (response.error || !response.data) {
      return [];
    }
    return response.data.filter((msg) => msg.info.role === "assistant").map((msg) => msg.info);
  } catch {
    return [];
  }
}
async function fetchChildrenForSession(sessionID, client) {
  try {
    const response = await client.session.children({
      path: { id: sessionID }
    });
    if (response.error || !response.data) {
      return [];
    }
    return response.data.map((session) => ({ id: session.id }));
  } catch {
    return [];
  }
}
async function listSessionTree(rootID, client, options = {}) {
  const { maxDepth = 5 } = options;
  const visited = new Set;
  async function buildTree(sessionID, depth) {
    visited.add(sessionID);
    const messages = await fetchMessagesForSession(sessionID, client);
    if (depth >= maxDepth) {
      return {
        sessionID,
        messages,
        children: []
      };
    }
    const childSessions = await fetchChildrenForSession(sessionID, client);
    const children = [];
    for (const childSession of childSessions) {
      if (visited.has(childSession.id)) {
        continue;
      }
      const childNode = await buildTree(childSession.id, depth + 1);
      children.push(childNode);
    }
    return {
      sessionID,
      messages,
      children
    };
  }
  return buildTree(rootID, 0);
}
function collectAllMessages(node) {
  const allMessages = [...node.messages];
  for (const child of node.children) {
    const childMessages = collectAllMessages(child);
    allMessages.push(...childMessages);
  }
  return allMessages;
}
function aggregateSessionTree(node, pricing) {
  const allMessages = collectAllMessages(node);
  const totals = aggregateTokens(allMessages);
  const byModel = aggregateTokensByModel(allMessages);
  const childSummaries = [];
  for (const child of node.children) {
    const childMessages = collectAllMessages(child);
    const childTokens = aggregateTokens(childMessages);
    const childByModel = aggregateTokensByModel(childMessages);
    const childCostResult = calculateCost(childByModel, pricing);
    childSummaries.push({
      sessionID: child.sessionID,
      tokens: childTokens,
      cost: childCostResult.totalCost
    });
  }
  return {
    totals,
    byModel,
    childSummaries
  };
}

// lib/notifications.ts
var COST_DELTA_THRESHOLD = 0.1;
var TIME_THRESHOLD_MS = 5 * 60 * 1000;
var sessionStore = new Map;
function getState(sessionID) {
  let state = sessionStore.get(sessionID);
  if (!state) {
    state = {
      lastCost: 0,
      lastToastAt: 0,
      previousQuotaSeverities: new Map
    };
    sessionStore.set(sessionID, state);
  }
  return state;
}
function severityWorsened(prev, current) {
  const severityRank = { info: 0, warning: 1, error: 2 };
  return severityRank[current] > severityRank[prev];
}
function shouldShowToast(currentCost, quotaStatuses, sessionID, nowOverride) {
  const state = getState(sessionID);
  const now = nowOverride ?? Date.now();
  if (state.lastToastAt === 0) {
    return { show: true, message: formatCostToast(currentCost) };
  }
  if (state.previousQuotaSeverities.size > 0) {
    for (const quota of quotaStatuses) {
      const key = `${quota.source}/${quota.scope}`;
      const prevSeverity = state.previousQuotaSeverities.get(key);
      if (prevSeverity && severityWorsened(prevSeverity, quota.severity)) {
        return { show: true, message: formatQuotaAlertToast(quota) };
      }
    }
  }
  const delta = currentCost - state.lastCost;
  if (delta >= COST_DELTA_THRESHOLD) {
    return { show: true, message: formatCostToast(currentCost, delta) };
  }
  const elapsed = now - state.lastToastAt;
  if (elapsed >= TIME_THRESHOLD_MS) {
    return { show: true, message: formatCostToast(currentCost) };
  }
  return { show: false };
}
function updateState(sessionID, cost, quotaStatuses) {
  const state = getState(sessionID);
  state.lastCost = cost;
  state.lastToastAt = Date.now();
  state.previousQuotaSeverities.clear();
  for (const quota of quotaStatuses) {
    const key = `${quota.source}/${quota.scope}`;
    state.previousQuotaSeverities.set(key, quota.severity);
  }
}
function resetState(sessionID) {
  sessionStore.delete(sessionID);
}
function formatCostToast(cost, delta) {
  const costStr = `$${cost.toFixed(4)}`;
  if (delta !== undefined) {
    const deltaStr = `+$${delta.toFixed(4)}`;
    return `Session: ${costStr} (${deltaStr})`;
  }
  return `Session: ${costStr}`;
}
function formatQuotaAlertToast(status) {
  const percent = Math.round(status.remainingFraction * 100);
  const scopeLabel = status.scope;
  if (status.severity === "error") {
    return `\u26A0\uFE0F ${scopeLabel} at ${percent}% remaining!`;
  }
  return `\u26A0\uFE0F ${scopeLabel} quota at ${percent}%`;
}

// plugin/index.ts
import { writeFileSync as writeFileSync2, mkdirSync as mkdirSync2 } from "fs";
import { dirname } from "path";
var inFlightSessions = new Set;
var DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
function getInFlightCount() {
  return inFlightSessions.size;
}
function computeCostMapFromAgentModel(statsByAgentModel, customPricing) {
  const costMap = {};
  for (const entry of Object.values(statsByAgentModel)) {
    const modelCost = calculateCost({
      [entry.model]: {
        input: entry.input,
        output: entry.output,
        total: entry.total,
        reasoning: entry.reasoning,
        cache: {
          read: entry.cache.read,
          write: entry.cache.write
        }
      }
    }, customPricing).totalCost;
    costMap[entry.agent] = (costMap[entry.agent] || 0) + modelCost;
  }
  return costMap;
}
function computeAgentCosts(assistantMessages, customPricing) {
  const statsByAgentModel = aggregateTokensByAgentModel(assistantMessages);
  return computeCostMapFromAgentModel(statsByAgentModel, customPricing);
}
function computeInitiatorCosts(assistantMessages, userMessages, customPricing) {
  const parentIdToAgent = new Map;
  for (const userMsg of userMessages) {
    parentIdToAgent.set(userMsg.id, userMsg.agent);
  }
  const initiatorAttributedMessages = assistantMessages.map((msg) => {
    const userAgent = parentIdToAgent.get(msg.parentID);
    const initiatorKey = userAgent && userAgent.trim() !== "" ? userAgent : "unknown";
    return {
      ...msg,
      mode: initiatorKey
    };
  });
  const statsByInitiatorAgentModel = aggregateTokensByAgentModel(initiatorAttributedMessages);
  return computeCostMapFromAgentModel(statsByInitiatorAgentModel, customPricing);
}
function maybeRecalculateHistoryCosts(records, recalculate) {
  if (!recalculate) {
    return records;
  }
  const customPricing = loadPricingConfig();
  return records.map((record) => ({
    ...record,
    cost: calculateCost(record.byModel, customPricing).totalCost
  }));
}
function parseDateArg(value, kind) {
  if (!value) {
    return;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return date;
  }
  if (DATE_ONLY_RE.test(value) && kind === "to") {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}
async function plugin_default(input) {
  return {
    tool: {
      token_history: tool({
        description: "Query token history for date range",
        args: {
          from: tool.schema.string().optional().describe("Start date (ISO: 2026-01-01)"),
          to: tool.schema.string().optional().describe("End date (ISO: 2026-02-07)"),
          scope: tool.schema.string().optional().describe("Scope: project or all (default: all)"),
          recalculate: tool.schema.boolean().optional().describe("Recalculate historical costs using current pricing")
        },
        async execute(args, _context) {
          try {
            const now = new Date;
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fromDate = parseDateArg(args.from, "from") ?? thirtyDaysAgo;
            const toDate = parseDateArg(args.to, "to") ?? now;
            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
              return "Error: Invalid date format. Please use ISO format (e.g., 2026-01-01)";
            }
            const scope = args.scope ?? "all";
            const projectID = scope === "project" ? input.project?.id : undefined;
            const loadedRecords = await loadHistoryForRange(fromDate, toDate, undefined, projectID);
            const records = maybeRecalculateHistoryCosts(loadedRecords, args.recalculate);
            if (records.length === 0) {
              const scopeLabel = scope === "project" ? `project (${input.project?.id ?? "unknown"})` : "all";
              return `# Token Usage History

**Scope:** ${scopeLabel}

No session records found between ${fromDate.toISOString().split("T")[0]} and ${toDate.toISOString().split("T")[0]}.`;
            }
            let output = `# Token Usage History

`;
            output += `**Period:** ${fromDate.toISOString().split("T")[0]} to ${toDate.toISOString().split("T")[0]}
`;
            output += `**Scope:** ${scope}${scope === "project" ? ` (${input.project?.id ?? "unknown"})` : ""}
`;
            output += `**Sessions:** ${records.length}

`;
            const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
            const totalTokens = records.reduce((sum, r) => sum + r.totals.total, 0);
            output += `## Summary
`;
            output += `- Total Cost: $${totalCost.toFixed(4)}
`;
            output += `- Total Tokens: ${totalTokens.toLocaleString()}

`;
            output += `## Sessions\\n`;
            output += `| Date | Session ID | Tokens | Cost |\\n`;
            output += `|------|------------|--------|------|\\n`;
            const { rows: limitedRecords, truncated: recordsTruncated, totalCount: recordsTotal } = limitTableRows(records);
            for (const record of limitedRecords) {
              const date = new Date(record.timestamp).toISOString().split("T")[0];
              const sessionIDShort = record.sessionID.substring(0, 12);
              output += `| ${date} | ${sessionIDShort}... | ${record.totals.total.toLocaleString()} | $${record.cost.toFixed(4)} |\\n`;
            }
            if (recordsTruncated) {
              output += `\\n_...and ${recordsTotal - limitedRecords.length} more rows. Use \`token_export\` for full data._\\n`;
            }
            try {
              const trends = analyzeTrends(records);
              if (trends.buckets.length > 0) {
                output += `
## Trend Analysis

`;
                const costValues = trends.buckets.map((b) => b.cost);
                const dateLabels = trends.buckets.map((b) => b.date.substring(5));
                const chart = renderBarChart(costValues, dateLabels);
                if (chart) {
                  output += `### Daily Cost Trend
\`\`\`
${chart}
\`\`\`

`;
                }
                if (trends.weekOverWeekDelta !== 0) {
                  const direction = trends.weekOverWeekDelta > 0 ? "increased" : "decreased";
                  const percentage = Math.abs(trends.weekOverWeekDelta * 100).toFixed(1);
                  output += `**Week-over-week:** ${direction} by ${percentage}%

`;
                }
                if (trends.spikes.length > 0) {
                  output += `**Cost spikes detected:** ${trends.spikes.join(", ")}

`;
                }
              }
            } catch {}
            const result = truncateOutput(output);
            return result.content;
          } catch (error) {
            return `Error loading token history: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }),
      token_export: tool({
        description: "Export token data (JSON/CSV/Markdown)",
        args: {
          format: tool.schema.enum(["json", "csv", "markdown"]).describe("Format: json, csv, markdown"),
          scope: tool.schema.enum(["session", "range"]).optional().describe("Scope: session or range"),
          session_id: tool.schema.string().optional().describe("Session ID (default: current)"),
          from: tool.schema.string().optional().describe("Start date (ISO: 2026-01-01)"),
          to: tool.schema.string().optional().describe("End date (ISO: 2026-02-07)"),
          include_children: tool.schema.boolean().optional().describe("Include child sessions"),
          file_path: tool.schema.string().optional().describe("File path (optional)"),
          history_scope: tool.schema.enum(["project", "all"]).optional().describe("History scope: project or all (default: all, range mode only)"),
          recalculate: tool.schema.boolean().optional().describe("Recalculate historical costs using current pricing (range mode only)")
        },
        async execute(args, context) {
          try {
            const scope = args.scope ?? "session";
            const format = args.format;
            let records;
            if (scope === "session") {
              const sessionID = args.session_id ?? context.sessionID;
              const response = await input.client.session.messages({
                path: { id: sessionID }
              });
              if (response.error) {
                return `Error fetching session messages: ${response.error}`;
              }
              const messages = response.data || [];
              const assistantMessages = messages.filter((msg) => msg.info.role === "assistant").map((msg) => msg.info);
              if (assistantMessages.length === 0) {
                return "No assistant messages found in this session.";
              }
              const totals = aggregateTokens(assistantMessages);
              const byModel = aggregateTokensByModel(assistantMessages);
              const customPricing = loadPricingConfig();
              const costResult = calculateCost(byModel, customPricing);
              records = [
                {
                  sessionID,
                  projectID: input.project?.id,
                  timestamp: Date.now(),
                  totals,
                  byModel,
                  cost: costResult.totalCost
                }
              ];
            } else {
              const now = new Date;
              const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              const fromDate = parseDateArg(args.from, "from") ?? thirtyDaysAgo;
              const toDate = parseDateArg(args.to, "to") ?? now;
              if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                return "Error: Invalid date format. Please use ISO format (e.g., 2026-01-01)";
              }
              const historyScope = args.history_scope ?? "all";
              const projectIDFilter = historyScope === "project" ? input.project?.id : undefined;
              const loadedRecords = await loadHistoryForRange(fromDate, toDate, undefined, projectIDFilter);
              records = maybeRecalculateHistoryCosts(loadedRecords, args.recalculate);
              if (records.length === 0) {
                return `No session records found between ${fromDate.toISOString().split("T")[0]} and ${toDate.toISOString().split("T")[0]}.`;
              }
            }
            const content = exportData(records, format);
            if (args.file_path) {
              mkdirSync2(dirname(args.file_path), { recursive: true });
              writeFileSync2(args.file_path, content, "utf-8");
              return `Successfully exported ${records.length} record(s) to ${args.file_path}`;
            }
            const INLINE_THRESHOLD = 1e4;
            if (content.length > INLINE_THRESHOLD) {
              const timestamp = new Date().toISOString().split("T")[0];
              const extension = format === "json" ? "json" : format === "csv" ? "csv" : "md";
              const autoPath = `./token-export-${timestamp}.${extension}`;
              writeFileSync2(autoPath, content, "utf-8");
              const sizeBytes = Buffer.byteLength(content, "utf-8");
              return `Export written to ${autoPath} (${sizeBytes} bytes). Content too large for inline display.`;
            }
            const result = truncateOutput(content);
            return result.content;
          } catch (error) {
            return `Error exporting data: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      }),
      token_stats: tool({
        description: "Show token usage for current session",
        args: {
          session_id: tool.schema.string().optional().describe("Session ID (default: current)"),
          include_children: tool.schema.boolean().optional().describe("Include child sessions"),
          trend_days: tool.schema.number().optional().describe("Trend days (default: 7)"),
          compact: tool.schema.boolean().optional().describe("Skip heavy sections"),
          debug: tool.schema.boolean().optional().describe("Include debug info"),
          agent_view: tool.schema.string().optional().describe("Agent view: execution, initiator, or both (default: both)"),
          agent_sort: tool.schema.string().optional().describe("Sort agent tables by: cost or tokens (default: cost)"),
          agent_top_n: tool.schema.number().optional().describe("Top N agents to show (default: 10, 0 disables)"),
          scope: tool.schema.string().optional().describe("Scope: project or all (default: all)")
        },
        async execute(args, context) {
          const sessionID = args.session_id ?? context.sessionID;
          const scope = args.scope ?? "all";
          try {
            const response = await input.client.session.messages({
              path: { id: sessionID }
            });
            if (response.error) {
              return `Error fetching session messages: ${response.error}`;
            }
            const messages = response.data || [];
            let assistantMessages = messages.filter((msg) => msg.info.role === "assistant").map((msg) => msg.info);
            const rootAssistantParts = messages.filter((msg) => msg.info.role === "assistant").flatMap((msg) => msg.parts || []);
            let allParts = [...rootAssistantParts];
            let userMessages = messages.filter((msg) => msg.info.role === "user").map((msg) => msg.info);
            let sessionTree;
            if (args.include_children) {
              const flattenAssistantMessages = (node) => {
                const all = [...node.messages];
                for (const child of node.children) {
                  all.push(...flattenAssistantMessages(child));
                }
                return all;
              };
              const collectSessionIDs = (node) => {
                const ids = [node.sessionID];
                for (const child of node.children) {
                  ids.push(...collectSessionIDs(child));
                }
                return ids;
              };
              sessionTree = await listSessionTree(sessionID, input.client);
              assistantMessages = flattenAssistantMessages(sessionTree);
              const childSessionIDs = collectSessionIDs(sessionTree).filter((id) => id !== sessionID);
              const allUserMessages = [...userMessages];
              for (const childID of childSessionIDs) {
                try {
                  const childResponse = await input.client.session.messages({
                    path: { id: childID }
                  });
                  if (childResponse.error || !childResponse.data) {
                    continue;
                  }
                  const childUsers = childResponse.data.filter((msg) => msg.info.role === "user").map((msg) => msg.info);
                  allUserMessages.push(...childUsers);
                  const childAssistantParts = childResponse.data.filter((msg) => msg.info.role === "assistant").flatMap((msg) => msg.parts || []);
                  allParts.push(...childAssistantParts);
                } catch {}
              }
              userMessages = allUserMessages;
            }
            const isAntigravity = assistantMessages.some((msg) => msg.modelID?.startsWith("antigravity-") || `${msg.providerID}/${msg.modelID}`.startsWith("google/antigravity-"));
            const effectiveCompact = args.compact || isAntigravity;
            if (assistantMessages.length === 0) {
              return `# Token Usage Statistics

No assistant messages found in this session.`;
            }
            const totalStats = aggregateTokens(assistantMessages);
            const statsByModel = aggregateTokensByModel(assistantMessages);
            const customPricing = loadPricingConfig();
            const costResult = calculateCost(statsByModel, customPricing);
            const models = Object.keys(statsByModel);
            let output = "";
            output += renderHeader(sessionID, models, isAntigravity, args.compact === true);
            output += renderTotals(totalStats);
            output += renderEstimatedCost(costResult.totalCost);
            output += renderModelTable(statsByModel, costResult.byModel, isAntigravity ? { maxTableRows: 15 } : undefined);
            output += renderWarnings(costResult.warnings);
            const agentView = args.agent_view === "execution" || args.agent_view === "initiator" ? args.agent_view : "both";
            const agentSort = args.agent_sort === "tokens" ? "tokens" : "cost";
            const agentTopN = args.agent_top_n !== undefined ? args.agent_top_n : 10;
            const statsByAgent = aggregateTokensByAgent(assistantMessages);
            const statsByInitiator = aggregateTokensByInitiator(assistantMessages, userMessages);
            const executionCostMap = computeAgentCosts(assistantMessages, customPricing);
            const initiatorCostMap = computeInitiatorCosts(assistantMessages, userMessages, customPricing);
            const appendAgentTable = (title, stats, costMap) => {
              if (agentTopN === 0) {
                const entries = Object.entries(stats);
                const { rows: limited, truncated, totalCount } = limitTableRows(entries);
                const rows = limited.map(([agent, rowStats]) => ({
                  agent,
                  stats: rowStats,
                  cost: costMap[agent] || 0
                }));
                output += renderAgentTable(title, { rows }, costResult.totalCost);
                if (truncated) {
                  output += `
_...and ${totalCount - limited.length} more rows. Use \`token_export\` for full data._
`;
                }
              } else {
                const effectiveN = agentTopN < 0 ? 0 : agentTopN;
                const rows = topNAgents(stats, costMap, effectiveN, agentSort);
                output += renderAgentTable(title, rows, costResult.totalCost);
              }
            };
            if (agentView === "both" || agentView === "execution") {
              appendAgentTable("By Execution Agent", statsByAgent, executionCostMap);
            }
            if (agentView === "both" || agentView === "initiator") {
              appendAgentTable("By Initiator Agent", statsByInitiator, initiatorCostMap);
            }
            if (!effectiveCompact) {
              const statsByAgentModel = aggregateTokensByAgentModel(assistantMessages);
              for (const entry of Object.values(statsByAgentModel)) {
                const modelCost = calculateCost({
                  [entry.model]: {
                    input: entry.input,
                    output: entry.output,
                    total: entry.total,
                    reasoning: entry.reasoning,
                    cache: {
                      read: entry.cache.read,
                      write: entry.cache.write
                    }
                  }
                }, customPricing).totalCost;
                entry.cost = modelCost;
              }
              output += renderAgentModelTable(statsByAgentModel, costResult.totalCost);
              const toolAttribution = aggregateToolAttribution(allParts);
              if (Object.keys(toolAttribution.byTool).length > 0) {
                output += renderToolUsageChart(toolAttribution);
                output += renderToolCommandTable(toolAttribution, costResult.totalCost);
              }
            }
            const sections = [];
            try {
              const quotaStatuses = loadAntigravityQuota();
              if (quotaStatuses.length > 0) {
                let quotaSection = `
## Quota Status

`;
                for (const quota of quotaStatuses) {
                  const icon = quota.severity === "error" ? "\uD83D\uDEA8" : quota.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
                  const percent = Math.round(quota.remainingFraction * 100);
                  quotaSection += `- ${icon} ${quota.source}/${quota.scope}: ${percent}% remaining`;
                  if (quota.resetsAt) {
                    quotaSection += ` (resets: ${quota.resetsAt})`;
                  }
                  quotaSection += `
`;
                }
                output += quotaSection;
                sections.push(quotaSection);
              }
            } catch {
              output += `
_[Quota status unavailable]_
`;
            }
            if (!effectiveCompact) {
              try {
                const now = new Date;
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const records = await loadHistoryForRange(sevenDaysAgo, now, undefined, scope === "project" ? input.project?.id : undefined);
                const budgetConfig = loadBudgetConfig();
                const budgetStatuses = getBudgetStatus(records, budgetConfig);
                if (budgetStatuses.length > 0) {
                  const budgetSection = `
## Budget Status

` + formatBudgetSection(budgetStatuses) + `
`;
                  output += budgetSection;
                  sections.push(budgetSection);
                }
              } catch {
                output += `
_[Budget status unavailable]_
`;
              }
              try {
                const trendDays = args.trend_days ?? 7;
                const now = new Date;
                const startDate = new Date(now.getTime() - trendDays * 24 * 60 * 60 * 1000);
                const records = await loadHistoryForRange(startDate, now, undefined, scope === "project" ? input.project?.id : undefined);
                if (records.length > 0) {
                  const trends = analyzeTrends(records);
                  const cacheBuckets = bucketCacheHitRateByDay(records);
                  if (trends.buckets.length > 0) {
                    let trendSection = `
## Trend Analysis (${trendDays} days)

`;
                    const costValues = trends.buckets.map((b) => b.cost);
                    const dateLabels = trends.buckets.map((b) => b.date.substring(5));
                    const chart = renderBarChart(costValues, dateLabels);
                    if (chart) {
                      trendSection += `### Daily Cost Trend
\`\`\`
${chart}
\`\`\`

`;
                    }
                    if (cacheBuckets.length > 0) {
                      const findLastFinite = (values) => {
                        for (let i = values.length - 1;i >= 0; i--) {
                          const v = values[i];
                          if (typeof v === "number" && Number.isFinite(v)) {
                            return v;
                          }
                        }
                        return null;
                      };
                      const overallSeries = cacheBuckets.map((b) => b.hitRate);
                      const overallSpark = renderSparkline(overallSeries);
                      if (overallSpark) {
                        const totals = cacheBuckets.reduce((acc, b) => {
                          acc.input += b.input;
                          acc.cacheRead += b.cacheRead;
                          return acc;
                        }, { input: 0, cacheRead: 0 });
                        const overallAvg = totals.input + totals.cacheRead > 0 ? totals.cacheRead / (totals.input + totals.cacheRead) * 100 : null;
                        const providerTotals = new Map;
                        for (const bucket of cacheBuckets) {
                          for (const [provider, stats] of Object.entries(bucket.byProvider)) {
                            const existing = providerTotals.get(provider) ?? { input: 0, cacheRead: 0 };
                            existing.input += stats.input;
                            existing.cacheRead += stats.cacheRead;
                            providerTotals.set(provider, existing);
                          }
                        }
                        const topProviders = Array.from(providerTotals.entries()).sort((a, b) => {
                          const aDenom = a[1].input + a[1].cacheRead;
                          const bDenom = b[1].input + b[1].cacheRead;
                          if (bDenom !== aDenom) {
                            return bDenom - aDenom;
                          }
                          return a[0].localeCompare(b[0]);
                        }).slice(0, 6).map(([provider]) => provider);
                        const labelWidth = Math.max("Overall".length, ...topProviders.map((p) => p.length));
                        const sparkWidth = overallSpark.length;
                        const overallLast = findLastFinite(overallSeries);
                        const overallLastText = overallLast !== null ? `${overallLast.toFixed(1)}%` : "N/A";
                        const overallAvgText = overallAvg !== null ? `${overallAvg.toFixed(1)}%` : "N/A";
                        trendSection += `### Cache Hit Rate Trend
\`\`\`
`;
                        trendSection += `${"Overall".padEnd(labelWidth)} ${overallSpark.padEnd(sparkWidth, " ")} ${overallLastText} (last)
`;
                        trendSection += `${"".padEnd(labelWidth)} ${"".padEnd(sparkWidth, " ")} ${overallAvgText} (avg)
`;
                        for (const provider of topProviders) {
                          const series = cacheBuckets.map((b) => b.byProvider[provider]?.hitRate ?? null);
                          const spark = renderSparkline(series).padEnd(sparkWidth, " ");
                          const last = findLastFinite(series);
                          const lastText = last !== null ? `${last.toFixed(1)}%` : "N/A";
                          trendSection += `${provider.padEnd(labelWidth)} ${spark} ${lastText}
`;
                        }
                        trendSection += `\`\`\`

`;
                      }
                    }
                    trendSection += `| Date | Cost | Tokens | Sessions |
`;
                    trendSection += `|------|------|--------|----------|
`;
                    const { rows: limitedBuckets, truncated: bucketsTruncated, totalCount: bucketsTotal } = limitTableRows(trends.buckets);
                    for (const bucket of limitedBuckets) {
                      trendSection += `| ${bucket.date} | $${bucket.cost.toFixed(4)} | ${bucket.tokens.toLocaleString()} | ${bucket.sessions} |
`;
                    }
                    if (bucketsTruncated) {
                      trendSection += `
_...and ${bucketsTotal - limitedBuckets.length} more rows. Use \`token_export\` for full data._
`;
                    }
                    if (trends.weekOverWeekDelta !== 0) {
                      const direction = trends.weekOverWeekDelta > 0 ? "increased" : "decreased";
                      const percentage = Math.abs(trends.weekOverWeekDelta * 100).toFixed(1);
                      trendSection += `
**Week-over-week:** ${direction} by ${percentage}%
`;
                    }
                    if (trends.spikes.length > 0) {
                      trendSection += `**Cost spikes detected:** ${trends.spikes.join(", ")}
`;
                    }
                    output += trendSection;
                    sections.push(trendSection);
                  }
                }
              } catch {
                output += `
_[Trend analysis unavailable]_
`;
              }
              try {
                const suggestions = generateOptimizationSuggestions(totalStats, statsByModel, customPricing);
                if (suggestions.length > 0) {
                  const optimizationSection = formatOptimizationSection(suggestions);
                  if (optimizationSection) {
                    output += `
${optimizationSection}
`;
                    sections.push(optimizationSection);
                  }
                }
              } catch {
                output += `
_[Optimization suggestions unavailable]_
`;
              }
            }
            if (args.include_children) {
              try {
                const tree = sessionTree ?? await listSessionTree(sessionID, input.client);
                if (tree.children.length > 0) {
                  const treeStats = aggregateSessionTree(tree, customPricing);
                  const childTotalTokens = treeStats.childSummaries.reduce((sum, c) => sum + c.tokens.total, 0);
                  const childTotalCost = treeStats.childSummaries.reduce((sum, c) => sum + c.cost, 0);
                  let childSection = `
## Child Sessions

`;
                  if (effectiveCompact) {
                    childSection += `- Sessions: ${treeStats.childSummaries.length}
`;
                    childSection += `- Tokens: ${childTotalTokens.toLocaleString()}
`;
                    childSection += `- Cost: $${childTotalCost.toFixed(4)}
`;
                  } else {
                    childSection += `| Session ID | Tokens | Cost |
`;
                    childSection += `|------------|--------|------|
`;
                    const { rows: limitedChildren, truncated: childrenTruncated, totalCount: childrenTotal } = limitTableRows(treeStats.childSummaries);
                    for (const child of limitedChildren) {
                      const sessionIDShort = child.sessionID.substring(0, 12);
                      childSection += `| ${sessionIDShort}... | ${child.tokens.total.toLocaleString()} | $${child.cost.toFixed(4)} |
`;
                    }
                    if (childrenTruncated) {
                      childSection += `
_...and ${childrenTotal - limitedChildren.length} more rows. Use \`token_export\` for full data._
`;
                    }
                  }
                  output += childSection;
                  sections.push(childSection);
                }
              } catch {
                output += `
_[Child sessions unavailable]_
`;
              }
            }
            if (args.debug) {
              const debugSection = `
## Debug Info

${getDebugInfo(sections)}
`;
              output += debugSection;
            }
            const stabilityConfig = isAntigravity ? { maxChars: 8000 } : {};
            const result = truncateOutput(output, stabilityConfig);
            return result.content;
          } catch (error) {
            return `Error calculating token statistics: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    },
    event: async ({ event }) => {
      if (event.type === "message.updated") {
        try {
          const msgInfo = event.properties?.info;
          if (!msgInfo || msgInfo.role !== "assistant") {
            return;
          }
          const sessionID = msgInfo.sessionID;
          if (inFlightSessions.has(sessionID)) {
            return;
          }
          inFlightSessions.add(sessionID);
          try {
            const response = await input.client.session.messages({
              path: { id: sessionID }
            });
            if (response.error || !response.data) {
              return;
            }
            const messages = response.data;
            const assistantMessages = messages.filter((m) => m.info.role === "assistant").map((m) => m.info);
            if (assistantMessages.length === 0) {
              return;
            }
            const byModel = aggregateTokensByModel(assistantMessages);
            const customPricing = loadPricingConfig();
            const costResult = calculateCost(byModel, customPricing);
            const quotaStatuses = loadAntigravityQuota();
            const decision = shouldShowToast(costResult.totalCost, quotaStatuses, sessionID);
            if (decision.show && decision.message) {
              updateState(sessionID, costResult.totalCost, quotaStatuses);
              await input.client.tui.showToast({
                body: {
                  message: decision.message,
                  variant: decision.message.includes("\u26A0\uFE0F") ? "warning" : "info",
                  duration: 5000
                }
              });
            }
          } finally {
            inFlightSessions.delete(sessionID);
          }
        } catch (error) {
          console.error("Error in message.updated handler:", error);
        }
        return;
      }
      if (event.type === "session.idle") {
        try {
          const sessionID = event.properties.sessionID;
          const response = await input.client.session.messages({
            path: { id: sessionID }
          });
          if (response.error) {
            return;
          }
          const messages = response.data || [];
          const assistantMessages = messages.filter((msg) => msg.info.role === "assistant").map((msg) => msg.info);
          if (assistantMessages.length === 0) {
            return;
          }
          const totals = aggregateTokens(assistantMessages);
          const byModel = aggregateTokensByModel(assistantMessages);
          const customPricing = loadPricingConfig();
          const costResult = calculateCost(byModel, customPricing);
          let aggregateCost = costResult.totalCost;
          try {
            const tree = await listSessionTree(sessionID, input.client, { maxDepth: 3 });
            if (tree.children.length > 0) {
              const treeStats = aggregateSessionTree(tree, customPricing);
              const treeCostResult = calculateCost(treeStats.byModel, customPricing);
              aggregateCost = treeCostResult.totalCost;
            }
          } catch {}
          await saveSessionRecord({
            sessionID,
            projectID: input.project?.id,
            timestamp: Date.now(),
            totals,
            byModel,
            cost: costResult.totalCost
          });
          await input.client.tui.showToast({
            body: {
              message: `Session Cost: $${aggregateCost.toFixed(4)}`,
              variant: "info",
              duration: 5000
            }
          });
          resetState(sessionID);
        } catch (error) {
          console.error("Error in session.idle handler:", error);
        }
      }
    }
  };
}
export {
  getInFlightCount,
  plugin_default as default
};
