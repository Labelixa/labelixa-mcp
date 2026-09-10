// MCP araç katmanı testleri — AĞSIZ (sahte fetch ile).
//
// Sunucu kablolaması (server.mjs) burada sınanmaz; sınanan şey API
// sözleşmesinin doğru çağrıldığı ve yanıtın MCP biçimine DÜRÜSTÇE
// çevrildiği. Özellikle iki tuzak kilitleniyor:
//   1. /v1/barcodes geçersiz girdide 200 + hata-PNG + X-Warnings döner —
//      bunu "görüntü ürettim" diye geçirmek asistana yalan söyletir.
//   2. Sunucu SVG'yi ancak format=svg AÇIKÇA istenince verir (varsayılan
//      PNG) — parametre gitmezse araç PNG baytlarını "SVG metni" diye
//      basardı.
import { test } from "node:test";
import assert from "node:assert/strict";
import { yeniBaglam, zplOnizle, zplDogrula, barkodUret, dilTespit,
         eplDogrula, tsplDogrula, cpclDogrula, uyumlulukDenetle,
         dpiDonustur, zplAcikla, komutYardimi } from "../araclar.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function sahteFetch(kayit, yanit) {
  return async (url, secenekler = {}) => {
    kayit.push({ url, secenekler });
    return {
      status: yanit.status ?? 200,
      headers: { get: (ad) => (yanit.basliklar ?? {})[ad] ?? null },
      arrayBuffer: async () => (yanit.baytlar ?? PNG).buffer,
      text: async () => yanit.metin ?? "",
    };
  };
}

test("zpl_preview PNG'yi base64 görüntü içeriği olarak döner", async () => {
  const kayit = [];
  const b = yeniBaglam({ fetch: sahteFetch(kayit, { baytlar: PNG }) });
  const s = await zplOnizle(b, { zpl: "^XA^XZ", width_in: 2, height_in: 1 });
  assert.equal(s.content[0].type, "image");
  assert.equal(s.content[0].mimeType, "image/png");
  assert.equal(Buffer.from(s.content[0].data, "base64")[0], 0x89);
  assert.match(kayit[0].url, /\/v1\/printers\/8dpmm\/labels\/2x1\/0$/);
});

test("zpl_validate olcuyu w/h ADLARIYLA gonderir (ECO-013 dersi)", async () => {
  const kayit = [];
  const b = yeniBaglam({ fetch: sahteFetch(kayit, { metin: "{\"diagnostics\":[]}" }) });
  await zplDogrula(b, { zpl: "^XA^XZ", width_in: 2.25, height_in: 1 });
  // `width=`/`height=` FastAPI'de SESSİZCE yok sayılır; ad `w`/`h` olmalı.
  assert.match(kayit[0].url, /\/v1\/diagnostics\?dpmm=8&w=2\.25&h=1$/);
});

test("api anahtari varsa X-API-Key gider, yoksa GITMEZ", async () => {
  const kayit = [];
  const anahtarli = yeniBaglam({ apiKey: "lbx_test",
                                 fetch: sahteFetch(kayit, {}) });
  await zplDogrula(anahtarli, { zpl: "^XA^XZ" });
  assert.equal(kayit[0].secenekler.headers["X-API-Key"], "lbx_test");

  const kayit2 = [];
  const anonim = yeniBaglam({ fetch: sahteFetch(kayit2, {}) });
  await zplDogrula(anonim, { zpl: "^XA^XZ" });
  assert.equal(kayit2[0].secenekler.headers["X-API-Key"], undefined);
});

test("kota (429) hatasi sunucunun Retry-After'ini tasir, uydurmaz", async () => {
  const b = yeniBaglam({ fetch: sahteFetch([], {
    status: 429, metin: "gunluk kota doldu",
    basliklar: { "Retry-After": "137" } }) });
  const s = await zplOnizle(b, { zpl: "^XA^XZ" });
  assert.equal(s.isError, true);
  assert.match(s.content[0].text, /gunluk kota doldu/);
  assert.match(s.content[0].text, /137 sn/);
});

test("barkod SVG'yi ACIKCA ister (sunucu varsayilani PNG'dir)", async () => {
  const kayit = [];
  const b = yeniBaglam({ fetch: sahteFetch(kayit, { metin: "<svg/>" }) });
  const s = await barkodUret(b, { type: "code128", data: "ABC" });
  assert.match(kayit[0].url, /format=svg/);
  assert.equal(s.content[0].text, "<svg/>");
});

test("barkod hata-PNG'sini (200 + X-Warnings) GORUNTU DIYE GECIRMEZ", async () => {
  const b = yeniBaglam({ fetch: sahteFetch([], {
    baytlar: PNG, basliklar: { "X-Warnings": "gecersiz EAN-13" } }) });
  const s = await barkodUret(b, { type: "ean13", data: "12", format: "png" });
  assert.equal(s.isError, true, "hata-PNG'si basarili goruntu sayilmis");
  assert.match(s.content[0].text, /gecersiz EAN-13/);
});

// ------------------------------------------------------ 0.2.0 araçları -----

test("language_detect dogru uca duz metin POST'lar, JSON'i metin doner",
  async () => {
    const kayit = [];
    const b = yeniBaglam({ fetch: sahteFetch(kayit,
      { metin: '{"dil":"tspl","guven":"high"}' }) });
    const s = await dilTespit(b, { code: "SIZE 4,6\nPRINT 1" });
    assert.match(kayit[0].url, /\/v1\/language-detect$/);
    assert.equal(kayit[0].secenekler.method, "POST");
    assert.equal(kayit[0].secenekler.body, "SIZE 4,6\nPRINT 1");
    assert.equal(s.content[0].text, '{"dil":"tspl","guven":"high"}');
  });

