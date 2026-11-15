#!/usr/bin/env node
/**
 * Lemon Actions — Projectarium Model Context Protocol (MCP) Server
 *
 * Provides native tools for Autonomous AI Agents to safely register applications
 * into Lemon-Projectarium stands, allocate dedicated non-colliding ports (4320+),
 * issue lease tokens, renew heartbeats, and release ports cleanly upon task completion.
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
      'Registers an agent application with Lemon-Projectarium Port Shield, allocates a dedicated non-colliding port (4320+), and returns instanceId, leaseToken, projectToken, and allocatedApp. Call this BEFORE starting any local web server, preview app, or listener.',
    inputSchema: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Descriptive name of the application or agent service (e.g. "preview-docs-server", "data-crawler")',
        },
        projectName: {
          type: 'string',
          description: 'Optional Projectarium stand name (defaults to "Agent Dynamic Apps" if omitted along with projectSlug/projectToken)',
        },
        projectSlug: {
          type: 'string',
          description: 'Optional existing Projectarium stand slug (e.g. "actions", "seasons", "agent-dynamic-apps")',
        },
        projectToken: {
          type: 'string',
          description: 'Optional Projectarium stand master token returned from a prior registration',
        },
        host: {
          type: 'string',
          description: 'Optional host/IP (default: "localhost")',
        },
        environment: {
          type: 'string',
          enum: ['dev', 'staging', 'production'],
          description: 'Environment scope (default: "dev")',
        },
        networkMode: {
          type: 'string',
          enum: ['local', 'lan', 'tailscale-lan', 'tailscale-funnel'],
          description: 'Network routing: "local" (localhost), "lan", "tailscale-lan" (mesh 100.x), or "tailscale-funnel" (public HTTPS)',
        },
        preferredPort: {
          type: 'number',
          description: 'Optional preferred port. If omitted, Projectarium automatically allocates the next available port (4320+).',
        },
        desiredPort: {
          type: 'number',
          description: 'Alias for preferredPort for backward compatibility.',
        },
        healthUrl: {
          type: 'string',
          description: 'Optional explicit HTTP/TCP healthcheck URL.',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'lemon_heartbeat',
    description: 'Renews the lease token for an active application instance in Projectarium to prevent eviction and confirm liveness.',
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
    description: 'Releases the allocated port and lease token in Projectarium when the agent completes its task or shuts down the server.',
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
    description: 'Lists all active services currently registered in Lemon-Projectarium Port Shield, with their stands, ports, and health status.',
    inputSchema: {
      type: 'object',
      properties: {
        environment: {
          type: 'string',
          enum: ['dev', 'staging', 'production'],
          description: 'Filter by environment',
        },
        networkMode: {
          type: 'string',
          enum: ['local', 'lan', 'tailscale-lan', 'tailscale-funnel'],
          description: 'Filter by network mode',
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
      const hasProjectRef = Boolean(args?.projectToken || args?.projectSlug || args?.projectName);
      const payload = {
        ...args,
        preferredPort: args?.preferredPort ?? args?.desiredPort,
        ...(hasProjectRef
          ? {}
          : {
              projectSlug: 'agent-dynamic-apps',
              projectName: 'Agent Dynamic Apps',
            }),
        author: args?.author || 'projectarium-mcp',
      };
      delete payload.desiredPort;
      const result = await callBackend('projectarium/register', 'POST', payload);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'lemon_heartbeat': {
      const result = await callBackend('projectarium/heartbeat', 'POST', args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'lemon_release_app': {
      const result = await callBackend('projectarium/release', 'POST', args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'lemon_list_apps': {
      const params = new URLSearchParams();
      if (args?.environment) params.set('environment', String(args.environment));
      if (args?.networkMode) params.set('networkMode', String(args.networkMode));
      const query = params.toString() ? `?${params.toString()}` : '';
      const result = await callBackend(`projectarium/pool${query}`, 'GET');
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
              name: 'lemon-projectarium-mcp',
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
