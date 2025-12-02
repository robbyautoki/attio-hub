"use client";

import { useState, useEffect } from "react";
import {
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  MailIcon,
  ClockIcon,
  BellIcon,
  UserCheckIcon,
  UserXIcon,
  VideoIcon,
  HeartIcon,
  TestTubeIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmailLog {
  id: string;
  emailType: string;
  to: string;
  subject: string;
  from: string;
  status: string;
  resendId: string | null;
  errorMessage: string | null;
  bookingId: string | null;
  sentAt: string;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  confirmation: "Bestätigung",
  reminder_24h: "24h Erinnerung",
  reminder_1h: "1h Erinnerung",
  no_show: "No-Show",
  meeting_running: "Meeting läuft",
  thank_you_discovery: "Danke (Discovery)",
  thank_you_strategie: "Danke (Strategie)",
  test: "Test",
};

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/emails/logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Error fetching email logs:", error);
    } finally {
      setLoading(false);
    }
  }

  function getEmailTypeIcon(type: string) {
    switch (type) {
      case "confirmation":
        return <MailIcon className="size-4 text-blue-500" />;
      case "reminder_24h":
        return <BellIcon className="size-4 text-orange-500" />;
      case "reminder_1h":
        return <ClockIcon className="size-4 text-yellow-500" />;
      case "no_show":
        return <UserXIcon className="size-4 text-red-500" />;
      case "meeting_running":
        return <VideoIcon className="size-4 text-purple-500" />;
      case "thank_you_discovery":
      case "thank_you_strategie":
        return <HeartIcon className="size-4 text-pink-500" />;
      case "test":
        return <TestTubeIcon className="size-4 text-gray-500" />;
      default:
        return <MailIcon className="size-4 text-muted-foreground" />;
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "sent":
        return <CheckCircleIcon className="size-4 text-green-500" />;
      case "failed":
        return <XCircleIcon className="size-4 text-destructive" />;
      case "scheduled":
        return <ClockIcon className="size-4 text-blue-500" />;
      default:
        return <ClockIcon className="size-4 text-muted-foreground" />;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500">Gesendet</Badge>;
      case "failed":
        return <Badge variant="destructive">Fehlgeschlagen</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-500">Geplant</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">E-Mail Logs</h1>
        <p className="text-muted-foreground">
          Alle gesendeten E-Mails im Überblick
        </p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MailIcon className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Noch keine E-Mails gesendet
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Gesendete E-Mails ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{log.to}</span>
                        {getStatusBadge(log.status)}
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          {getEmailTypeIcon(log.emailType)}
                          {EMAIL_TYPE_LABELS[log.emailType] || log.emailType}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {log.subject}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.sentAt).toLocaleString("de-DE")}
                      </div>
                      {log.errorMessage && (
                        <div className="text-sm text-destructive mt-1">
                          {log.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {log.resendId ? log.resendId.slice(0, 8) : log.id.slice(0, 8)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
