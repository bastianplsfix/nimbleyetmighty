import { route, setupNimble } from "../packages/core/mod.ts";

const app = setupNimble([]);

const port = parseInt(Deno.env.get("PORT") || "8000");

console.log(`Benchmark server running on http://localhost:${port}`);
Deno.serve({ port }, app.fetch);
