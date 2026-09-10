# labelixa-mcp

MCP (Model Context Protocol) server for the [Labelixa](https://labelixa.com)
API. Lets AI assistants that speak MCP (Claude Desktop, Claude Code and
other MCP clients) work with Zebra ZPL label code directly.

This npm package ships the **core tool subset** below. The hosted remote
MCP server carries the **full tool set** — everything here plus label
templates, bulk generation, image-to-ZPL conversion, barcode reading
from photos and EPL/TSPL/CPCL previews. See
[labelixa.com/mcp](https://labelixa.com/mcp) for the remote endpoint and
the live tool list.

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
| `zpl_command_help` | Looks up one ZPL command in the maintained catalog: name, syntax, parameters and whether the preview engine actually renders it — printer-side commands are marked as not rendered. |
| `convert_zpl_dpi` | Rescales ZPL coordinates between printer resolutions (203/300/600 dpi). Embedded `^GF`/`~DG` bitmaps are NOT rescaled — a warnings block precedes the output when present. |
| `explain_zpl` | Full sectioned health report (syntax, size/DPI, orientation, barcodes, fonts, memory) with an honest score — sections it cannot assess say "not assessed" instead of counting. |

## Installation

```sh
npm install -g labelixa-mcp
```

Or skip installing and run it with `npx` straight from your MCP client
config (below).

Also available as a remote server on
[Smithery](https://smithery.ai/servers/labelixa/zpl) (`labelixa/zpl`) —
no local install at all; the gateway connects to our hosted MCP
endpoint. Listed in the official
[MCP Registry](https://registry.modelcontextprotocol.io) as
`com.labelixa/zpl` (remote server + this npm package).

[![smithery badge](https://smithery.ai/badge/labelixa/zpl)](https://smithery.ai/servers/labelixa/zpl)

## Configuration

Environment variables:

- `LABELIXA_API_KEY` — optional `lbx_` API key. Without it the anonymous
  quota applies. Get a key at
  [labelixa.com](https://labelixa.com).
- `LABELIXA_BASE_URL` — optional; defaults to `https://api.labelixa.com`.

Example MCP client entry:

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

## Honesty notes

- Errors carry the server's own message verbatim; quota exhaustion is
  reported with the server's `Retry-After` rather than a made-up delay.
- `zpl_preview` is a render, not a print: physical output depends on the
  printer, media and darkness settings.

License: MIT.
