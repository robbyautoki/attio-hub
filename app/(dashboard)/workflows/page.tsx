"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlusIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  CopyIcon,
  LoaderIcon,
  CheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  isEnabled: boolean;
  status: string;
  webhookUrl: string | null;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutedAt: string | null;
  createdAt: string;
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  async function fetchWorkflows() {
    try {
      const res = await fetch("/api/workflows");
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error("Error fetching workflows:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    try {
      const res = await fetch(`/api/workflows/${id}/toggle`, { method: "POST" });
      if (res.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error("Error toggling workflow:", error);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Workflow wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchWorkflows();
      }
    } catch (error) {
      console.error("Error deleting workflow:", error);
    }
  }

  async function copyWebhookUrl(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getStatusBadge(status: string, isEnabled: boolean) {
    if (!isEnabled) {
      return <Badge variant="secondary">Deaktiviert</Badge>;
    }
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Aktiv</Badge>;
      case "paused":
        return <Badge variant="secondary">Pausiert</Badge>;
      case "error":
        return <Badge variant="destructive">Fehler</Badge>;
      default:
        return <Badge variant="outline">Entwurf</Badge>;
    }
  }

  function getTriggerLabel(triggerType: string) {
    switch (triggerType) {
      case "webhook":
        return "Webhook";
      case "manual":
        return "Manuell";
      case "schedule":
        return "Zeitplan";
      default:
        return triggerType;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Deine Automatisierungen im Überblick
          </p>
        </div>
        <Button asChild>
          <Link href="/workflows/new">
            <PlusIcon className="mr-2 size-4" />
            Neuer Workflow
          </Link>
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Noch keine Workflows vorhanden
            </p>
            <Button asChild>
              <Link href="/workflows/new">
                <PlusIcon className="mr-2 size-4" />
                Ersten Workflow erstellen
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link href={`/workflows/${workflow.id}`}>
                      <CardTitle className="text-lg hover:underline">
                        {workflow.name}
                      </CardTitle>
                    </Link>
                    {getStatusBadge(workflow.status, workflow.isEnabled)}
                    <Badge variant="outline">
                      {getTriggerLabel(workflow.triggerType)}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggle(workflow.id)}
                      disabled={togglingId === workflow.id}
                    >
                      {togglingId === workflow.id ? (
                        <LoaderIcon className="size-4 animate-spin" />
                      ) : workflow.isEnabled ? (
                        <PauseIcon className="size-4" />
                      ) : (
                        <PlayIcon className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(workflow.id)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>
                {workflow.description && (
                  <CardDescription>{workflow.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {workflow.webhookUrl && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {workflow.webhookUrl.slice(0, 50)}...
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyWebhookUrl(workflow.webhookUrl!, workflow.id)}
                      >
                        {copiedId === workflow.id ? (
                          <CheckIcon className="size-3 text-green-500" />
                        ) : (
                          <CopyIcon className="size-3" />
                        )}
                      </Button>
                    </div>
                  )}
                  <span>
                    {workflow.totalExecutions} Ausführungen
                    {workflow.failedExecutions > 0 && (
                      <span className="text-destructive">
                        {" "}({workflow.failedExecutions} fehlgeschlagen)
                      </span>
                    )}
                  </span>
                  {workflow.lastExecutedAt && (
                    <span>
                      Zuletzt: {new Date(workflow.lastExecutedAt).toLocaleString("de-DE")}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
