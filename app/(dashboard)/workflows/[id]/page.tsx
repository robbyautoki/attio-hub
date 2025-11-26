"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CopyIcon,
  CheckIcon,
  PlayIcon,
  PauseIcon,
  LoaderIcon,
  ExternalLinkIcon,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  triggerType: string;
  triggerConfig: Record<string, unknown> | null;
  webhookPath: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  code: string | null;
  requiredIntegrations: string[] | null;
  isEnabled: boolean;
  status: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  async function fetchWorkflow() {
    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkflow(data);
        setName(data.name);
        setDescription(data.description || "");
      } else {
        router.push("/workflows");
      }
    } catch (error) {
      console.error("Error fetching workflow:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (res.ok) {
        const updated = await res.json();
        setWorkflow(updated);
      }
    } catch (error) {
      console.error("Error saving workflow:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/workflows/${id}/toggle`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setWorkflow(updated);
      }
    } catch (error) {
      console.error("Error toggling workflow:", error);
    } finally {
      setToggling(false);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoaderIcon className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/workflows">
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{workflow.name}</h1>
          <p className="text-muted-foreground">Workflow-Details und Einstellungen</p>
        </div>
        <Button
          variant={workflow.isEnabled ? "destructive" : "default"}
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? (
            <LoaderIcon className="mr-2 size-4 animate-spin" />
          ) : workflow.isEnabled ? (
            <PauseIcon className="mr-2 size-4" />
          ) : (
            <PlayIcon className="mr-2 size-4" />
          )}
          {workflow.isEnabled ? "Deaktivieren" : "Aktivieren"}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Grundeinstellungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || (name === workflow.name && description === (workflow.description || ""))}
            >
              {saving && <LoaderIcon className="mr-2 size-4 animate-spin" />}
              Speichern
            </Button>
          </CardContent>
        </Card>

        {/* Status & Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Status & Statistiken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              {workflow.isEnabled ? (
                <Badge className="bg-green-500">Aktiv</Badge>
              ) : (
                <Badge variant="secondary">Deaktiviert</Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{workflow.totalExecutions}</div>
                <div className="text-xs text-muted-foreground">Gesamt</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">
                  {workflow.successfulExecutions}
                </div>
                <div className="text-xs text-muted-foreground">Erfolgreich</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">
                  {workflow.failedExecutions}
                </div>
                <div className="text-xs text-muted-foreground">Fehlgeschlagen</div>
              </div>
            </div>
            {workflow.lastExecutedAt && (
              <div className="text-sm text-muted-foreground">
                Zuletzt ausgeführt:{" "}
                {new Date(workflow.lastExecutedAt).toLocaleString("de-DE")}
              </div>
            )}
            <Button variant="outline" asChild className="w-full">
              <Link href={`/workflows/${id}/logs`}>
                <ExternalLinkIcon className="mr-2 size-4" />
                Ausführungs-Logs anzeigen
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Info */}
        {workflow.webhookUrl && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Webhook-Konfiguration</CardTitle>
              <CardDescription>
                {workflow.triggerConfig?.provider === "attio"
                  ? "Kopiere diese URL und füge sie in Attio unter Webhooks ein"
                  : "Kopiere diese URL und füge sie in Cal.com unter Webhooks ein"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Webhook URL</label>
                <div className="flex gap-2">
                  <Input
                    value={workflow.webhookUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(workflow.webhookUrl!)}
                  >
                    {copied ? (
                      <CheckIcon className="size-4 text-green-500" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              {workflow.triggerConfig && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Events</label>
                  <div className="flex flex-wrap gap-2">
                    {(workflow.triggerConfig.events as string[] || []).map((event) => (
                      <Badge key={event} variant="outline">
                        {event}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {workflow.triggerConfig?.provider === "attio" ? (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-2">Attio Einrichtung:</h4>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Gehe zu Attio → Settings → Webhooks</li>
                    <li>Klicke auf &quot;Create Webhook&quot;</li>
                    <li>Füge die Webhook URL oben ein</li>
                    <li>Wähle das Event: record.attribute-value.updated</li>
                    <li>Speichern und aktiviere den Workflow hier</li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-2">Cal.com Einrichtung:</h4>
                  <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                    <li>Gehe zu Cal.com → Settings → Webhooks</li>
                    <li>Klicke auf &quot;New Webhook&quot;</li>
                    <li>Füge die Webhook URL oben ein</li>
                    <li>Wähle die Events: BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED</li>
                    <li>Speichern und aktiviere den Workflow hier</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Required Integrations */}
        {workflow.requiredIntegrations && workflow.requiredIntegrations.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Benötigte Integrationen</CardTitle>
              <CardDescription>
                Stelle sicher, dass diese API Keys konfiguriert sind
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {workflow.requiredIntegrations.map((integration) => (
                  <Badge key={integration} variant="secondary" className="text-sm">
                    {integration}
                  </Badge>
                ))}
              </div>
              <Button variant="link" asChild className="mt-2 p-0">
                <Link href="/api-keys">API Keys verwalten →</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
