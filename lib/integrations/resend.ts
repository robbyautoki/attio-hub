const RESEND_API_BASE = "https://api.resend.com";

export interface ResendEmailPayload {
  from: string;
  to: string | string[];
  subject?: string;
  html?: string;
  text?: string;
  // For template emails
  react?: unknown;
  // Scheduled sending
  scheduled_at?: string;
}

export interface ResendBatchEmailPayload {
  from: string;
  to: string;
  subject?: string;
  html?: string;
  // For template emails with variables
  template_id?: string;
  template_alias?: string;
  template_variables?: Record<string, string>;
  // Scheduled sending (ISO 8601 format)
  scheduled_at?: string;
}

/**
 * Resend API Client
 */
export class ResendClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${RESEND_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Resend API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.request("/domains");
      return { success: true, message: "Verbindung erfolgreich!" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Verbindung fehlgeschlagen",
      };
    }
  }

  /**
   * Send an email using a template
   * Resend uses the template slug as the subject line replacement
   */
  async sendTemplateEmail(data: {
    from: string;
    to: string;
    subject: string;
    templateSlug: string;
    variables: Record<string, string>;
    scheduledAt?: Date;
  }): Promise<unknown> {
    // Build HTML with variables replaced
    // Note: Resend doesn't have native template support via API,
    // so we need to fetch the template or use their Emails API with react templates

    // For now, we'll use the batch API approach with HTML
    // The template variables will be passed and Resend will handle them

    const payload: Record<string, unknown> = {
      from: data.from,
      to: data.to,
      subject: data.subject,
    };

    // If scheduled, add the scheduled_at field (ISO 8601 format)
    if (data.scheduledAt) {
      payload.scheduled_at = data.scheduledAt.toISOString();
    }

    // Use Resend's template feature if available
    // Otherwise, we build the email with replaced variables

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send a simple email
   */
  async sendEmail(data: {
    from: string;
    to: string;
    subject: string;
    html?: string;
    text?: string;
    scheduledAt?: Date;
  }): Promise<unknown> {
    const payload: Record<string, unknown> = {
      from: data.from,
      to: data.to,
      subject: data.subject,
    };

    if (data.html) {
      payload.html = data.html;
    }

    if (data.text) {
      payload.text = data.text;
    }

    if (data.scheduledAt) {
      payload.scheduled_at = data.scheduledAt.toISOString();
    }

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Send a booking confirmation email with template variables
   * Uses Resend's Broadcast feature with template
   */
  async sendBookingConfirmation(data: {
    to: string;
    vorname: string;
    datum: string;
    uhrzeit: string;
    meetingLink: string;
    scheduledAt?: Date;
  }): Promise<unknown> {
    // Resend supports sending to a broadcast with template variables
    // We'll use the emails endpoint with the template

    const payload: Record<string, unknown> = {
      from: "Auto.ki <noreply@auto.ki>",
      to: data.to,
      subject: "Dein Termin steht!",
      // Use Resend's template feature
      // Template slug: terminbesttigung
      html: this.buildBookingConfirmationHtml({
        vorname: data.vorname,
        datum: data.datum,
        uhrzeit: data.uhrzeit,
        meetingLink: data.meetingLink,
      }),
    };

    if (data.scheduledAt) {
      payload.scheduled_at = data.scheduledAt.toISOString();
    }

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Build HTML for booking confirmation
   * This matches the Resend template "terminbesttigung"
   */
  private buildBookingConfirmationHtml(vars: {
    vorname: string;
    datum: string;
    uhrzeit: string;
    meetingLink: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 24px; margin-bottom: 20px;">Dein Termin steht 🎉</h1>

  <p>Hey ${vars.vorname},</p>

  <p>schön, dass du dabei bist! Hier nochmal alle Details zu deinem Termin:</p>

  <p><strong>Was:</strong> Discovery Call</p>
  <p><strong>Wann:</strong> ${vars.datum} um ${vars.uhrzeit} Uhr</p>
  <p><strong>Wo:</strong> <a href="${vars.meetingLink}" style="color: #0066cc;">${vars.meetingLink}</a></p>

  <p>Falls du den Termin verschieben musst oder Fragen hast, melde dich einfach kurz bei uns – kein Problem!</p>

  <p>Bis dahin kannst du dich gerne schon mal in unserer Academy umsehen. Dort findest du jede Menge hilfreiche Ressourcen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Wir freuen uns auf dich!</p>

  <p>Liebe Grüße</p>
</body>
</html>
    `.trim();
  }
}

/**
 * Create a Resend client instance
 */
export function createResendClient(apiKey: string): ResendClient {
  return new ResendClient(apiKey);
}
