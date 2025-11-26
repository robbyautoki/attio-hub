import { NextResponse } from "next/server";
import { getGmailAuthUrl, isGmailConfigured } from "@/lib/integrations/gmail";

/**
 * Start Gmail OAuth Flow
 * Redirects to Google's authorization page
 */
export async function GET() {
  // Check if already configured
  if (isGmailConfigured()) {
    return NextResponse.json({
      status: "configured",
      message: "Gmail is already configured with a refresh token",
    });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/auth/callback/google`;

    const authUrl = getGmailAuthUrl(redirectUri);

    // Redirect to Google
    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate auth URL",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
