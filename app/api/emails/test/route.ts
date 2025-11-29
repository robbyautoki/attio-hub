import { NextResponse } from "next/server";

// Lazy init for Resend
let resendInstance: import("resend").Resend | null = null;

async function getResend() {
  if (!resendInstance) {
    const { Resend } = await import("resend");
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// Deutsche GmbH-konforme Email-Signatur mit Foto und Datenschutz-Footer
const signatureHtml = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; max-width: 600px;">
  <tr>
    <td style="border-top: 2px solid #e5e5e5; padding-top: 24px;"></td>
  </tr>
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: top; padding-right: 24px;">
            <img src="https://attio-hub.vercel.app/signature-photo.png" alt="Robby Reinemann" width="110" height="97" style="border-radius: 8px; display: block; object-fit: cover;" />
          </td>
          <td style="vertical-align: top;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 20px; font-weight: 700; color: #000000; line-height: 1.2; padding-bottom: 4px;">
                  Robby Reinemann
                </td>
              </tr>
              <tr>
                <td style="font-size: 14px; color: #555555; line-height: 1.4; padding-bottom: 16px; font-weight: 500;">
                  Geschäftsführer
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #333333; line-height: 1.8;">
                  <a href="mailto:robby@avanto-vr.de" style="color: #333333; text-decoration: none;">robby@avanto-vr.de</a>
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #333333; line-height: 1.8;">
                  <a href="tel:+49421XXXXXXX" style="color: #333333; text-decoration: none;">+49 421 XXX XXXX</a>
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; line-height: 1.8;">
                  <a href="https://avanto-vr.de" style="color: #000000; text-decoration: none; font-weight: 600;">avanto-vr.de</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 20px;"></td>
  </tr>
  <tr>
    <td style="border-top: 1px solid #e5e5e5; padding-top: 16px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size: 13px; font-weight: 600; color: #000000; line-height: 1.4;">
            AVANTO VR Solutions GmbH
          </td>
        </tr>
        <tr>
          <td style="font-size: 12px; color: #666666; line-height: 1.5; padding-top: 4px;">
            Otto-Lilienthal-Str. 20 · 28199 Bremen
          </td>
        </tr>
        <tr>
          <td style="font-size: 11px; color: #888888; line-height: 1.5; padding-top: 8px;">
            Amtsgericht Bremen · HRB XXXXX · USt-IdNr.: DE XXXXXXXXX
          </td>
        </tr>
        <tr>
          <td style="font-size: 11px; color: #888888; line-height: 1.5;">
            Geschäftsführer: Robby Reinemann
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 32px;"></td>
  </tr>
  <tr>
    <td style="border-top: 1px solid #eeeeee; padding-top: 20px;">
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 0;">
        Vielen Dank, dass Sie sich die Zeit genommen haben, diese E-Mail zu lesen. Diese Nachricht ist Teil einer fortlaufenden Konversation zwischen uns, und ich möchte mir einen Moment Zeit nehmen, um sicherzustellen, dass Sie vollständige Transparenz darüber haben, warum Sie diese Nachricht erhalten haben, wie Ihre Daten behandelt werden und was Sie von zukünftigen E-Mails erwarten können.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        <strong style="color: #777777;">Warum Sie diese E-Mail erhalten:</strong> Sie erhalten diese E-Mail, weil Sie sich zu einem bestimmten Zeitpunkt dafür entschieden haben, Updates, Neuigkeiten oder Informationen zu einem bestimmten Thema zu erhalten, das wir zuvor besprochen oder geteilt haben. Ganz gleich, ob es sich um ein Abonnement, ein Formular oder eine andere Form der Kommunikation handelt, Ihre Informationen wurden freiwillig weitergegeben, und wir respektieren Ihre Entscheidung, mit uns in Verbindung zu treten.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        Wenn Sie sich über die Art unserer Korrespondenz wundern, können Sie sicher sein, dass wir uns bemühen, alle E-Mails relevant, zeitnah und frei von unnötigem Ballast zu halten. Dazu gehört auch, dass wir Ihren Posteingang respektieren und keine irrelevanten Nachrichten versenden.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        <strong style="color: #777777;">Ihre Privatsphäre ist wichtig:</strong> Wir wissen Ihr Vertrauen zu schätzen und nehmen Ihre Privatsphäre sehr ernst. Die von Ihnen zur Verfügung gestellten Informationen werden sicher gespeichert und niemals weitergegeben, verkauft oder außerhalb des Zwecks verwendet, für den Sie sie zur Verfügung gestellt haben. Wenn Sie wissen möchten, wie wir mit Ihren Daten umgehen, können Sie sich gerne direkt an uns wenden. Transparenz hat für uns Priorität, und wir beantworten gerne alle Ihre Fragen, die Sie haben.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        Sie haben immer die Kontrolle über die Informationen, die Sie uns mitteilen. Wenn Sie das Gefühl haben, dass ein Teil Ihres Abonnements oder Ihrer Interaktion einer Klärung bedarf, lassen Sie es uns wissen. Wir sind hier, um Ihnen genaue Antworten zu geben und sicherzustellen, dass Sie zufrieden sind.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        <strong style="color: #777777;">Wie Sie sich abmelden oder Ihre Präferenzen verwalten können:</strong> Wir wissen, dass der Posteingang bei jedem anders ist. Sollten Sie unsere E-Mails einmal nicht mehr als relevant empfinden, nehmen Sie es uns nicht übel. Sie können Ihre E-Mail-Präferenzen ganz einfach verwalten oder das Abonnement über den unten stehenden Link kündigen.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        Wenn Sie auf den Abmeldelink klicken, werden Sie auf eine Seite weitergeleitet, auf der Sie entweder Ihre Kommunikationspräferenzen anpassen (z. B. weniger E-Mails oder nur zu bestimmten Themen erhalten) oder sich vollständig aus unserer Liste streichen können. Der Vorgang ist unkompliziert, und alle Änderungen werden sofort wirksam.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        Wir verwenden keine Tricks, um Sie auf unserer Liste zu halten. Unsere Priorität ist es, dafür zu sorgen, dass unsere E-Mails einen Mehrwert für Sie darstellen, und wenn dies nicht der Fall ist, respektieren wir Ihre Entscheidung, sich von uns zu trennen.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        <strong style="color: #777777;">Zugänglichkeit und Kommunikation:</strong> Wenn Sie Probleme haben, auf die Abmeldeseite zuzugreifen, Ihre Einstellungen zu verwalten oder zu verstehen, warum Sie diese E-Mail erhalten, können Sie sich direkt an unser Support-Team wenden. Wir bemühen uns, Ihnen innerhalb eines angemessenen Zeitrahmens zu antworten und Ihre Anliegen effektiv zu bearbeiten.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        <strong style="color: #777777;">Eine Verpflichtung zu nicht aufdringlichen E-Mails:</strong> Unser Ziel ist es, eine nicht aufdringliche Kommunikationserfahrung zu schaffen. Das bedeutet, dass wir Ihren Posteingang nicht mit übermäßigen Nachrichten überschwemmen werden und dass wir uns bemühen, unsere Inhalte klar und prägnant zu halten. Der Zweck dieser E-Mails ist es, mit Ihnen in Verbindung zu bleiben und Ihnen Aktualisierungen oder Informationen zukommen zu lassen, die wir für sinnvoll erachten. Sollten wir jemals diese Standards nicht erfüllen, bitten wir Sie, uns dies mitzuteilen.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        Rückmeldungen, ob positiv oder konstruktiv, sind uns immer willkommen. Ihre Gedanken helfen uns zu verstehen, wie wir uns verbessern können und unsere Kommunikation zu verbessern. Wir können zwar nicht garantieren, dass jeder Vorschlag umgesetzt wird, aber wir werden uns die Zeit nehmen, Ihre Anregungen sorgfältig zu prüfen und zu berücksichtigen.
      </p>
      <p style="font-size: 9px; color: #999999; line-height: 1.6; margin: 12px 0 0 0;">
        Wir bemühen uns, alle Kommunikationskanäle offen zu halten und Ihnen jederzeit zur Verfügung zu stehen. Ganz gleich, ob Sie eine Frage, einen Kommentar oder ein Anliegen haben, unser Team ist bereit, Ihnen zu helfen.
      </p>
    </td>
  </tr>
</table>`;

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email ist erforderlich" }, { status: 400 });
    }

    const resend = await getResend();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif;">
  <p style="font-size: 14px; color: #333333; line-height: 1.6; margin-bottom: 24px;">
    Hallo,<br><br>
    dies ist eine Test-Email mit der neuen Signatur.
  </p>
  ${signatureHtml}
</body>
</html>`;

    const result = await resend.emails.send({
      from: "autoki <robby@notifications.auto.ki>",
      to: email,
      subject: "Test: E-Mail Signatur",
      html: emailHtml,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Senden" },
      { status: 500 }
    );
  }
}
