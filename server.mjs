#!/usr/bin/env node
/**
 * Labelixa MCP sunucusu — stdio (LBL-ECO-014).
 *
 * Kablolama BURADA, iş mantığı `araclar.mjs`te: araçlar MCP SDK'sız,
 * sahte fetch ile test edilir; bu dosya yalnız şema + kayıt + taşımadır.
 *
 * Yapılandırma: `LABELIXA_API_KEY` (isteğe bağlı — anonim kota çalışır),
 * `LABELIXA_BASE_URL` (varsayılan https://api.labelixa.com).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SURUM, yeniBaglam, zplOnizle, zplDogrula, barkodUret, dilTespit,
         eplDogrula, tsplDogrula, cpclDogrula, uyumlulukDenetle,
         dpiDonustur, zplAcikla, komutYardimi } from "./araclar.mjs";

const baglam = yeniBaglam({
  apiKey: process.env.LABELIXA_API_KEY,
  baseUrl: process.env.LABELIXA_BASE_URL || undefined,
});

// Sürüm TEK kaynaktan (package.json → araclar.SURUM): 0.3.1'de üç dosya
// üç ayrı sayı taşıyordu (GEO denetimi 2026-09-06). Elle yazılan sürüm
// bir daha yazılmaz.
const server = new McpServer({ name: "labelixa", version: SURUM });

// Ortak ölçü şeması — SDK'daki adlarla birebir (width_in/height_in inç).
const olcu = {
  dpmm: z.number().int().min(6).max(24).default(8)
    .describe("Printer density in dots per mm (6, 8, 12 or 24)"),
  width_in: z.number().positive().default(4)
    .describe("Label width in inches"),
  height_in: z.number().positive().default(6)
    .describe("Label height in inches"),
};

server.tool(
  "zpl_preview",
  "Render ZPL label code to a PNG image via the Labelixa API. This is a " +
    "SERVER-SIDE render for inspection — it is not a guarantee of how a " +
    "specific physical printer will output the label.",
  {
    zpl: z.string().min(1).describe("Raw ZPL code (^XA ... ^XZ)"),
    ...olcu,
    index: z.number().int().min(0).default(0)
      .describe("Which label to render when the stream contains several"),
  },
  (args) => zplOnizle(baglam, args),
);

server.tool(
  "zpl_validate",
  "Lint/validate ZPL and return the structured diagnostics report " +
    "(unknown commands, parameter range errors, layout overflow, etc.) " +
    "as JSON. Pass the real label size — checks depend on it.",
  { zpl: z.string().min(1).describe("Raw ZPL code"), ...olcu },
  (args) => zplDogrula(baglam, args),
);

server.tool(
  "barcode_generate",
  "Generate a standalone barcode (SVG text or PNG image). Supported " +
    "types include code128, code39, ean13, upca, upce, itf14, msi, " +
    "qrcode, datamatrix, pdf417.",
  {
    type: z.string().min(1).describe("Barcode type, e.g. code128"),
    data: z.string().min(1).describe("Data to encode"),
    format: z.enum(["svg", "png"]).default("svg"),
  },
  (args) => barkodUret(baglam, args),
);

server.tool(
  "language_detect",
  "Detect which printer language raw label code is written in (ZPL, EPL, " +
    "TSPL or CPCL). Heuristic: returns the language plus a confidence " +
    "TIER (high/medium/low) and signal codes — not a probability.",
  { code: z.string().min(1).describe("Raw label code to classify") },
  (args) => dilTespit(baglam, args),
);

server.tool(
  "epl_validate",
  "Lint/validate EPL/EPL2 label code and return the structured " +
    "diagnostics report (findings with positions and severity) as JSON.",
  { epl: z.string().min(1).describe("Raw EPL/EPL2 code") },
  (args) => eplDogrula(baglam, args),
);

server.tool(
  "tspl_validate",
  "Lint/validate TSPL/TSPL2 label code and return the structured " +
    "diagnostics report (findings with positions and severity) as JSON.",
  { tspl: z.string().min(1).describe("Raw TSPL/TSPL2 code") },
  (args) => tsplDogrula(baglam, args),
);

server.tool(
  "cpcl_validate",
  "Lint/validate CPCL label code and return the structured diagnostics " +
    "report (findings with positions and severity) as JSON.",
  { cpcl: z.string().min(1).describe("Raw CPCL code") },
  (args) => cpclDogrula(baglam, args),
);

server.tool(
  "zpl_compatibility",
  "Compatibility RISK analysis of ZPL code against a specific printer " +
    "model, given as manufacturer/model (e.g. 'zebra/zd421'). NOT an " +
    "emulator and never says 'it " +
    "works': reports the model's language posture with evidence level, " +
    "size-rule findings and the scope of our preview.",
  {
    zpl: z.string().min(1).describe("Raw ZPL code"),
    model: z.string().min(1)
      .describe("Printer model as manufacturer/model, e.g. zebra/zd421"),
  },
  (args) => uyumlulukDenetle(baglam, args),
);

server.tool(
  "zpl_command_help",
  "Look up one ZPL command in the maintained catalog: name, syntax, " +
    "parameters (types, ranges, defaults) and whether the preview engine " +
    "actually renders it — printer-side commands are honestly marked as " +
    "not rendered.",
  { command: z.string().min(1)
      .describe("Command code with or without prefix, e.g. ^PO, BC, ~DG") },
  (args) => komutYardimi(baglam, args),
);

server.tool(
  "convert_zpl_dpi",
  "Rescale ZPL coordinates between printer resolutions (203/300/600 dpi). " +
    "Embedded ^GF/~DG bitmap data is NOT rescaled — when present, a " +
    "Warnings block precedes the output instead of silently passing.",
  {
    zpl: z.string().min(1).describe("Raw ZPL code to convert"),
    source: z.number().int().default(203)
      .describe("Source resolution in dpi (152, 203, 300 or 600)"),
    target: z.number().int().default(300)
      .describe("Target resolution in dpi (152, 203, 300 or 600)"),
  },
  (args) => dpiDonustur(baglam, args),
);

server.tool(
  "explain_zpl",
  "Full sectioned health report for a ZPL label (syntax, size/DPI, " +
    "orientation, barcodes, fonts, memory) with an honest score: only " +
    "assessable sections count, the rest say 'not assessed'. Pass the " +
    "real label size — findings depend on it.",
  {
    zpl: z.string().min(1).describe("Raw ZPL code"),
    ...olcu,
    model: z.string().default("")
      .describe("Optional printer model as manufacturer/model " +
                "(e.g. zebra/zd421) to add " +
                "a model-compatibility section"),
  },
  (args) => zplAcikla(baglam, args),
);

const transport = new StdioServerTransport();
await server.connect(transport);
