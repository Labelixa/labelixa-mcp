/**
 * Labelixa MCP araçları — SAF katman (LBL-ECO-014).
 *
 * Tasarım, node SDK'sıyla aynı ilkeleri paylaşır:
 * - İNCE sarmalayıcı: her araç belgeli bir REST ucuna 1:1 gider; istemci
 *   tarafında sihir yok, kotayı gizleyen sessiz retry yok.
 * - Hata sunucunun KENDİ metnini taşır; 402/429 ayrı işaretlenir ki
 *   asistan "biraz sonra dene"yi uydurmak yerine sunucudan okusun.
 * - Bu dosya MCP SDK'sını İÇE AKTARMAZ: araçların tamamı sahte fetch ile
 *   ağsız test edilir (node --test), sunucu kablolaması server.mjs'te.
 *
 * Dürüstlük sınırı (PRN-015 ailesi): `zpl_preview` bir SUNUCU RENDER'ıdır
 * — "yazıcıda böyle çıkar" garantisi değildir ve araç açıklaması bunu
 * söyler. Fiziksel doğrulama ayrı bir dünyadır (EDT-039).
 */

import { createRequire } from "node:module";

const VARSAYILAN_TABAN = "https://api.labelixa.com";
// Paket sürümü package.json'dan okunur — User-Agent, MCP serverInfo ve
// npm metadata'sı aynı sayıyı taşır. Sabit yazılmış "0.3.0" 0.3.1
// yayınında geride kalmıştı; tek kaynak bunu yapısal olarak kapatır.
export const SURUM = createRequire(import.meta.url)("./package.json").version;

/** g-format: 4.0 -> "4", 2.25 -> "2.25" (SDK ile aynı). */
const g = (n) => String(Number(n));

function basliklar(apiKey) {
  const b = { "User-Agent": `labelixa-mcp/${SURUM}` };
  if (apiKey) b["X-API-Key"] = apiKey;
  return b;
}

/** Hata gövdesini MCP metnine çevirir; kota ayrı ve eyleme dönük. */
async function hataMetni(yanit) {
  const govde = (await yanit.text()).slice(0, 500);
  if (yanit.status === 402 || yanit.status === 429) {
    const sn = yanit.headers.get("Retry-After") ?? "60";
    return `Kota/limit (HTTP ${yanit.status}): ${govde} — ${sn} sn sonra ` +
      `yeniden denenebilir. Anonim kota kucuktur; LABELIXA_API_KEY ` +
      `ortam degiskeni ile anahtar verilebilir.`;
  }
  return `Labelixa API hatasi (HTTP ${yanit.status}): ${govde}`;
}

/** MCP sonucu: hata → isError + metin; içerik dizisi MCP biçiminde. */
const hataSonucu = (metin) => ({ isError: true,
  content: [{ type: "text", text: metin }] });

export function yeniBaglam({ apiKey, baseUrl = VARSAYILAN_TABAN,
                             fetch: fetchImpl } = {}) {
  return {
    taban: baseUrl.replace(/\/+$/, ""),
    fetch: fetchImpl ?? globalThis.fetch,
    basliklar: basliklar(apiKey),
  };
}

/** ZPL'i PNG'ye render eder; MCP image içeriği döner. */
export async function zplOnizle(b, { zpl, dpmm = 8, width_in = 4,
                                     height_in = 6, index = 0 }) {
  const yol = `/v1/printers/${dpmm}dpmm/labels/` +
    `${g(width_in)}x${g(height_in)}/${index}`;
  const y = await b.fetch(b.taban + yol, {
    method: "POST",
    headers: { ...b.basliklar, "Content-Type": "text/plain" },
    body: zpl,
  });
  if (y.status !== 200) return hataSonucu(await hataMetni(y));
  const ham = new Uint8Array(await y.arrayBuffer());
  return { content: [{ type: "image", mimeType: "image/png",
                       data: Buffer.from(ham).toString("base64") }] };
}

