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

function extractClientKey(headers: IncomingHttpHeaders): string | undefined {
  const headerClientKey = headers["x-client-key"] as
    | string
    | string[]
    | undefined;

  if (!headerClientKey) return undefined;

  return Array.isArray(headerClientKey)
    ? headerClientKey[0]
    : headerClientKey;
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
    headers?: IncomingHttpHeaders;
  }): Promise<SessionData> => {
    // ✅ УПРОЩЕНО: Извлекаем оба ключа один раз здесь
    // Для stdio transport headers может быть undefined
    const apiKey = request.headers 
      ? extractApiKey(request.headers) || process.env.SFS_API_KEY || ""
      : process.env.SFS_API_KEY || "";
    const clientKey = request.headers
      ? extractClientKey(request.headers) || process.env.SFS_CLIENT_KEY || ""
      : process.env.SFS_CLIENT_KEY || "";

    // Логирование для отладки
    console.log("[AUTH]", new Date().toISOString(), {
      hasApiKey: !!apiKey,
      hasClientKey: !!clientKey,
      transportType: request.headers ? "httpStream" : "stdio",
      apiKeySource: request.headers && extractApiKey(request.headers)
        ? "header"
        : process.env.SFS_API_KEY
        ? "env"
        : "none",
      clientKeySource: request.headers && extractClientKey(request.headers)
        ? "header"
        : process.env.SFS_CLIENT_KEY
        ? "env"
        : "none",
    });

    return { apiKey, clientKey };
  },
  health: { enabled: true, message: "ok", path: "/health", status: 200 },
});

const ORIGIN = "mcp-sfs";

async function sfsApiCall(
  apiKey: string,
  path: "template" | "placeholder" | "contract",
  body: Record<string, unknown>
): Promise<any> {
  const endpoint = `https://api.sendforsign.com/api/${path}`;
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
  execute: async (args, { session, log }) => {
    // ✅ УПРОЩЕНО: Ключи уже извлечены в authenticate
    let apiKey: string;
    let clientKey: string;
    
    if (session) {
      // Если сессия доступна (httpStream), используем её
      ({ apiKey, clientKey } = session);
    } else {
      // Если сессия недоступна (stdio), используем переменные окружения
      apiKey = process.env.SFS_API_KEY || "";
      clientKey = process.env.SFS_CLIENT_KEY || "";
    }

    if (!apiKey || !clientKey) {
      throw new Error("Unauthorized - API key and client key are required. Please set SFS_API_KEY and SFS_CLIENT_KEY environment variables.");
    }

    log.info("Listing templates", { origin: ORIGIN });
    
    const body = {
      data: { clientKey, action: "list" as const },
    };
    
    const res = await sfsApiCall(apiKey, "template", body);
    return asText(res);
  },
});

server.addTool({
  name: "sfs_read_template",
  description: "Read a SendForSign template content by templateKey. Use the sfs_list_templates tool to get the templateKey if needed.",
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
    // ✅ УПРОЩЕНО: Ключи уже извлечены в authenticate
    let apiKey: string;
    let clientKey: string;
    
    if (session) {
      // Если сессия доступна (httpStream), используем её
      ({ apiKey, clientKey } = session);
    } else {
      // Если сессия недоступна (stdio), используем переменные окружения
      apiKey = process.env.SFS_API_KEY || "";
      clientKey = process.env.SFS_CLIENT_KEY || "";
    }

    if (!templateKey || !templateKey.trim()) {
      throw new Error('Missing required argument "templateKey"');
    }

    if (!apiKey || !clientKey) {
      throw new Error("Unauthorized - API key and client key are required. Please set SFS_API_KEY and SFS_CLIENT_KEY environment variables.");
    }

    log.info("Reading template", { templateKey, origin: ORIGIN });
    
    const body = {
      data: {
        action: "read" as const,
        clientKey,
        template: { templateKey },
      },
    };
    
    const res = await sfsApiCall(apiKey, "template", body);
    return asText(res);
  },
});

server.addTool({
  name: "sfs_list_placeholders",
  description:
    "List placeholders for a specific SendForSign template by templateKey.",
  parameters: z
    .object({
      templateKey: z
        .string()
        .min(1)
        .describe(
          "The unique key identifier of the template whose placeholders to list"
        ),
    })
    .strict(),
  execute: async (args, { session, log }) => {
    const { templateKey } = args;
    let apiKey: string;
    let clientKey: string;

    if (session) {
      ({ apiKey, clientKey } = session);
    } else {
      apiKey = process.env.SFS_API_KEY || "";
      clientKey = process.env.SFS_CLIENT_KEY || "";
    }

    if (!templateKey || !templateKey.trim()) {
      throw new Error('Missing required argument "templateKey"');
    }

    if (!apiKey || !clientKey) {
      throw new Error(
        "Unauthorized - API key and client key are required. Please set SFS_API_KEY and SFS_CLIENT_KEY environment variables."
      );
    }

    log.info("Listing placeholders", { templateKey, origin: ORIGIN });

    const body = {
      data: {
        action: "list" as const,
        clientKey,
        templateKey,
      },
    };

    const res = await sfsApiCall(apiKey, "placeholder", body);
    return asText(res);
  },
});

server.addTool({
  name: "sfs_create_contract",
  description:
    "Create a new SendForSign contract from HTML/text value with a given name.",
  parameters: z
    .object({
      name: z
        .string()
        .min(1)
        .describe("Human-readable contract name, automatically generated if not provided"),
      value: z
        .string()
        .min(1)
        .describe("HTML content of the contract (e.g., <p>...</p>), automatically generated if not provided"),
    })
    .strict(),
  execute: async (args, { session, log }) => {
    const { name, value } = args;
    let apiKey: string;
    let clientKey: string;

    if (session) {
      ({ apiKey, clientKey } = session);
    } else {
      apiKey = process.env.SFS_API_KEY || "";
      clientKey = process.env.SFS_CLIENT_KEY || "";
    }

    if (!name || !name.trim()) {
      throw new Error('Missing required argument "name"');
    }
    if (!value || !value.trim()) {
      throw new Error('Missing required argument "value"');
    }

    if (!apiKey || !clientKey) {
      throw new Error(
        "Unauthorized - API key and client key are required. Please set SFS_API_KEY and SFS_CLIENT_KEY environment variables."
      );
    }

    log.info("Creating contract", { name, origin: ORIGIN });

    const body = {
      data: {
        action: "create" as const,
        clientKey,
        contract: {
          name,
          value,
        },
      },
    };

    const res = await sfsApiCall(apiKey, "contract", body);
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