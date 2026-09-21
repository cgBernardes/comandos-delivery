/* =========================================================
   CONFIGURAÇÃO (troque aqui, sem mexer no layout)
   ========================================================= */
const BRAND = "AI Food Studio";
const PRODUCT_NAME = "DELIVERY 1K";
const PRODUCT_TOTAL = 1000;          // exibido como "1.000"
const PRODUCT_PRICE = "27,90";
const BUY_URL = "https://pay.kiwify.com.br/Uufg03i";
const PDF_URL = "assets/100-comandos-de-delivery.pdf";
const INSTAGRAM_URL = "https://instagram.com/ia.thaynnara";
const HERO_EXAMPLES = [
  "/acai-luzamarela-natural",
  "/pizza-flash-vibrante",
  "/burger-fundopoluido-natural",
  "/marmita-desbotada-vibrante"
];

/* =========================================================
   DADOS
   ========================================================= */
const CATEGORIES = window.CATEGORIES || [];
const COMMANDS = window.COMMANDS || [];
if (!CATEGORIES.length || !COMMANDS.length) {
  console.error("data/commands.js não carregou: window.CATEGORIES e window.COMMANDS são obrigatórios.");
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fmtInt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const catBySlug = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));
const isBonus = c => c.numero === "+";
const countIn = slug => COMMANDS.filter(c => c.categoria === slug).length;
const FREE_COUNT = COMMANDS.filter(c => catBySlug[c.categoria] && !isBonus(catBySlug[c.categoria])).length;
const ALL_COUNT = COMMANDS.length;
const BLOCKS_COUNT = CATEGORIES.filter(c => !isBonus(c)).length;

const NUM_WORDS = { 1:"Um", 2:"Dois", 3:"Três", 4:"Quatro", 5:"Cinco", 6:"Seis", 7:"Sete", 8:"Oito", 9:"Nove", 10:"Dez", 11:"Onze", 12:"Doze" };

// índice de busca: nome, descrição, texto do prompt e nome da categoria
const INDEX = COMMANDS.map(c => norm([c.id, c.titulo, c.descricao, c.prompt, (catBySlug[c.categoria] || {}).titulo].join(" ")));

/* =========================================================
   TEXTOS LIGADOS ÀS CONSTANTES
   ========================================================= */
const BIND = {
  name: PRODUCT_NAME,
  total: fmtInt(PRODUCT_TOTAL),
  price: PRODUCT_PRICE,
  free: String(FREE_COUNT),
  all: String(ALL_COUNT)
};
$$("[data-b]").forEach(n => { n.textContent = BIND[n.dataset.b] ?? ""; });
$("#blocksWord").textContent = NUM_WORDS[BLOCKS_COUNT] || String(BLOCKS_COUNT);
$("#freeWord").textContent = FREE_COUNT === 100 ? "cem" : String(FREE_COUNT);
$("#year").textContent = new Date().getFullYear();

/* links de compra, com utm_* preservados */
function withUtm(url) {
  try {
    const u = new URL(url);
    new URLSearchParams(location.search).forEach((v, k) => {
      if (k.toLowerCase().startsWith("utm_")) u.searchParams.set(k, v);
    });
    return u.toString();
  } catch (e) { return url; }
}
$$("[data-buy]").forEach(a => {
  if (BUY_URL) {
    a.href = withUtm(BUY_URL);
  } else {
    a.href = "#";
    a.setAttribute("aria-disabled", "true");
    a.addEventListener("click", e => { e.preventDefault(); console.warn("BUY_URL está vazio: defina o link do checkout em app.js."); });
  }
});
$$("[data-instagram]").forEach(a => { a.href = INSTAGRAM_URL; });
$$("[data-pdf]").forEach(a => {
  if (PDF_URL) {
    a.href = PDF_URL;
    a.setAttribute("download", "");
  } else {
    a.removeAttribute("href");
    a.removeAttribute("download");
    a.setAttribute("aria-disabled", "true");
    a.textContent = "em breve";
  }
});

/* =========================================================
   HERO: chips de exemplo
   ========================================================= */
