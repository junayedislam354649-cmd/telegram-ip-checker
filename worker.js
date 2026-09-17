export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // ==========================================
    // CORS
    // ==========================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }

    // ==========================================
    // IP CHECK
    // ==========================================

    if (url.pathname === "/api/check") {

      const ip =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("X-Forwarded-For") ||
        "unknown";

      // Check existing IP
      const existingIP =
        await env.IP_DATABASE.get(ip);

      // ========================================
      // MULTIPLE DETECTED
      // ========================================

      if (existingIP) {

        return new Response(
          JSON.stringify({
            success: true,
            status: "multiple",
            ip: ip,
            multiple: true
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      // ========================================
      // NEW IP
      // ========================================

      await env.IP_DATABASE.put(
        ip,
        JSON.stringify({
          first_seen: new Date().toISOString()
        })
      );

      // ========================================
      // CREATE VERIFICATION TOKEN
      // ========================================

      const token =
        crypto.randomUUID();

      await env.IP_DATABASE.put(
        "verify:" + token,
        JSON.stringify({
          ip: ip,
          created_at: Date.now()
        }),
        {
          expirationTtl: 600
        }
      );

      return new Response(
        JSON.stringify({
          success: true,
          status: "new",
          ip: ip,
          multiple: false,
          token: token
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    // ==========================================
    // VERIFY TOKEN
    // ==========================================

    if (url.pathname === "/api/verify") {

      const token =
        url.searchParams.get("token");

      if (!token) {

        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing token"
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      const data =
        await env.IP_DATABASE.get(
          "verify:" + token
        );

      if (!data) {

        return new Response(
          JSON.stringify({
            success: false,
            verified: false,
            error: "Invalid or expired token"
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      // One-time token
      await env.IP_DATABASE.delete(
        "verify:" + token
      );

      return new Response(
        JSON.stringify({
          success: true,
          verified: true
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    // ==========================================
    // API HOME
    // ==========================================

    return new Response(
      `
      <!DOCTYPE html>
      <html>

      <head>
        <title>IP Checker API</title>

        <style>

          body {
            background: #0b0f14;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            padding-top: 80px;
          }

          .box {
            max-width: 500px;
            margin: auto;
            padding: 30px;
          }

          h1 {
            font-size: 28px;
          }

          p {
            color: #9aa4b2;
          }

          a {
            color: #5ca9ff;
            text-decoration: none;
            font-weight: bold;
          }

        </style>

      </head>

      <body>

        <div class="box">

          <h1>🚀 IP Checker API</h1>

          <p>
            API is running successfully.
          </p>

          <p>
            This API made by
            <a
              href="https://t.me/CallJunaeid"
              target="_blank"
            >
              @CallJunaeid
            </a>
          </p>

        </div>

      </body>

      </html>
      `,
      {
        headers: {
          "Content-Type":
            "text/html; charset=UTF-8"
        }
      }
    );

  }
};