/** ZPL tanılaması; yapısal raporu JSON metni olarak döner. */
export async function zplDogrula(b, { zpl, dpmm = 8, width_in = 4,
                                      height_in = 6 }) {
  // Sunucu `w`/`h` okur — `width`/`height` SESSİZCE yok sayılırdı
  // (ECO-013'ün npm/PyPI'da yaşanmış hatası; üçüncü kez yaşanmasın).
  const q = `?dpmm=${dpmm}&w=${g(width_in)}&h=${g(height_in)}`;
  const y = await b.fetch(b.taban + "/v1/diagnostics" + q, {
    method: "POST",
    headers: { ...b.basliklar, "Content-Type": "text/plain" },
    body: zpl,
  });
  if (y.status !== 200) return hataSonucu(await hataMetni(y));
  return { content: [{ type: "text", text: await y.text() }] };
}

/** Düz-metin gövde POST'layıp JSON metni döndüren uçların ortak yolu.
 *
 * 0.2.0'daki beş yeni araç aynı sözleşmeyi paylaşır (durumsuz, JSON
 * yanıt, hata sunucu metniyle); şablonu beş kez yazmak, beş kez hatalı
 * yazma riskiydi. */
async function metinGonderJsonAl(b, yol, govde) {
  const y = await b.fetch(b.taban + yol, {
    method: "POST",
    headers: { ...b.basliklar, "Content-Type": "text/plain" },
    body: govde,
  });
  if (y.status !== 200) return hataSonucu(await hataMetni(y));
  return { content: [{ type: "text", text: await y.text() }] };
}

/** Yazıcı dilini tahmin eder (ZPL/EPL/TSPL/CPCL) — heuristik.
 * Yanıt dil + güven KADEMESİ döner (yüzde değil; sunucu gerçek olasılık
 * hesaplamıyor ve biz de öyleymiş gibi sunmayız). */
export const dilTespit = (b, { code }) =>
  metinGonderJsonAl(b, "/v1/language-detect", code);

/** EPL/EPL2 tanılaması; konum bilgili bulgu listesi (JSON). */
export const eplDogrula = (b, { epl }) =>
  metinGonderJsonAl(b, "/v1/epl/diagnostics", epl);

/** TSPL/TSPL2 tanılaması; konum bilgili bulgu listesi (JSON). */
export const tsplDogrula = (b, { tspl }) =>
  metinGonderJsonAl(b, "/v1/tspl/diagnostics", tspl);

/** CPCL tanılaması; konum bilgili bulgu listesi (JSON). */
export const cpclDogrula = (b, { cpcl }) =>
  metinGonderJsonAl(b, "/v1/cpcl/diagnostics", cpcl);

/** ZPL'in belirli bir yazıcı MODELİYLE uyumluluk RİSK analizi.
 * Emülatör değildir ve "çalışır" demez — sunucunun kendi dürüstlük
 * sözleşmesi aynen geçirilir; bilinmeyen model sunucudan 404 döner ve
 * hata metni olduğu gibi taşınır. */
export const uyumlulukDenetle = (b, { zpl, model }) =>
  metinGonderJsonAl(b, "/v1/compatibility?model=" +
    encodeURIComponent(model), zpl);

// ------------------------------------------------------ 0.3.0 araçları -----
// PLT-026 FAZ A/B/E uçları prod'da açıldıktan SONRA eklendi (kural:
// yayınlanmamış yüzey paketlenmez/belgelenmez; açılış 2026-08-26).

/** ZPL'i çözünürlükler arasında ölçekler (203/300/600 dpi).
 * ^GF/~DG görüntü verisi ÖLÇEKLENMEZ — sunucu bunu X-Warnings ile söyler
 * ve uyarı çıktının ÖNÜNE ayrı metin bloğu olarak konur; sessiz geçilmez. */
