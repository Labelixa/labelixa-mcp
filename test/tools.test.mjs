// MCP tool layer tests — NO network (fake fetch).
//
// The server wiring (server.mjs) is not tested here; what is tested is
// that the API contract is called correctly and the response is turned
// into the MCP shape HONESTLY. Two traps in particular are locked:
//   1. /v1/barcodes returns 200 + error PNG + X-Warnings on invalid input —
//      passing that through as "image generated" would mislead the assistant.
//   2. The server returns SVG only when format=svg is requested EXPLICITLY
//      (the default is PNG) — without the parameter the tool would print
//      PNG bytes as "SVG text".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createContext, zplPreview, zplValidate, barcodeGenerate,
         languageDetect, eplValidate, tsplValidate, cpclValidate,
         checkCompatibility, convertDpi, explainZpl, commandHelp } from "../tools.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function fakeFetch(calls, response) {
  return async (url, options = {}) => {
    calls.push({ url, options });
    return {
      status: response.status ?? 200,
      headers: { get: (name) => (response.headers ?? {})[name] ?? null },
      arrayBuffer: async () => (response.bytes ?? PNG).buffer,
      text: async () => response.text ?? "",
    };
  };
}

test("zpl_preview returns the PNG as base64 image content", async () => {
  const calls = [];
  const ctx = createContext({ fetch: fakeFetch(calls, { bytes: PNG }) });
  const r = await zplPreview(ctx, { zpl: "^XA^XZ", width_in: 2, height_in: 1 });
  assert.equal(r.content[0].type, "image");
  assert.equal(r.content[0].mimeType, "image/png");
  assert.equal(Buffer.from(r.content[0].data, "base64")[0], 0x89);
  assert.match(calls[0].url, /\/v1\/printers\/8dpmm\/labels\/2x1\/0$/);
});

test("zpl_validate sends the size under the w/h NAMES", async () => {
  const calls = [];
  const ctx = createContext({ fetch: fakeFetch(calls, { text: "{\"diagnostics\":[]}" }) });
  await zplValidate(ctx, { zpl: "^XA^XZ", width_in: 2.25, height_in: 1 });
  // `width=`/`height=` are ignored silently by the server; names must be `w`/`h`.
  assert.match(calls[0].url, /\/v1\/diagnostics\?dpmm=8&w=2\.25&h=1$/);
});

test("X-API-Key is sent when a key is set and NOT sent otherwise", async () => {
  const calls = [];
  const withKey = createContext({ apiKey: "lbx_test",
                                  fetch: fakeFetch(calls, {}) });
  await zplValidate(withKey, { zpl: "^XA^XZ" });
  assert.equal(calls[0].options.headers["X-API-Key"], "lbx_test");

  const calls2 = [];
  const anonymous = createContext({ fetch: fakeFetch(calls2, {}) });
  await zplValidate(anonymous, { zpl: "^XA^XZ" });
  assert.equal(calls2[0].options.headers["X-API-Key"], undefined);
});

test("quota (429) error carries the server's Retry-After, never invents one", async () => {
  const ctx = createContext({ fetch: fakeFetch([], {
    status: 429, text: "daily quota exhausted",
    headers: { "Retry-After": "137" } }) });
  const r = await zplPreview(ctx, { zpl: "^XA^XZ" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /daily quota exhausted/);
  assert.match(r.content[0].text, /137 s/);
});

test("barcode requests SVG EXPLICITLY (the server default is PNG)", async () => {
  const calls = [];
  const ctx = createContext({ fetch: fakeFetch(calls, { text: "<svg/>" }) });
  const r = await barcodeGenerate(ctx, { type: "code128", data: "ABC" });
  assert.match(calls[0].url, /format=svg/);
  assert.equal(r.content[0].text, "<svg/>");
});

test("barcode error PNG (200 + X-Warnings) is NOT passed through as an image", async () => {
  const ctx = createContext({ fetch: fakeFetch([], {
    bytes: PNG, headers: { "X-Warnings": "invalid EAN-13" } }) });
  const r = await barcodeGenerate(ctx, { type: "ean13", data: "12", format: "png" });
  assert.equal(r.isError, true, "error PNG was treated as a successful image");
  assert.match(r.content[0].text, /invalid EAN-13/);
});

// ------------------------------------------------------------ 0.2.0 tools --

test("language_detect POSTs plain text to the right endpoint and returns JSON as text",
  async () => {
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls,
      { text: '{"dil":"tspl","guven":"high"}' }) });
    const r = await languageDetect(ctx, { code: "SIZE 4,6\nPRINT 1" });
    assert.match(calls[0].url, /\/v1\/language-detect$/);
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.body, "SIZE 4,6\nPRINT 1");
    // The API's wire names reach the assistant in English.
    assert.equal(r.content[0].text, '{"language":"tspl","confidence":"high"}');
  });

