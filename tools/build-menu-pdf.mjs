// Gera assets/cardapio.pdf a partir de js/menu-data.js (mesmos dados do site).
// Uso: node tools/build-menu-pdf.mjs   (requer o pacote "playwright" com Chromium)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(root, "js/menu-data.js"), "utf8"), ctx);
const MENU = ctx.window.MENU;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const logo = readFileSync(join(root, "assets/favicon.svg"), "utf8");

const sections = Object.values(MENU)
  .map(
    (cat) => `<section><h2>${esc(cat.label)}</h2>${cat.items
      .map(
        (it) => `<div class="item"><div class="row"><h3>${esc(it.name)}${it.chef ? ' <span class="chef">★ chef</span>' : ""}</h3><span class="dots"></span><span class="price">R$ ${it.price}</span></div><p>${esc(it.desc)}</p></div>`
      )
      .join("")}</section>`
  )
  .join("");

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Montserrat:wght@300;500&family=Pinyon+Script&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #0A0908; color: #F5F1EA; font: 300 10.5pt/1.5 Montserrat, sans-serif; }
.page { padding: 22mm 20mm; min-height: 297mm; }
header { text-align: center; margin-bottom: 12mm; }
header svg { width: 22mm; height: 22mm; }
header h1 { font: 600 30pt/1 "Cormorant Garamond", serif; letter-spacing: .2em; margin: 4mm 0 1mm; }
header .tag { font-size: 7pt; letter-spacing: .4em; text-transform: uppercase; color: #A8A29E; }
header .script { font: 26pt "Pinyon Script", cursive; color: #C9A24A; margin-top: 4mm; }
.cols { columns: 2; column-gap: 14mm; }
section { break-inside: avoid; margin-bottom: 9mm; }
h2 { font: 500 17pt "Cormorant Garamond", serif; text-transform: uppercase; letter-spacing: .12em; color: #C9A24A; border-bottom: 1px solid rgba(255,255,255,.12); padding-bottom: 2mm; margin: 0 0 3mm; }
.item { margin-bottom: 3mm; }
.row { display: flex; align-items: baseline; gap: 2mm; }
h3 { font: 500 13pt "Cormorant Garamond", serif; margin: 0; }
.chef { font: 500 6.5pt Montserrat, sans-serif; letter-spacing: .15em; text-transform: uppercase; color: #C9A24A; vertical-align: middle; }
.dots { flex: 1; border-bottom: 1px dotted rgba(168,162,158,.5); transform: translateY(-1mm); }
.price { font: 600 12pt "Cormorant Garamond", serif; color: #E6C77A; }
p { margin: .5mm 0 0; color: #A8A29E; font-size: 8.5pt; }
footer { text-align: center; margin-top: 8mm; font-size: 7.5pt; color: #A8A29E; letter-spacing: .1em; }
</style></head><body><div class="page">
<header>${logo}<h1>SUSHI</h1><div class="tag">Japanese Restaurant</div><div class="script">Cardápio</div></header>
<div class="cols">${sections}</div>
<footer>Preços em reais · Sujeito à disponibilidade do peixe do dia · Rua das Cerejeiras, 120 — São Paulo/SP · (11) 99999-9999</footer>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.pdf({ path: join(root, "assets/cardapio.pdf"), format: "A4", printBackground: true });
await browser.close();
console.log("assets/cardapio.pdf gerado");
