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

// Apple-inspired minimalist email footer HTML
const emailFooterHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
  <tr>
    <td align="center" style="padding: 48px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">

        <!-- Divider -->
        <tr>
          <td style="padding-bottom: 32px;">
            <div style="height: 1px; background: linear-gradient(90deg, transparent, #e5e5e5, transparent);"></div>
          </td>
        </tr>

        <!-- Logo/Brand -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; font-size: 20px; font-weight: 600; letter-spacing: -0.5px; color: #1d1d1f;">
              autoki
            </span>
          </td>
        </tr>

        <!-- Tagline -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; color: #86868b; margin: 0;">
              Automation, die begeistert.
            </p>
          </td>
        </tr>

        <!-- Social Links -->
        <tr>
          <td align="center" style="padding-bottom: 32px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 12px;">
                  <a href="https://linkedin.com/company/autoki" style="text-decoration: none;">
                    <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="LinkedIn" width="20" height="20" style="display: block; opacity: 0.5;" />
                  </a>
                </td>
                <td style="padding: 0 12px;">
                  <a href="https://twitter.com/autoki" style="text-decoration: none;">
                    <img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter" width="20" height="20" style="display: block; opacity: 0.5;" />
                  </a>
                </td>
                <td style="padding: 0 12px;">
                  <a href="https://autoki.de" style="text-decoration: none;">
                    <img src="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" alt="Website" width="20" height="20" style="display: block; opacity: 0.5;" />
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Links -->
        <tr>
          <td align="center" style="padding-bottom: 24px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding: 0 16px;">
                  <a href="https://autoki.de/impressum" style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #86868b; text-decoration: none;">
                    Impressum
                  </a>
                </td>
                <td style="color: #d2d2d7;">|</td>
                <td style="padding: 0 16px;">
                  <a href="https://autoki.de/datenschutz" style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #86868b; text-decoration: none;">
                    Datenschutz
                  </a>
                </td>
                <td style="color: #d2d2d7;">|</td>
                <td style="padding: 0 16px;">
                  <a href="mailto:hello@autoki.de" style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 12px; color: #86868b; text-decoration: none;">
                    Kontakt
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Address -->
        <tr>
          <td align="center" style="padding-bottom: 16px;">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 11px; line-height: 1.6; color: #86868b; margin: 0;">
              autoki GmbH · Musterstraße 1 · 10115 Berlin
            </p>
          </td>
        </tr>

        <!-- Copyright -->
        <tr>
          <td align="center">
            <p style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #86868b; margin: 0;">
              © 2024 autoki. Alle Rechte vorbehalten.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
`;

export default function EmailsPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSending(true);
    setSent(false);

    try {
      const res = await fetch("/api/emails/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } else {
        const error = await res.json();
        alert(`Fehler: ${error.message || "E-Mail konnte nicht gesendet werden"}`);
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      alert("Fehler beim Senden der Test-E-Mail");
    } finally {
      setSending(false);
    }
  }

  function handleCopyHtml() {
    navigator.clipboard.writeText(emailFooterHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">E-Mail Footer Test</h1>
        <p className="text-muted-foreground">
          Teste den E-Mail Footer und sende eine Vorschau an deine E-Mail-Adresse
        </p>
      </div>

      {/* Send Test Form */}
      <Card>
        <CardHeader>
          <CardTitle>Test-E-Mail senden</CardTitle>
          <CardDescription>
            Gib deine E-Mail-Adresse ein, um eine Test-E-Mail mit dem Footer zu erhalten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendTest} className="flex gap-3">
            <Input
              type="email"
              placeholder="deine@email.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-sm"
              required
            />
            <Button type="submit" disabled={sending || !email}>
              {sending ? (
                <LoaderIcon className="mr-2 size-4 animate-spin" />
              ) : sent ? (
                <CheckIcon className="mr-2 size-4" />
              ) : (
                <SendIcon className="mr-2 size-4" />
              )}
              {sent ? "Gesendet!" : "Senden"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Footer Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Footer Vorschau</CardTitle>
              <CardDescription>
                So sieht der E-Mail Footer in Aktion aus
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyHtml}>
              {copied ? (
                <CheckIcon className="mr-2 size-4" />
              ) : (
                <CopyIcon className="mr-2 size-4" />
              )}
              {copied ? "Kopiert!" : "HTML kopieren"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="border rounded-lg overflow-hidden bg-white"
            dangerouslySetInnerHTML={{ __html: emailFooterHtml }}
          />
        </CardContent>
      </Card>

      {/* HTML Code */}
      <Card>
        <CardHeader>
          <CardTitle>HTML Code</CardTitle>
          <CardDescription>
            Der vollständige HTML-Code des Footers zum Einbetten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
            <code>{emailFooterHtml.trim()}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