test("language validators hit their own endpoints (epl/tspl/cpcl)", async () => {
  for (const [fn, arg, path] of [
    [eplValidate, { epl: "N\nP1" }, /\/v1\/epl\/diagnostics$/],
    [tsplValidate, { tspl: "SIZE 4,6" }, /\/v1\/tspl\/diagnostics$/],
    [cpclValidate, { cpcl: "! 0 200 200 210 1" }, /\/v1\/cpcl\/diagnostics$/],
  ]) {
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls,
      { text: '{"diagnostics":[]}' }) });
    await fn(ctx, arg);
    assert.match(calls[0].url, path);
    assert.equal(calls[0].options.method, "POST");
  }
});

test("zpl_compatibility URL-encodes the model and sends ZPL in the body",
  async () => {
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls, { text: "{}" }) });
    await checkCompatibility(ctx, { zpl: "^XA^XZ", model: "zebra zd421" });
    assert.match(calls[0].url, /\/v1\/compatibility\?model=zebra%20zd421$/);
    assert.equal(calls[0].options.body, "^XA^XZ");
  });

test("unknown model 404 is returned as an ERROR with the server text (nothing invented)",
  async () => {
    const ctx = createContext({ fetch: fakeFetch([], {
      status: 404, text: '{"hata":"Model not in database"}' }) });
    const r = await checkCompatibility(ctx, { zpl: "^XA^XZ", model: "none" });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /Model not in database/);
    // Only the server's sentence: no raw JSON error body.
    assert.doesNotMatch(r.content[0].text, /[{}]/);
  });

// ------------------------------------------------------------ 0.3.0 tools --

test("convert_zpl_dpi hits the right endpoint; X-Warnings goes BEFORE the output",
  async () => {
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls, {
      text: "^XA^FO74,74^XZ",
      headers: { "X-Warnings": "^GF data not rescaled" } }) });
    const r = await convertDpi(ctx, { zpl: "^XA^FO50,50^XZ" });
    assert.match(calls[0].url, /\/v1\/dpi\/convert\?source=203&target=300$/);
    assert.equal(calls[0].options.body, "^XA^FO50,50^XZ");
    assert.match(r.content[0].text, /not rescaled/);
    assert.equal(r.content[1].text, "^XA^FO74,74^XZ");
  });

test("convert_zpl_dpi returns a SINGLE content block when there is no warning", async () => {
  const ctx = createContext({ fetch: fakeFetch([], { text: "^XA^XZ" }) });
  const r = await convertDpi(ctx, { zpl: "^XA^XZ", source: 300, target: 203 });
  assert.equal(r.content.length, 1);
  assert.equal(r.content[0].text, "^XA^XZ");
});

test("explain_zpl sends the size as w/h and encodes the model",
  async () => {
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls,
      { text: '{"puan":90}' }) });
    await explainZpl(ctx, { zpl: "^XA^XZ", width_in: 2.25, height_in: 1,
                            model: "zebra zd421" });
    assert.match(calls[0].url,
      /\/v1\/diagnostics\/full\?dpmm=8&w=2\.25&h=1&model=zebra%20zd421$/);
    // Without a model the parameter is not sent at all (the server accepts
    // an empty model, but the URL stays clean).
    const calls2 = [];
    const ctx2 = createContext({ fetch: fakeFetch(calls2, { text: "{}" }) });
    await explainZpl(ctx2, { zpl: "^XA^XZ" });
    assert.match(calls2[0].url, /\/v1\/diagnostics\/full\?dpmm=8&w=4&h=6$/);
  });

test("zpl_command_help filters the catalog; a non-rendered command such as ^PO " +
  "is returned HONESTLY with rendered_by_preview=false", async () => {
    // `komutlar`, `kod`, `ad`, `destekleniyor` are the API's response fields.
    const catalog = JSON.stringify({ komutlar: [
      { kod: "PO", ad: "Print Orientation", destekleniyor: false },
      { kod: "A", ad: "Font Selection", destekleniyor: true },
      { kod: "BC", ad: "Code 128", destekleniyor: true },
    ] });
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls, { text: catalog }) });
    const r = await commandHelp(ctx, { command: "^PO" });
    assert.match(calls[0].url, /\/v1\/commands$/);
    const entry = JSON.parse(r.content[0].text);
    // Same field names as the hosted server's zpl_command_help.
    assert.equal(entry.command, "PO");
    assert.equal(entry.name, "Print Orientation");
    assert.equal(entry.rendered_by_preview, false);
    assert.equal(entry.kod, undefined);
    // The ^A0 font family maps to the "A" entry; long spellings reduce to two letters (BCN -> BC).
    const a = JSON.parse((await commandHelp(ctx, { command: "^A0" }))
      .content[0].text);
    assert.equal(a.command, "A");
    const bc = JSON.parse((await commandHelp(ctx, { command: "BCN" }))
      .content[0].text);
    assert.equal(bc.command, "BC");
  });

