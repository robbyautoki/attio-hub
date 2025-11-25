"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ExecutionLog {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  triggerType: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "success":
        return <CheckCircleIcon className="size-4 text-green-500" />;
      case "failed":
        return <XCircleIcon className="size-4 text-destructive" />;
      case "running":
        return <PlayIcon className="size-4 text-blue-500" />;
      case "pending":
        return <ClockIcon className="size-4 text-yellow-500" />;
      default:
        return <ClockIcon className="size-4 text-muted-foreground" />;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Erfolgreich</Badge>;
      case "failed":
        return <Badge variant="destructive">Fehlgeschlagen</Badge>;
      case "running":
        return <Badge className="bg-blue-500">Läuft</Badge>;
      case "pending":
        return <Badge variant="secondary">Wartend</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function formatDuration(ms: number | null) {
    if (ms === null) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
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
        <h1 className="text-3xl font-bold">Ausführungs-Logs</h1>
        <p className="text-muted-foreground">
          Alle Workflow-Ausführungen im Überblick
        </p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              Noch keine Ausführungen vorhanden
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Letzte Ausführungen</CardTitle>
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
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/workflows/${log.workflowId}`}
                          className="font-medium hover:underline"
                        >
                          {log.workflowName || "Workflow"}
                        </Link>
                        {getStatusBadge(log.status)}
                        <Badge variant="outline" className="text-xs">
                          {log.triggerType}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(log.startedAt).toLocaleString("de-DE")}
                        {log.durationMs !== null && (
                          <> • {formatDuration(log.durationMs)}</>
                        )}
                      </div>
                      {log.errorMessage && (
                        <div className="text-sm text-destructive mt-1">
                          {log.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {log.id.slice(0, 8)}
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
