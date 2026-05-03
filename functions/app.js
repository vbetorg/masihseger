export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname;
    const DOMAIN = url.origin;

    const API_URL = "https://script.google.com/macros/s/AKfycbxXpn0lB80LpLRaJHKBI5wgLjnyGLU-gXC3qTo-MxXBuJlHbTZ10ORuFdnDRl1LB2y5/exec";

    const match = path.match(/^\/artikel\/(.+)$/);
    const slug = match ? match[1] : null;

    const page = parseInt(url.searchParams.get("page") || "1");
    const perPage = 12;

    // ======================
    // HELPERS
    // ======================
    const makeSlug = (str) =>
      (str || "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");

    const escapeHtml = (str) =>
      (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const render = (tpl, data) => {
      let html = tpl;
      for (const key in data) {
        html = html.replaceAll(`{{${key}}}`, data[key]);
      }
      return html;
    };

    // ======================
    // LOAD TEMPLATE (FIX)
    // ======================
    const loadTemplate = async (name) => {
      const res = await context.env.ASSETS.fetch(
        new Request(`https://internal/templates/${name}.html`)
      );

      if (!res.ok) {
        throw new Error("Template tidak ditemukan: " + name);
      }

      return await res.text();
    };

    // ======================
    // FETCH API (WITH TIMEOUT)
    // ======================
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let data = [];

    try {
      const res = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeout);

      const text = await res.text();
      const json = JSON.parse(text);

      if (Array.isArray(json)) data = json;
    } catch {
      return new Response("Gagal ambil data API", { status: 500 });
    }

    // ======================
    // HOMEPAGE
    // ======================
    if (!slug) {
      const tpl = await loadTemplate("home");

      const start = (page - 1) * perPage;
      const paginated = data.slice(start, start + perPage);

      let cards = "";

      paginated.forEach(item => {
        const s = makeSlug(item.slug || item.id);

        const title = escapeHtml(item.title || "Artikel");
        const desc = escapeHtml((item.meta_description || "").substring(0, 120));
        const image = item.image || "/default.png";

        cards += `
          <a href="/artikel/${s}">
            <img src="${image}" alt="${title}">
            <h2>${title}</h2>
            <p>${desc}</p>
          </a>
        `;
      });

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = "";

      if (page > 1) {
        pagination += `<a href="/?page=${page - 1}">Prev</a>`;
      }

      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}">${i}</a>`;
      }

      if (page < totalPages) {
        pagination += `<a href="/?page=${page + 1}">Next</a>`;
      }

      const html = render(tpl, {
        title: "Blog Artikel",
        desc: `Kumpulan artikel halaman ${page}`,
        cards,
        pagination
      });

      return new Response(html, {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "public, max-age=300"
        },
      });
    }

    // ======================
    // ARTIKEL
    // ======================
    const artikel = data.find(item =>
      makeSlug(item.slug || item.id) === slug
    );

    if (!artikel) {
      return new Response("Not found", { status: 404 });
    }

    const tpl = await loadTemplate("artikel");

    const title = escapeHtml(artikel.title || "Artikel");
    const desc = escapeHtml(
      artikel.meta_description || (artikel.content || "").substring(0, 140)
    );

    const html = render(tpl, {
      title,
      desc,
      content: artikel.content || "",
      image: artikel.image || "/default.png"
    });

    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "public, max-age=300"
      },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString(), { status: 500 });
  }
}