test("dil dogrulayicilari kendi uclarina gider (epl/tspl/cpcl)", async () => {
  for (const [fn, arg, yol] of [
    [eplDogrula, { epl: "N\nP1" }, /\/v1\/epl\/diagnostics$/],
    [tsplDogrula, { tspl: "SIZE 4,6" }, /\/v1\/tspl\/diagnostics$/],
    [cpclDogrula, { cpcl: "! 0 200 200 210 1" }, /\/v1\/cpcl\/diagnostics$/],
  ]) {
    const kayit = [];
    const b = yeniBaglam({ fetch: sahteFetch(kayit,
      { metin: '{"diagnostics":[]}' }) });
    await fn(b, arg);
    assert.match(kayit[0].url, yol);
    assert.equal(kayit[0].secenekler.method, "POST");
  }
});

test("zpl_compatibility model'i URL-encode eder ve govdede ZPL tasir",
  async () => {
    const kayit = [];
    const b = yeniBaglam({ fetch: sahteFetch(kayit, { metin: "{}" }) });
    await uyumlulukDenetle(b, { zpl: "^XA^XZ", model: "zebra zd421" });
    assert.match(kayit[0].url, /\/v1\/compatibility\?model=zebra%20zd421$/);
    assert.equal(kayit[0].secenekler.body, "^XA^XZ");
  });

test("bilinmeyen model 404'u sunucu metniyle HATA doner (uydurma yok)",
  async () => {
    const b = yeniBaglam({ fetch: sahteFetch([], {
      status: 404, metin: '{"hata":"Model veritabaninda yok"}' }) });
    const s = await uyumlulukDenetle(b, { zpl: "^XA^XZ", model: "yok" });
    assert.equal(s.isError, true);
    assert.match(s.content[0].text, /Model veritabaninda yok/);
  });

// ------------------------------------------------------ 0.3.0 araçları -----

test("convert_zpl_dpi dogru uca gider; X-Warnings ciktinin ONUNE gecer",
  async () => {
    const kayit = [];
    const b = yeniBaglam({ fetch: sahteFetch(kayit, {
      metin: "^XA^FO74,74^XZ",
      basliklar: { "X-Warnings": "^GF verisi olceklenmedi" } }) });
    const s = await dpiDonustur(b, { zpl: "^XA^FO50,50^XZ" });
    assert.match(kayit[0].url, /\/v1\/dpi\/convert\?source=203&target=300$/);
    assert.equal(kayit[0].secenekler.body, "^XA^FO50,50^XZ");
    assert.match(s.content[0].text, /olceklenmedi/);
    assert.equal(s.content[1].text, "^XA^FO74,74^XZ");
  });

test("convert_zpl_dpi uyarisiz yanitla TEK icerik doner", async () => {
  const b = yeniBaglam({ fetch: sahteFetch([], { metin: "^XA^XZ" }) });
  const s = await dpiDonustur(b, { zpl: "^XA^XZ", source: 300, target: 203 });
  assert.equal(s.content.length, 1);
  assert.equal(s.content[0].text, "^XA^XZ");
});

test("explain_zpl olcuyu w/h adlariyla, modeli encode ederek gonderir",
  async () => {
    const kayit = [];
    const b = yeniBaglam({ fetch: sahteFetch(kayit,
      { metin: '{"puan":90}' }) });
    await zplAcikla(b, { zpl: "^XA^XZ", width_in: 2.25, height_in: 1,
                         model: "zebra zd421" });
    assert.match(kayit[0].url,
      /\/v1\/diagnostics\/full\?dpmm=8&w=2\.25&h=1&model=zebra%20zd421$/);
    // model verilmezse parametre HIC gitmez (sunucu bos model kabul eder
    // ama adres temiz kalsin).
    const kayit2 = [];
    const b2 = yeniBaglam({ fetch: sahteFetch(kayit2, { metin: "{}" }) });
    await zplAcikla(b2, { zpl: "^XA^XZ" });
    assert.match(kayit2[0].url, /\/v1\/diagnostics\/full\?dpmm=8&w=4&h=6$/);
  });

test("zpl_command_help katalogdan suzer; ^PO gibi render edilmeyeni " +
  "destekleniyor=false ile DURUSTCE doner", async () => {
    const katalog = JSON.stringify({ komutlar: [
      { kod: "PO", ad: "Baski Yonu", destekleniyor: false },
      { kod: "A", ad: "Font Secimi", destekleniyor: true },
      { kod: "BC", ad: "Code 128", destekleniyor: true },
    ] });
    const kayit = [];
    const b = yeniBaglam({ fetch: sahteFetch(kayit, { metin: katalog }) });
    const s = await komutYardimi(b, { command: "^PO" });
    assert.match(kayit[0].url, /\/v1\/commands$/);
    const kayitli = JSON.parse(s.content[0].text);
    assert.equal(kayitli.kod, "PO");
    assert.equal(kayitli.destekleniyor, false);
    // ^A0 font ailesi "A" kaydina; uzun yazim 2 harfe iner (BCN -> BC).
    const a = JSON.parse((await komutYardimi(b, { command: "^A0" }))
      .content[0].text);
    assert.equal(a.kod, "A");
    const bc = JSON.parse((await komutYardimi(b, { command: "BCN" }))
      .content[0].text);
    assert.equal(bc.kod, "BC");
  });

test("zpl_command_help bilinmeyen komutta hata doner, kayit UYDURMAZ",
  async () => {
    const b = yeniBaglam({ fetch: sahteFetch([],
      { metin: '{"komutlar":[]}' }) });
    const s = await komutYardimi(b, { command: "^QQ" });
    assert.equal(s.isError, true);
    assert.match(s.content[0].text, /Bilinmeyen komut/);
  });
