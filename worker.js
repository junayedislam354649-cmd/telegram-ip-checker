export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/check") {
      return new Response(
        JSON.stringify({
          success: true,
          status: "ok"
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    return new Response("IP Checker API is running.");
  }
};
