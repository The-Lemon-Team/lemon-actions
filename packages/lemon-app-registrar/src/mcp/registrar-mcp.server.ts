#!/usr/bin/env node
/**
 * Lemon Actions — Model Context Protocol (MCP) Server
 *
 * Provides native tools for Autonomous AI Agents to safely register applications,
 * allocate dedicated non-colliding ports, issue lease tokens, renew heartbeats,
 * and release ports cleanly upon task completion.
 *
 * Transports: Standard Input / Output (stdio) JSON-RPC 2.0.
 */

import * as readline from 'readline';

const API_BASE_URL = process.env.LEMON_API_URL || 'http://localhost:3000/api';

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: McpTool[] = [
  {
    name: 'lemon_register_app',
    description:
      'Registers an agent application with Lemon Port Shield, allocates a dedicated non-colliding port (4301+), and returns instanceId and leaseToken. Call this BEFORE starting any local web server, preview app, or listener.',
    inputSchema: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Descriptive name of the application or agent service (e.g. "preview-docs-server", "data-crawler")',
        },
        environment: {
          type: 'string',
          enum: ['dev', 'staging', 'production'],
          description: 'Environment scope (default: "dev")',
        },
        networkMode: {
          type: 'string',
          enum: ['local', 'tailscale-lan', 'tailscale-funnel'],
          description: 'Network routing: "local" (localhost), "tailscale-lan" (mesh 100.x), or "tailscale-funnel" (public HTTPS)',
        },
        desiredPort: {
          type: 'number',
          description: 'Optional preferred port. If omitted, the registrar automatically allocates the next available port.',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'lemon_heartbeat',
    description: 'Renews the lease token for an active application instance to prevent automatic eviction.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID returned during registration' },
        leaseToken: { type: 'string', description: 'Lease token issued during registration' },
      },
      required: ['instanceId', 'leaseToken'],
    },
  },
  {
    name: 'lemon_release_app',
    description: 'Releases the allocated port and token when the agent completes its task or shuts down the server.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'Instance ID returned during registration' },
        leaseToken: { type: 'string', description: 'Lease token issued during registration' },
      },
      required: ['instanceId', 'leaseToken'],
    },
  },
  {
    name: 'lemon_list_apps',
    description: 'Lists all active services currently registered in Lemon Port Shield, with their ports and health status.',
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          enum: ['dev', 'staging', 'production'],
          description: 'Filter by environment',
        },
      },
    },
  },
];

async function callBackend(path: string, method: string, body?: unknown) {
  const url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { isError: true, status: res.status, error: errText };
    }
    return await res.json();
  } catch (err: any) {
    return { isError: true, error: err?.message || 'Failed to connect to Lemon API at ' + url };
  }
}

async function handleToolCall(name: string, args: any) {
  switch (name) {
    case 'lemon_register_app': {
      const result = await callBackend('registry/register', 'POST', args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'lemon_heartbeat': {
      const result = await callBackend('registry/heartbeat', 'POST', args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'lemon_release_app': {
      const result = await callBackend('registry/release', 'POST', args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'lemon_list_apps': {
      const query = args?.environment ? `?environment=${args.environment}` : '';
      const result = await callBackend(`registry/pool${query}`, 'GET');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function startStdioServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line);
      const id = request.id;

      if (request.method === 'initialize') {
        const response = {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: {
              name: 'lemon-app-registrar-mcp',
              version: '0.1.0',
            },
          },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } else if (request.method === 'tools/list') {
        const response = {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      } else if (request.method === 'tools/call') {
        const toolName = request.params?.name;
        const toolArgs = request.params?.arguments || {};
        try {
          const result = await handleToolCall(toolName, toolArgs);
          const response = { jsonrpc: '2.0', id, result };
          process.stdout.write(JSON.stringify(response) + '\n');
        } catch (err: any) {
          const response = {
            jsonrpc: '2.0',
            id,
            error: { code: -32603, message: err?.message || 'Tool execution error' },
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } else {
        // Unhandled method
        const response = {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        };
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch {
      // Ignore unparseable lines
    }
  });
}

if (require.main === module) {
  startStdioServer();
}
