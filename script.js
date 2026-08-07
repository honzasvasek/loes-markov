// Het atelier: gedachten, werk en weggegooid werk door elkaar, op cyclus
// gesorteerd. De volgorde is bewust chronologisch en niet per soort gegroepeerd
// — juist de afwisseling van denken en maken is wat er te zien valt.

const $ = (id) => document.getElementById(id);

function esc(tekst) {
  const d = document.createElement("div");
  d.textContent = tekst == null ? "" : String(tekst);
  return d.innerHTML;
}

function lijstjeUitNotities(tekst) {
  // tech_notities komt uit de db als een python-achtige lijst-string.
  if (!tekst) return [];
  const schoon = String(tekst).trim();
  if (!schoon || schoon === "[]") return [];
  const treffers = schoon.match(/'([^']+)'|"([^"]+)"/g);
  if (treffers) return treffers.map((t) => t.slice(1, -1));
  return [schoon];
}

function toonBijgewerkt(iso) {
  const el = $("bijgewerkt");
  if (!el) return;
  if (!iso) { el.textContent = "onbekend"; return; }
  const d = new Date(iso);
  el.textContent = isNaN(d)
    ? iso
    : d.toLocaleString("nl-NL", {
        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      });
}

async function start() {
  let data;
  try {
    // cache: "no-cache" laat de browser altijd bij de server navragen (ETag,
    // dus meestal een goedkope 304). Zonder dit hield de browser data.json
    // vast en zag je oud werk terwijl de site allang bijgewerkt was — alleen
    // met een harde refresh te omzeilen, en dat kun je van niemand vragen.
    data = await (await fetch("data.json", { cache: "no-cache" })).json();
  } catch (err) {
    $("laden").textContent = "het atelier is even niet bereikbaar";
    return;
  }

  toonBijgewerkt(data.bijgewerkt);
  toonOnderzoek(data.onderzoek);
  toonStroom(data);
  toonEerder(data.afgesloten || []);
  toonIdentiteit(data.identiteit || []);
  toonMetingen(data.metingen || {});
  wireFilters();
  wireLichtbak();
}

function toonOnderzoek(o) {
  if (!o) return;
  $("onderzoek-titel").textContent = o.titel;
  $("onderzoek-vraag").textContent = o.vraag;
  $("onderzoek-aanleiding").textContent = o.aanleiding || "";
  const uitleg =
    o.modus === "uitputten"
      ? "ik bijt me hierin vast en melk het uit"
      : "ik zoek de randen op";
  $("onderzoek-meta").innerHTML =
    `<span class="modus">${esc(o.modus)}</span>${esc(uitleg)} — begonnen in cyclus ${o.begonnen_cyclus}`;
  $("onderzoek").hidden = false;
}

function toonStroom(data) {
  const items = [];

  for (const n of data.notities || []) {
    items.push({ cyclus: n.cyclus, soort: "gedachten", html: gedachteHtml(n) });
  }
  for (const w of data.werk || []) {
    items.push({ cyclus: w.cyclus, soort: "werk", html: werkHtml(w), beeld: w });
  }
  for (const a of data.afgekeurd || []) {
    items.push({ cyclus: a.cyclus, soort: "afgekeurd", html: wegHtml(a), beeld: a });
  }

  items.sort((a, b) => b.cyclus - a.cyclus);

  const stroom = $("stroom");
  stroom.innerHTML = "";
  for (const item of items) {
    const el = document.createElement("article");
    el.className = `item ${item.soort === "gedachten" ? "gedachte" : "werk"}`;
    if (item.soort === "afgekeurd") el.classList.add("weg");
    if (item.beeld && item.beeld.gekozen) el.classList.add("gekozen");
    el.dataset.cyclus = `c${item.cyclus}`;
    el.dataset.soort = item.soort;
    el.innerHTML = item.html;
    const img = el.querySelector("img");
    if (img && item.beeld) img.addEventListener("click", () => openLichtbak(item.beeld));
    stroom.appendChild(el);
  }
  $("filters").hidden = false;
}

function gedachteHtml(n) {
  return `<span class="soort">${esc(n.soort)}</span><p>${esc(n.tekst)}</p>`;
}

