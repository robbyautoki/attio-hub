import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Resend } from "resend";

// Lazy initialize Resend to avoid build-time errors
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY nicht konfiguriert");
  }
  return new Resend(apiKey);
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN 1: DARK CYBER 2060
// ═══════════════════════════════════════════════════════════════════════════
const darkCyberHtml = `
<!-- DARK CYBER 2060 - EMAIL SIGNATURE + FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0a0a;">
  <tr>
    <td style="padding: 0;">

      <!-- ═══════════ SIGNATURE SECTION ═══════════ -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
        <tr>
          <td style="padding: 40px 32px 32px 32px;">

            <!-- BRAND MARK -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 18px; font-weight: 300; letter-spacing: 6px; color: #ffffff; text-transform: lowercase;">
                  autoki
                </td>
                <td style="padding-left: 10px; vertical-align: middle;">
                  <div style="width: 6px; height: 6px; background: linear-gradient(135deg, #00f0ff 0%, #0080ff 100%); border-radius: 50%;"></div>
                </td>
              </tr>
            </table>

            <!-- GRADIENT DIVIDER -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; margin-bottom: 20px;">
              <tr>
                <td style="width: 80px; height: 1px; background: linear-gradient(90deg, #00f0ff 0%, rgba(0, 240, 255, 0) 100%);"></td>
              </tr>
            </table>

            <!-- NAME & TITLE -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 500; color: #ffffff; letter-spacing: 0.5px; padding-bottom: 6px;">
                  Robby Reinemann
                </td>
              </tr>
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 400; color: #555555; letter-spacing: 3px; text-transform: uppercase;">
                  Gründer &amp; CEO
                </td>
              </tr>
            </table>

            <!-- CONTACT INFO -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
              <tr>
                <td style="padding-bottom: 6px;">
                  <a href="mailto:hello@autoki.de" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #666666; text-decoration: none; letter-spacing: 0.5px;">
                    hello@autoki.de
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 6px;">
                  <a href="tel:+49XXX" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #666666; text-decoration: none; letter-spacing: 0.5px;">
                    +49 XXX XXXXXXX
                  </a>
                </td>
              </tr>
              <tr>
                <td>
                  <a href="https://autoki.de" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #00f0ff; text-decoration: none; letter-spacing: 0.5px;">
                    autoki.de
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

      <!-- ═══════════ FOOTER SECTION ═══════════ -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; border-top: 1px solid #1a1a1a;">
        <tr>
          <td style="padding: 32px;">

            <!-- SOCIAL LINKS -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
              <tr>
                <td style="padding-right: 16px;">
                  <a href="https://linkedin.com/company/autoki" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #444444; text-decoration: none; text-transform: uppercase;">
                    LI
                  </a>
                </td>
                <td style="color: #333333; font-family: 'Courier New', Courier, monospace; padding-right: 16px;">/</td>
                <td style="padding-right: 16px;">
                  <a href="https://x.com/autoki" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #444444; text-decoration: none; text-transform: uppercase;">
                    X
                  </a>
                </td>
                <td style="color: #333333; font-family: 'Courier New', Courier, monospace; padding-right: 16px;">/</td>
                <td>
                  <a href="https://autoki.de" style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #00f0ff; text-decoration: none; text-transform: uppercase;">
                    WEB
                  </a>
                </td>
              </tr>
            </table>

            <!-- TAGLINE -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 400; letter-spacing: 2px; color: #444444; text-transform: uppercase;">
                  Automation, die begeistert.
                </td>
              </tr>
            </table>

            <!-- LEGAL LINKS -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
              <tr>
                <td style="padding-right: 12px;">
                  <a href="https://autoki.de/impressum" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #333333; text-decoration: none; letter-spacing: 1px; text-transform: uppercase;">
                    Impressum
                  </a>
                </td>
                <td style="color: #222222; font-family: 'Courier New', Courier, monospace; font-size: 10px; padding-right: 12px;">·</td>
                <td style="padding-right: 12px;">
                  <a href="https://autoki.de/datenschutz" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #333333; text-decoration: none; letter-spacing: 1px; text-transform: uppercase;">
                    Datenschutz
                  </a>
                </td>
                <td style="color: #222222; font-family: 'Courier New', Courier, monospace; font-size: 10px; padding-right: 12px;">·</td>
                <td>
                  <a href="https://autoki.de/agb" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #333333; text-decoration: none; letter-spacing: 1px; text-transform: uppercase;">
                    AGB
                  </a>
                </td>
              </tr>
            </table>

            <!-- COPYRIGHT -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 10px; color: #2a2a2a; letter-spacing: 0.5px;">
                  © 2025 autoki GmbH · Berlin
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
`;

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN 2: GOLD LUXURY
// ═══════════════════════════════════════════════════════════════════════════
const goldLuxuryHtml = `
<!-- GOLD LUXURY - EMAIL SIGNATURE + FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fafafa;">
  <tr>
    <td align="center" style="padding: 40px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">

        <!-- LUXURY GRADIENT ACCENT LINE -->
        <tr>
          <td style="padding-bottom: 28px;">
            <div style="height: 3px; background: linear-gradient(135deg, #c9a962 0%, #e8d5b7 25%, #d4a574 50%, #c9a962 75%, #a68b4b 100%); border-radius: 2px;"></div>
          </td>
        </tr>

        <!-- ═══════════ SIGNATURE CARD ═══════════ -->
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e8e4dc; border-radius: 12px;">
              <tr>
                <td style="padding: 32px 36px;">

                  <!-- NAME -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family: Georgia, 'Times New Roman', Times, serif; font-size: 26px; font-weight: 400; letter-spacing: 0.5px; color: #1a1a1a; padding-bottom: 6px;">
                        Robby Reinemann
                      </td>
                    </tr>
                  </table>

                  <!-- TITLE -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: #b8996c; padding-bottom: 4px;">
                        Gründer &amp; CEO
                      </td>
                    </tr>
                  </table>

                  <!-- COMPANY -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; color: #888888; padding-bottom: 20px;">
                        autoki
                      </td>
                    </tr>
                  </table>

                  <!-- GOLD DIVIDER -->
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                    <tr>
                      <td style="width: 100px; height: 1px; background: linear-gradient(90deg, #c9a962 0%, #e8d5b7 50%, transparent 100%);"></td>
                    </tr>
                  </table>

                  <!-- CONTACT INFO -->
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding-bottom: 8px;">
                        <a href="mailto:hello@autoki.de" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #4a4a4a; text-decoration: none; letter-spacing: 0.3px;">
                          hello@autoki.de
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding-bottom: 8px;">
                        <a href="tel:+49XXX" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #4a4a4a; text-decoration: none; letter-spacing: 0.3px;">
                          +49 XXX XXXXXXX
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <a href="https://autoki.de" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #b8996c; text-decoration: none; letter-spacing: 0.3px; font-weight: 500;">
                          autoki.de
                        </a>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ═══════════ FOOTER SECTION ═══════════ -->

        <!-- ELEGANT DIVIDER -->
        <tr>
          <td style="padding: 32px 0;">
            <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #d4d0c8 20%, #c9a962 50%, #d4d0c8 80%, transparent 100%);"></div>
          </td>
        </tr>

        <!-- BRAND + TAGLINE -->
        <tr>
          <td align="center" style="padding-bottom: 12px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right: 8px; vertical-align: middle;">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: linear-gradient(135deg, #c9a962 0%, #a68b4b 100%);"></div>
                </td>
                <td style="font-family: Georgia, 'Times New Roman', Times, serif; font-size: 20px; font-weight: 400; letter-spacing: 1px; color: #1a1a1a;">
                  autoki
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <p style="font-family: Georgia, 'Times New Roman', Times, serif; font-size: 13px; font-style: italic; line-height: 1.6; color: #8a8a8a; margin: 0; letter-spacing: 0.5px;">
              Intelligente Automation für anspruchsvolle Unternehmen
            </p>
          </td>
        </tr>

        <!-- SOCIAL LINKS -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 12px;">
                  <a href="https://linkedin.com/company/autoki" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; color: #b8996c; text-decoration: none; text-transform: uppercase;">
                    LinkedIn
                  </a>
                </td>
                <td style="color: #c9a962; font-size: 10px;">◆</td>
                <td style="padding: 0 12px;">
                  <a href="https://x.com/autoki" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; color: #b8996c; text-decoration: none; text-transform: uppercase;">
                    X
                  </a>
                </td>
                <td style="color: #c9a962; font-size: 10px;">◆</td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 1px; color: #b8996c; text-decoration: none; text-transform: uppercase;">
                    Website
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- LEGAL LINKS -->
        <tr>
          <td align="center" style="padding-bottom: 16px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de/impressum" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.5px; color: #999999; text-decoration: none;">
                    Impressum
                  </a>
                </td>
                <td style="color: #d4d0c8;">|</td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de/datenschutz" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.5px; color: #999999; text-decoration: none;">
                    Datenschutz
                  </a>
                </td>
                <td style="color: #d4d0c8;">|</td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de/agb" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0.5px; color: #999999; text-decoration: none;">
                    AGB
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ADDRESS + COPYRIGHT -->
        <tr>
          <td align="center" style="padding-bottom: 8px;">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.6; color: #aaaaaa; margin: 0;">
              autoki GmbH · Berlin · Deutschland
            </p>
          </td>
        </tr>
        <tr>
          <td align="center">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; color: #bbbbbb; margin: 0;">
              © 2025 autoki. Alle Rechte vorbehalten.
            </p>
          </td>
        </tr>

        <!-- FINAL GOLD ACCENT -->
        <tr>
          <td align="center" style="padding-top: 16px;">
            <div style="width: 40px; height: 2px; background: linear-gradient(90deg, #c9a962 0%, #e8d5b7 100%); border-radius: 1px;"></div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
`;

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN 3: BRUTALIST NEON
// ═══════════════════════════════════════════════════════════════════════════
const brutalistNeonHtml = `
<!-- BRUTALIST NEON - EMAIL SIGNATURE + FOOTER -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
  <tr>
    <td style="padding: 0;">

      <!-- NEON TOP BAR -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="height: 6px; background-color: #00FF88;"></td>
        </tr>
      </table>

      <!-- ═══════════ SIGNATURE SECTION ═══════════ -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
        <tr>
          <td style="padding: 48px 32px 40px 32px;">

            <!-- NAME - MASSIVE -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 700; letter-spacing: -2px; color: #FFFFFF; line-height: 1; text-transform: uppercase;">
                  ROBBY
                </td>
              </tr>
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 700; letter-spacing: -2px; color: #FFFFFF; line-height: 1; text-transform: uppercase;">
                  REINEMANN
                </td>
              </tr>
            </table>

            <!-- TITLE + COMPANY BLOCK -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px; margin-bottom: 28px;">
              <tr>
                <td style="border-left: 4px solid #00FF88; padding-left: 16px;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 400; letter-spacing: 3px; color: #666666; text-transform: uppercase; display: block;">
                    GRUENDER &amp; CEO
                  </span>
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 16px; font-weight: 700; letter-spacing: 2px; color: #00FF88; text-transform: uppercase; display: block; margin-top: 4px;">
                    AUTOKI
                  </span>
                </td>
              </tr>
            </table>

            <!-- CONTACT GRID -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-bottom: 12px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 70px; vertical-align: top;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #444444; text-transform: uppercase;">
                          EMAIL
                        </span>
                      </td>
                      <td style="vertical-align: top;">
                        <a href="mailto:hello@autoki.de" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 400; color: #FFFFFF; text-decoration: none;">
                          hello@autoki.de
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 12px;">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 70px; vertical-align: top;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #444444; text-transform: uppercase;">
                          TEL
                        </span>
                      </td>
                      <td style="vertical-align: top;">
                        <a href="tel:+49XXX" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 400; color: #FFFFFF; text-decoration: none;">
                          +49 XXX XXXXXXX
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="width: 70px; vertical-align: top;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #444444; text-transform: uppercase;">
                          WEB
                        </span>
                      </td>
                      <td style="vertical-align: top;">
                        <a href="https://autoki.de" style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 700; color: #00FF88; text-decoration: none;">
                          autoki.de
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

      <!-- ═══════════ FOOTER SECTION ═══════════ -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
        <tr>
          <td style="padding: 0 32px;">
            <div style="height: 1px; background-color: #1a1a1a;"></div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
        <tr>
          <td align="center" style="padding: 48px 32px;">

            <!-- MASSIVE BRAND -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 48px; font-weight: 900; letter-spacing: -3px; color: #FFFFFF; text-transform: uppercase;">
                  AUTOKI
                </td>
              </tr>
            </table>

            <!-- TAGLINE -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 400; letter-spacing: 4px; color: #555555; text-transform: uppercase;">
                  AUTOMATION OHNE KOMPROMISSE
                </td>
              </tr>
            </table>

            <!-- SOCIAL - TEXT STYLE -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
              <tr>
                <td style="padding: 0 16px;">
                  <a href="https://linkedin.com/company/autoki" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #FFFFFF; text-decoration: none; text-transform: uppercase;">
                    LI
                  </a>
                </td>
                <td style="color: #333333; font-family: 'Courier New', Courier, monospace; font-size: 12px;">/</td>
                <td style="padding: 0 16px;">
                  <a href="https://x.com/autoki" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #FFFFFF; text-decoration: none; text-transform: uppercase;">
                    X
                  </a>
                </td>
                <td style="color: #333333; font-family: 'Courier New', Courier, monospace; font-size: 12px;">/</td>
                <td style="padding: 0 16px;">
                  <a href="https://autoki.de" style="font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #00FF88; text-decoration: none; text-transform: uppercase;">
                    WEB
                  </a>
                </td>
              </tr>
            </table>

            <!-- LEGAL LINKS -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
              <tr>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de/impressum" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 400; letter-spacing: 1px; color: #444444; text-decoration: none; text-transform: uppercase;">
                    IMPRESSUM
                  </a>
                </td>
                <td style="color: #333333; font-family: 'Courier New', Courier, monospace; font-size: 10px;">|</td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de/datenschutz" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 400; letter-spacing: 1px; color: #444444; text-decoration: none; text-transform: uppercase;">
                    DATENSCHUTZ
                  </a>
                </td>
                <td style="color: #333333; font-family: 'Courier New', Courier, monospace; font-size: 10px;">|</td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de/agb" style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 400; letter-spacing: 1px; color: #444444; text-decoration: none; text-transform: uppercase;">
                    AGB
                  </a>
                </td>
              </tr>
            </table>

            <!-- COPYRIGHT -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
              <tr>
                <td style="font-family: 'Courier New', Courier, monospace; font-size: 10px; font-weight: 400; letter-spacing: 1px; color: #333333; text-transform: uppercase;">
                  © 2025 AUTOKI GMBH · BERLIN
                </td>
              </tr>
            </table>

            <!-- FINAL ACCENT BAR -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width: 60px; height: 4px; background-color: #00FF88;"></td>
              </tr>
            </table>

          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
`;

