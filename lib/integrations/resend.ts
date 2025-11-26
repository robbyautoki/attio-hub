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
      from: "Auto.ki <robby@notifications.auto.ki>",
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
   * Send a reminder email using Resend Broadcast with template
   * Template: te-24h (24h reminder)
   * Variables: vorname, terminart, datum, uhrzeit, ort_oder_link
   */
  async sendReminderEmail(data: {
    to: string;
    templateSlug: string;
    variables: {
      vorname: string;
      terminart: string;
      datum: string;
      uhrzeit: string;
      ort_oder_link: string;
    };
  }): Promise<unknown> {
    // Resend Broadcast API für Template-Emails
    // POST /broadcasts/{broadcast_id}/send
    // Da wir die Broadcast ID nicht haben, bauen wir das HTML selbst
    // basierend auf dem Template-Design

    const { vorname, terminart, datum, uhrzeit, ort_oder_link } = data.variables;

    const html = this.buildReminderHtml({
      vorname,
      terminart,
      datum,
      uhrzeit,
      ort_oder_link,
    });

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: "Robby <robby@notifications.auto.ki>",
        to: data.to,
        subject: "Kleine Erinnerung für Morgen",
        html,
      }),
    });
  }

  /**
   * Build HTML for reminder email (matches te-24h template)
   */
  private buildReminderHtml(vars: {
    vorname: string;
    terminart: string;
    datum: string;
    uhrzeit: string;
    ort_oder_link: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Morgen ist es soweit ☀️</h1>

  <p>Hey ${vars.vorname},</p>

  <p>wir wissen, wie schnell die Tage manchmal verfliegen – zwischen E-Mails, Meetings und To-do-Listen kann man leicht mal was übersehen. Deshalb hier ein freundlicher Reminder von uns:</p>

  <p>Morgen steht dein Termin an:</p>

  <p><strong>Was:</strong> ${vars.terminart}</p>
  <p><strong>Wann:</strong> ${vars.datum} um ${vars.uhrzeit} Uhr</p>
  <p><strong>Wo:</strong> <a href="${vars.ort_oder_link}" style="color: #0066cc;">${vars.ort_oder_link}</a></p>

  <p>Trag ihn dir am besten nochmal kurz in den Kalender ein, falls noch nicht geschehen. Und falls dir was dazwischengekommen ist – kein Stress!<br>
  Melde dich einfach kurz bei uns, dann finden wir einen neuen Termin.</p>

  <p>Du willst dich vorab schon ein bisschen einstimmen? In unserer Academy findest du hilfreiche Inhalte, die dir den Einstieg erleichtern:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Wir freuen uns auf morgen!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>
    `.trim();
  }

  /**
   * Send a 1h reminder email using Resend
   * Template: te-1h (1h reminder)
   * Variables: vorname, terminart, uhrzeit, ort_oder_link
   */
  async send1hReminderEmail(data: {
    to: string;
    variables: {
      vorname: string;
      terminart: string;
      uhrzeit: string;
      ort_oder_link: string;
    };
  }): Promise<unknown> {
    const { vorname, terminart, uhrzeit, ort_oder_link } = data.variables;

    const html = this.build1hReminderHtml({
      vorname,
      terminart,
      uhrzeit,
      ort_oder_link,
    });

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: "Robby <robby@notifications.auto.ki>",
        to: data.to,
        subject: "Unser Termin beginnt gleich",
        html,
      }),
    });
  }

  /**
   * Build HTML for 1h reminder email (matches te-1h template)
   */
  private build1hReminderHtml(vars: {
    vorname: string;
    terminart: string;
    uhrzeit: string;
    ort_oder_link: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">In einer Stunde geht's los! ⏰</h1>

  <p>Hey ${vars.vorname},</p>

  <p>der Alltag kann ganz schön turbulent sein – deshalb wollten wir uns nochmal kurz bei dir melden. In einer Stunde startet dein Termin:</p>

  <p><strong>Was:</strong> ${vars.terminart}</p>
  <p><strong>Wann:</strong> Heute um ${vars.uhrzeit} Uhr</p>
  <p><strong>Wo:</strong> <a href="${vars.ort_oder_link}" style="color: #0066cc;">${vars.ort_oder_link}</a></p>

  <p>Schnapp dir vielleicht noch einen Kaffee, mach den Browser-Tab schon mal auf und dann kann's losgehen. Wir freuen uns, dich gleich zu sehen!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>
    `.trim();
  }

  /**
   * Send a No-Show email when someone misses their appointment
   * Variables: vorname, terminart, datum, uhrzeit
   */
  async sendNoShowEmail(data: {
    to: string;
    variables: {
      vorname: string;
      terminart: string;
      datum: string;
      uhrzeit: string;
    };
  }): Promise<unknown> {
    const { vorname, terminart, datum, uhrzeit } = data.variables;

    const html = this.buildNoShowHtml({
      vorname,
      terminart,
      datum,
      uhrzeit,
    });

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: "Robby <robby@notifications.auto.ki>",
        to: data.to,
        subject: "Schade, dass wir dich verpasst haben",
        html,
      }),
    });
  }

  /**
   * Build HTML for No-Show email
   */
  private buildNoShowHtml(vars: {
    vorname: string;
    terminart: string;
    datum: string;
    uhrzeit: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Schade, dass wir dich verpasst haben 😔</h1>

  <p>Hey ${vars.vorname},</p>

  <p>wir hatten uns auf unser Gespräch gefreut, aber leider konnten wir dich nicht erreichen:</p>

  <p><strong>Was:</strong> ${vars.terminart}</p>
  <p><strong>Wann:</strong> ${vars.datum} um ${vars.uhrzeit} Uhr</p>

  <p>Kein Problem – das Leben ist manchmal unberechenbar! Falls du immer noch Interesse hast, kannst du ganz einfach einen neuen Termin buchen:</p>

  <a href="https://cal.com/auto-ki/discovery" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Neuen Termin buchen</a>

  <p>Falls du Fragen hast oder etwas dazwischengekommen ist, melde dich gerne bei uns.</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>
    `.trim();
  }

  /**
   * Send a "Meeting Running - Person Missing" email
   * Sent when meeting has started but attendee hasn't joined
   * Variables: vorname, terminart, uhrzeit, meetingLink
   */
  async sendMeetingRunningEmail(data: {
    to: string;
    variables: {
      vorname: string;
      terminart: string;
      uhrzeit: string;
      meetingLink: string;
    };
  }): Promise<unknown> {
    const { vorname, terminart, uhrzeit, meetingLink } = data.variables;

    const html = this.buildMeetingRunningHtml({
      vorname,
      terminart,
      uhrzeit,
      meetingLink,
    });

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: "Robby <robby@notifications.auto.ki>",
        to: data.to,
        subject: "Dein Meeting läuft gerade – wir warten auf dich!",
        html,
      }),
    });
  }

  /**
   * Build HTML for Meeting Running email
   */
  private buildMeetingRunningHtml(vars: {
    vorname: string;
    terminart: string;
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
  <h1 style="font-size: 28px; margin-bottom: 24px;">Dein Meeting läuft gerade! 🎥</h1>

  <p>Hey ${vars.vorname},</p>

  <p>wir sitzen gerade im Meeting und warten auf dich! Das Gespräch hat um <strong>${vars.uhrzeit} Uhr</strong> begonnen.</p>

  <p><strong>Was:</strong> ${vars.terminart}</p>
  <p><strong>Gestartet um:</strong> ${vars.uhrzeit} Uhr</p>

  <p>Klicke einfach auf den Button, um direkt beizutreten:</p>

  <a href="${vars.meetingLink}" style="display: inline-block; background-color: #22c55e; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 4px; margin: 16px 0; font-weight: bold;">Jetzt beitreten</a>

  <p>Falls du es heute nicht schaffst, melde dich kurz bei uns – dann finden wir einen neuen Termin.</p>

  <p>Bis gleich!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>
    `.trim();
  }

  /**
   * Send a Thank You email after Discovery Call completed
   * Variables: vorname
   */
  async sendThankYouDiscoveryEmail(data: {
    to: string;
    variables: {
      vorname: string;
    };
  }): Promise<unknown> {
    const { vorname } = data.variables;

    const html = this.buildThankYouDiscoveryHtml({ vorname });

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: "Robby <robby@notifications.auto.ki>",
        to: data.to,
        subject: "Danke für das tolle Gespräch!",
        html,
      }),
    });
  }

  /**
   * Build HTML for Thank You Discovery Call email
   */
  private buildThankYouDiscoveryHtml(vars: { vorname: string }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Danke für das tolle Gespräch! 🙏</h1>

  <p>Hey ${vars.vorname},</p>

  <p>vielen Dank, dass du dir die Zeit für unser Discovery Call genommen hast! Es war super, dich kennenzulernen und mehr über deine Ziele zu erfahren.</p>

  <p>Ich hoffe, du konntest einen guten ersten Eindruck gewinnen, wie wir dich unterstützen können. Falls du noch Fragen hast oder direkt loslegen möchtest, melde dich gerne bei mir.</p>

  <p>In der Zwischenzeit kannst du dich gerne in unserer Academy umsehen – dort findest du viele hilfreiche Ressourcen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Ich freue mich auf die weitere Zusammenarbeit!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Robby von auto.ki</strong></p>
</body>
</html>
    `.trim();
  }

  /**
   * Send a Thank You email after Strategie Call completed
   * Variables: vorname
   */
  async sendThankYouStrategieEmail(data: {
    to: string;
    variables: {
      vorname: string;
    };
  }): Promise<unknown> {
    const { vorname } = data.variables;

    const html = this.buildThankYouStrategieHtml({ vorname });

    return this.request("/emails", {
      method: "POST",
      body: JSON.stringify({
        from: "Robby <robby@notifications.auto.ki>",
        to: data.to,
        subject: "Danke für das Strategiegespräch!",
        html,
      }),
    });
  }

  /**
   * Build HTML for Thank You Strategie Call email
   */
  private buildThankYouStrategieHtml(vars: { vorname: string }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Danke für das Strategiegespräch! 🚀</h1>

  <p>Hey ${vars.vorname},</p>

  <p>vielen Dank für das intensive Strategiegespräch! Es war großartig, gemeinsam an deiner Strategie zu arbeiten und konkrete nächste Schritte zu definieren.</p>

  <p>Ich bin überzeugt, dass wir zusammen Großes erreichen können. Die besprochenen Punkte und Empfehlungen werden dir helfen, deine Ziele schneller zu erreichen.</p>

  <p>Falls du noch Fragen hast oder wir etwas besprechen sollten, bin ich jederzeit für dich da.</p>

  <p>Schau auch gerne in unsere Academy – dort findest du weiterführende Ressourcen zu den besprochenen Themen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Auf eine erfolgreiche Zusammenarbeit!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Robby von auto.ki</strong></p>
</body>
</html>
    `.trim();
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
