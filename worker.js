export default {
  async fetch(request, env) {

    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    };

    // =====================================================
    // 🌐 CORS PREFLIGHT
    // =====================================================

    if (request.method === "OPTIONS") {

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });

    }

    // =====================================================
    // 🔍 GET USER IP
    // =====================================================

    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      "unknown";

    // =====================================================
    // 🔧 CREATE VERIFICATION TOKEN
    // =====================================================

    async function createVerificationToken(
      userId,
      userIP
    ) {

      const token =
        crypto.randomUUID();

      await env.IP_DATABASE.put(
        "verify:" + token,
        JSON.stringify({
          user_id: userId,
          ip: userIP,
          created_at: Date.now()
        }),
        {
          expirationTtl: 600
        }
      );

      return token;
    }

    // =====================================================
    // 🔍 API CHECK
    // =====================================================

    if (url.pathname === "/api/check") {

      console.log(
      "🔥 API CHECK REQUEST:",
      request.method,
      url.toString()
    );

      const userId =
        url.searchParams.get("user_id");

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

      // =================================================
      // 🚫 CHECK PERMANENT BAN
      // =================================================

      const bannedUser =
        await env.IP_DATABASE.get(
          "banned:" + userId
        );

      if (bannedUser) {

        return new Response(
          JSON.stringify({
            success: true,
            status: "banned",
            ip: ip,
            multiple: true,
            banned: true,
            permanent: true
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

      // =================================================
      // 👤 CHECK EXISTING USER
      // =================================================

      const userRecord =
        await env.IP_DATABASE.get(
          "user:" + userId
        );

      if (userRecord) {

        const savedUser =
          JSON.parse(userRecord);

        // ===============================================
        // 🌐 IP CHANGED
        // ===============================================

        if (
          savedUser.ip &&
          savedUser.ip !== ip
        ) {

          // ---------------------------------------------
          // 🔍 CHECK NEW IP DATABASE
          // ---------------------------------------------

          const newIPRecord =
            await env.IP_DATABASE.get(
              "ip:" + ip
            );

          if (newIPRecord) {

            const savedIP =
              JSON.parse(newIPRecord);

            // -------------------------------------------
            // 🚫 DIFFERENT USER ALREADY USED THIS IP
            // -------------------------------------------

            if (
              String(savedIP.user_id) !==
              String(userId)
            ) {

              // -----------------------------------------
              // 💾 SAVE PERMANENT BAN
              // -----------------------------------------

              await env.IP_DATABASE.put(
                "banned:" + userId,
                JSON.stringify({
                  user_id: userId,
                  detected_ip: ip,
                  original_user_id:
                    savedIP.user_id,
                  banned_at:
                    new Date().toISOString(),
                  reason:
                    "Multiple account detected"
                })
              );

              return new Response(
                JSON.stringify({
                  success: true,
                  status: "banned",
                  ip: ip,
                  multiple: true,
                  banned: true,
                  permanent: true
                }),
                {
                  status: 403,
                  headers: {
                    ...corsHeaders,
                    "Content-Type":
                      "application/json"
                  }
                }
              );

            }

          }

          // ---------------------------------------------
          // 🆕 NEW IP IS NOT USED BY ANOTHER USER
          // ---------------------------------------------

          const newToken =
            await createVerificationToken(
              userId,
              ip
            );

          return new Response(
            JSON.stringify({
              success: true,
              status: "new_verification",
              ip: ip,
              multiple: false,
              already_verified: false,
              token: newToken
            }),
            {
              headers: {
                ...corsHeaders,
                "Content-Type":
                  "application/json"
              }
            }
          );

        }

        // ===============================================
        // ✅ ALREADY VERIFIED
        // ===============================================

        if (
          savedUser.verified === true
        ) {

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
                "Content-Type":
                  "application/json"
              }
            }
          );

        }

        // ===============================================
        // 🔄 VERIFICATION NOT COMPLETED
        // ===============================================

        const pendingToken =
          await createVerificationToken(
            userId,
            ip
          );

        return new Response(
          JSON.stringify({
            success: true,
            status: "pending",
            ip: ip,
            multiple: false,
            already_verified: false,
            token: pendingToken
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      // =================================================
      // 🌐 NEW USER — CHECK IP DATABASE
      // =================================================

      const ipRecord =
        await env.IP_DATABASE.get(
          "ip:" + ip
        );

      if (ipRecord) {

        const savedIP =
          JSON.parse(ipRecord);

        // ===============================================
        // 🚫 IP BELONGS TO ANOTHER USER
        // ===============================================

        if (
          String(savedIP.user_id) !==
          String(userId)
        ) {

          // ---------------------------------------------
          // 💾 SAVE PERMANENT BAN
          // ---------------------------------------------

          await env.IP_DATABASE.put(
            "banned:" + userId,
            JSON.stringify({
              user_id: userId,
              detected_ip: ip,
              original_user_id:
                savedIP.user_id,
              banned_at:
                new Date().toISOString(),
              reason:
                "Multiple account detected"
            })
          );

          return new Response(
            JSON.stringify({
              success: true,
              status: "banned",
              ip: ip,
              multiple: true,
              banned: true,
              permanent: true
            }),
            {
              status: 403,
              headers: {
                ...corsHeaders,
                "Content-Type":
                  "application/json"
              }
            }
          );

        }

      }

      // =================================================
      // 💾 SAVE NEW USER
      // =================================================

      await env.IP_DATABASE.put(
        "user:" + userId,
        JSON.stringify({
          user_id: userId,
          ip: ip,
          first_seen:
            new Date().toISOString(),
          verified: false
        })
      );

      // =================================================
      // 💾 SAVE IP
      // =================================================

      await env.IP_DATABASE.put(
        "ip:" + ip,
        JSON.stringify({
          user_id: userId,
          first_seen:
            new Date().toISOString()
        })
      );

      // =================================================
      // 🎟️ CREATE VERIFICATION TOKEN
      // =================================================

      const token =
        await createVerificationToken(
          userId,
          ip
        );

      // =================================================
      // ✅ NEW VERIFICATION
      // =================================================

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
            "Content-Type":
              "application/json"
          }
        }
      );

    }

    // =====================================================
    // 🚫 SAFE BAN CHECK
    // =====================================================

    if (url.pathname === "/api/ban-check") {

      const userId =
        url.searchParams.get("user_id");

      if (!userId) {

        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Telegram user ID missing"
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      const bannedUser =
        await env.IP_DATABASE.get(
          "banned:" + userId
        );

      if (bannedUser) {

        return new Response(
          JSON.stringify({
            success: true,
            banned: true,
            permanent: true
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      return new Response(
        JSON.stringify({
          success: true,
          banned: false,
          permanent: false
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }

    // =====================================================
    // 🎟️ VERIFY TOKEN
    // =====================================================

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
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      // =================================================
      // 🔎 GET TOKEN DATA
      // =================================================

      const data =
        await env.IP_DATABASE.get(
          "verify:" + token
        );

      if (!data) {

        return new Response(
          JSON.stringify({
            success: false,
            verified: false,
            error:
              "Invalid or expired token"
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      const verificationData =
        JSON.parse(data);

      const userId =
        verificationData.user_id;

      const verifiedIP =
        verificationData.ip;

      // =================================================
      // 🚫 CHECK BAN BEFORE VERIFY
      // =================================================

      const bannedUser =
        await env.IP_DATABASE.get(
          "banned:" + userId
        );

      if (bannedUser) {

        return new Response(
          JSON.stringify({
            success: false,
            verified: false,
            banned: true,
            permanent: true,
            error:
              "User is permanently banned"
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      // =================================================
      // 🔎 GET USER
      // =================================================

      const userRecord =
        await env.IP_DATABASE.get(
          "user:" + userId
        );

      if (!userRecord) {

        return new Response(
          JSON.stringify({
            success: false,
            verified: false,
            error:
              "User record not found"
          }),
          {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      const savedUser =
        JSON.parse(userRecord);

      // =================================================
      // 🛡️ VERIFY TOKEN IP
      // =================================================

      if (
        savedUser.ip !==
        verifiedIP
      ) {

        savedUser.ip =
          verifiedIP;

        savedUser.ip_updated_at =
          new Date().toISOString();

      }

      // =================================================
      // 🗑️ DELETE ONE-TIME TOKEN
      // =================================================

      await env.IP_DATABASE.delete(
        "verify:" + token
      );

      // =================================================
      // ✅ MARK USER VERIFIED
      // =================================================

      savedUser.verified = true;

      savedUser.verified_at =
        new Date().toISOString();

      await env.IP_DATABASE.put(
        "user:" + userId,
        JSON.stringify(savedUser)
      );

      // =================================================
      // 💾 UPDATE IP DATABASE
      // =================================================

      await env.IP_DATABASE.put(
        "ip:" + verifiedIP,
        JSON.stringify({
          user_id: userId,
          first_seen:
            new Date().toISOString()
        })
      );

      // =================================================
      // ✅ VERIFIED
      // =================================================

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          user_id: userId,
          ip: verifiedIP
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json"
          }
        }
      );

    }

    // =====================================================
    // 🌐 DEFAULT RESPONSE
    // =====================================================

    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        >
        <title>IP Verification API</title>
      </head>
      <body>
        <h1>IP Verification API</h1>
        <p>API is running successfully.</p>
        <p>This API made by @CallJunaeid</p>
      </body>
      </html>`,
      {
        headers: {
          "Content-Type":
            "text/html; charset=UTF-8"
        }
      }
    );

  }
};
