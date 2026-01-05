import { route, setupNimble } from "@bastianplsfix/nimble";

const app = setupNimble([
  route.get("/", () => new Response("Hello from Nimble!")),
  route.get("/health", () => new Response("OK")),
  route.post("/echo", async (req) => {
    const body = await req.text();
    return new Response(body);
  }),
]);

Deno.serve(app.fetch);
