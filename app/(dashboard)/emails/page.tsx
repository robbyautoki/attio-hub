"use client";

import { useState } from "react";
import { SendIcon, LoaderIcon, CopyIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export default function EmailsPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSendTest() {
    if (!email) return;
    setSending(true);

    try {
      const res = await fetch("/api/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        alert("Test-Email gesendet!");
      } else {
        const data = await res.json();
        alert(`Fehler: ${data.error || "Unbekannter Fehler"}`);
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      alert("Fehler beim Senden");
    } finally {
      setSending(false);
    }
  }

  function handleCopyHtml() {
    navigator.clipboard.writeText(signatureHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">E-Mail Signatur</h1>
        <p className="text-muted-foreground">
          Minimalistische Email-Signatur für professionelle Korrespondenz
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Vorschau */}
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
            <CardDescription>So sieht die Signatur in Emails aus</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="bg-white p-6 rounded border"
              dangerouslySetInnerHTML={{ __html: signatureHtml }}
            />
          </CardContent>
        </Card>

        {/* Aktionen */}
        <Card>
          <CardHeader>
            <CardTitle>Aktionen</CardTitle>
            <CardDescription>HTML kopieren oder Test-Email senden</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* HTML kopieren */}
            <div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCopyHtml}
              >
                {copied ? (
                  <>
                    <CheckIcon className="mr-2 size-4" />
                    Kopiert!
                  </>
                ) : (
                  <>
                    <CopyIcon className="mr-2 size-4" />
                    HTML kopieren
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Füge den HTML-Code in deine Email-App ein
              </p>
            </div>

            {/* Test-Email */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="test@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button onClick={handleSendTest} disabled={sending || !email}>
                  {sending ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <SendIcon className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sende eine Test-Email mit der Signatur
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* HTML Code */}
      <Card>
        <CardHeader>
          <CardTitle>HTML Code</CardTitle>
          <CardDescription>Zum manuellen Einfügen in Email-Clients</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {signatureHtml}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
