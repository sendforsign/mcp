#!/usr/bin/env node
import dotenv from "dotenv";
import { FastMCP, type Logger } from "fastmcp";
import { z } from "zod";
import { request } from "undici";
import type { IncomingHttpHeaders } from "http";

dotenv.config({ debug: false, quiet: true });

interface SessionData {
  apiKey?: string;
  clientKey?: string;
  [key: string]: unknown;
}

function extractApiKey(headers: IncomingHttpHeaders): string | undefined {
  const headerAuth = headers["authorization"];
  const headerApiKey = (headers["x-sendforsign-key"] ||
    headers["x-api-key"]) as string | string[] | undefined;

  if (headerApiKey) {
    return Array.isArray(headerApiKey) ? headerApiKey[0] : headerApiKey;
  }

  if (
    typeof headerAuth === "string" &&
    headerAuth.toLowerCase().startsWith("bearer ")
  ) {
    return headerAuth.slice(7).trim();
  }

  return undefined;
}

function removeEmptyTopLevel<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0
    )
      continue;
    // @ts-expect-error dynamic
    out[k] = v;
  }
  return out;
}

class ConsoleLogger implements Logger {
  private shouldLog =
    process.env.CLOUD_SERVICE === "true" ||
    process.env.SSE_LOCAL === "true" ||
    process.env.HTTP_STREAMABLE_SERVER === "true";

  debug(...args: unknown[]): void {
    if (this.shouldLog)
      console.debug("[DEBUG]", new Date().toISOString(), ...args);
  }
  error(...args: unknown[]): void {
    if (this.shouldLog)
      console.error("[ERROR]", new Date().toISOString(), ...args);
  }
  info(...args: unknown[]): void {
    if (this.shouldLog)
      console.log("[INFO]", new Date().toISOString(), ...args);
  }
  log(...args: unknown[]): void {
    if (this.shouldLog) console.log("[LOG]", new Date().toISOString(), ...args);
  }
  warn(...args: unknown[]): void {
    if (this.shouldLog)
      console.warn("[WARN]", new Date().toISOString(), ...args);
  }
}

const server = new FastMCP<SessionData>({
  name: "mcp-sfs",
  version: "1.0.0",
  logger: new ConsoleLogger(),
  roots: { enabled: false },
  authenticate: async (request: {
    headers: IncomingHttpHeaders;
  }): Promise<SessionData> => {
    const isCloud = process.env.CLOUD_SERVICE === "true";

    const apiKeyFromHeader = extractApiKey(request.headers);
    const headerClientKey = request.headers["x-client-key"] as
      | string
      | string[]
      | undefined;
    const clientKeyFromHeader = headerClientKey
      ? Array.isArray(headerClientKey)
        ? headerClientKey[0]
        : headerClientKey
      : undefined;

    if (isCloud) {
      if (!apiKeyFromHeader || !clientKeyFromHeader) {
        return removeEmptyTopLevel({
          apiKey: apiKeyFromHeader,
          clientKey: clientKeyFromHeader,
        });
      }
      return { apiKey: apiKeyFromHeader, clientKey: clientKeyFromHeader };
    }

    // For stdio mode: return empty session, keys will be read from env in tools
    return {};
  },
  health: { enabled: true, message: "ok", path: "/health", status: 200 },
});

const ORIGIN = "mcp-sfs";

async function sfsCall(
  apiKey: string,
  body: Record<string, unknown>
): Promise<any> {
  const endpoint = "https://api.sendforsign.com/api/template";
  const res = await request(endpoint, {
    method: "POST",
    headers: {
      "X-Sendforsign-Key": apiKey,
      "Content-Type": "application/json",
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

server.addTool({
  name: "sfs_list_templates",
  description: `List all available SendForSign templates and their keys.`,
  parameters: z.object({
    clientKey: z.string().optional().describe("Client key for authentication. If not provided, uses the server-configured default.")
  }),
  execute: async (args, { session, log }) => {
    const { clientKey: clientKeyArg } = args as { clientKey?: string };
    
    const apiKey = process.env.SFS_API_KEY;
    const clientKey = clientKeyArg || process.env.SFS_CLIENT_KEY;

    if (!apiKey || !clientKey) {
      throw new Error("Unauthorized - API key and client key are required");
    }

    log.info("Listing templates", { origin: ORIGIN, hasClientKeyArg: !!clientKeyArg });
    const body = {
      data: removeEmptyTopLevel({ clientKey, action: "list" as const }),
    };
    const res = await sfsCall(apiKey, body);
    return asText(res);
  },
});

server.addTool({
  name: "sfs_read_template",
  description: "Read a SendForSign template content by templateKey.",
  parameters: z.object({
    templateKey: z.string().min(1).describe("The unique key identifier of the template to read"),
    clientKey: z.string().optional().describe("Client key for authentication. If not provided, uses the server-configured default.")
  }),
  execute: async (args, { session, log }) => {
    const { templateKey, clientKey: clientKeyArg } = args as { templateKey: string; clientKey?: string };

    if (!templateKey || !templateKey.trim()) {
      throw new Error('Missing required argument "templateKey"');
    }

    const apiKey = process.env.SFS_API_KEY;
    const clientKey = clientKeyArg || process.env.SFS_CLIENT_KEY;

    if (!apiKey || !clientKey) {
      throw new Error("Unauthorized - API key and client key are required");
    }

    log.info("Reading template", { templateKey, origin: ORIGIN, hasClientKeyArg: !!clientKeyArg });
    const body = {
      data: removeEmptyTopLevel({
        action: "read" as const,
        clientKey,
        template: { templateKey },
      }),
    };
    const res = await sfsCall(apiKey, body);
    return asText(res);
  },
});

const PORT = Number(process.env.PORT || 3000);
const HOST =
  process.env.CLOUD_SERVICE === "true"
    ? "0.0.0.0"
    : process.env.HOST || "localhost";

type StartArgs = Parameters<typeof server.start>[0];
let args: StartArgs;

if (
  process.env.CLOUD_SERVICE === "true" ||
  process.env.SSE_LOCAL === "true" ||
  process.env.HTTP_STREAMABLE_SERVER === "true"
) {
  args = {
    transportType: "httpStream",
    httpStream: {
      port: PORT,
      host: HOST,
      stateless: true,
    },
  };
} else {
  args = { transportType: "stdio" };
}

await server.start(args);
