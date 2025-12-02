"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

// Example data for previews
const EXAMPLE_DATA = {
  vorname: "Max",
  terminart: "Discovery Call",
  datum: "15. Dezember 2025",
  uhrzeit: "14:30",
  meetingLink: "https://meet.google.com/abc-defg-hij",
};

// All email templates with their HTML
const EMAIL_TEMPLATES = [
  {
    id: "confirmation",
    name: "Terminbestätigung",
    subject: "Dein Termin steht!",
    description: "Wird nach Buchung gesendet",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 24px; margin-bottom: 20px;">Dein Termin steht!</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>schön, dass du dabei bist! Hier nochmal alle Details zu deinem Termin:</p>

  <p><strong>Was:</strong> Discovery Call</p>
  <p><strong>Wann:</strong> ${EXAMPLE_DATA.datum} um ${EXAMPLE_DATA.uhrzeit} Uhr</p>
  <p><strong>Wo:</strong> <a href="${EXAMPLE_DATA.meetingLink}" style="color: #0066cc;">${EXAMPLE_DATA.meetingLink}</a></p>

  <p>Falls du den Termin verschieben musst oder Fragen hast, melde dich einfach kurz bei uns – kein Problem!</p>

  <p>Bis dahin kannst du dich gerne schon mal in unserer Academy umsehen. Dort findest du jede Menge hilfreiche Ressourcen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Wir freuen uns auf dich!</p>

  <p>Liebe Grüße</p>
</body>
</html>`,
  },
  {
    id: "reminder_24h",
    name: "24h Erinnerung",
    subject: "Kleine Erinnerung für Morgen",
    description: "24 Stunden vor dem Termin",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Morgen ist es soweit!</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>wir wissen, wie schnell die Tage manchmal verfliegen – zwischen E-Mails, Meetings und To-do-Listen kann man leicht mal was übersehen. Deshalb hier ein freundlicher Reminder von uns:</p>

  <p>Morgen steht dein Termin an:</p>

  <p><strong>Was:</strong> ${EXAMPLE_DATA.terminart}</p>
  <p><strong>Wann:</strong> ${EXAMPLE_DATA.datum} um ${EXAMPLE_DATA.uhrzeit} Uhr</p>
  <p><strong>Wo:</strong> <a href="${EXAMPLE_DATA.meetingLink}" style="color: #0066cc;">${EXAMPLE_DATA.meetingLink}</a></p>

  <p>Trag ihn dir am besten nochmal kurz in den Kalender ein, falls noch nicht geschehen. Und falls dir was dazwischengekommen ist – kein Stress!<br>
  Melde dich einfach kurz bei uns, dann finden wir einen neuen Termin.</p>

  <p>Du willst dich vorab schon ein bisschen einstimmen? In unserer Academy findest du hilfreiche Inhalte, die dir den Einstieg erleichtern:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Wir freuen uns auf morgen!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>`,
  },
  {
    id: "reminder_1h",
    name: "1h Erinnerung",
    subject: "Unser Termin beginnt gleich",
    description: "1 Stunde vor dem Termin",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">In einer Stunde geht's los!</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>der Alltag kann ganz schön turbulent sein – deshalb wollten wir uns nochmal kurz bei dir melden. In einer Stunde startet dein Termin:</p>

  <p><strong>Was:</strong> ${EXAMPLE_DATA.terminart}</p>
  <p><strong>Wann:</strong> Heute um ${EXAMPLE_DATA.uhrzeit} Uhr</p>
  <p><strong>Wo:</strong> <a href="${EXAMPLE_DATA.meetingLink}" style="color: #0066cc;">${EXAMPLE_DATA.meetingLink}</a></p>

  <p>Schnapp dir vielleicht noch einen Kaffee, mach den Browser-Tab schon mal auf und dann kann's losgehen. Wir freuen uns, dich gleich zu sehen!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>`,
  },
  {
    id: "no_show",
    name: "No-Show",
    subject: "Schade, dass wir dich verpasst haben",
    description: "Wenn jemand nicht erscheint",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Schade, dass wir dich verpasst haben</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>wir hatten uns auf unser Gespräch gefreut, aber leider konnten wir dich nicht erreichen:</p>

  <p><strong>Was:</strong> ${EXAMPLE_DATA.terminart}</p>
  <p><strong>Wann:</strong> ${EXAMPLE_DATA.datum} um ${EXAMPLE_DATA.uhrzeit} Uhr</p>

  <p>Kein Problem – das Leben ist manchmal unberechenbar! Falls du immer noch Interesse hast, kannst du ganz einfach einen neuen Termin buchen:</p>

  <a href="https://cal.com/auto-ki/discovery" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Neuen Termin buchen</a>

  <p>Falls du Fragen hast oder etwas dazwischengekommen ist, melde dich gerne bei uns.</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>`,
  },
  {
    id: "meeting_running",
    name: "Meeting läuft",
    subject: "Dein Meeting läuft gerade – wir warten auf dich!",
    description: "Wenn Meeting gestartet aber Person fehlt",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Dein Meeting läuft gerade!</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>wir sitzen gerade im Meeting und warten auf dich! Das Gespräch hat um <strong>${EXAMPLE_DATA.uhrzeit} Uhr</strong> begonnen.</p>

  <p><strong>Was:</strong> ${EXAMPLE_DATA.terminart}</p>
  <p><strong>Gestartet um:</strong> ${EXAMPLE_DATA.uhrzeit} Uhr</p>

  <p>Klicke einfach auf den Button, um direkt beizutreten:</p>

  <a href="${EXAMPLE_DATA.meetingLink}" style="display: inline-block; background-color: #22c55e; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 4px; margin: 16px 0; font-weight: bold;">Jetzt beitreten</a>

  <p>Falls du es heute nicht schaffst, melde dich kurz bei uns – dann finden wir einen neuen Termin.</p>

  <p>Bis gleich!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>auto.ki</strong></p>
</body>
</html>`,
  },
  {
    id: "thank_you_discovery",
    name: "Danke (Discovery)",
    subject: "Danke für das tolle Gespräch!",
    description: "Nach Discovery Call",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Danke für das tolle Gespräch!</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>vielen Dank, dass du dir die Zeit für unser Discovery Call genommen hast! Es war super, dich kennenzulernen und mehr über deine Ziele zu erfahren.</p>

  <p>Ich hoffe, du konntest einen guten ersten Eindruck gewinnen, wie wir dich unterstützen können. Falls du noch Fragen hast oder direkt loslegen möchtest, melde dich gerne bei mir.</p>

  <p>In der Zwischenzeit kannst du dich gerne in unserer Academy umsehen – dort findest du viele hilfreiche Ressourcen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Ich freue mich auf die weitere Zusammenarbeit!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Robby von auto.ki</strong></p>
</body>
</html>`,
  },
  {
    id: "thank_you_strategie",
    name: "Danke (Strategie)",
    subject: "Danke für das Strategiegespräch!",
    description: "Nach Strategie Call",
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="font-size: 28px; margin-bottom: 24px;">Danke für das Strategiegespräch!</h1>

  <p>Hey ${EXAMPLE_DATA.vorname},</p>

  <p>vielen Dank für das intensive Strategiegespräch! Es war großartig, gemeinsam an deiner Strategie zu arbeiten und konkrete nächste Schritte zu definieren.</p>

  <p>Ich bin überzeugt, dass wir zusammen Großes erreichen können. Die besprochenen Punkte und Empfehlungen werden dir helfen, deine Ziele schneller zu erreichen.</p>

  <p>Falls du noch Fragen hast oder wir etwas besprechen sollten, bin ich jederzeit für dich da.</p>

  <p>Schau auch gerne in unsere Academy – dort findest du weiterführende Ressourcen zu den besprochenen Themen:</p>

  <a href="https://academy.auto.ki" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Zur Academy</a>

  <p>Auf eine erfolgreiche Zusammenarbeit!</p>

  <p>Liebe Grüße</p>

  <p style="margin-top: 24px;"><strong>Robby von auto.ki</strong></p>
</body>
</html>`,
  },
];

export default function EmailTemplatesPage() {
  const [expandedId, setExpandedId] = useState<string | null>("confirmation");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">E-Mail Vorlagen</h1>
        <p className="text-muted-foreground">
          Alle E-Mail Templates mit Vorschau
        </p>
      </div>

      <div className="space-y-4">
        {EMAIL_TEMPLATES.map((template) => (
          <Card key={template.id}>
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() =>
                setExpandedId(expandedId === template.id ? null : template.id)
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedId === template.id ? (
                    <ChevronDownIcon className="size-5 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="size-5 text-muted-foreground" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{template.subject}</Badge>
              </div>
            </CardHeader>

            {expandedId === template.id && (
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 border-b">
                    <p className="text-sm">
                      <strong>Betreff:</strong> {template.subject}
                    </p>
                  </div>
                  <div
                    className="bg-white p-4"
                    style={{ minHeight: "300px" }}
                    dangerouslySetInnerHTML={{ __html: template.html }}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
