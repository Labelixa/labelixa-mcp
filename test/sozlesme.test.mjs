/**
 * npm paketinin MCP araç sözleşmesi kilidi (LBL-ECO-021, ikinci yüzey).
 *
 * **Neden var.** 2026-09-09'da uzak sunucunun (`app/mcp_ucu.py`, 21 araç)
 * `inputSchema`sı kilitlendi. Bu paket AYRI bir üründür — 11 araç, farklı
 * adlar (`barcode_generate`, uzakta `barcode_png`), zod şemaları — ve
 * kendi sözleşmesi kilitli DEĞİLDİ: bir alanın adı, tipi ya da
 * zorunluluğu değişse hiçbir test kırılmıyordu. Paket haftada ~88 kez
 * kuruluyor; sessiz bir kırılma bizde değil KULLANICIDA görünürdü.
 *
 * **Ölçüm SUNUCUNUN KENDİSİNDEN alınır, kaynaktan değil.** Sunucu
 * gerçekten başlatılıp `initialize` + `tools/list` konuşulur; okunan şey
 * istemcinin gördüğü JSON Schema'nın ta kendisidir — zod'un ve MCP
 * SDK'sının dönüşümü dahil. Kaynaktaki zod ifadesini okumak, SDK bir gün
 * dönüşümü değiştirdiğinde sessizce yanlış olurdu.
 *
 * **Sınıflandırıcı BİLEREK ikinci kez yazılmadı.** Python tarafında
 * KIRICI/EKLEMELİ ayrımı yapan bir karşılaştırıcı var
 * (`scripts/mcp_sozlesme.py`). Aynı mantığı burada JavaScript'te ikinci
 * kez yazmak iki kural kümesi demek olurdu ve **ikisi arasındaki kayma
 * görünmez olurdu** — kapatmak için yazıldığımız kusurun aynısı. Burada
 * yapılan tam eşitlik karşılaştırması; hangi değişikliğin kırıcı olduğu
 * `scripts/mcp_sozlesme.py` başlığındaki TEK tabloda yazılı ve hata
 * mesajı oraya yönlendirir.
 *
 * Anlık görüntüyü güncellemek: `node --test test/sozlesme.test.mjs` çıktısı
 * beklenen JSON'u basar; `test/sozlesme.json`a yazmak BİLEREK elle bir
 * iştir — test kendi beklentisini tazeleseydi hiçbir şey ölçmezdi.
 */
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BURASI = dirname(fileURLToPath(import.meta.url));
const SUNUCU = join(BURASI, "..", "server.mjs");
const ANLIK = join(BURASI, "sozlesme.json");

