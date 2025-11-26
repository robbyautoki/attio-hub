import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail";

/**
 * Google OAuth Callback Handler
 * After authorization, Google redirects here with an authorization code.
 * We exchange it for access + refresh tokens.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Handle errors from Google
  if (error) {
    return NextResponse.json(
      { error: `Google OAuth error: ${error}` },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: "No authorization code provided" },
      { status: 400 }
    );
  }

  try {
    // Determine redirect URI based on environment
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/auth/callback/google`;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // IMPORTANT: Display the refresh token so it can be saved to .env
    // In production, you'd want to store this securely
    return new NextResponse(
      `
<!DOCTYPE html>
<html>
<head>
  <title>Gmail OAuth Success</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #22c55e; margin-bottom: 20px; }
    .token-box {
      background: #1f2937;
      color: #22c55e;
      padding: 15px;
      border-radius: 4px;
      font-family: monospace;
      word-break: break-all;
      margin: 15px 0;
    }
    .instructions {
      background: #fef3c7;
      padding: 15px;
      border-radius: 4px;
      margin-top: 20px;
    }
    .instructions h3 { margin-top: 0; color: #92400e; }
    code {
      background: #e5e7eb;
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Gmail OAuth erfolgreich!</h1>

    <p>Matthias hat erfolgreich den Zugriff auf Gmail autorisiert.</p>

    <h3>Refresh Token:</h3>
    <div class="token-box">${tokens.refresh_token}</div>

    <div class="instructions">
      <h3>Nächste Schritte:</h3>
      <ol>
        <li>Kopiere den Refresh Token oben</li>
        <li>Füge ihn zu deinen Vercel Environment Variables hinzu:
          <br><code>GOOGLE_REFRESH_TOKEN=...</code>
        </li>
        <li>Starte die App neu (Vercel redeploy)</li>
        <li>Emails werden jetzt von matthias@auto.ki gesendet!</li>
      </ol>
    </div>
  </div>
</body>
</html>
      `.trim(),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      {
        error: "Failed to exchange authorization code",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
