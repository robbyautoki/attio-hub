"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  LoaderIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StepLog {
  name: string;
  status: "success" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: string;
}

interface ExecutionLog {
  id: string;
  workflowId: string;
  status: string;
  triggerType: string;
  inputPayload: Record<string, unknown> | null;
  outputPayload: Record<string, unknown> | null;
  errorMessage: string | null;
  stepLogs: StepLog[] | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export default function WorkflowLogsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [id]);

  async function fetchLogs() {
    try {
      const res = await fetch(`/api/logs?workflowId=${id}&limit=50`);
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
      case "skipped":
        return <Badge variant="secondary">Übersprungen</Badge>;
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/workflows/${id}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Ausführungs-Logs</h1>
          <p className="text-muted-foreground">
            Detaillierte Logs für diesen Workflow
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              Noch keine Ausführungen für diesen Workflow
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() =>
                  setExpandedLog(expandedLog === log.id ? null : log.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedLog === log.id ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(log.status)}
                        <Badge variant="outline" className="text-xs">
                          {log.triggerType}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDuration(log.durationMs)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(log.startedAt).toLocaleString("de-DE")}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {log.id.slice(0, 8)}
                  </div>
                </div>
              </CardHeader>

              {expandedLog === log.id && (
                <CardContent className="pt-0">
                  {log.errorMessage && (
                    <div className="mb-4 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                      <strong>Fehler:</strong> {log.errorMessage}
                    </div>
                  )}

                  {log.stepLogs && log.stepLogs.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Schritte:</h4>
                      <div className="space-y-2">
                        {log.stepLogs.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 bg-muted rounded-lg text-sm"
                          >
                            {getStatusIcon(step.status)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{step.name}</span>
                                {getStatusBadge(step.status)}
                                <span className="text-xs text-muted-foreground">
                                  {step.durationMs}ms
                                </span>
                              </div>
                              {step.error && (
                                <div className="text-destructive text-xs mt-1">
                                  {step.error}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.inputPayload && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">Input:</h4>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                        {JSON.stringify(log.inputPayload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {log.outputPayload && (
                    <div>
                      <h4 className="font-medium mb-2">Output:</h4>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
                        {JSON.stringify(log.outputPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
