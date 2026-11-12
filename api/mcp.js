// Stateless Streamable HTTP MCP endpoint for ChatGPT.
// Endpoint: POST /api/mcp
// Auth: Authorization: Bearer <UPLOAD_SECRET>
// Exposes upload_product_image, which forwards image data to the existing
// GitHub upload endpoint. No GitHub token is exposed to the MCP client.

const SERVER_INFO = { name: "tatiana-guevara-boutique", version: "1.0.0" };
const PROTOCOL_VERSION = "2025-03-26";

function send(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(body === undefined ? "" : JSON.stringify(body));
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

const tools = [{
  name: "upload_product_image",
  description: "Guarda una imagen de producto en el repositorio de Tatiana Guevara Boutique y agrega sus datos a productos.json como borrador, sin reemplazar los productos existentes. Acepta JPG, PNG o WebP codificada en base64.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["imageBase64", "mimeType", "nombre"],
    properties: {
      imageBase64: { type: "string", description: "Contenido binario completo de la imagen codificado en base64, sin prefijo data URL." },
      mimeType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
      filename: { type: "string", description: "Nombre sugerido del archivo, opcional." },
      nombre: { type: "string", description: "Nombre del producto." },
      categoria: { type: "string", enum: ["Blusas y Tops", "Bodies", "Corsetería", "Pantalones y Shorts", "Vestidos", "Conjuntos", "Ropa deportiva", "Vestidos de baño", "Pijamas", "Accesorios"] },
      tallas: { type: "array", items: { type: "string" } },
      precio_lista_shein: { type: "number", description: "Precio de lista/tachado de SHEIN, si se conoce." },
      precio_venta: { type: "number", description: "Precio de venta ya calculado, si se conoce." }
    }
  }
}];

async function callUpload(args, req) {
  const origin = (req.headers["x-forwarded-proto"] || "https") + "://" + req.headers.host;
  const response = await fetch(origin + "/api/upload", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.UPLOAD_SECRET,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      imageBase64: args.imageBase64,
      mimeType: args.mimeType,
      filename: args.filename || args.nombre,
      product: {
        nombre: args.nombre,
        categoria: args.categoria,
        tallas: args.tallas || [],
        precio_lista_shein: args.precio_lista_shein,
        precio_venta: args.precio_venta
      }
    })
  });
  const result = await response.json().catch(() => ({ error: "Invalid response from upload service" }));
  if (!response.ok) throw new Error(result.error || "Image upload failed");
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, Mcp-Protocol-Version");
  if (req.method === "OPTIONS") return send(res, 204);
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  const expected = process.env.UPLOAD_SECRET;
  const authorization = req.headers.authorization || "";
  if (!expected || authorization !== "Bearer " + expected) {
    return send(res, 401, { error: "Unauthorized" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (Array.isArray(body)) {
    return send(res, 200, body.map(item => rpcError(item && item.id, -32600, "Batch requests are not supported")));
  }
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return send(res, 400, rpcError(body.id, -32600, "Invalid JSON-RPC request"));
  }

  if (body.method === "notifications/initialized" || body.method.startsWith("notifications/")) {
    return send(res, 202);
  }

  if (body.method === "initialize") {
    return send(res, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Usa upload_product_image para guardar imágenes de productos en el repositorio privado/público configurado. Cada alta queda como borrador. No inventes tallas, precios ni categoría; omite los datos desconocidos."
      }
    });
  }

  if (body.method === "ping") {
    return send(res, 200, { jsonrpc: "2.0", id: body.id, result: {} });
  }

  if (body.method === "tools/list") {
    return send(res, 200, { jsonrpc: "2.0", id: body.id, result: { tools } });
  }

  if (body.method === "tools/call") {
    const name = body.params && body.params.name;
    const args = body.params && body.params.arguments || {};
    if (name !== "upload_product_image") {
      return send(res, 200, rpcError(body.id, -32602, "Unknown tool"));
    }
    if (typeof args.imageBase64 !== "string" || !args.imageBase64.length) {
      return send(res, 200, {
        jsonrpc: "2.0", id: body.id,
        result: { isError: true, content: [{ type: "text", text: "Falta imageBase64. La herramienta necesita recibir los bytes de la imagen en base64." }] }
      });
    }
    try {
      const result = await callUpload(args, req);
      return send(res, 200, {
        jsonrpc: "2.0", id: body.id,
        result: {
          content: [{ type: "text", text: "Imagen guardada en GitHub como borrador. Archivo: " + result.image + ". URL: " + result.imageUrl }],
          structuredContent: result,
          isError: false
        }
      });
    } catch (error) {
      return send(res, 200, {
        jsonrpc: "2.0", id: body.id,
        result: { isError: true, content: [{ type: "text", text: error.message || "No se pudo guardar la imagen." }] }
      });
    }
  }

  return send(res, 200, rpcError(body.id, -32601, "Method not found"));
};

module.exports.config = { api: { bodyParser: { sizeLimit: "4mb" } } };
