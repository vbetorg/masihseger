export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const origin = url.origin;

    const API_URL = "https://script.google.com/macros/s/AKfycbxXpn0lB80LpLRaJHKBI5wgLjnyGLU-gXC3qTo-MxXBuJlHbTZ10ORuFdnDRl1LB2y5/exec";

    const match = path.match(/^\/artikel\/(.+)$/);
    const slug = match ? match[1] : null;

    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = 12;

    // ======================
    // TEMPLATE LOADER (FIX)
    // ======================
    async function renderTemplate(file, data = {}) {
      const res = await fetch(`${origin}/templates/${file}`);
      if (!res.ok) {
        return `Template ${file} tidak ditemukan`;
      }

      let html = await res.text();

      for (const key in data) {
        html = html.replace(new RegExp(`{{${key}}}`, "g"), data[key]);
      }

      return html;
    }

    // ======================
    // FETCH DATA
    // ======================
    const res = await fetch(API_URL);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
      if (!Array.isArray(data)) data = [];
    } catch {
      return new Response("Bukan JSON:\n" + text);
    }

    // ======================
    // SITEMAP
    // ======================
    if (path === "/sitemap.xml") {
      const items = data.map(item => {
        let s = (item.slug || item.id || "")
          .toString()
          .toLowerCase()
          .replace(/\s+/g, "-");

        return `<url><loc>${origin}/artikel/${s}</loc></url>`;
      }).join("");

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>${origin}/</loc></url>
        ${items}
      </urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }

    // ======================
    // HOMEPAGE
    // ======================
    if (!slug) {
      const start = (page - 1) * perPage;
      const paginated = data.slice(start, start + perPage);

      let cards = "";

      for (const item of paginated) {
        let s = (item.slug || item.id || "")
          .toString()
          .toLowerCase()
          .replace(/\s+/g, "-");

        const title = item.title || "Artikel";
        const desc = (item.meta_description || "").substring(0, 120);
        const image = item.image && item.image.trim() !== ""
          ? item.image
          : "/default.png";

        cards += `
          <a href="/artikel/${s}" class="card">
            <img src="${image}" alt="${title}">
            <h2>${title}</h2>
            <p>${desc}</p>
          </a>
        `;
      }

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = "";
      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}" class="${i === page ? 'active' : ''}">${i}</a>`;
      }

      const html = await renderTemplate("home.html", {
        title: `Blog Artikel - Page ${page}`,
        cards,
        pagination
      });

      return new Response(html, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // ======================
    // ARTIKEL
    // ======================
    const artikel = data.find(item => {
      let s = (item.slug || item.id || "")
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-");
      return s === slug;
    });

    if (!artikel) {
      return new Response("Not found", { status: 404 });
    }

    const title = artikel.title || "Artikel";
    const content = artikel.content || "";
    const desc = artikel.meta_description || content.substring(0, 140);
    const image = artikel.image && artikel.image.trim() !== ""
      ? artikel.image
      : "/default.png";

    const fullUrl = `${origin}/artikel/${slug}`;

    const html = await renderTemplate("artikel.html", {
      title,
      desc,
      content,
      image,
      url: fullUrl
    });

    return new Response(html, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString());
  }
}