test("zpl_command_help returns an error for an unknown command, never invents an entry",
  async () => {
    const ctx = createContext({ fetch: fakeFetch([],
      { text: '{"komutlar":[]}' }) });
    const r = await commandHelp(ctx, { command: "^QQ" });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /Unknown command/);
  });

// The `locale` parameter maps to the documented `?lang=` query parameter.
// It is measured on the URL, not on the response: the server decides the
// language, and a client that quietly dropped the parameter would return
// English while the assistant believed it had asked for German.
test("zpl_command_help passes locale through as ?lang=, and omits it when unset",
  async () => {
    const catalog = JSON.stringify({ komutlar: [
      { kod: "FO", ad: "Field Origin", destekleniyor: true },
    ] });
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls, { text: catalog }) });
    await commandHelp(ctx, { command: "FO" });
    assert.match(calls[0].url, /\/v1\/commands$/);
    await commandHelp(ctx, { command: "FO", locale: "de" });
    assert.match(calls[1].url, /\/v1\/commands\?lang=de$/);
  });

// Numbers reach the request path and query string. JSON has no Infinity or
// NaN literal, but `1e999` parses to Infinity and a client may send any
// number; nothing non-finite or out of range may leave the process.
test("non-finite and out-of-range numbers are rejected before any request",
  async () => {
    const calls = [];
    const ctx = createContext({ fetch: fakeFetch(calls, { text: "{}" }) });
    const cases = [
      [zplPreview, { zpl: "^XA^XZ", width_in: Infinity }],
      [zplPreview, { zpl: "^XA^XZ", height_in: NaN }],
      [zplPreview, { zpl: "^XA^XZ", width_in: -1 }],
      [zplPreview, { zpl: "^XA^XZ", width_in: 16 }],
      [zplPreview, { zpl: "^XA^XZ", dpmm: 7 }],
      [zplPreview, { zpl: "^XA^XZ", dpmm: Infinity }],
      [zplPreview, { zpl: "^XA^XZ", index: 1.5 }],
      [zplPreview, { zpl: "^XA^XZ", index: -1 }],
      [zplPreview, { zpl: "^XA^XZ", index: Infinity }],
      [zplValidate, { zpl: "^XA^XZ", height_in: Infinity }],
      [zplValidate, { zpl: "^XA^XZ", width_in: "4" }],
      [explainZpl, { zpl: "^XA^XZ", width_in: NaN }],
      [convertDpi, { zpl: "^XA^XZ", source: Infinity }],
      [convertDpi, { zpl: "^XA^XZ", target: 301 }],
      [convertDpi, { zpl: "^XA^XZ", target: NaN }],
    ];
    for (const [tool, args] of cases) {
      const r = await tool(ctx, args);
      assert.equal(r.isError, true, `${tool.name} accepted ${JSON.stringify(args)}`);
      assert.match(r.content[0].text, /^Invalid /);
    }
    assert.equal(calls.length, 0, "a request went out with an invalid number");
    // Valid edges still pass.
    await zplPreview(ctx, { zpl: "^XA^XZ", dpmm: 24, width_in: 15, height_in: 0.5 });
    await convertDpi(ctx, { zpl: "^XA^XZ", source: 152, target: 600 });
    assert.equal(calls.length, 2);
  });

// fetch drops only `Authorization` on a cross-host redirect; X-API-Key
// would be carried along, so no request may follow a redirect.
test("requests never follow redirects", async () => {
  const calls = [];
  const ctx = createContext({ apiKey: "lbx_test", fetch: fakeFetch(calls, { status: 307 }) });
  const r = await zplValidate(ctx, { zpl: "^XA^XZ" });
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /HTTP 307/);
  await commandHelp(ctx, { command: "FO" });
  await barcodeGenerate(ctx, { type: "code128", data: "1" });
  await languageDetect(ctx, { code: "^XA^XZ" });
  for (const c of calls) assert.equal(c.options.redirect, "manual", c.url);
});

// ------------------------------------------------- English output (0.5.0) --
// The API's Turkish wire names and code words are renamed before the
// result reaches the assistant (contract.js); the HTTP API keeps them.

