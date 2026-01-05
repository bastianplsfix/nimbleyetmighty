import { route, setupNimble } from "../packages/core/mod.ts";

const app = setupNimble([
  route.get("/", () => new Response("OK")),
  route.get(
    "/json",
    () =>
      new Response(JSON.stringify({ message: "Hello, World!" }), {
        headers: { "Content-Type": "application/json" },
      }),
  ),
]);

const port = parseInt(Deno.env.get("PORT") || "3000");

console.log(`Benchmark server running on http://localhost:${port}`);
Deno.serve({ port }, app.fetch);
