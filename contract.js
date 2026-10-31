/**
 * WIRE VOCABULARY: the API's own field names, and the English names this
 * server shows the assistant instead.
 *
 * Some JSON field names in Labelixa API answers are Turkish (`ozet`,
 * `mesaj`, `risk.seviye`, ...). They are the API's stable wire protocol:
 * every client reads them, so the server cannot rename them. A few
 * enum-like values are Turkish code words too (`risk.seviye: "dusuk"`,
 * a report section's `durum: "degerlendirilmedi"`). An assistant and the
 * person reading its answer should not have to know Turkish, so the JSON
 * is renamed once, after parsing, before it becomes tool output.
 *
 * The English words are the same ones the hosted server
 * (https://api.labelixa.com/mcp) and the n8n node use, so one API answer
 * reads the same everywhere. This is the ONE file exempt from the publish
 * guard's word rule (the wire names have to be written somewhere); ticket
 * ids, non-English characters and audit markers are still checked here.
 *
 * Reference: https://labelixa.com/docs/api
 */

/** An error answer (any non-2xx) is `{"hata": "<the server's sentence>"}`. */
export const ERROR_FIELD = "hata";

/** The command catalog response (`GET /v1/commands`). */
export const COMMAND_LIST = "komutlar";
export const COMMAND_CODE = "kod";

/** Wire key -> output key. A key not listed here passes through unchanged. */
export const FIELD_NAMES = Object.freeze({
  mesaj: "message",
  ozet: "summary",
  toplam: "total",
  alanlar: "fields",
  onizleme: "preview",
  baslik: "title",
  baslik_key: "title_key",
  yeni: "replacement",
  islem: "operation",
  bicim: "format",
  banka: "bank",
  veri: "data",
  komut: "command",
  oneri: "suggestion",
  parametre: "parameter",
  deger: "value",
  hane: "digits",
  verilen: "given",
  dogru: "correct",
  beklenen: "expected",
  gelen: "actual",
  uzunluk: "length",
  yol: "path",
  genislik: "label_width",
  yukseklik: "label_height",
  bitis: "end",
  gen: "print_width",
  azami: "maximum",
  desteklenen: "supported_dpi",
  tip: "type",
  dil: "language",
  guven: "confidence",
  karma: "mixed",
  puanlar: "scores",
  kanitlar: "evidence",
  kod: "code",
  satir: "line",
  uretici: "manufacturer",
  kategori: "category",
  dil_postur: "language_support",
  tur: "type",
  kaynak_url: "source_url",
  dogrulama: "verification",
  cihaz_seri: "device_serial",
  not: "note",
  seviye: "level",
  gerekceler: "reasons",
  boyut_kurali_var: "has_size_rule",
  boyut_bulgulari: "size_findings",
  onizleme_kapsami: "preview_coverage",
  destekli: "supported",
  kismi: "partial",
  desteksiz: "unsupported",
  yok_sayilan: "ignored",
  bilinmiyor: "unknown",
  sinir: "limitation",
  puan: "score",
  puan_formulu: "score_formula",
  degerlendirilen: "assessed",
  degerlendirilmeyen: "not_assessed",
  bolumler: "sections",
  notlar: "notes",
  durum: "status",
  bulgular: "findings",
  uyarilar: "warnings",
  sebep: "reason",
  sozdizimi: "syntax",
  boyut_dpi: "size_dpi",
  yon: "orientation",
  barkod: "barcode",
  gorsel_bellek: "graphics_memory",
  is_davranisi: "job_behaviour",
  model_uyum: "model_compatibility",
  komut_adedi: "command_count",
  etiket_adedi: "label_count",
  dondurulmus_alan: "rotated_fields",
  adet: "count",
  komutlar: "commands",
  indirilen_font_adedi: "downloaded_font_count",
  indirilen_font_bayt: "downloaded_font_bytes",
  ozel_font_cagrisi: "custom_font_calls",
  grafik_bayt: "graphic_bytes",
  grafik_adet: "graphic_count",
  font_bayt: "font_bytes",
  font_adet: "font_count",
  toplam_bayt: "total_bytes",
  tavan_bayt: "limit_bytes",
  en_dots: "width_dots",
  boy_dots: "height_dots",
  boyut_kaynagi: "size_source",
  adaylar: "candidates",
  en_inch: "width_in",
  boy_inch: "height_in",
  en_mm: "width_mm",
  boy_mm: "height_mm",
  standart: "standard",
  tahmini_dpi: "estimated_dpi",
  tahmin_sebebi: "estimate_reason",
  kopya: "copies",
  format_adedi: "format_count",
  sablon_adedi: "template_count",
  toplam_baski: "total_prints",
  tasma_olculen_format: "overflow_measured_formats",
  render_siniri: "render_limit",
  etiketler: "labels",
  sira: "index",
  alan_adedi: "field_count",
  barkod_adedi: "barcode_count",
  sablon: "template",
  tasan_alan: "overflowing_fields",
  modeller: "models",
  // Bulk jobs and barcode read-back: hosted-server tools only, listed here
  // so both servers keep one vocabulary (`ad` -> `name` is shared below).
  is_id: "job_id",
  satir_sayisi: "row_count",
  sonuc: "result",
  deneme: "attempts",
  uretilen: "produced",
  hatali_sayisi: "failed_count",
  hatali: "failed",
  sorunlar: "problems",
  cikti: "output",
  olcu: "size",
  genislik_in: "width_in",
  yukseklik_in: "height_in",
  kota_iade: "quota_refunded",
  islenen: "processed",
  isler: "jobs",
  hata_tipi: "error_type",
  baski: "print",
  gonderildi: "sent",
  ucretlendi: "charged",
  basim_onaylandi: "print_confirmed",
  etiket: "label_count",
  olculdu: "measured",
  okunan: "decoded",
  neden: "reason",
  ad: "name",
  aciklama: "description",
  ornek: "example",
  parametreler: "parameters",
  destekleniyor: "rendered_by_preview",
  zorunlu: "required",
  varsayilan: "default",
  aralik: "range",
  secenekler: "options",
  onizlemede_yok: "not_in_preview",
  onekler: "prefixes",
});

