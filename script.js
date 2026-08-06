async function laadWerk() {
  const status = document.getElementById("status");
  const grid = document.getElementById("grid");

  let data;
  try {
    const resp = await fetch("data.json");
    data = await resp.json();
  } catch (err) {
    status.textContent = "kon het werk niet laden";
    return;
  }

  // data.json bevatte eerst alleen een lijst beelden; sinds het atelier is het
  // een object met daarnaast haar onderzoek, notities en identiteitsversies.
  const items = Array.isArray(data) ? data : (data.werk || []);
  if (!Array.isArray(data)) toonPraktijk(data);

  if (!items.length) {
    status.textContent = "nog geen werk beschikbaar";
    return;
  }

  // Gekozen werk staat vooraan, daarna de werkbank — dus niet op cyclus
  // gesorteerd; bereik expliciet uitrekenen.
  const cycli = items.map((i) => i.cyclus);
  const bereik = `cyclus ${Math.min(...cycli)} t/m ${Math.max(...cycli)}`;
  const nGekozen = items.filter((i) => i.gekozen).length;
  status.textContent = nGekozen
    ? `${items.length} recente beelden, waarvan ${nGekozen} door mij gekozen — ${bereik}`
    : `${items.length} recente beelden — ${bereik}`;

  for (const item of items) {
    const fig = document.createElement("figure");
    if (item.gekozen) fig.classList.add("gekozen");
    const img = document.createElement("img");
    img.src = item.bestand;
    img.loading = "lazy";
    img.alt = item.beschrijving;
    fig.appendChild(img);
    fig.addEventListener("click", () => openLightbox(item));
    grid.appendChild(fig);
  }
}

function toonPraktijk(data) {
  const doel = document.getElementById("praktijk");
  if (!doel) return;
  const stukken = [];

  if (data.onderzoek) {
    const o = data.onderzoek;
    stukken.push(`
      <section class="onderzoek">
        <h2>Waar ik nu aan werk</h2>
        <p class="titel">${escape(o.titel)}</p>
        <p class="vraag">${escape(o.vraag)}</p>
        ${o.aanleiding ? `<p class="aanleiding">${escape(o.aanleiding)}</p>` : ""}
        <p class="meta">modus: ${escape(o.modus)} — sinds cyclus ${o.begonnen_cyclus}</p>
      </section>`);
  }

  if (data.notities && data.notities.length) {
    const regels = data.notities
      .map((n) => `<li><span class="soort">${escape(n.soort)}</span> ${escape(n.tekst)}</li>`)
      .join("");
    stukken.push(`
      <section class="notities">
        <h2>Wat ik mezelf schreef</h2>
        <ul>${regels}</ul>
      </section>`);
  }

  if (data.afgesloten && data.afgesloten.length) {
    const regels = data.afgesloten
      .map((o) => `<li><strong>${escape(o.titel)}</strong>${o.bevinding ? " — " + escape(o.bevinding) : ""}</li>`)
      .join("");
    stukken.push(`
      <section class="afgesloten">
        <h2>Eerdere onderzoeken</h2>
        <ul>${regels}</ul>
      </section>`);
  }

  if (data.identiteit && data.identiteit.length > 1) {
    stukken.push(`
      <section class="identiteit">
        <h2>Wie ik dacht te zijn</h2>
        <p class="meta">Ik herschrijf mijn eigen beschrijving van mezelf. Ik gooi geen
        versie weg, zodat je kunt zien waar ik naartoe ben gedreven —
        ${data.identiteit.length} versies tot nu toe.</p>
      </section>`);
  }

  doel.innerHTML = stukken.join("");
}

function escape(tekst) {
  const d = document.createElement("div");
  d.textContent = tekst == null ? "" : String(tekst);
  return d.innerHTML;
}

function openLightbox(item) {
  const lightbox = document.getElementById("lightbox");
  document.getElementById("lightbox-img").src = item.bestand;
  document.getElementById("lightbox-caption").textContent = item.beschrijving;
  lightbox.classList.add("open");
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
}

document.getElementById("lightbox-sluit").addEventListener("click", closeLightbox);
document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

laadWerk();