function werkHtml(w) {
  const stempel = w.gekozen
    ? '<span class="stempel">dit liet ik zien</span>'
    : '<span class="stempel stil">gemaakt, niet gekozen</span>';
  const gebreken = lijstjeUitNotities(w.tech_notities);
  const oordeel = gebreken.length
    ? `<p class="oordeel">Wat er technisch niet klopt: ${esc(gebreken.join("; "))}.</p>`
    : "";
  return `
    ${stempel}
    <figure><img src="${esc(w.bestand)}" loading="lazy" alt="${esc(w.beschrijving)}"></figure>
    <p class="opdracht"><span class="label">de zin die ik mezelf gaf</span>${esc(w.prompt)}</p>
    <p class="gezien">${esc(w.beschrijving)}</p>
    ${oordeel}`;
}

function wegHtml(a) {
  const reden =
    a.afkeuringsreden === "cliche"
      ? a.cliche_notities
      : lijstjeUitNotities(a.tech_notities).join("; ");
  const kop =
    a.afkeuringsreden === "cliche"
      ? "weggegooid — te veel ansichtkaart"
      : "weggegooid — technisch kapot";
  return `
    <span class="stempel">${esc(kop)}</span>
    <figure><img src="${esc(a.bestand)}" loading="lazy" alt="Afgekeurd werk uit cyclus ${a.cyclus}"></figure>
    <p class="opdracht"><span class="label">de zin die ik mezelf gaf</span>${esc(a.prompt)}</p>
    ${reden ? `<p class="reden">${esc(reden)}</p>` : ""}`;
}

function toonEerder(lijst) {
  if (!lijst.length) return;
  $("eerder-lijst").innerHTML = lijst
    .map(
      (o) => `
      <article>
        <h3>${esc(o.titel)}</h3>
        <p class="bevinding">${esc(o.bevinding || o.vraag)}</p>
        <p class="duur">cyclus ${o.begonnen_cyclus} tot ${o.geeindigd_cyclus}</p>
      </article>`
    )
    .join("");
  $("eerder").hidden = false;
}

function toonIdentiteit(versies) {
  if (!versies.length) return;
  $("identiteit-lijst").innerHTML = versies
    .slice()
    .reverse()
    .map(
      (v, i) => `
      <details${i === 0 ? " open" : ""}>
        <summary><span>versie ${v.versie}</span><span>${i === 0 ? "nu" : "eerder"}</span></summary>
        <pre>${esc(v.tekst.replace(/^#.*\n/, "").trim())}</pre>
      </details>`
    )
    .join("");
  $("identiteit").hidden = false;
}

function toonMetingen(m) {
  const labels = {
    cycli: "cycli gedraaid",
    gemaakt: "beelden gemaakt",
    gekozen: "zelf gekozen",
    afgekeurd: "weggegooid",
    corpus: "zinnen in omloop",
    notities: "aantekeningen",
  };
  const rijen = Object.entries(labels)
    .filter(([k]) => m[k] !== undefined)
    .map(([k, label]) => `<div><dt>${label}</dt><dd>${m[k]}</dd></div>`)
    .join("");
  if (!rijen) return;
  $("metingen-lijst").innerHTML = rijen;
  $("metingen").hidden = false;
}

function wireFilters() {
  const knoppen = document.querySelectorAll(".filters button");
  knoppen.forEach((knop) => {
    knop.addEventListener("click", () => {
      knoppen.forEach((k) => k.classList.toggle("actief", k === knop));
      const filter = knop.dataset.filter;
      document.querySelectorAll(".stroom .item").forEach((item) => {
        item.hidden = filter !== "alles" && item.dataset.soort !== filter;
      });
    });
  });
}

function openLichtbak(beeld) {
  $("lichtbak-img").src = beeld.bestand;
  $("lichtbak-tekst").textContent = beeld.beschrijving || beeld.cliche_notities || "";
  $("lichtbak").hidden = false;
}

function wireLichtbak() {
  const sluit = () => ($("lichtbak").hidden = true);
  $("lichtbak-sluit").addEventListener("click", sluit);
  $("lichtbak").addEventListener("click", (e) => {
    if (e.target.id === "lichtbak") sluit();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") sluit();
  });
}

start();
