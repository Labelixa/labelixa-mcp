/**
 * Labelixa MCP tools — the pure layer.
 *
 * The design shares the Node SDK's principles:
 * - THIN wrapper: every tool maps 1:1 to a documented REST endpoint
 *   (https://labelixa.com/docs/api); no client-side magic, no silent
 *   retries that would hide quota signals.
 * - Errors carry the server's OWN text; 402/429 are flagged separately so
 *   the assistant reads the retry delay from the server instead of
 *   inventing one.
 * - This file does NOT import the MCP SDK: every tool is tested without a
 *   network using a fake fetch (node --test); the server wiring lives in
 *   server.mjs.
 *
 * Honesty boundary: `zpl_preview` is a SERVER-SIDE render — it is not a
 * guarantee of how a physical printer will output the label, and the tool
 * description says so.
 */

import { createRequire } from "node:module";

const DEFAULT_BASE_URL = "https://api.labelixa.com";
// The package version is read from package.json so the User-Agent, the
// MCP serverInfo and the npm metadata always carry the same number.
export const VERSION = createRequire(import.meta.url)("./package.json").version;

/** g-format: 4.0 -> "4", 2.25 -> "2.25" (same as the SDK). */
const g = (n) => String(Number(n));

function headers(apiKey) {
  const h = { "User-Agent": `labelixa-mcp/${VERSION}` };
  if (apiKey) h["X-API-Key"] = apiKey;
  return h;
}

/** Turns an error body into MCP text; quota errors are separate and actionable. */
async function errorMessage(response) {
  const body = (await response.text()).slice(0, 500);
  if (response.status === 402 || response.status === 429) {
    const seconds = response.headers.get("Retry-After") ?? "60";
    return `Quota/rate limit (HTTP ${response.status}): ${body} — retry ` +
      `after ${seconds} s. The anonymous quota is small; set the ` +
      `LABELIXA_API_KEY environment variable to use your own key.`;
  }
  return `Labelixa API error (HTTP ${response.status}): ${body}`;
}

/** MCP result for an error: isError + text content. */
const errorResult = (text) => ({ isError: true,
  content: [{ type: "text", text }] });

export function createContext({ apiKey, baseUrl = DEFAULT_BASE_URL,
                                fetch: fetchImpl } = {}) {
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    fetch: fetchImpl ?? globalThis.fetch,
    headers: headers(apiKey),
  };
}

/** Renders ZPL to PNG; returns MCP image content. */
export async function zplPreview(ctx, { zpl, dpmm = 8, width_in = 4,
                                        height_in = 6, index = 0 }) {
  const path = `/v1/printers/${dpmm}dpmm/labels/` +
    `${g(width_in)}x${g(height_in)}/${index}`;
  const res = await ctx.fetch(ctx.baseUrl + path, {
    method: "POST",
    headers: { ...ctx.headers, "Content-Type": "text/plain" },
    body: zpl,
  });
  if (res.status !== 200) return errorResult(await errorMessage(res));
  const raw = new Uint8Array(await res.arrayBuffer());
  return { content: [{ type: "image", mimeType: "image/png",
                       data: Buffer.from(raw).toString("base64") }] };
}

/** ZPL diagnostics; returns the structured report as JSON text. */
export async function zplValidate(ctx, { zpl, dpmm = 8, width_in = 4,
                                         height_in = 6 }) {
  // The endpoint reads the label size from the `w`/`h` query parameters;
  // unknown parameters are ignored silently by the server, so any other
  // spelling would run every check against the 4x6 default.
  const q = `?dpmm=${dpmm}&w=${g(width_in)}&h=${g(height_in)}`;
  const res = await ctx.fetch(ctx.baseUrl + "/v1/diagnostics" + q, {
    method: "POST",
    headers: { ...ctx.headers, "Content-Type": "text/plain" },
    body: zpl,
  });
  if (res.status !== 200) return errorResult(await errorMessage(res));
  return { content: [{ type: "text", text: await res.text() }] };
}

/** Shared path for endpoints that take a plain-text body and return JSON.
 * Several tools share this contract (stateless, JSON response, errors with
 * the server's text); one helper instead of one copy per tool. */
async function postTextGetJson(ctx, path, body) {
  const res = await ctx.fetch(ctx.baseUrl + path, {
    method: "POST",
    headers: { ...ctx.headers, "Content-Type": "text/plain" },
    body,
  });
  if (res.status !== 200) return errorResult(await errorMessage(res));
  return { content: [{ type: "text", text: await res.text() }] };
}

/** Detects the printer language (ZPL/EPL/TSPL/CPCL) — heuristic. The
 * response carries the language plus a confidence TIER (not a percentage;
 * the server computes no real probability and neither do we pretend to). */
export const languageDetect = (ctx, { code }) =>
  postTextGetJson(ctx, "/v1/language-detect", code);

/** EPL/EPL2 diagnostics; positioned findings (JSON). */
export const eplValidate = (ctx, { epl }) =>
  postTextGetJson(ctx, "/v1/epl/diagnostics", epl);

/** TSPL/TSPL2 diagnostics; positioned findings (JSON). */
export const tsplValidate = (ctx, { tspl }) =>
  postTextGetJson(ctx, "/v1/tspl/diagnostics", tspl);

