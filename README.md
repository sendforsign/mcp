# SendForSign MCP Server

MCP server for SendForSign API with support for both stdio and HTTP Stream transports. Provides tools to list templates and read template content with flexible authentication via environment variables or HTTP headers.

## Features

- 🔐 **Flexible Authentication**: API keys via environment variables or HTTP headers
- 🚀 **Dual Transport Support**: stdio for MCP clients, HTTP Stream for web APIs
- 📋 **Template Management**: List and read SendForSign templates
- 🐳 **Docker Ready**: Containerized deployment support
- 🔍 **Health Monitoring**: Built-in health check endpoint

## Installation

### Global Install

```bash
npm i -g @sendforsign/mcp
```

### Run via npx (no install)

```bash
npx @sendforsign/mcp
```

### Local Development

```bash
git clone https://github.com/sendforsign/mcp.git
cd mcp
npm install
npm run build
```

## Usage

### 1. MCP Client Integration (stdio transport)

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "sendforsign-mcp": {
      "command": "npx",
      "args": ["-y", "@sendforsign/mcp"],
      "env": {
        "SFS_API_KEY": "YOUR-API-KEY",
        "SFS_CLIENT_KEY": "YOUR-CLIENT-KEY"
      }
    }
  }
}
```

### 1.1. HTTP Stream Mode (for n8n and web clients)

For HTTP Stream mode, add `HTTP_STREAMABLE_SERVER=true`:

**Published package (after npm publish):**
```json
{
  "mcpServers": {
    "sendforsign-mcp": {
      "command": "npx",
      "args": ["-y", "@sendforsign/mcp"],
      "env": {
        "HTTP_STREAMABLE_SERVER": "true",
        "SFS_API_KEY": "YOUR-API-KEY",
        "SFS_CLIENT_KEY": "YOUR-CLIENT-KEY"
      }
    }
  }
}
```

**Local development (before npm publish):**
```json
{
  "mcpServers": {
    "sendforsign-mcp": {
      "command": "node",
      "args": ["/path/to/your/mcp/dist/index.js"],
      "env": {
        "HTTP_STREAMABLE_SERVER": "true",
        "SFS_API_KEY": "YOUR-API-KEY",
        "SFS_CLIENT_KEY": "YOUR-CLIENT-KEY"
      }
    }
  }
}
```

**Via command line:**
```bash
# Published package
env HTTP_STREAMABLE_SERVER=true SFS_API_KEY=YOUR-API-KEY SFS_CLIENT_KEY=YOUR-CLIENT-KEY npx -y @sendforsign/mcp

# Local development
env HTTP_STREAMABLE_SERVER=true SFS_API_KEY=YOUR-API-KEY SFS_CLIENT_KEY=YOUR-CLIENT-KEY node /path/to/your/mcp/dist/index.js
```

### 2. HTTP Stream API (for web clients)

Start the server in HTTP Stream mode:

```bash
CLOUD_SERVICE=true npm run dev
```

The server will be available at `http://localhost:3000` with the following endpoints:

- `GET /health` - Health check
- `POST /mcp` - MCP protocol endpoint

#### Authentication via HTTP Headers

Send API keys in HTTP headers with each request:

**API Key** (choose one):
- `X-Sendforsign-Key: YOUR-API-KEY`
- `X-Api-Key: YOUR-API-KEY`
- `Authorization: Bearer YOUR-API-KEY`

**Client Key**:
- `X-Client-Key: YOUR-CLIENT-KEY`

#### Example API Calls

**List available tools:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Sendforsign-Key: YOUR-API-KEY" \
  -H "X-Client-Key: YOUR-CLIENT-KEY" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

**List templates:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Sendforsign-Key: YOUR-API-KEY" \
  -H "X-Client-Key: YOUR-CLIENT-KEY" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "sfs_list_templates", "arguments": {}}}'
```

**Read template:**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Sendforsign-Key: YOUR-API-KEY" \
  -H "X-Client-Key: YOUR-CLIENT-KEY" \
  -d '{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "sfs_read_template", "arguments": {"templateKey": "your-template-key"}}}'
```

## Configuration

### Environment Variables

- `SFS_API_KEY`: SendForSign API key (fallback if not provided in headers)
- `SFS_CLIENT_KEY`: SendForSign client key (fallback if not provided in headers)
- `CLOUD_SERVICE`: Set to `true` to enable HTTP Stream transport
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost, 0.0.0.0 when CLOUD_SERVICE=true)

### Local Development Setup

1. Copy environment template:
```bash
cp env.sample .env
```

2. Edit `.env` with your API keys:
```bash
SFS_API_KEY=your-api-key-here
SFS_CLIENT_KEY=your-client-key-here
```

## Available Tools

### `sfs_list_templates`
List all SendForSign templates for the authenticated client.

**Parameters:**
- `clientKey` (optional): Override client key from session/headers

**Returns:** JSON array of templates with their keys and metadata.

### `sfs_read_template`
Read the content of a specific SendForSign template.

**Parameters:**
- `templateKey` (required): The key of the template to read
- `clientKey` (optional): Override client key from session/headers

**Returns:** Template content and metadata.

## Transport Modes

### stdio Transport (Default)
- Used by MCP clients like Cursor, Claude Desktop
- Authentication via environment variables
- Start: `npm run dev` or `npm start`

### HTTP Stream Transport
- Used for web APIs and custom integrations
- Authentication via HTTP headers or environment variables
- Start: `CLOUD_SERVICE=true npm run dev`
- Health check: `curl http://localhost:3000/health`

## Docker Deployment

### Build Image
```bash
docker build -t sendforsign/mcp:latest .
```

### Run Container

**With environment variables:**
```bash
docker run --rm -p 3000:3000 \
  -e CLOUD_SERVICE=true \
  -e SFS_API_KEY=YOUR-API-KEY \
  -e SFS_CLIENT_KEY=YOUR-CLIENT-KEY \
  sendforsign/mcp:latest
```

**With client-provided keys (headers only):**
```bash
docker run --rm -p 3000:3000 \
  -e CLOUD_SERVICE=true \
  sendforsign/mcp:latest
```

### Health Check
```bash
curl -sS http://localhost:3000/health
```

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run prepublishOnly` - Build before publishing

### Requirements
- Node.js >= 18.17
- TypeScript 5.6.3+

## License

MIT