/** Sunucuyu stdio üzerinden konuşturur ve `tools/list` sonucunu döner. */
async function araclariOku() {
  const cocuk = spawn(process.execPath, [SUNUCU], {
    stdio: ["pipe", "pipe", "pipe"],
    // Anahtar VERİLMEZ: liste kimlikten bağımsız olmalı. Ortamdan sızan
    // bir anahtar ölçümü makineye bağlardı.
    env: { ...process.env, LABELIXA_API_KEY: "" },
  });
  const yaz = (o) => cocuk.stdin.write(JSON.stringify(o) + "\n");

  let tampon = "";
  const sonuc = new Promise((coz, red) => {
    const zaman = setTimeout(() => {
      cocuk.kill();
      red(new Error("sunucu 15 sn icinde tools/list dondurmedi"));
    }, 15000);
    cocuk.stdout.on("data", (p) => {
      tampon += p.toString();
      let n;
      while ((n = tampon.indexOf("\n")) >= 0) {
        const satir = tampon.slice(0, n).trim();
        tampon = tampon.slice(n + 1);
        if (!satir) continue;
        let y;
        try { y = JSON.parse(satir); } catch { continue; }
        if (y.id === 2) {
          clearTimeout(zaman);
          cocuk.kill();
          coz(y.result?.tools ?? []);
        }
      }
    });
    cocuk.on("error", red);
  });

  yaz({ jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {},
                  clientInfo: { name: "sozlesme-kilidi", version: "1" } } });
  yaz({ jsonrpc: "2.0", method: "notifications/initialized" });
  yaz({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  return sonuc;
}

/**
 * Servis edilen aracı karşılaştırılabilir bir kayda indirger.
 *
 * Saklanan: alan adları, tipleri, `enum` KÜMESİ, `required` kümesi.
 * Saklanmayan: açıklama nesri ve alan sırası — Python tarafıyla aynı
 * gerekçe (nesir okunamaz bir anlık görüntü üretir ve şemayı bozmaz;
 * sıra sözleşme değildir).
 */
function kayit(arac) {
  const sema = arac.inputSchema ?? {};
  const ozellikler = sema.properties ?? {};
  const alanlar = {};
  for (const ad of Object.keys(ozellikler).sort()) {
    const o = ozellikler[ad] ?? {};
    const k = { tip: o.type ?? (o.anyOf ? "anyOf" : "") };
    if (Array.isArray(o.enum)) k.enum = o.enum.map(String).sort();
    alanlar[ad] = k;
  }
  return { alanlar, zorunlu: [...(sema.required ?? [])].sort() };
}

function sozlesme(araclar) {
  const cikti = {};
  for (const a of [...araclar].sort((x, y) => x.name < y.name ? -1 : 1)) {
    cikti[a.name] = kayit(a);
  }
  return cikti;
}

test("servis edilen sozlesme anlik goruntuyle AYNI", async () => {
  const bugun = sozlesme(await araclariOku());
  const beklenen = JSON.parse(readFileSync(ANLIK, "utf8"));

  const eksik = Object.keys(beklenen).filter((a) => !(a in bugun));
  const fazla = Object.keys(bugun).filter((a) => !(a in beklenen));
  assert.deepEqual(
    { eksik, fazla }, { eksik: [], fazla: [] },
    "arac listesi degisti — KAYBOLAN arac KIRICIDIR (bkz. " +
    "scripts/mcp_sozlesme.py basligindaki tablo)");

  for (const ad of Object.keys(beklenen)) {
    assert.deepEqual(
      bugun[ad], beklenen[ad],
      `\n'${ad}' aracinin girdi semasi degisti.\n` +
      `Bilerek yapildiysa test/sozlesme.json guncellenir ve fark PR'in ` +
      `diff'inde GORUNUR olur.\nHangi degisiklik KIRICI, hangisi ` +
      `EKLEMELI: scripts/mcp_sozlesme.py basligindaki tablo.\n` +
      `bugun:    ${JSON.stringify(bugun[ad])}\n` +
      `beklenen: ${JSON.stringify(beklenen[ad])}\n`);
  }
});

test("anlik goruntu BOS DEGIL ve 11 araci kapsiyor", () => {
  const beklenen = JSON.parse(readFileSync(ANLIK, "utf8"));
  // Bos bir anlik goruntu, yesil ama hicbir sey olcmeyen bir test demek:
  // ustteki dongu sifir kez doner ve 'eksik' listesi de bos cikar.
  assert.equal(Object.keys(beklenen).length, 11);
  for (const kayit of Object.values(beklenen)) {
    assert.ok(Object.keys(kayit.alanlar).length > 0);
  }
});

test("anlik goruntu aciklama NESRI tasimaz", () => {
  const ham = readFileSync(ANLIK, "utf8");
  // Nesir girerse dosya okunamaz olur ve her kelime duzeltmesi devasa bir
  // diff uretir; o diff'te gercek bir sema degisikligi gozden kacar.
  assert.ok(!ham.includes("SERVER-SIDE"), "aciklama metni sizmis");
  assert.ok(!ham.includes("describe"), "zod ifadesi sizmis");
});

test("uzak sunucuyla AYNI URUN SANILMASIN: adlar bilerek farkli", () => {
  const beklenen = JSON.parse(readFileSync(ANLIK, "utf8"));
  // Uzak sunucu (21 arac) `barcode_png` sunar, bu paket
  // `barcode_generate`. Iki AYRI urun; dizin basvurusunda ve belgelerde
  // hangisinin anlatildigi buna gore degisir (GEO-014'te bir kez ters
  // yone duzeltilmisti).
  assert.ok("barcode_generate" in beklenen);
  assert.ok(!("barcode_png" in beklenen));
});
