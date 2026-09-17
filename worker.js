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

      const userId =
        url.searchParams.get("user_id");

      // ========================================
      // TELEGRAM USER ID REQUIRED
      // ========================================

      if (!userId) {

        return new Response(
          JSON.stringify({
            success: false,
            error: "Telegram user ID missing"
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

      // ========================================
      // CHECK THIS TELEGRAM USER
      // ========================================

      const userRecord =
        await env.IP_DATABASE.get(
          "user:" + userId
        );

      // ========================================
      // SAME TELEGRAM USER ALREADY VERIFIED
      // ========================================

      if (userRecord) {

        const savedUser =
          JSON.parse(userRecord);

        // Same Telegram + same IP
        if (savedUser.ip === ip) {

          return new Response(
            JSON.stringify({
              success: true,
              status: "already_verified",
              ip: ip,
              multiple: false,
              already_verified: true
            }),
            {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
              }
            }
          );

        }

        // Same Telegram but different IP
        // Treat as already verified
        return new Response(
          JSON.stringify({
            success: true,
            status: "already_verified",
            ip: ip,
            multiple: false,
            already_verified: true
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
      // CHECK WHETHER IP BELONGS TO ANOTHER USER
      // ========================================

      const ipRecord =
        await env.IP_DATABASE.get(
          "ip:" + ip
        );

      if (ipRecord) {

        const savedIP =
          JSON.parse(ipRecord);

        // ======================================
        // DIFFERENT TELEGRAM + SAME IP
        // ======================================

        if (
          String(savedIP.user_id) !==
          String(userId)
        ) {

          return new Response(
            JSON.stringify({
              success: true,
              status: "banned",
              ip: ip,
              multiple: true,
              banned: true
            }),
            {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
              }
            }
          );

        }
      }

      // ========================================
      // NEW USER + NEW IP
      // ========================================

      await env.IP_DATABASE.put(
        "user:" + userId,
        JSON.stringify({
          user_id: userId,
          ip: ip,
          first_seen: new Date().toISOString()
        })
      );

      await env.IP_DATABASE.put(
        "ip:" + ip,
        JSON.stringify({
          user_id: userId,
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
          user_id: userId,
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
          already_verified: false,
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
