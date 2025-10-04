<div align="center">
  <a name="readme-top"></a>
  <h1>Sendforsign MCP Server</h1>
</div>

A Model Context Protocol (MCP) server implementation that integrates with [Sendforsign](https://sendforsign.com) for document template management and signing workflows.

## Features

- Template listing and content reading
- Flexible authentication (API keys via env vars or HTTP headers)
- Dual transport support (stdio for MCP clients, HTTP Stream for web APIs)
- Docker ready deployment
- Health monitoring

## Installation

### Running with npx

```bash
env SFS_API_KEY=YOUR_API_KEY SFS_CLIENT_KEY=YOUR_CLIENT_KEY npx -y @sendforsign/mcp
```

### Manual Installation

```bash
npm install -g @sendforsign/mcp
```

### Running on Cursor

For the most up-to-date configuration instructions, please refer to the official Cursor documentation on configuring MCP servers:
[Cursor MCP Server Configuration Guide](https://docs.cursor.com/context/model-context-protocol#configuring-mcp-servers)

To configure SendForSign MCP in Cursor:

1. Open Cursor Settings
2. Go to Features > MCP Servers
3. Click "+ Add new global MCP server"
4. Enter the following code:
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

### Running on Windsurf

Add this to your `./codeium/windsurf/model_config.json`:

```json
{
  "mcpServers": {
    "sendforsign-mcp": {
      "command": "npx",
      "args": ["-y", "@sendforsign/mcp"],
      "env": {
        "SFS_API_KEY": "YOUR_API_KEY",
        "SFS_CLIENT_KEY": "YOUR_CLIENT_KEY"
      }
    }
  }
}
```

### Running with HTTP Stream Mode

To run the server using HTTP Stream locally instead of the default stdio transport:

```bash
# Option 1: Using HTTP_STREAMABLE_SERVER
env HTTP_STREAMABLE_SERVER=true SFS_API_KEY=YOUR_API_KEY SFS_CLIENT_KEY=YOUR_CLIENT_KEY npx -y @sendforsign/mcp

# Option 2: Using CLOUD_SERVICE
env CLOUD_SERVICE=true SFS_API_KEY=YOUR_API_KEY SFS_CLIENT_KEY=YOUR_CLIENT_KEY npx -y @sendforsign/mcp
```

Use the url: http://localhost:3000/mcp

## Configuration

### Environment Variables

#### Required

- `SFS_API_KEY`: Your SendForSign API key
- `SFS_CLIENT_KEY`: Your SendForSign client key

#### Optional

- `HTTP_STREAMABLE_SERVER`: Set to `true` to enable HTTP Stream transport
- `CLOUD_SERVICE`: Set to `true` to enable HTTP Stream transport (alternative to HTTP_STREAMABLE_SERVER)
- `SSE_LOCAL`: Set to `true` to enable HTTP Stream transport (alternative to HTTP_STREAMABLE_SERVER)
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost)

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sendforsign-mcp": {
      "command": "npx",
      "args": ["-y", "@sendforsign/mcp"],
      "env": {
        "SFS_API_KEY": "YOUR_API_KEY_HERE",
        "SFS_CLIENT_KEY": "YOUR_CLIENT_KEY_HERE"
      }
    }
  }
}
```

## Available Tools

### 1. List Templates (`sfs_list_templates`)

List all SendForSign templates for the authenticated client.

**Best for:**
- Discovering available templates
- Getting template metadata

**Usage Example:**
```json
{
  "name": "sfs_list_templates",
  "arguments": {}
}
```

**Returns:** Array of templates with their keys and metadata.

### 2. Read Template (`sfs_read_template`)

Read the content of a specific SendForSign template.

**Best for:**
- Getting template content for editing or analysis
- Template inspection

**Usage Example:**
```json
{
  "name": "sfs_read_template",
  "arguments": {
    "templateKey": "your-template-key"
  }
}
```

**Returns:** Template content and metadata.

## HTTP Stream API

When running in HTTP Stream mode, the server provides REST endpoints:

- `GET /health` - Health check
- `POST /mcp` - MCP protocol endpoint

### Authentication via HTTP Headers

Send API keys in HTTP headers:

**API Key** (choose one):
- `X-Sendforsign-Key: YOUR-API-KEY`
- `X-Api-Key: YOUR-API-KEY`

**Client Key**:
- `X-Client-Key: YOUR-CLIENT-KEY`

### Example API Call

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "X-Sendforsign-Key: YOUR-API-KEY" \
  -H "X-Client-Key: YOUR-CLIENT-KEY" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
```

## Docker Deployment

### Build and Run

```bash
# Build image
docker build -t sendforsign/mcp:latest .

# Run container
docker run --rm -p 3000:3000 \
  -e CLOUD_SERVICE=true \
  -e SFS_API_KEY=YOUR-API-KEY \
  -e SFS_CLIENT_KEY=YOUR-CLIENT-KEY \
  sendforsign/mcp:latest
```

### Health Check
```bash
curl -sS http://localhost:3000/health
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run development server
npm run dev
```

## License

MIT License - see LICENSE file for details


