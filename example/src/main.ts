import { route, setupNimble } from "@bastianplsfix/nimble";

const app = setupNimble([
  route.get("/", () => new Response("Hello from Nimble!")),
  route.get("/users/:id", ({ params }) => {
    const userId = params.id;
    return new Response(`User: ${userId}`);
  }),
  route.get("/health", () => new Response("OK")),
  route.post("/echo", async ({ request }) => {
    const body = await request.text();
    return new Response(body);
  }),
  route.put(
    "/users/:id",
    ({ params }) => new Response(`Updated user ${params.id}`),
  ),
  route.patch(
    "/users/:id",
    ({ params }) => new Response(`Patched user ${params.id}`),
  ),
  route.delete(
    "/users/:id",
    ({ params }) => new Response(`Deleted user ${params.id}`),
  ),
  route.head(
    "/users/:id",
    () => new Response(null, { headers: { "Content-Length": "42" } }),
  ),
  route.options("/api", () =>
    new Response(null, {
      headers: { "Allow": "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
    })),
  // Match any HTTP method on this path
  route.all(
    "/wildcard",
    ({ request }) => new Response(`Received ${request.method} request`),
  ),
  // Custom/non-standard HTTP method using the escape hatch
  route.on(
    "PROPFIND",
    "/webdav",
    () => new Response("WebDAV PROPFIND response"),
  ),
]);

Deno.serve(app.fetch);
