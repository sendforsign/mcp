## MCP SFS Server

MCP server for SendForSign API with both transports (stdio and httpStream). Provides tools to list templates and read template content.

### Install

```bash
npm i -g @iliabovkunov/mcp-sfs
```

Or run via npx (no install):

```bash
npx @iliabovkunov/mcp-sfs
```

Use in an MCP client config (via npx):

```json
{
  "mcpServers": {
    "mcp-sfs": {
      "command": "npx",
      "args": ["-y", "@iliabovkunov/mcp-sfs"],
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


