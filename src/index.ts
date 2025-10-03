#!/usr/bin/env node
import dotenv from "dotenv";
import { FastMCP, type Logger } from "fastmcp";
import { z } from "zod";
import { request } from "undici";
import type { IncomingHttpHeaders } from "http";

dotenv.config({ debug: false, quiet: true });

interface SessionData {
  apiKey: string;
  clientKey: string;
  [key: string]: any;
}

// Универсальная функция: ищет и в headers, и в process.env
function getHeaderOrEnv(
  headers: IncomingHttpHeaders,
  names: string[]
): string | undefined {
  // ищем в headers
  for (const name of names) {
    const val = headers[name.toLowerCase()] as string | string[] | undefined;
    if (val) return Array.isArray(val) ? val[0] : val;
  }

  // ищем в process.env (и с нижним подчёркиванием, и с дефисом, и в разных регистрах)
  for (const name of names) {
    const candidates = [
      name,
      name.replace(/-/g, "_"),
      name.replace(/_/g, "-"),
      name.toUpperCase(),
      name.toLowerCase(),
    ];
    for (const cand of candidates) {
      if (process.env[cand]) return process.env[cand];
    }
  }

  return undefined;
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
    // Логируем все заголовки, которые реально пришли
    console.log("[HEADERS]", new Date().toISOString(), request.headers);

    const apiKey =
      getHeaderOrEnv(request.headers, ["x-api-key", "x-sendforsign-key"]) || "";
    const clientKey = getHeaderOrEnv(request.headers, ["x-client-key"]) || "";

    console.log("[AUTH]", new Date().toISOString(), {
      hasApiKey: !!apiKey,
      hasClientKey: !!clientKey,
      apiKeySource: apiKey ? "header/env" : "none",
      clientKeySource: clientKey ? "header/env" : "none",
    });

    return { apiKey, clientKey };
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
  parameters: z.object({}).strict(),
  execute: async (_args, { session, log }) => {
    const { apiKey, clientKey } = session!;

    if (!apiKey || !clientKey) {
      throw new Error("Unauthorized - API key and client key are required");
    }

    log.info("Listing templates", { origin: ORIGIN });

    const body = {
      data: { clientKey, action: "list" as const },
    };

    const res = await sfsCall(apiKey, body);
    return asText(res);
  },
});

server.addTool({
  name: "sfs_read_template",
  description: "Read a SendForSign template content by templateKey.",
  parameters: z
    .object({
      templateKey: z
        .string()
        .min(1)
        .describe("The unique key identifier of the template to read"),
    })
    .strict(),
  execute: async (args, { session, log }) => {
    const { templateKey } = args;
    const { apiKey, clientKey } = session!;

    if (!templateKey || !templateKey.trim()) {
      throw new Error('Missing required argument "templateKey"');
    }

    if (!apiKey || !clientKey) {
      throw new Error("Unauthorized - API key and client key are required");
    }

    log.info("Reading template", { templateKey, origin: ORIGIN });

    const body = {
      data: {
        action: "read" as const,
        clientKey,
        template: { templateKey },
      },
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
