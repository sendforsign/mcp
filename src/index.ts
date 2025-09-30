#!/usr/bin/env node
import dotenv from 'dotenv';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { request } from 'undici';
import type { IncomingHttpHeaders } from 'http';

dotenv.config({ debug: false, quiet: true });

interface SessionData {
  apiKey?: string;
  clientKey?: string;
  [key: string]: unknown;
}

function extractApiKey(headers: IncomingHttpHeaders): string | undefined {
  const headerAuth = headers['authorization'];
  const headerApiKey = (headers['x-sendforsign-key'] || headers['x-api-key']) as
    | string
    | string[]
    | undefined;

  if (headerApiKey) {
    return Array.isArray(headerApiKey) ? headerApiKey[0] : headerApiKey;
  }

  if (typeof headerAuth === 'string' && headerAuth.toLowerCase().startsWith('bearer ')) {
    return headerAuth.slice(7).trim();
  }

  return undefined;
}

function removeEmptyTopLevel<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    // @ts-expect-error dynamic
    out[k] = v;
  }
  return out;
}

const server = new FastMCP<SessionData>({
  name: 'mcp-sfs',
  version: '1.0.0',
  roots: { enabled: false },
  authenticate: async (request?: { headers?: IncomingHttpHeaders }): Promise<SessionData> => {
    const headers: IncomingHttpHeaders = (request?.headers as IncomingHttpHeaders) || {} as IncomingHttpHeaders;
    const apiKey = extractApiKey(headers) || process.env.SFS_API_KEY;
    const headerClientKey = headers['x-client-key'] as string | string[] | undefined;
    const normalizedHeaderClientKey = headerClientKey
      ? Array.isArray(headerClientKey)
        ? headerClientKey[0]
        : headerClientKey
      : undefined;
    const clientKey = normalizedHeaderClientKey ?? process.env.SFS_CLIENT_KEY;

    // Be permissive here so unauthenticated actions like listTools can work.
    // Tools themselves validate presence of credentials.
    return { apiKey, clientKey };
  },
});

const ORIGIN = 'mcp-sfs';

async function sfsCall(
  apiKey: string,
  body: Record<string, unknown>
): Promise<any> {
  const endpoint = 'https://api.sendforsign.com/api/template';
  const res = await request(endpoint, {
    method: 'POST',
    headers: {
      'X-Sendforsign-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.body.json();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(`SFS error ${res.statusCode}: ${JSON.stringify(json)}`);
  }
  return json;
}

function asText(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

// Schemas
const listParams = z.object({
  // optional override for clientKey (usually from session)
  clientKey: z.string().optional(),
});

const readParams = z.object({
  templateKey: z.string().min(1),
  clientKey: z.string().optional(),
});

server.addTool({
  name: 'sfs_list_templates',
  description:
    'List SendForSign templates and their keys for the current clientKey.',
  parameters: listParams,
  execute: async (args, { session, log }) => {
    const { clientKey: override } = args as { clientKey?: string };
    const apiKey = session?.apiKey as string | undefined;
    const clientKey = override || (session?.clientKey as string | undefined);
    if (!apiKey || !clientKey) throw new Error('Unauthorized');
    log.info('Listing templates', { origin: ORIGIN });
    const body = {
      data: removeEmptyTopLevel({ clientKey, action: 'list' as const }),
    };
    const res = await sfsCall(apiKey, body);
    return asText(res);
  },
});

server.addTool({
  name: 'sfs_read_template',
  description: 'Read a SendForSign template content by templateKey.',
  parameters: readParams,
  execute: async (args, { session, log }) => {
    const { templateKey, clientKey: override } = args as {
      templateKey: string;
      clientKey?: string;
    };
    const apiKey = session?.apiKey as string | undefined;
    const clientKey = override || (session?.clientKey as string | undefined);
    if (!apiKey || !clientKey) throw new Error('Unauthorized');
    log.info('Reading template', { templateKey, origin: ORIGIN });
    const body = {
      data: removeEmptyTopLevel({
        action: 'read' as const,
        clientKey,
        template: { templateKey },
      }),
    };
    const res = await sfsCall(apiKey, body);
    return asText(res);
  },
});

await server.start({ transportType: 'stdio' });


