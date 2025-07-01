import { makeOffline, generateServiceWorker } from "./make-offline";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Serve the service worker
    if (url.pathname === "/sw.js") {
      return new Response(generateServiceWorker(), {
        headers: {
          "Content-Type": "application/javascript",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Any HTML page - just wrap with makeOffline()
    if (url.pathname === "/") {
      const html = `
<!DOCTYPE html>
<html>
<head><title>My App</title></head>
<body>
    <h1>Welcome!</h1>
    <p>This automatically works offline!</p>
    <button onclick="fetch('/api/test').then(r=>r.json()).then(console.log)">
        Test API
    </button>
</body>
</html>
      `;

      return new Response(makeOffline(html), {
        headers: { "Content-Type": "text/html;charset=utf8" },
      });
    }

    // Any other endpoint - will be auto-cached
    if (url.pathname === "/api/test") {
      return Response.json({ message: "Hello!", time: Date.now() });
    }

    return new Response("Not Found", { status: 404 });
  },
};
