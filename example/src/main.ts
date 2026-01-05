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
]);

Deno.serve(app.fetch);