(function heroChips() {
  const ul = $("#heroChips");
  let picks = HERO_EXAMPLES.map(id => COMMANDS.find(c => c.id === id)).filter(Boolean);
  if (picks.length < 4) {
    const seen = new Set(picks.map(c => c.id));
    for (const c of COMMANDS) { if (picks.length >= 4) break; if (!seen.has(c.id)) { picks.push(c); seen.add(c.id); } }
  }
  picks.slice(0, 4).forEach(c => {
    const li = el("li");
    const b = el("button", "chip", c.id);
    b.type = "button";
    b.addEventListener("click", () => openModal({ cat: c.categoria, cmdId: c.id }));
    li.appendChild(b);
    ul.appendChild(li);
  });
})();

/* =========================================================
   CATEGORIAS (cartões)
   ========================================================= */
(function catCards() {
  const grid = $("#catGrid");
  CATEGORIES.forEach(cat => {
    const list = COMMANDS.filter(c => c.categoria === cat.slug);
    const b = el("button", "cat");
    b.type = "button";
    const num = el("span", "cat__num", cat.numero);
    if (isBonus(cat)) num.appendChild(el("span", "cat__bonus", "BÔNUS"));
    b.appendChild(num);
    b.appendChild(el("span", "cat__title", cat.titulo));
    b.appendChild(el("span", "cat__desc", cat.descricao));
    const chips = el("span", "cat__chips");
    list.slice(0, 3).forEach(c => chips.appendChild(el("span", null, c.id)));
    b.appendChild(chips);
    b.appendChild(el("span", "cat__count", list.length + (list.length === 1 ? " comando →" : " comandos →")));
    b.addEventListener("click", () => openModal({ cat: cat.slug }));
    grid.appendChild(b);
  });
})();

/* =========================================================
   MODAL
   ========================================================= */
const overlay = $("#overlay");
const modal = $(".modal", overlay);
const qInput = $("#q");
const tabsEl = $("#tabs");
const listEl = $("#list");
const countEl = $("#count");
const howEl = $("#how");
const state = { cat: "all", q: "" };
let lastFocus = null;

// "Como usar" aberto na primeira visita, recolhido depois (localStorage é opcional)
try {
  if (localStorage.getItem("af_how_seen")) howEl.open = false;
  else localStorage.setItem("af_how_seen", "1");
} catch (e) { /* sem storage, segue aberto */ }

function buildTabs() {
  tabsEl.textContent = "";
  const mk = (slug, label) => {
    const t = el("button", "tab", label);
    t.type = "button";
    t.setAttribute("role", "tab");
    t.dataset.slug = slug;
    t.addEventListener("click", () => { state.cat = slug; if (state.q) { state.q = ""; qInput.value = ""; } render(); });
    tabsEl.appendChild(t);
  };
  mk("all", "Todos");
  CATEGORIES.forEach(c => mk(c.slug, (isBonus(c) ? "Bônus" : c.numero) + " " + c.titulo));
}

