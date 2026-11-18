// Cloudflare Worker: public, read-only JSON API for the Vestige scanner.
// Paste this entire file into the Cloudflare Worker editor and Deploy.
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqxE08q7N5Wjv51m_mmoPusiqbdWXYvAMuuEUNh-M-0CCNkkQBU5a6tkyqAXCZ4aYhZn1IRWuiD7sG/pub?gid=1169149957&single=true&output=csv";

function parseCSV(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else {
      if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
      else if (ch !== '\r') field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=30"
    }
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }});
    if (request.method !== "GET") return json({ success: false, error: "Only GET is supported." }, 405);
    try {
      const upstream = await fetch(CSV_URL, { headers: { "Accept": "text/csv" }, cf: { cacheTtl: 30, cacheEverything: true } });
      if (!upstream.ok) throw new Error("Google Sheets returned HTTP " + upstream.status);
      const csv = (await upstream.text()).replace(/^\uFEFF/, "");
      if (!csv || csv.trimStart().startsWith("<!DOCTYPE html") || csv.trimStart().startsWith("<html")) {
        throw new Error("Published CSV did not return CSV data. Check that the products tab is published as CSV.");
      }
      const rows = parseCSV(csv);
      if (rows.length < 2) return json({ success: true, totalProducts: 0, products: [] });
      const headers = rows[0].map(v => String(v).trim().toLowerCase());
      const ni = headers.indexOf("name"), mi = headers.indexOf("mrp"), di = headers.indexOf("dp"), pi = headers.indexOf("pv");
      if ([ni, mi, di, pi].some(i => i < 0)) throw new Error("Required CSV headers missing. Found: " + headers.join(", "));
      const products = rows.slice(1).filter(r => String(r[ni] ?? "").trim()).map(r => ({
        name: String(r[ni] ?? "").trim(),
        MRP: String(r[mi] ?? "").trim(),
        DP: String(r[di] ?? "").trim(),
        pv: String(r[pi] ?? "").trim()
      }));
      return json({ success: true, totalProducts: products.length, products });
    } catch (err) {
      return json({ success: false, error: String(err && err.message ? err.message : err) }, 502);
    }
  }
};
