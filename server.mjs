#!/usr/bin/env node
/**
 * Labelixa MCP server — stdio.
 *
 * The wiring lives HERE, the tool logic in `tools.mjs`: the tools are
 * tested without the MCP SDK using a fake fetch; this file only holds
 * schemas, registration and transport.
 *
 * Configuration: `LABELIXA_API_KEY` (optional — the anonymous quota works),
 * `LABELIXA_BASE_URL` (default https://api.labelixa.com).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VERSION, createContext, zplPreview, zplValidate, barcodeGenerate,
         languageDetect, eplValidate, tsplValidate, cpclValidate,
         checkCompatibility, convertDpi, explainZpl, commandHelp } from "./tools.mjs";

const context = createContext({
  apiKey: process.env.LABELIXA_API_KEY,
  baseUrl: process.env.LABELIXA_BASE_URL || undefined,
});

// The version comes from a single source (package.json -> tools.VERSION);
// it is never written by hand here.
const server = new McpServer({ name: "labelixa", version: VERSION });

// Shared size schema — same names as the SDK (width_in/height_in in inches).
const sizeSchema = {
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
    ...sizeSchema,
    index: z.number().int().min(0).default(0)
      .describe("Which label to render when the stream contains several"),
  },
  (args) => zplPreview(context, args),
);

server.tool(
  "zpl_validate",
  "Lint/validate ZPL and return the structured diagnostics report " +
    "(unknown commands, parameter range errors, layout overflow, etc.) " +
    "as JSON. Pass the real label size — checks depend on it.",
  { zpl: z.string().min(1).describe("Raw ZPL code"), ...sizeSchema },
  (args) => zplValidate(context, args),
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
  (args) => barcodeGenerate(context, args),
);

server.tool(
  "language_detect",
  "Detect which printer language raw label code is written in (ZPL, EPL, " +
    "TSPL or CPCL). Heuristic: returns the language plus a confidence " +
    "TIER (high/medium/low) and signal codes — not a probability.",
  { code: z.string().min(1).describe("Raw label code to classify") },
  (args) => languageDetect(context, args),
);

server.tool(
  "epl_validate",
  "Lint/validate EPL/EPL2 label code and return the structured " +
    "diagnostics report (findings with positions and severity) as JSON.",
  { epl: z.string().min(1).describe("Raw EPL/EPL2 code") },
  (args) => eplValidate(context, args),
);

server.tool(
  "tspl_validate",
  "Lint/validate TSPL/TSPL2 label code and return the structured " +
    "diagnostics report (findings with positions and severity) as JSON.",
  { tspl: z.string().min(1).describe("Raw TSPL/TSPL2 code") },
  (args) => tsplValidate(context, args),
);

server.tool(
  "cpcl_validate",
  "Lint/validate CPCL label code and return the structured diagnostics " +
    "report (findings with positions and severity) as JSON.",
  { cpcl: z.string().min(1).describe("Raw CPCL code") },
  (args) => cpclValidate(context, args),
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
  (args) => checkCompatibility(context, args),
);

server.tool(
  "zpl_command_help",
  "Look up one ZPL command in the maintained catalog: name, syntax, " +
    "parameters (types, ranges, defaults) and whether the preview engine " +
    "actually renders it — printer-side commands are honestly marked as " +
    "not rendered.",
  {
    command: z.string().min(1)
      .describe("Command code with or without prefix, e.g. ^PO, BC, ~DG"),
    locale: z.enum(["en", "tr", "de"]).optional()
      .describe("Language for the name and descriptions (default English). " +
        "Command codes, syntax strings, examples and parameter names are " +
        "protocol and never change."),
  },
  (args) => commandHelp(context, args),
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
  (args) => convertDpi(context, args),
);

server.tool(
  "explain_zpl",
  "Full sectioned health report for a ZPL label (syntax, size/DPI, " +
    "orientation, barcodes, fonts, memory) with an honest score: only " +
    "assessable sections count, the rest say 'not assessed'. Pass the " +
    "real label size — findings depend on it.",
  {
    zpl: z.string().min(1).describe("Raw ZPL code"),
    ...sizeSchema,
    model: z.string().default("")
      .describe("Optional printer model as manufacturer/model " +
                "(e.g. zebra/zd421) to add " +
                "a model-compatibility section"),
  },
  (args) => explainZpl(context, args),
);

const transport = new StdioServerTransport();
await server.connect(transport);
