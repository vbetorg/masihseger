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

    const render = (tpl, data) => {
      let html = tpl;
      for (const key in data) {
        html = html.replaceAll(`{{${key}}}`, data[key]);
      }
      return html;
    };

    // ======================
    // LOAD TEMPLATE
    // ======================
    const loadTemplate = async (name) => {
      const res = await fetch(`${DOMAIN}/templates/${name}.html`);
      return await res.text();
    };

    // ======================
    // FETCH DATA
    // ======================
    const res = await fetch(API_URL);
    const data = await res.json();

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

        cards += `
          <a href="/artikel/${s}">
            <h2>${item.title}</h2>
          </a>
        `;
      });

      const totalPages = Math.ceil(data.length / perPage);

      let pagination = "";
      for (let i = 1; i <= totalPages; i++) {
        pagination += `<a href="/?page=${i}">${i}</a>`;
      }

      const html = render(tpl, {
        title: "Blog Artikel",
        desc: "Kumpulan artikel",
        cards,
        pagination
      });

      return new Response(html, {
        headers: { "content-type": "text/html" },
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

    const html = render(tpl, {
      title: artikel.title,
      desc: artikel.meta_description || "",
      content: artikel.content || "",
      image: artikel.image || "/default.png"
    });

    return new Response(html, {
      headers: { "content-type": "text/html" },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString(), { status: 500 });
  }
}
