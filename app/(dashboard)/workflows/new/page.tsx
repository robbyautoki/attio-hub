"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TRIGGER_OPTIONS = [
  { value: "webhook", label: "Webhook (Cal.com, etc.)" },
  { value: "manual", label: "Manuell" },
];

const INTEGRATION_OPTIONS = [
  { value: "attio", label: "Attio CRM" },
  { value: "klaviyo", label: "Klaviyo" },
  { value: "slack", label: "Slack" },
];

const WORKFLOW_TEMPLATES = [
  {
    id: "cal-to-attio-klaviyo",
    name: "Cal.com → Attio + Klaviyo",
    description:
      "Wenn jemand einen Termin bei Cal.com bucht, wird automatisch ein Kontakt in Attio und Klaviyo erstellt.",
    triggerType: "webhook",
    triggerConfig: {
      provider: "calcom",
      events: ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"],
    },
    requiredIntegrations: ["attio", "klaviyo"],
  },
  {
    id: "attio-no-show",
    name: "Attio No-Show Handler",
    description:
      "Wenn in Attio der Booking-Status auf 'No-Show' gesetzt wird, wird die Buchung markiert und eine Slack-Benachrichtigung gesendet.",
    triggerType: "webhook",
    triggerConfig: {
      provider: "attio",
      fixedWebhookPath: "attio",
      events: ["record.attribute-value.updated"],
      attributeSlug: "booking_status",
      triggerValue: "No-Show",
    },
    requiredIntegrations: ["attio", "slack"],
  },
  {
    id: "webflow-lead-sync",
    name: "Webflow → Klaviyo Lead-Sync",
    description:
      "Wenn jemand ein Formular auf Webflow ausfüllt, wird automatisch ein Profil in Klaviyo erstellt und zur Liste hinzugefügt.",
    triggerType: "webhook",
    triggerConfig: {
      provider: "webflow",
      fixedWebhookPath: "lead-sync",
    },
    requiredIntegrations: ["klaviyo"],
  },
];

export default function NewWorkflowPage() {
  const router = useRouter();
  const [step, setStep] = useState<"template" | "custom">("template");
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("webhook");
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);

  async function handleCreateFromTemplate(template: (typeof WORKFLOW_TEMPLATES)[0]) {
    setLoading(true);

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          triggerType: template.triggerType,
          triggerConfig: template.triggerConfig,
          requiredIntegrations: template.requiredIntegrations,
        }),
      });

      if (res.ok) {
        const workflow = await res.json();
        router.push(`/workflows/${workflow.id}`);
      } else {
        alert("Fehler beim Erstellen des Workflows");
      }
    } catch (error) {
      console.error("Error creating workflow:", error);
      alert("Fehler beim Erstellen des Workflows");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCustom(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          triggerType,
          requiredIntegrations: selectedIntegrations,
        }),
      });

      if (res.ok) {
        const workflow = await res.json();
        router.push(`/workflows/${workflow.id}`);
      } else {
        alert("Fehler beim Erstellen des Workflows");
      }
    } catch (error) {
      console.error("Error creating workflow:", error);
      alert("Fehler beim Erstellen des Workflows");
    } finally {
      setLoading(false);
    }
  }

  function toggleIntegration(value: string) {
    setSelectedIntegrations((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Neuer Workflow</h1>
        <p className="text-muted-foreground">
          Wähle eine Vorlage oder erstelle einen eigenen Workflow
        </p>
      </div>

      {step === "template" ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Vorlagen</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {WORKFLOW_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                >
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {template.requiredIntegrations.map((int) => (
                        <span
                          key={int}
                          className="text-xs bg-muted px-2 py-1 rounded"
                        >
                          {int}
                        </span>
                      ))}
                    </div>
                    <Button
                      onClick={() => handleCreateFromTemplate(template)}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? (
                        <LoaderIcon className="mr-2 size-4 animate-spin" />
                      ) : null}
                      Diese Vorlage verwenden
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Oder
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => setStep("custom")}
            className="w-full"
          >
            Eigenen Workflow erstellen
          </Button>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Eigener Workflow</CardTitle>
            <CardDescription>
              Konfiguriere deinen Workflow manuell
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCustom} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="z.B. Cal.com zu CRM Sync"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Beschreibung</label>
                <Textarea
                  placeholder="Was macht dieser Workflow?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Trigger</label>
                <Select value={triggerType} onValueChange={setTriggerType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Integrationen</label>
                <div className="flex flex-wrap gap-2">
                  {INTEGRATION_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={
                        selectedIntegrations.includes(option.value)
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => toggleIntegration(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("template")}
                >
                  Zurück
                </Button>
                <Button type="submit" disabled={loading || !name}>
                  {loading ? (
                    <LoaderIcon className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Workflow erstellen
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
