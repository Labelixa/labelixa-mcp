# Installing the Labelixa MCP server

Labelixa is a hosted (remote) MCP server. There is nothing to build or
install: add the server URL to your MCP client configuration.

## Option 1 (recommended): remote server

Add this entry to the `mcpServers` object of your MCP settings file.
In Cline it is `cline_mcp_settings.json`: open it from the MCP Servers
panel ("Edit Configuration"); on macOS and Linux it is usually
`~/.cline/data/settings/cline_mcp_settings.json`. There is no need to
search the disk for it.

```json
{
  "mcpServers": {
    "labelixa": {
      "type": "streamableHttp",
      "url": "https://api.labelixa.com/mcp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

No API key is required. Anonymous use is free and rate-limited per IP.
To use an account's own quota, add a Labelixa API key as a header:

```json
"headers": { "Authorization": "Bearer lbx_..." }
```

API keys are created at https://labelixa.com/panel (keys start with `lbx_`).

## Option 2: local server over stdio

Requires Node.js 18 or newer.

```json
{
  "mcpServers": {
    "labelixa": {
      "command": "npx",
      "args": ["-y", "labelixa-mcp"],
      "env": { "LABELIXA_API_KEY": "" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

`LABELIXA_API_KEY` is optional; leave it empty for anonymous use.

## Verify the installation

Call the `zpl_validate` tool with:

```
^XA^FO50,50^A0N,40,40^FDHello^FS^XZ
```

A successful response lists zero errors. Then call `zpl_preview` with the
same ZPL to get a PNG rendering of the label.

Documentation: https://labelixa.com/mcp