/** Every state a bulk job can be in. */
const JOB_STATUS = Object.freeze({
  bekliyor: "queued",
  calisiyor: "running",
  bitti: "done",
  hata: "failed",
  iptal: "cancelled",
});

/**
 * Enum-like values the API sends as Turkish code words, per output field.
 * The key is the field's path in the output (English names, `[]` for the
 * items of an array, `*` for any key). Only these fields are looked at,
 * and only the values listed: free text, rule codes, dates and any value
 * not listed pass through unchanged.
 */
export const VALUE_NAMES = Object.freeze({
  "risk.level": {
    dusuk: "low",
    orta: "medium",
    yuksek: "high",
  },
  "risk.reasons[]": {
    native: "native",
    emulasyon: "emulation",
    dil_yok: "no_zpl_support",
    boyut_bulgusu: "size_finding",
  },
  "model.category": {
    masaustu: "desktop",
    endustriyel: "industrial",
    mobil: "mobile",
  },
  "language_support.type": {
    native: "native",
    emulasyon: "emulation",
  },
  "limitation": {
    risk_analizi: "risk_analysis",
  },
  "evidence[].code": {
    zpl_xa: "zpl_xa",
    zpl_xz: "zpl_xz",
    zpl_komut_yogunlugu: "zpl_command_density",
    zpl_tilde: "zpl_tilde",
    epl_metin_satiri: "epl_text_line",
    epl_barkod_satiri: "epl_barcode_line",
    epl_kontrol_satiri: "epl_control_line",
    tspl_mm_boyut: "tspl_mm_size",
    tspl_kelime: "tspl_keyword",
    cpcl_baslik: "cpcl_header",
    cpcl_kelime: "cpcl_keyword",
  },
  "sections.*.status": {
    temiz: "clean",
    bulgulu: "findings",
    degerlendirilmedi: "not_evaluated",
  },
  "assessed[]": {
    sozdizimi: "syntax",
    boyut_dpi: "size_dpi",
    yon: "orientation",
    barkod: "barcode",
    font: "font",
    gorsel_bellek: "graphics_memory",
    is_davranisi: "job_behaviour",
    model_uyum: "model_compatibility",
  },
  "not_assessed[]": {
    sozdizimi: "syntax",
    boyut_dpi: "size_dpi",
    yon: "orientation",
    barkod: "barcode",
    font: "font",
    gorsel_bellek: "graphics_memory",
    is_davranisi: "job_behaviour",
    model_uyum: "model_compatibility",
  },
  "score_formula": {
    "100 - 15*error - 5*warning - 5*bolum_uyarisi (floor 0; evaluated sections only)": "100 - 15*error - 5*warning - 5*section_warning (floor 0; assessed sections only)",
    "100 - 15*error - 5*warning - 5*bolum_uyarisi (taban 0; yalniz degerlendirilen bolumler)": "100 - 15*error - 5*warning - 5*section_warning (floor 0; assessed sections only)",
  },
  "sections.size_dpi.summary.size_source": {
    komut: "command",
    alanlardan: "from_fields",
    karma: "mixed",
    onceki: "previous",
  },
  "sections.job_behaviour.summary.labels[].size_source": {
    komut: "command",
    alanlardan: "from_fields",
    karma: "mixed",
    onceki: "previous",
  },
  "status": JOB_STATUS,
  "jobs[].status": JOB_STATUS,
  "jobs[].type": {
    toplu_uretim: "bulk_production",
  },
  "result.failed[].problems[].code": {
    eksik: "missing",
    sayi_degil: "not_a_number",
    sozdizimi: "syntax",
    temizlendi: "sanitized",
    render: "render",
  },
  "result.print.reason": {
    "uretilen etiket yok, basilacak akis bos": "no label was produced; nothing to print",
  },
  "result.print.note": {
    "Baski isi kuyruga alindi. Yaziciya ileten agent kurulana dek 'queued' kalir; bu BASIM ONAYI DEGILDIR.": "The print job was queued. It stays 'queued' until an agent that forwards it to the printer is installed; this is NOT a print confirmation.",
  },
});

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function pathMatches(pattern, path) {
  const p = pattern.split(".");
  const q = path.split(".");
  return p.length === q.length && p.every((s, i) => s === "*" || s === q[i]);
}

