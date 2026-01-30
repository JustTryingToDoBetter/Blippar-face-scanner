
const statusEl = document.getElementById("status");
const cardEl = document.getElementById("card");

const MARKERS_URL = "/markers.json";

// Open Library “Book API” exists, but is described as legacy in docs; it still works for MVP. :contentReference[oaicite:6]{index=6}
async function fetchBookByISBN(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenLibrary error: ${res.status}`);
  const data = await res.json();
  return data[`ISBN:${isbn}`] ?? null;
}

function renderCard(book, isbn) {
  if (!book) {
    cardEl.innerHTML = `
      <h3>Not found</h3>
      <p>No Open Library data for ISBN: <strong>${isbn}</strong></p>
    `;
    cardEl.classList.remove("hidden");
    return;
  }

  const title = book.title ?? "Unknown title";
  const authors = (book.authors ?? []).map(a => a.name).filter(Boolean).join(", ") || "Unknown author";
  const publishDate = book.publish_date ?? "";
  const pages = book.number_of_pages ? `${book.number_of_pages} pages` : "";
  const cover = book.cover?.medium || book.cover?.small || "";
  const olUrl = book.url ? `https://openlibrary.org${book.url}` : "";

  cardEl.innerHTML = `
    ${cover ? `<img src="${cover}" alt="Cover"/>` : ""}
    <h3>${escapeHtml(title)}</h3>
    <p><strong>Author:</strong> ${escapeHtml(authors)}</p>
    <p>${[publishDate, pages].filter(Boolean).map(escapeHtml).join(" • ")}</p>
    ${olUrl ? `<p><a href="${olUrl}" target="_blank" rel="noreferrer">Open in Open Library</a></p>` : ""}
  `;
  cardEl.classList.remove("hidden");
}

function feedback() {
  // Haptics (mobile)
  try { navigator.vibrate?.(30); } catch {}

  // Tiny beep (safe + short)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 80);
  } catch {}
}


function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

(async function main() {
  const markers = await (await fetch(MARKERS_URL)).json();

  // For MVP: use the one marker in the HTML and read its id from attribute.
  const anchor = document.getElementById("markerAnchor");
  const attr = anchor.getAttribute("webar-marker"); // e.g. {id: "..."} depending on A-Frame parsing
  const markerId = (typeof attr === "string")
    ? attr.split("id:")[1]?.trim()
    : attr?.id;

  if (!markerId) {
    statusEl.textContent = "Marker id not found in scene.";
    return;
  }

  const meta = markers[markerId];
  if (!meta?.isbn) {
    statusEl.textContent = `No ISBN mapped for marker: ${markerId}`;
    return;
  }

  let loaded = false;

  // A-Frame fires events when entities become visible/invisible in many tracking setups.
  // If your setup doesn’t fire these, we can switch to polling anchor.object3D.visible.
  anchor.addEventListener("markerFound", async () => {
    statusEl.textContent = "Book detected. Loading info...";
    if (loaded) return;

    try {
      loaded = true;
      const book = await fetchBookByISBN(meta.isbn);
      renderCard(book, meta.isbn);
      statusEl.textContent = "Detected. Info shown.";
    } catch (e) {
      loaded = false;
      statusEl.textContent = "Detected, but fetch failed.";
      cardEl.innerHTML = `<h3>Error</h3><p>${escapeHtml(e.message)}</p>`;
      cardEl.classList.remove("hidden");
    }
  });

  anchor.addEventListener("markerLost", () => {
    statusEl.textContent = "Marker lost. Point at the cover again.";
    // Optional: hide card when lost
    // cardEl.classList.add("hidden");
    // loaded = false;
  });

  window.addEventListener("load", () => {
    // Try auto-start; if blocked, user can tap Start
    start();
  });


  statusEl.textContent = "Ready. Scan the registered cover.";
})();