test("compatibility result: English field names and code values", async () => {
  const wire = {
    model: { uretici: "Zebra", model: "ZD421", kategori: "masaustu", dpi: [203] },
    dil_postur: { tur: "emulasyon", evidence: "VENDOR_EMULATION_DOCUMENTATION",
                  kaynak_url: "https://example.com/a.pdf", dogrulama: "2026-09-01",
                  not: "TSPL-EZ automatic emulation" },
    risk: { seviye: "orta", gerekceler: ["emulasyon", "boyut_bulgusu"] },
    boyut_kurali_var: true,
    boyut_bulgulari: [],
    onizleme_kapsami: { destekli: ["FO"], kismi: [], desteksiz: [],
                        yok_sayilan: [], bilinmiyor: [] },
    sinir: "risk_analizi",
  };
  const ctx = createContext({ fetch: fakeFetch([], { text: JSON.stringify(wire) }) });
  const out = JSON.parse((await checkCompatibility(ctx, { zpl: "^XA^XZ", model: "x" }))
    .content[0].text);
  assert.deepEqual(out.risk, { level: "medium", reasons: ["emulation", "size_finding"] });
  assert.equal(out.model.category, "desktop");
  assert.equal(out.model.manufacturer, "Zebra");
  assert.equal(out.language_support.type, "emulation");
  assert.equal(out.language_support.note, "TSPL-EZ automatic emulation");
  assert.equal(out.limitation, "risk_analysis");
  assert.deepEqual(out.preview_coverage.supported, ["FO"]);
  assert.equal(out.has_size_rule, true);
});

test("explain report: English section names, statuses and keys", async () => {
  const wire = {
    puan: 100,
    puan_formulu: "100 - 15*error - 5*warning - 5*bolum_uyarisi "
      + "(taban 0; yalniz degerlendirilen bolumler)",
    degerlendirilen: ["sozdizimi"],
    degerlendirilmeyen: ["barkod", "model_uyum"],
    bolumler: {
      sozdizimi: { durum: "temiz", bulgular: [], uyarilar: [],
                   ozet: { komut_adedi: 4, etiket_adedi: 1 } },
      barkod: { durum: "degerlendirilmedi", bulgular: [], uyarilar: [],
                sebep: "No barcode", ozet: { adet: 0, komutlar: [] } },
      boyut_dpi: { durum: "bulgulu", bulgular: [], uyarilar: ["w"],
                   ozet: { boyut_kaynagi: "alanlardan", en_dots: 812 } },
    },
    notlar: [],
  };
  const ctx = createContext({ fetch: fakeFetch([], { text: JSON.stringify(wire) }) });
  const r = await explainZpl(ctx, { zpl: "^XA^XZ" });
  const out = JSON.parse(r.content[0].text);
  assert.equal(out.score, 100);
  assert.deepEqual(out.assessed, ["syntax"]);
  assert.deepEqual(out.not_assessed, ["barcode", "model_compatibility"]);
  assert.equal(out.sections.syntax.status, "clean");
  assert.equal(out.sections.barcode.status, "not_evaluated");
  assert.equal(out.sections.size_dpi.status, "findings");
  assert.equal(out.sections.size_dpi.summary.size_source, "from_fields");
  assert.equal(out.sections.size_dpi.summary.width_dots, 812);
  assert.equal(out.sections.syntax.summary.command_count, 4);
  assert.doesNotMatch(out.score_formula, /taban|bolum/);
  for (const wireName of ["puan", "bolumler", "durum", "ozet", "temiz", "sozdizimi"]) {
    assert.doesNotMatch(r.content[0].text, new RegExp(`"${wireName}"`), wireName);
  }
});

test("validate result: English summary and message; unknown keys and free text untouched",
  async () => {
    const wire = { diagnostics: [{ code: "ZPL0002", severity: "error", line: 1, col: 1,
                                   mesaj: "Missing ^XZ", args: { komut: "XZ" },
                                   kendi_alani: "x" }],
                   ozet: { toplam: 1, error: 1, warning: 0, info: 0 } };
    const ctx = createContext({ fetch: fakeFetch([], { text: JSON.stringify(wire) }) });
    const out = JSON.parse((await zplValidate(ctx, { zpl: "^XA" })).content[0].text);
    assert.deepEqual(out.summary, { total: 1, error: 1, warning: 0, info: 0 });
    assert.equal(out.diagnostics[0].message, "Missing ^XZ");
    assert.equal(out.diagnostics[0].code, "ZPL0002");
    assert.deepEqual(out.diagnostics[0].args, { command: "XZ" });
    assert.equal(out.diagnostics[0].kendi_alani, "x");
  });

test("a body that is not JSON passes through unchanged", async () => {
  const ctx = createContext({ fetch: fakeFetch([], { text: "not json" }) });
  const r = await languageDetect(ctx, { code: "x" });
  assert.equal(r.content[0].text, "not json");
});

test("error with extra fields: sentence first, extra fields in English", async () => {
  const ctx = createContext({ fetch: fakeFetch([], {
    status: 400, text: JSON.stringify({ hata: "Unknown printer model", modeller: ["zd421"] }) }) });
  const r = await explainZpl(ctx, { zpl: "^XA^XZ", model: "nope" });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /Unknown printer model \{"models":\["zd421"\]\}/);
});