function quoteHighlight(node, text) {
  text.split(/(“[^”]*”)/).forEach(part => {
    if (!part) return;
    if (part.startsWith("“") && part.endsWith("”")) node.appendChild(el("mark", null, part));
    else node.appendChild(document.createTextNode(part));
  });
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* cai no fallback */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

function itemNode(c) {
  const cat = catBySlug[c.categoria];
  const art = el("article", "item");
  art.dataset.id = c.id;

  const top = el("div", "item__top");
  top.appendChild(el("span", "item__id", c.id));
  top.appendChild(el("span", "item__cat", cat ? cat.titulo : ""));
  art.appendChild(top);

  const title = el("p", "item__title");
  title.appendChild(el("strong", null, c.titulo));
  title.appendChild(document.createTextNode(c.descricao ? ": " + c.descricao : ""));
  art.appendChild(title);

  if (c.nota) art.appendChild(el("p", "item__note", c.nota));

  const acts = el("div", "item__acts");
  const copy = el("button", "act act--copy", "copiar o comando inteiro");
  copy.type = "button";
  let timer;
  copy.addEventListener("click", async () => {
    const ok = await copyText(c.prompt);
    clearTimeout(timer);
    copy.textContent = ok ? "copiado ✓" : "não foi possível copiar";
    copy.classList.toggle("done", ok);
    timer = setTimeout(() => { copy.textContent = "copiar o comando inteiro"; copy.classList.remove("done"); }, 2000);
  });
  const toggle = el("button", "act act--ghost", "ver o comando");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  acts.appendChild(copy);
  acts.appendChild(toggle);
  art.appendChild(acts);

  const pre = el("div", "item__prompt");
  pre.hidden = true;
  quoteHighlight(pre, c.prompt);
  art.appendChild(pre);
  toggle.addEventListener("click", () => {
    pre.hidden = !pre.hidden;
    toggle.textContent = pre.hidden ? "ver o comando" : "ocultar o comando";
    toggle.setAttribute("aria-expanded", String(!pre.hidden));
  });
  art._expand = () => { pre.hidden = false; toggle.textContent = "ocultar o comando"; toggle.setAttribute("aria-expanded", "true"); };
  return art;
}

function render() {
  const q = state.q.trim();
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  const activeCat = tokens.length ? "all" : state.cat;

  $$(".tab", tabsEl).forEach(t => t.setAttribute("aria-selected", String(t.dataset.slug === activeCat)));

  let rows = COMMANDS.map((c, i) => ({ c, i }));
  if (tokens.length) rows = rows.filter(r => tokens.every(t => INDEX[r.i].includes(t)));
  else if (activeCat !== "all") rows = rows.filter(r => r.c.categoria === activeCat);

  listEl.textContent = "";
  if (!rows.length) {
    const e = el("div", "empty");
    e.appendChild(el("strong", null, "Nada por aqui com essa palavra."));
    e.appendChild(document.createTextNode("Tente outra, como açaí, pizza, flash, preço ou ifood."));
    listEl.appendChild(e);
  } else {
    const frag = document.createDocumentFragment();
    rows.forEach(r => frag.appendChild(itemNode(r.c)));
    listEl.appendChild(frag);
  }
  listEl.scrollTop = 0;

  if (tokens.length) {
    countEl.textContent = rows.length + (rows.length === 1 ? " resultado" : " resultados");
  } else {
    const label = activeCat === "all" ? "todas as categorias" : catBySlug[activeCat].titulo;
    countEl.textContent = rows.length + " de " + ALL_COUNT + " comandos em " + label;
  }
}

function openModal(opts = {}) {
  lastFocus = document.activeElement;
  state.cat = opts.cat || "all";
  state.q = "";
  qInput.value = "";
  if (!tabsEl.children.length) buildTabs();
  render();
  overlay.hidden = false;
  document.body.classList.add("lock");
  qInput.focus({ preventScroll: true });
  if (opts.cmdId) {
    const node = $(`.item[data-id="${CSS.escape(opts.cmdId)}"]`, listEl);
    if (node) {
      node._expand();
      node.classList.add("flash");
      requestAnimationFrame(() => node.scrollIntoView({ block: "nearest" }));
      setTimeout(() => node.classList.remove("flash"), 2200);
    }
  }
}

function closeModal() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove("lock");
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

$$("[data-open]").forEach(b => b.addEventListener("click", () => openModal({ cat: "all" })));
$("#closeBtn").addEventListener("click", closeModal);
$("#qClear").addEventListener("click", () => {
  if (state.q) { state.q = ""; qInput.value = ""; render(); qInput.focus(); }
  else closeModal();
});
qInput.addEventListener("input", () => { state.q = qInput.value; render(); });
overlay.addEventListener("mousedown", e => { if (e.target === overlay) closeModal(); });
document.addEventListener("keydown", e => {
  if (overlay.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
  if (e.key === "Tab") { // mantém o foco dentro do modal
    const f = $$("button, input, summary, a[href], [tabindex]:not([tabindex='-1'])", modal).filter(n => !n.disabled && n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
