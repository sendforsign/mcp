## SendForSign MCP Server

MCP server for SendForSign API with both transports (stdio and httpStream). Provides tools to list templates and read template content.

### Install

```bash
npm i -g @sendforsign/mcp
```

Or run via npx (no install):

```bash
npx @sendforsign/mcp
```

Use in an MCP client config (via npx):

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

### Env

- `SFS_API_KEY`: SendForSign API key
- `SFS_CLIENT_KEY`: SendForSign client key
- `CLOUD_SERVICE` (optional): when `true`, enables httpStream transport on `PORT`/`HOST`

Copy `.env.example` to `.env` for local usage.

### Tools

- `sfs_list_templates({ clientKey? })`
- `sfs_read_template({ templateKey, clientKey? })`

If `clientKey` is omitted in arguments, the value from session/env is used.

### Transports

- Default `stdio` when `CLOUD_SERVICE` is not `true`
- `httpStream` when `CLOUD_SERVICE=true` (health at `/health`)

### Docker

Build:

```bash
docker build -t sendforsign/mcp:local .
```

Run:

```bash
docker run --rm -p 3000:3000 \
  -e CLOUD_SERVICE=true \
  -e SFS_API_KEY=YOUR-API-KEY \
  -e SFS_CLIENT_KEY=YOUR-CLIENT-KEY \
  sendforsign/mcp:local
```

Health check:

```bash
curl -sS http://localhost:3000/health
```