export async function dpiDonustur(b, { zpl, source = 203, target = 300 }) {
  const y = await b.fetch(
    b.taban + `/v1/dpi/convert?source=${source}&target=${target}`, {
      method: "POST",
      headers: { ...b.basliklar, "Content-Type": "text/plain" },
      body: zpl,
    });
  if (y.status !== 200) return hataSonucu(await hataMetni(y));
  const cikti = await y.text();
  const uyari = y.headers.get("X-Warnings");
  const icerik = [];
  if (uyari) icerik.push({ type: "text", text: `Warnings: ${uyari}` });
  icerik.push({ type: "text", text: cikti });
  return { content: icerik };
}

/** Tam sağlık raporu (Diagnostics Hub): bölümlü JSON — skor yalnız
 * değerlendirilebilen bölümlerden, ölçülemeyen bölüm "degerlendirilmedi"
 * der; sunucunun dürüstlük sözleşmesi aynen geçirilir. */
export const zplAcikla = (b, { zpl, dpmm = 8, width_in = 4,
                               height_in = 6, model = "" }) => {
  const q = `?dpmm=${dpmm}&w=${g(width_in)}&h=${g(height_in)}` +
    (model ? `&model=${encodeURIComponent(model)}` : "");
  return metinGonderJsonAl(b, "/v1/diagnostics/full" + q, zpl);
};

/** Tek ZPL komutunun katalog kaydı (ad, format, parametreler ve komutun
 * önizlemede render edilip edilmediğini söyleyen `destekleniyor` alanı).
 * Sunucuda tek-komut ucu yok; belgeli /v1/commands listesi çekilir ve
 * istemcide süzülür — sunum katmanı, sihir değil. */
export async function komutYardimi(b, { command }) {
  const y = await b.fetch(b.taban + "/v1/commands",
                          { method: "GET", headers: b.basliklar });
  if (y.status !== 200) return hataSonucu(await hataMetni(y));
  const { komutlar } = JSON.parse(await y.text());
  const kod = String(command).trim().replace(/^[\^~]+/, "").toUpperCase();
  // ^A0/^AD font ailesi kataloğa "A" olarak; öteki uzun yazımlar 2 harfe
  // indirgenir (sunucudaki _norm_code ile aynı sıra).
  const kayit = komutlar.find((k) => k.kod === kod)
    ?? ((kod.startsWith("A") && kod !== "A@")
        ? komutlar.find((k) => k.kod === "A") : undefined)
    ?? (kod.length > 2
        ? komutlar.find((k) => k.kod === kod.slice(0, 2)) : undefined);
  if (!kayit) {
    return hataSonucu(`Bilinmeyen komut: ${command} — katalogda yok ` +
      `(yazim hatasi olabilir; dogrulama icin zpl_validate kullanin).`);
  }
  return { content: [{ type: "text", text: JSON.stringify(kayit, null, 1) }] };
}

/** Barkod üretir; svg → metin, png → görüntü içeriği.

Sunucu sözleşmesi (api.py `/v1/barcodes`): varsayılan biçim PNG'dir —
SVG isteniyorsa `format=svg` AÇIKÇA gönderilir. Geçersiz girdi 4xx
DEĞİL, 200 + hata-PNG'si + `X-Warnings` başlığı döner; o başlığı
okumadan görüntüyü geçirmek, asistana "barkod ürettim" yalanı söyletir. */
export async function barkodUret(b, { type, data, format = "svg" }) {
  const q = new URLSearchParams({ type, data, format });
  const y = await b.fetch(b.taban + "/v1/barcodes?" + q.toString(), {
    method: "GET", headers: b.basliklar,
  });
  if (y.status !== 200) return hataSonucu(await hataMetni(y));
  const uyari = y.headers.get("X-Warnings");
  if (uyari) return hataSonucu(`Barkod uretilemedi: ${uyari}`);
  if (format === "png") {
    const ham = new Uint8Array(await y.arrayBuffer());
    return { content: [{ type: "image", mimeType: "image/png",
                         data: Buffer.from(ham).toString("base64") }] };
  }
  return { content: [{ type: "text", text: await y.text() }] };
}