function valuesFor(path) {
  if (own(VALUE_NAMES, path)) return VALUE_NAMES[path];
  for (const [pattern, values] of Object.entries(VALUE_NAMES)) {
    if (pattern.includes("*") && pathMatches(pattern, path)) return values;
  }
  return undefined;
}

/**
 * Returns a copy of `value` with every known wire key renamed, at any depth
 * (objects inside arrays included), and the enum values of the fields in
 * VALUE_NAMES translated. Every other value is copied as it is. When the
 * English name is already taken in the same object, the wire key is kept,
 * so nothing is ever overwritten.
 */
export function englishFields(value, path = "") {
  if (Array.isArray(value)) return value.map((item) => englishFields(item, `${path}[]`));
  if (typeof value === "string") {
    const values = valuesFor(path);
    return values && own(values, value) ? values[value] : value;
  }
  if (value === null || typeof value !== "object") return value;
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    const renamed = own(FIELD_NAMES, key) ? FIELD_NAMES[key] : key;
    const name = renamed !== key && (own(value, renamed) || own(out, renamed)) ? key : renamed;
    out[name] = englishFields(inner, path ? `${path}.${name}` : name);
  }
  return out;
}

/**
 * JSON text in, JSON text out with English names. Text that is not JSON is
 * returned unchanged: a tool result must never be broken by the renaming.
 */
export function englishJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  return JSON.stringify(englishFields(parsed));
}

/**
 * The sentence of an error answer. Extra fields (for example the list of
 * valid models) follow it as English-keyed JSON, because the assistant can
 * correct its call with them. Any other body is returned unchanged.
 */
export function errorText(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!body || typeof body !== "object" || typeof body[ERROR_FIELD] !== "string") return raw;
  const rest = { ...body };
  delete rest[ERROR_FIELD];
  return Object.keys(rest).length
    ? `${body[ERROR_FIELD]} ${JSON.stringify(englishFields(rest))}`
    : body[ERROR_FIELD];
}
