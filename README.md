# labelixa-mcp

[Labelixa](https://labelixa.com) is an MCP (Model Context Protocol) server
and API platform for thermal label development. It gives AI assistants and
developer tools the ability to render, validate, debug, inspect and
convert thermal printer labels — **ZPL, EPL, TSPL and CPCL** — through MCP.

There are two ways to connect:

| | Remote server (recommended) | This npm package |
|---|---|---|
| Endpoint | `https://api.labelixa.com/mcp` | local process over stdio |
| Tool set | full set: rendering, validation, debugging, conversion, barcode analysis, printer compatibility, templates, bulk jobs | core subset (table below); each tool calls the Labelixa REST API |
| Install | nothing to install | `npx -y labelixa-mcp` or `npm install -g labelixa-mcp` |
| Authentication | optional `lbx_` API key | optional `lbx_` API key |

The live tool list of the remote server is at
[labelixa.com/mcp](https://labelixa.com/mcp).

## Remote server (no install)

Transport: Streamable HTTP, stateless JSON-RPC over POST. Anonymous use
is free and rate-limited per IP; an API key uses the account's own quota.
Keys: [labelixa.com](https://labelixa.com).

Claude Code:

```sh
claude mcp add --transport http labelixa https://api.labelixa.com/mcp
```

With an API key:

```sh
claude mcp add --transport http labelixa https://api.labelixa.com/mcp \
  --header "Authorization: Bearer lbx_..."
```

Generic MCP client configuration (Claude Desktop, Cursor and other
clients that accept a `url` entry):

```json
{
  "mcpServers": {
    "labelixa": {
      "url": "https://api.labelixa.com/mcp",
      "headers": {"Authorization": "Bearer lbx_..."}
    }
  }
}
```

Drop the `headers` block for anonymous use.

## Local server (this package)

```sh
npm install -g labelixa-mcp
```

Or skip installing and run it with `npx` straight from your MCP client
config:

```json
{
  "mcpServers": {
    "labelixa": {
      "command": "npx",
      "args": ["-y", "labelixa-mcp"],
      "env": {"LABELIXA_API_KEY": "lbx_..."}
    }
  }
}
```

Environment variables:

- `LABELIXA_API_KEY` — optional `lbx_` API key. Without it the anonymous
  quota applies.
- `LABELIXA_BASE_URL` — optional; defaults to `https://api.labelixa.com`.

### Tools in this package

| Tool | What it does |
|---|---|
| `zpl_preview` | Renders ZPL to a PNG image for inspection. Server-side render — not a guarantee of how a specific physical printer will output the label. |
| `zpl_validate` | Lints ZPL and returns the structured diagnostics report (unknown commands, parameter ranges, layout overflow) as JSON. Pass the real label size — checks depend on it. |
| `barcode_generate` | Generates a standalone barcode (SVG or PNG): code128, code39, ean13, upca, upce, itf14, msi, qrcode, datamatrix, pdf417. |
| `language_detect` | Detects the printer language of raw label code (ZPL/EPL/TSPL/CPCL). Heuristic — returns a confidence tier, not a probability. |
| `epl_validate` | Lints EPL/EPL2 code; positioned findings with severity, as JSON. |
| `tspl_validate` | Lints TSPL/TSPL2 code; positioned findings with severity, as JSON. |
| `cpcl_validate` | Lints CPCL code; positioned findings with severity, as JSON. |
| `zpl_compatibility` | Compatibility RISK analysis of ZPL against a printer model. Not an emulator — reports language posture with evidence level; never says "it works". |
| `zpl_command_help` | Looks up one ZPL command in the maintained catalog: name, syntax, parameters and whether the preview engine actually renders it — printer-side commands are marked as not rendered. Optional `locale` (`en` default, `tr`, `de`) translates the name and descriptions only; command codes, syntax strings, examples and parameter names are protocol and never change. |
| `convert_zpl_dpi` | Rescales ZPL coordinates between printer resolutions (203/300/600 dpi). Embedded `^GF`/`~DG` bitmaps are NOT rescaled — a warnings block precedes the output when present. |
| `explain_zpl` | Full sectioned health report (syntax, size/DPI, orientation, barcodes, fonts, memory) with an honest score — sections it cannot assess say "not assessed" instead of counting. |

EPL, TSPL and CPCL previews, label templates, bulk generation,
image-to-ZPL conversion and barcode reading from photos are on the remote
server only.

## Directory listings

- Official [MCP Registry](https://registry.modelcontextprotocol.io):
  `com.labelixa/zpl` (remote server + this npm package).
- [Smithery](https://smithery.ai/servers/labelixa/zpl): `labelixa/zpl`.
  Smithery routes calls through its own gateway; the canonical endpoint
  is `https://api.labelixa.com/mcp`.

[![smithery badge](https://smithery.ai/badge/labelixa/zpl)](https://smithery.ai/servers/labelixa/zpl)

## Honesty notes

- Errors carry the server's own message verbatim; quota exhaustion is
  reported with the server's `Retry-After` rather than a made-up delay.
- `zpl_preview` is a render, not a print: physical output depends on the
  printer, media and darkness settings.

Source of this package: [github.com/Labelixa/labelixa-mcp](https://github.com/Labelixa/labelixa-mcp).
Docs: [labelixa.com/docs/api](https://labelixa.com/docs/api). License: MIT.
