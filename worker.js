export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    // ==========================================
    // IP CHECK API
    // ==========================================

    if (url.pathname === "/api/check") {

      const ip =
        request.headers.get("CF-Connecting-IP") ||
        request.headers.get("X-Forwarded-For") ||
        "unknown";


      // ========================================
      // CHECK IF IP ALREADY EXISTS
      // ========================================

      const existingIP = await env.IP_DATABASE.get(ip);


      // ========================================
      // SAME IP DETECTED
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
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*"
            }
          }
        );

      }


      // ========================================
      // NEW IP → SAVE IT
      // ========================================

      await env.IP_DATABASE.put(
        ip,
        JSON.stringify({
          first_seen: new Date().toISOString()
        })
      );


      return new Response(
        JSON.stringify({
          success: true,
          status: "new",
          ip: ip,
          multiple: false
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }


    // ==========================================
    // API HOME PAGE
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

          a:hover {
            text-decoration: underline;
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
          "Content-Type": "text/html; charset=UTF-8"
        }
      }
    );

  }
};
