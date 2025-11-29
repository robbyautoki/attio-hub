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

// Deutsche GmbH-konforme Email-Signatur mit Foto
const signatureHtml = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; max-width: 500px;">
  <tr>
    <td style="border-top: 2px solid #e5e5e5; padding-top: 20px;"></td>
  </tr>
  <tr>
    <td>
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align: top; padding-right: 20px;">
            <img src="https://attio-hub.vercel.app/signature-photo.jpg" alt="Robby Reinemann" width="90" height="90" style="border-radius: 50%; display: block;" />
          </td>
          <td style="vertical-align: top;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-size: 18px; font-weight: 600; color: #000000; line-height: 1.3; padding-bottom: 2px;">
                  Robby Reinemann
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #666666; line-height: 1.4; padding-bottom: 12px;">
                  Geschäftsführer
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #333333; line-height: 1.6;">
                  <a href="mailto:robby@avanto-vr.de" style="color: #333333; text-decoration: none;">robby@avanto-vr.de</a>
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; color: #333333; line-height: 1.6;">
                  <a href="tel:+49421XXXXXXX" style="color: #333333; text-decoration: none;">+49 421 XXX XXXX</a>
                </td>
              </tr>
              <tr>
                <td style="font-size: 13px; line-height: 1.6;">
                  <a href="https://avanto-vr.de" style="color: #000000; text-decoration: none; font-weight: 500;">avanto-vr.de</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding-top: 16px; border-top: 1px solid #e5e5e5; margin-top: 16px;"></td>
  </tr>
  <tr>
    <td style="padding-top: 12px;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size: 12px; font-weight: 600; color: #000000; line-height: 1.4;">
            AVANTO VR Solutions GmbH
          </td>
        </tr>
        <tr>
          <td style="font-size: 11px; color: #666666; line-height: 1.5; padding-top: 4px;">
            Otto-Lilienthal-Str. 20 · 28199 Bremen
          </td>
        </tr>
        <tr>
          <td style="font-size: 10px; color: #999999; line-height: 1.5; padding-top: 8px;">
            Amtsgericht Bremen · HRB XXXXX · USt-IdNr.: DE XXXXXXXXX
          </td>
        </tr>
        <tr>
          <td style="font-size: 10px; color: #999999; line-height: 1.5;">
            Geschäftsführer: Robby Reinemann
          </td>
        </tr>
      </table>
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
