# labelixa-mcp — sürüm günlüğü

Kural: girdinin başlığı yayın durumunu söyler — tarih = o gün npm'de
yayımlandı; "yayımlanmadı" = depoda hazır, `npm publish` bekliyor.
Yayımlanmış bir sürümün girdisi bir daha DEĞİŞTİRİLMEZ; yayından sonra
yapılan metadata düzeltmesi yeni sürüm numarası alır (0.3.1 dersi, aşağıda).

## 0.3.3 — 2026-09-10

- **Lisans metni artık pakette (LBL-DOC-012).** `license: MIT` ilan
  ediliyordu ama tarball'da lisans metni YOKTU (`npm pack` ile ölçüldü:
  4 dosya). `LICENSE` eklendi ve `files` listesine yazıldı — dosya
  depoda durup `files`e girmezse kullanıcıya HİÇ ulaşmaz.
- **`repository` gerçek bir adrese işaret ediyor (LBL-ECO-025).** Alan
  `github.com/Labelixa/Labelixa`yı gösteriyordu ve o adres kimliksiz
  **404** dönüyor (ölçüldü). Artık paketin kendi public deposu:
  `github.com/Labelixa/labelixa-mcp`. `bugs.url` de gerçek bir issue
  kanalı.
- Araç yüzeyi ve davranış DEĞİŞMEDİ — 11 aracın şeması aynı
  (`test/sozlesme.json` ile kilitli).

## 0.3.2 — 2026-09-09

- **Sürüm tek kaynaktan:** `server.mjs` ve `araclar.mjs` sürümü artık
  `package.json`dan okur (`SURUM`); 0.3.1 yayınında üç dosya üç ayrı
  sayı taşıyordu (`package.json` 0.3.1, `server.mjs`/`araclar.mjs`
  0.3.0, `server.json` 0.3.0). GEO denetimi 2026-09-06 buldu; kilit
  `tests/test_mcp_surum.py`.
- **Açıklama netliği (yeniden):** 0.3.1 girdisinde "açıklama netliği"
  yazıyordu ama o düzenleme 2026-09-01'de, 0.3.1'in npm yayınından
  (2026-08-27) SONRA yapıldı ve npm'deki 0.3.1 tarball'ı ESKİ açıklamayı
  taşıyor (registry'den ölçüldü: "MCP server for the Labelixa API:
  preview ZPL labels…"). Düzeltme bu sürümle yayına girer.
- **Registry manifesti (`server.json`):** `websiteUrl`
  (`https://labelixa.com/mcp`) eklendi; sürüm alanları `package.json`
  ile hizalandı (0.3.2). `repository` alanı BİLEREK yok: kaynak depo
  özel (private) — herkese 404 dönen bir adresi manifestte ilan etmek
  yanıltır. Depo açılırsa alan eklenir.
- **Yanlış model örneği düzeltildi (ölçüm 2026-09-07):**
  `zpl_compatibility` ve `explain_zpl` açıklamaları modeli
  `zebra-zd421` diye örnekliyordu; uç `üretici/model` okuyor ve o dizeye
  prod'da da staging'de de `404 Model veritabaninda yok` dönüyordu —
  yani belgeye uyan İLK çağrı kesin hata alıyordu. Örnek artık
  `zebra/zd421`; kilit `tests/test_mcp_onboarding.py` örneği yazıcı
  kataloğuna bağlar. Aynı hatalı dize `sdk/node` ve `sdk/python`
  paketlerinde de duruyor (ayrı artefaktlar, ayrı sürüm — backlog).
- **`bugs.url` düzeltildi:** `https://labelixa.com/contact` prod'da 404
  (ölçüldü); paket var olmayan bir sayfaya "hata bildir" diyordu. Adres
  `https://labelixa.com/docs` (200) ve `support@labelixa.com`.
- Araç listesi, çağrı sözleşmeleri ve uzak uç davranışı DEĞİŞMEDİ;
  değişen yalnız araç AÇIKLAMALARI ve paket metadata'sı.

## 0.3.1 — 2026-08-27

- Yalnız metadata: `repository.url` yeni depo adresine çevrildi
  (`github.com/Labelixa/Labelixa`). Araç listesi, sözleşmeler ve uzak uç
  davranışı DEĞİŞMEDİ. Gerekçe ECO-017; ayrıntı sdk/node 0.2.1 girdisinde.
- NOT (2026-09-06 düzeltmesi): bu girdi bir süre "yayımlanmadı" başlığı
  taşıdı ve altına 2026-09-01 tarihli bir açıklama düzenlemesi yazıldı;
  oysa 0.3.1 npm'de 2026-08-27'de yayımlanmıştı ve o düzenlemeyi
  taşımıyor. Düzenleme 0.3.2'ye taşındı.

## 0.3.0 — 2026-08-26

- Üç yeni araç (PLT-026; hepsi 2026-08-26'da prod'da açılan uçlara 1:1):
  - `zpl_command_help`: tek komutun katalog kaydı — ad, sözdizimi,
    parametreler ve komutun önizlemede GERÇEKTEN render edilip
    edilmediği (`destekleniyor`); yazıcı-tarafı komutlar dürüstçe
    işaretli. Sunucuda tek-komut ucu olmadığı için belgeli
    `/v1/commands` listesi çekilir, istemcide süzülür.
  - `convert_zpl_dpi`: ZPL koordinatlarını çözünürlükler arasında
    ölçekler (`/v1/dpi/convert`); `^GF/~DG` görüntü verisi ölçeklenmez
    ve uyarı çıktının ÖNÜNE ayrı blok olarak konur.
  - `explain_zpl`: bölümlü sağlık raporu (`/v1/diagnostics/full`) —
    skor yalnız değerlendirilebilen bölümlerden, ölçülemeyen bölüm
    "degerlendirilmedi" der; isteğe bağlı `model` parametresi.

## 0.2.0 — 2026-08-25

- Beş yeni araç: `language_detect` (ZPL/EPL/TSPL/CPCL tespiti — güven
  KADEMESİ döner, yüzde değil), `epl_validate`, `tspl_validate`,
  `cpcl_validate` (konum bilgili tanılama raporları) ve
  `zpl_compatibility` (modele karşı RİSK analizi — emülatör değildir,
  "çalışır" demez; sunucunun dürüstlük sözleşmesi aynen geçer).
- Hepsi belgeli REST uçlarına 1:1 ince sarmalayıcı; hata sunucu
  metniyle taşınır, bilinmeyen model 404'ü uydurulmadan iletilir.

## 0.1.1 — 2026-08-25

- `package.json`'a `mcpName: "com.labelixa/zpl"` eklendi — resmî MCP
  Registry (registry.modelcontextprotocol.io) npm paketi doğrularken bu
  alanın `server.json`daki adla eşleşmesini şart koşuyor. Araç davranışı
  değişmedi; sürüm yalnız bu doğrulama alanı için artırıldı.
- `mcp/server.json` eklendi (registry manifesti: uzak uç + npm paketi).

## 0.1.0 — 2026-08-25

- İlk yayın: `zpl_preview`, `zpl_validate`, `barcode_generate`.
