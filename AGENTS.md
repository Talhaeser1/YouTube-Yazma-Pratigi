# AGENTS.md — bu projede çalışacak yapay zekâ araçları için

Chrome MV3 eklentisi: YouTube videosunun altyazısını şeffaf bir katmanda yazdırarak hızlı yazma pratiği yaptırır.
Derleme adımı ve bağımlılık yoktur; `src/` altındaki düz JavaScript dosyaları doğrudan yüklenir.

## Önce bunları oku

| Ne | Nerede |
| --- | --- |
| Kurallar ve arayüzler (bağlayıcı) | `ajanlar/SOZLESME.md` |
| Özelliklerin durumu ve kanıtı | `PROGRESS.md` |
| Kullanıcı rehberi | `BENIOKU.md` |
| Alt ajan tanımları (mimar, usta, denetci, katip) | `.claude/agents/` |
| Orkestratör (ana oturum) rehberi | `ajanlar/orkestrator/SKILL.md` |

## Her değişiklikte

1. `node test/run.js` çalıştır; hepsi geçmeli. Mantık değiştiyse test ekle.
2. Kullanıcının gördüğü bir şey değiştiyse (kısayol, metin, davranış) `BENIOKU.md` dosyasını aynı turda güncelle.
3. `PROGRESS.md` dosyasını güncelle. Depoda testi ya da tarihli elle doğrulaması olmayan özelliği "doğrulandı" diye yazma.
4. Değişikliği Git'e ayrı bir commit olarak kaydet.

## Dokunmadan önce dikkat

- `src/transcript.js` içindeki altyazı çekme zinciri YouTube'un belgelenmemiş iç davranışına dayanır ve yalnızca
  gerçek tarayıcıda doğrulanabilir. Canlı test yapmadan değiştirme.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` yasaktır (YouTube Trusted Types uygular).
- Yeni bağımlılık, derleme adımı ya da eklenti izni eklemeden önce kullanıcıya sor.
