/**
 * Gmail API Client using OAuth 2.0
 * Sends emails as matthias@auto.ki
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

// OAuth Credentials from Google Cloud Console
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Stored refresh token (set after initial authorization)
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Sender email
const SENDER_EMAIL = "matthias@auto.ki";

interface GmailTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// Cache for access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get a valid access token (refreshes if expired)
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Gmail OAuth not configured. Missing CLIENT_ID, CLIENT_SECRET, or REFRESH_TOKEN");
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Gmail access token: ${error}`);
  }

  const data: GmailTokenResponse = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedAccessToken;
}

/**
 * Create a MIME email message
 */
function createMimeMessage(options: {
  to: string;
  subject: string;
  html: string;
  bcc?: string;
}): string {
  // Simple single-part HTML email (more compatible)
  const mimeMessage = [
    `From: Matthias <${SENDER_EMAIL}>`,
    `To: ${options.to}`,
    options.bcc ? `Bcc: ${options.bcc}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(options.subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    options.html,
  ]
    .filter(Boolean)
    .join("\r\n");

  return mimeMessage;
}

/**
 * Send an email via Gmail API
 */
export async function sendGmailEmail(options: {
  to: string;
  subject: string;
  html: string;
  bcc?: string;
}): Promise<{ id: string; threadId: string }> {
  const accessToken = await getAccessToken();
  const mimeMessage = createMimeMessage(options);

  // Base64url encode the message
  const encodedMessage = Buffer.from(mimeMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodedMessage,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Check if Gmail is properly configured
 */
export function isGmailConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

/**
 * Get the OAuth authorization URL for initial setup
 */
export function getGmailAuthUrl(redirectUri: string): string {
  if (!CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID not configured");
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string }> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Gmail OAuth not configured");
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

// ============================================
// Email Templates (same as Resend)
// ============================================

/**
 * Send Thank You email after Discovery Call
 */
export async function sendThankYouDiscoveryEmail(data: {
  to: string;
  vorname: string;
}): Promise<{ id: string; threadId: string }> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Danke für das tolle Gespräch!</h1>

  <p>Hey ${data.vorname},</p>

  <p>vielen Dank, dass du dir die Zeit für unser Discovery Call genommen hast! Es war super, dich kennenzulernen und mehr über deine Ziele zu erfahren.</p>

  <p>Ich hoffe, du konntest einen guten ersten Eindruck gewinnen, wie wir dich unterstützen können. Falls du noch Fragen hast oder direkt loslegen möchtest, melde dich gerne bei mir.</p>

  <p>In der Zwischenzeit kannst du dich gerne in unserer Academy umsehen – dort findest du viele hilfreiche Ressourcen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Ich freue mich auf die weitere Zusammenarbeit!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Matthias von auto.ki</strong></p>
</body>
</html>
  `.trim();

  return sendGmailEmail({
    to: data.to,
    subject: "Danke für das tolle Gespräch!",
    html,
  });
}

/**
 * Send Thank You email after Strategie Call
 */
export async function sendThankYouStrategieEmail(data: {
  to: string;
  vorname: string;
}): Promise<{ id: string; threadId: string }> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Danke für das Strategiegespräch!</h1>

  <p>Hey ${data.vorname},</p>

  <p>vielen Dank für das intensive Strategiegespräch! Es war großartig, gemeinsam an deiner Strategie zu arbeiten und konkrete nächste Schritte zu definieren.</p>

  <p>Ich bin überzeugt, dass wir zusammen Großes erreichen können. Die besprochenen Punkte und Empfehlungen werden dir helfen, deine Ziele schneller zu erreichen.</p>

  <p>Falls du noch Fragen hast oder wir etwas besprechen sollten, bin ich jederzeit für dich da.</p>

  <p>Schau auch gerne in unsere Academy – dort findest du weiterführende Ressourcen zu den besprochenen Themen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Auf eine erfolgreiche Zusammenarbeit!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Matthias von auto.ki</strong></p>
</body>
</html>
  `.trim();

  return sendGmailEmail({
    to: data.to,
    subject: "Danke für das Strategiegespräch!",
    html,
  });
}

/**
 * Send Booking Confirmation email
 */
export async function sendBookingConfirmationEmail(data: {
  to: string;
  vorname: string;
  datum: string;
  uhrzeit: string;
  meetingLink: string;
}): Promise<{ id: string; threadId: string }> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Dein Termin ist bestätigt!</h1>

  <p>Hey ${data.vorname},</p>

  <p>super, dass du einen Termin bei uns gebucht hast! Hier sind die Details:</p>

  <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 0;"><strong>Datum:</strong> ${data.datum}</p>
    <p style="margin: 8px 0 0;"><strong>Uhrzeit:</strong> ${data.uhrzeit} Uhr</p>
  </div>

  <a href="${data.meetingLink}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zum Meeting</a>

  <p>Falls du Fragen hast oder den Termin verschieben musst, melde dich einfach bei mir.</p>

  <p>Bis bald!</p>

  <p style="margin-top: 24px;"><strong>Matthias von auto.ki</strong></p>
</body>
</html>
  `.trim();

  return sendGmailEmail({
    to: data.to,
    subject: "Dein Termin ist bestätigt!",
    html,
  });
}

/**
 * Send 1h Reminder email
 */
export async function send1hReminderEmail(data: {
  to: string;
  vorname: string;
  uhrzeit: string;
  meetingLink: string;
}): Promise<{ id: string; threadId: string }> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">In einer Stunde geht's los!</h1>

  <p>Hey ${data.vorname},</p>

  <p>der Alltag kann ganz schön turbulent sein – deshalb wollten wir uns nochmal kurz bei dir melden. In einer Stunde startet dein Termin:</p>

  <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 0;"><strong>Was:</strong> Discovery Call</p>
    <p style="margin: 8px 0 0;"><strong>Wann:</strong> Heute um ${data.uhrzeit} Uhr</p>
  </div>

  <a href="${data.meetingLink}" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zum Meeting</a>

  <p>Schnapp dir vielleicht noch einen Kaffee, mach den Browser-Tab schon mal auf und dann kann's losgehen. Wir freuen uns, dich gleich zu sehen!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Matthias von auto.ki</strong></p>
</body>
</html>
  `.trim();

  return sendGmailEmail({
    to: data.to,
    subject: "Unser Termin beginnt gleich",
    html,
  });
}
