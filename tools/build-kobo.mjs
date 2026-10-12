// 使い方: node tools/build-kobo.mjs [出力先フォルダ]      → <出力先>/kobo-shoes.html, kobo-pack.html, kobo-outer.html
//         node tools/build-kobo.mjs --check                → 登山靴の文面が元の「登山靴プロンプト工房」と同じか確認
// 元の登山靴プロンプト工房（tools/kobo-template.html）の画面をそのまま使い、
// プロンプトの文面と参照シートの描き方を tools/kobo-core.js（共通部分）に差し替えて、カテゴリーごとのページを作る。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import "./kobo-core.js";
const KOBO = globalThis.KOBO;
const here = path.dirname(new URL(import.meta.url).pathname);
const tpl = fs.readFileSync(path.join(here, "kobo-template.html"), "utf8");
const core = fs.readFileSync(path.join(here, "kobo-core.js"), "utf8");
const q = (s) => JSON.stringify(s);

function must(src, from, to) {
  if (!src.includes(from)) throw new Error("テンプレートに見つかりません: " + from.slice(0, 60));
  return src.split(from).join(to);
}
function between(src, a, b, to) {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error("区間が見つかりません: " + a);
  return src.slice(0, i) + to + src.slice(j);
}

function build(cat) {
  const C = KOBO.CATS[cat], DF = KOBO.defaults(cat);
  let h = tpl.replace(/^[\s\S]*?<body>\n?/, "").replace(/<\/body><\/html>\s*$/, "");
  h = must(h, "<title>登山靴プロンプト工房</title>", `<title>${C.title}</title>`);
  h = must(h, "<h1>登山靴プロンプト工房</h1>", `<h1>${C.title}</h1>`);
  h = must(h, "貼り付け（Ctrl+V / ⌘V）もできます。靴を真横から撮った画像が向いています。", C.photoHint);
  const fields = C.specs.map(([id, label, ph]) => `          <div class="f"><label for="${id}">${label}</label><input type="text" id="${id}" autocomplete="off" placeholder="${ph}"></div>`).join("\n");
  h = h.replace(/(<textarea id="source"[^\n]*\n\s*<div class="two">\n)[\s\S]*?(\n\s*<\/div>\n\s*<\/section>)/, (m, a, b) => a + fields + b);
  const ids = ["brand", "model", "modelJa", "color", "source", ...C.specs.map((s) => s[0]), "reader", "usage"];
  h = h.replace(/const TEXT_IDS=\[[^\n]*\];/, `const TEXT_IDS=${q(ids)};`);
  h = h.replace(/const SPECS=\[[^\n]*\];/, `const SPECS=${q(C.specs.map((s) => [s[0], s[1]]))};`);
  h = h.replace(/const DEFAULTS=\{[^\n]*\};/, `const DEFAULTS=${q(DF)};`);
  h = h.replace(/const SAMPLE=\{[^\n]*\};/, `const SAMPLE=${q(C.sample)};`);
  h = h.replace(/const KEY='[^']*';/, `const KEY=${q(C.key)};\nconst CAT=${q(cat)};`);
  h = between(h, "/* ---------- プロンプト ---------- */", "/* ---------- 画面更新 ---------- */", `/* ---------- プロンプトと参照シート（文面と描き方は KOBO 共通部分） ---------- */
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function renderPrompt(d){
  const raw=KOBO.buildPrompt(d,CAT);
  state.plain=KOBO.plain(raw);
  $('prompt').innerHTML=esc(raw).replace(/\\u0001/g,'<mark>').replace(/\\u0003/g,'<mark class="miss">').replace(/[\\u0002\\u0004]/g,'</mark>');
  $('count').textContent=state.plain.length.toLocaleString('ja-JP');
}
function drawSheet(){
  const d=collect(), cv=$('cv');
  const mctx=document.createElement('canvas').getContext('2d');
  KOBO.renderSheet(cv,mctx,d,CAT,state.img,state.plain,CF);
  state.blob=null;
  try{cv.toBlob(b=>{state.blob=b},'image/png');}catch(e){}
  if(state.imgPreview){ try{$('sheetImg').src=cv.toDataURL('image/png');}catch(e){} }
}

`);
  h = must(h, "<script>\n(function(){", `<script>\n${core}\n</script>\n<script>\n(function(){`);
  return h;
}

// 元の登山靴の buildPrompt と、共通部分の shoes の文面が一致するか確かめる
function check() {
  const src = tpl.match(/const ASPECTS=[^\n]*;/)[0] + "\n" + tpl.match(/const SPECS=[^\n]*;/)[0] + "\n" + tpl.match(/const DEFAULTS=[^\n]*;/)[0] + "\n" +
    tpl.slice(tpl.indexOf("const V=s=>"), tpl.indexOf("const esc=s=>"));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + "\nthis.buildPrompt=buildPrompt;", ctx);
  const base = { brand: "B", model: "M", modelJa: "J", color: "C", source: "https://example.com\n重量 1g", reader: "", usage: "" };
  let n = 0, bad = 0;
  for (const aspect of Object.keys(KOBO.ASPECTS)) for (const attach of ["sheet", "photo"]) for (const fixed of [true, false]) for (const spec of [{}, { specWp: "GORE-TEX", specWeight: "480g" }]) for (const empty of [false, true]) {
    const d = { ...(empty ? { brand: "", model: "", modelJa: "", color: "", source: "", reader: "", usage: "" } : base), ...spec, aspect, attach, fixed };
    for (const k of ["specUpper", "specMid", "specOut", "specDrop", "specWp", "specWeight"]) d[k] ??= "";
    n++; if (ctx.buildPrompt(d) !== KOBO.buildPrompt(d, "shoes")) { bad++; if (bad === 1) { const a = ctx.buildPrompt(d), b = KOBO.buildPrompt(d, "shoes"); let i = 0; while (a[i] === b[i]) i++; console.error("差分:", JSON.stringify(a.slice(i - 40, i + 40)), "\n  vs", JSON.stringify(b.slice(i - 40, i + 40))); } }
  }
  console.log(bad ? `不一致 ${bad}/${n}` : `一致 ${n}/${n}`);
  process.exit(bad ? 1 : 0);
}

if (process.argv[2] === "--check") check();
else {
  const out = process.argv[2] || "out/kobo";
  fs.mkdirSync(out, { recursive: true });
  for (const cat of Object.keys(KOBO.CATS)) { fs.writeFileSync(path.join(out, `kobo-${cat}.html`), build(cat)); console.log(path.join(out, `kobo-${cat}.html`)); }
}
