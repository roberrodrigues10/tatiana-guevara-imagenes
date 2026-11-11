// Vercel serverless endpoint for adding product images to the boutique image repository.
// POST JSON: { filename, mimeType, imageBase64, product: { nombre, categoria, precio_lista_shein, precio_venta, tallas } }
// Authentication: Authorization: Bearer <UPLOAD_SECRET>
// GITHUB_TOKEN must be a fine-grained token with Contents: Read and write for this repository.

const OWNER = "roberrodrigues10";
const REPO = "tatiana-guevara-imagenes";
const BRANCH = "main";
const MANIFEST = "productos.json";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const ALLOWED_MIME = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function safeSlug(value) {
  return String(value || "producto")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 55) || "producto";
}

async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) {
    const error = new Error(data.message || `GitHub API error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const uploadSecret = process.env.UPLOAD_SECRET;
  const githubToken = process.env.GITHUB_TOKEN;
  if (!uploadSecret || !githubToken) return json(res, 503, { error: "Server secrets are not configured" });

  const auth = req.headers.authorization || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!supplied || supplied !== uploadSecret) return json(res, 401, { error: "Unauthorized" });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { imageBase64, mimeType, filename, product } = body;
    const extension = ALLOWED_MIME.get(mimeType);
    if (!extension) return json(res, 400, { error: "mimeType must be image/jpeg, image/png, or image/webp" });
    if (typeof imageBase64 !== "string" || !imageBase64.trim()) return json(res, 400, { error: "imageBase64 is required" });

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
    const imageBuffer = Buffer.from(cleanBase64, "base64");
    if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_BYTES) return json(res, 413, { error: "Image must be between 1 byte and 3 MB" });
    if (imageBuffer.toString("base64").replace(/=+$/, "") !== cleanBase64.replace(/=+$/, "")) {
      return json(res, 400, { error: "Invalid base64 image data" });
    }

    const details = product && typeof product === "object" ? product : {};
    const title = String(details.nombre || filename || "Producto").trim().slice(0, 120);
    const category = String(details.categoria || "").trim();
    const categories = ["Blusas y Tops", "Bodies", "Corsetería", "Pantalones y Shorts", "Vestidos", "Conjuntos", "Ropa deportiva", "Vestidos de baño", "Pijamas", "Accesorios"];
    if (category && !categories.includes(category)) return json(res, 400, { error: "Invalid category" });

    const baseName = safeSlug(filename || title).replace(/\.(jpg|jpeg|png|webp)$/i, "");
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const imagePath = `${baseName}-${stamp}.${extension}`;

    // Create the image first. The timestamped path avoids overwriting prior images.
    await github(imagePath, githubToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Agregar imagen de producto: ${imagePath}`,
        content: imageBuffer.toString("base64"),
        branch: BRANCH,
      }),
    });

    // Append a draft entry, preserving all existing products.
    const manifestFile = await github(MANIFEST, githubToken);
    const manifest = JSON.parse(Buffer.from(manifestFile.content, "base64").toString("utf8"));
    if (!manifest || !Array.isArray(manifest.productos)) throw new Error("productos.json has an invalid format");

    const entry = {
      imagen: imagePath,
      nombre: title,
      categoria: category || "Pendiente de clasificar",
      tallas: Array.isArray(details.tallas) ? details.tallas.map(String) : [],
      estado: "draft",
    };
    if (Number.isFinite(Number(details.precio_lista_shein)) && details.precio_lista_shein !== "") {
      entry.precio_lista_shein = Number(details.precio_lista_shein);
    }
    if (Number.isFinite(Number(details.precio_venta)) && details.precio_venta !== "") {
      entry.precio_venta = Number(details.precio_venta);
    }
    manifest.productos.push(entry);

    await github(MANIFEST, githubToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Registrar borrador: ${title}`,
        content: Buffer.from(JSON.stringify(manifest, null, 2) + "\n").toString("base64"),
        sha: manifestFile.sha,
        branch: BRANCH,
      }),
    });

    return json(res, 201, {
      success: true,
      image: imagePath,
      product: entry,
      imageUrl: `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${imagePath}`,
      status: "draft",
    });
  } catch (error) {
    console.error("Image upload failed:", error);
    return json(res, error.status || 500, { error: error.message || "Upload failed" });
  }
};
