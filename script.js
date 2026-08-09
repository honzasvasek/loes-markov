// Het atelier, in vaste secties: eerst het nieuwste werk, dan wat ze zichzelf
// schreef, dan wat is weggegooid.
//
// Dit was eerst één stroom waarin werk, gedachten en afgekeurd werk op
// cyclusnummer door elkaar stonden. Dat leverde 56 items op waarvan het bovenste
// meestal een weggegooid beeld was — je landde op de mislukkingen in plaats van
// op het werk. De afwisseling was het idee; de chaos was het gevolg.

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
  toonWerk(data.werk || []);
  toonGedachten(data.notities || []);
  toonWeg(data.afgekeurd || []);
  toonEerder(data.afgesloten || []);
  toonIdentiteit(data.identiteit || []);
  toonMetingen(data.metingen || {});
  wireLichtbak();
}

function toonOnderzoek(o) {
  if (!o) return;
  $("onderzoek-titel").textContent = o.titel;
  $("onderzoek-vraag").textContent = o.vraag;
  const uitleg =
    o.modus === "uitputten"
      ? "ik bijt me hierin vast en melk het uit"
      : "ik zoek de randen op";
  $("onderzoek-meta").innerHTML =
    `<span class="modus">${esc(o.modus)}</span>${esc(uitleg)} — begonnen in cyclus ${o.begonnen_cyclus}`;
  $("onderzoek").hidden = false;
}

function vulRaster(el, items, maakHtml, opBeeld) {
  el.innerHTML = "";
  for (const item of items) {
    const kaart = document.createElement("article");
    kaart.className = "kaart";
    kaart.innerHTML = maakHtml(item);
    const img = kaart.querySelector("img");
    if (img) img.addEventListener("click", () => opBeeld(item));
    el.appendChild(kaart);
  }
}

function toonWerk(werk) {
  // data.json levert al op cyclus aflopend; niet opnieuw sorteren, dan blijft
  // er één plek waar de volgorde vandaan komt.
  vulRaster($("werk"), werk, werkHtml, openLichtbak);
}

function werkHtml(w) {
  // Titel en beschrijving, geen prompt: de prompt is machinerie en zei de
  // bezoeker niets over het beeld. Wat er wél toe doet is hoe zij het noemt en
  // wat zij erin ziet.
  const titel = w.titel ? `<h3 class="titel">${esc(w.titel)}</h3>` : "";
  return `
    <figure><img src="${esc(w.bestand)}" loading="lazy" alt="${esc(w.beschrijving)}"></figure>
    ${titel}
    <p class="gezien">${esc(w.beschrijving)}</p>
    <p class="cyclus">cyclus ${w.cyclus}</p>`;
}

function toonGedachten(notities) {
  if (!notities.length) return;
  $("gedachten-lijst").innerHTML = notities
    .map(
      (n) => `
      <article class="gedachte">
        <p>${esc(n.tekst)}</p>
        <p class="cyclus">${esc(n.soort)} · cyclus ${n.cyclus}</p>
      </article>`
    )
    .join("");
  $("gedachten").hidden = false;
}

function toonWeg(afgekeurd) {
  if (!afgekeurd.length) return;
  vulRaster($("weg-lijst"), afgekeurd, wegHtml, openLichtbak);
  $("weg").hidden = false;
}

function wegHtml(a) {
  const reden =
    a.afkeuringsreden === "cliche"
      ? a.cliche_notities
      : lijstjeUitNotities(a.tech_notities).join("; ");
  return `
    <figure><img src="${esc(a.bestand)}" loading="lazy" alt="Afgekeurd werk uit cyclus ${a.cyclus}"></figure>
    <p class="reden">${esc(reden || (a.afkeuringsreden === "cliche" ? "te veel ansichtkaart" : "technisch kapot"))}</p>`;
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
        <summary><span>${v.versie === 0 ? "grondslag" : "versie " + v.versie}</span><span>${
          v.versie === 0 ? "vast" : i === 0 ? "nu" : "eerder"
        }</span></summary>
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