/** CPCL diagnostics; positioned findings (JSON). */
export const cpclValidate = (ctx, { cpcl }) =>
  postTextGetJson(ctx, "/v1/cpcl/diagnostics", cpcl);

/** Compatibility RISK analysis of ZPL against a specific printer MODEL.
 * Not an emulator and never says "it works" — the server's own honesty
 * contract is passed through; an unknown model returns the server's 404
 * and the error text is carried verbatim. */
export const checkCompatibility = (ctx, { zpl, model }) =>
  postTextGetJson(ctx, "/v1/compatibility?model=" +
    encodeURIComponent(model), zpl);

// ------------------------------------------------------------ 0.3.0 tools --

/** Rescales ZPL between resolutions (203/300/600 dpi).
 * Embedded ^GF/~DG bitmap data is NOT rescaled — the server says so via
 * X-Warnings and the warning is placed BEFORE the output as a separate
 * text block instead of being dropped silently. */
export async function convertDpi(ctx, { zpl, source = 203, target = 300 }) {
  const res = await ctx.fetch(
    ctx.baseUrl + `/v1/dpi/convert?source=${source}&target=${target}`, {
      method: "POST",
      headers: { ...ctx.headers, "Content-Type": "text/plain" },
      body: zpl,
    });
  if (res.status !== 200) return errorResult(await errorMessage(res));
  const output = await res.text();
  const warning = res.headers.get("X-Warnings");
  const content = [];
  if (warning) content.push({ type: "text", text: `Warnings: ${warning}` });
  content.push({ type: "text", text: output });
  return { content };
}

/** Full health report (Diagnostics Hub): sectioned JSON — the score counts
 * only assessable sections, the rest say "not assessed"; the server's
 * honesty contract is passed through. */
export const explainZpl = (ctx, { zpl, dpmm = 8, width_in = 4,
                                  height_in = 6, model = "" }) => {
  const q = `?dpmm=${dpmm}&w=${g(width_in)}&h=${g(height_in)}` +
    (model ? `&model=${encodeURIComponent(model)}` : "");
  return postTextGetJson(ctx, "/v1/diagnostics/full" + q, zpl);
};

/** Catalog entry of a single ZPL command (name, format, parameters and a
 * flag telling whether the preview engine renders it). The API has no
 * single-command endpoint; the documented /v1/commands list is fetched and
 * filtered client-side — presentation, not magic.
 *
 * `locale` maps to the documented `?lang=` query parameter and defaults to
 * the server default (English). It reaches the human-readable fields only:
 * the command code, syntax string, example and parameter NAMES are
 * protocol, and translating them would produce ZPL that does not run. An
 * unsupported value is rejected by the server with 400 rather than falling
 * back silently — a caller asking for a language it does not get should
 * hear about it. */
export async function commandHelp(ctx, { command, locale }) {
  const q = locale ? "?lang=" + encodeURIComponent(locale) : "";
  const res = await ctx.fetch(ctx.baseUrl + "/v1/commands" + q,
                              { method: "GET", headers: ctx.headers });
  if (res.status !== 200) return errorResult(await errorMessage(res));
  // `komutlar` / `kod` are the field names of the API response
  // (https://labelixa.com/docs/api).
  const { komutlar: catalog } = JSON.parse(await res.text());
  const code = String(command).trim().replace(/^[\^~]+/, "").toUpperCase();
  // The ^A0/^AD font family is catalogued as "A"; other long spellings are
  // reduced to two letters (same order as the server's normalisation).
  const entry = catalog.find((k) => k.kod === code)
    ?? ((code.startsWith("A") && code !== "A@")
        ? catalog.find((k) => k.kod === "A") : undefined)
    ?? (code.length > 2
        ? catalog.find((k) => k.kod === code.slice(0, 2)) : undefined);
  if (!entry) {
    return errorResult(`Unknown command: ${command} — not in the catalog ` +
      `(possible typo; use zpl_validate to check the code).`);
  }
  return { content: [{ type: "text", text: JSON.stringify(entry, null, 1) }] };
}

/** Generates a barcode; svg -> text, png -> image content.

Server contract (https://labelixa.com/docs/api, /v1/barcodes): the default
format is PNG — SVG must be requested EXPLICITLY with `format=svg`. Invalid
input is NOT a 4xx: the server returns 200 with an error image and an
`X-Warnings` header; passing that image through without reading the header
would make the assistant claim "barcode generated". */
export async function barcodeGenerate(ctx, { type, data, format = "svg" }) {
  const q = new URLSearchParams({ type, data, format });
  const res = await ctx.fetch(ctx.baseUrl + "/v1/barcodes?" + q.toString(), {
    method: "GET", headers: ctx.headers,
  });
  if (res.status !== 200) return errorResult(await errorMessage(res));
  const warning = res.headers.get("X-Warnings");
  if (warning) return errorResult(`Barcode not generated: ${warning}`);
  if (format === "png") {
    const raw = new Uint8Array(await res.arrayBuffer());
    return { content: [{ type: "image", mimeType: "image/png",
                         data: Buffer.from(raw).toString("base64") }] };
  }
  return { content: [{ type: "text", text: await res.text() }] };
}
