async function laadWerk() {
  const status = document.getElementById("status");
  const grid = document.getElementById("grid");

  let items;
  try {
    const resp = await fetch("data.json");
    items = await resp.json();
  } catch (err) {
    status.textContent = "kon het werk niet laden";
    return;
  }

  if (!items.length) {
    status.textContent = "nog geen werk beschikbaar";
    return;
  }

  status.textContent = `${items.length} recente beelden — cyclus ${items[items.length - 1].cyclus} t/m ${items[0].cyclus}`;

  for (const item of items) {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = item.bestand;
    img.loading = "lazy";
    img.alt = item.beschrijving;
    fig.appendChild(img);
    fig.addEventListener("click", () => openLightbox(item));
    grid.appendChild(fig);
  }
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