// Design templates
const DESIGNS = {
  cyber: {
    name: "Dark Cyber 2060",
    html: darkCyberHtml,
    subject: "E-Mail Test - Dark Cyber 2060",
  },
  gold: {
    name: "Gold Luxury",
    html: goldLuxuryHtml,
    subject: "E-Mail Test - Gold Luxury",
  },
  brutalist: {
    name: "Brutalist Neon",
    html: brutalistNeonHtml,
    subject: "E-Mail Test - Brutalist Neon",
  },
} as const;

type DesignKey = keyof typeof DESIGNS;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, design = "cyber" } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "E-Mail-Adresse erforderlich" },
        { status: 400 }
      );
    }

    // Get the selected design template
    const selectedDesign = DESIGNS[design as DesignKey] || DESIGNS.cyber;

    // Build full email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${selectedDesign.name} - autoki</title>
</head>
<body style="margin: 0; padding: 0;">
  ${selectedDesign.html}
</body>
</html>
`;

    // Send email using Resend
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: "autoki <noreply@autoki.de>",
      to: [email],
      subject: `${selectedDesign.subject} - autoki`,
      html: emailHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test-E-Mail (${selectedDesign.name}) gesendet`,
      id: data?.id,
    });
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json(
      {
        error: "Interner Fehler",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
