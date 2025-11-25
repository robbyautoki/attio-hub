"use client";

import { useState, useEffect } from "react";
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  LoaderIcon,
  TestTubeIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ApiKey {
  id: string;
  name: string;
  service: string;
  keyHint: string;
  isValid: boolean;
  lastTestedAt: string | null;
  createdAt: string;
}

const SERVICE_OPTIONS = [
  { value: "attio", label: "Attio CRM" },
  { value: "klaviyo", label: "Klaviyo" },
  { value: "calcom", label: "Cal.com" },
  { value: "resend", label: "Resend" },
];

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formService, setFormService] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  async function fetchApiKeys() {
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);

    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          service: formService,
          apiKey: formApiKey,
        }),
      });

      if (res.ok) {
        setFormName("");
        setFormService("");
        setFormApiKey("");
        setIsDialogOpen(false);
        fetchApiKeys();
      }
    } catch (error) {
      console.error("Error creating API key:", error);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("API Key wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchApiKeys();
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);

    try {
      const res = await fetch(`/api/api-keys/${id}/test`, { method: "POST" });
      const result = await res.json();

      if (result.success) {
        alert("Verbindung erfolgreich!");
      } else {
        alert(`Fehler: ${result.message}`);
      }

      fetchApiKeys();
    } catch (error) {
      console.error("Error testing API key:", error);
      alert("Fehler beim Testen der Verbindung");
    } finally {
      setTestingId(null);
    }
  }

  function getServiceLabel(service: string) {
    return SERVICE_OPTIONS.find((s) => s.value === service)?.label || service;
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
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Verwalte deine API-Zugänge für externe Services
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 size-4" />
              API Key hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Neuen API Key hinzufügen</DialogTitle>
                <DialogDescription>
                  Füge einen API Key für einen externen Service hinzu
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="z.B. Attio Production"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service</label>
                  <Select value={formService} onValueChange={setFormService} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Service auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    placeholder="Dein API Key"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={formSubmitting}>
                  {formSubmitting ? (
                    <LoaderIcon className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Speichern
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Noch keine API Keys vorhanden
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <PlusIcon className="mr-2 size-4" />
              Ersten API Key hinzufügen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {apiKeys.map((key) => (
            <Card key={key.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{key.name}</CardTitle>
                    <Badge variant="secondary">{getServiceLabel(key.service)}</Badge>
                    {key.isValid ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircleIcon className="mr-1 size-3" />
                        Gültig
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircleIcon className="mr-1 size-3" />
                        Ungültig
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(key.id)}
                      disabled={testingId === key.id}
                    >
                      {testingId === key.id ? (
                        <LoaderIcon className="mr-2 size-4 animate-spin" />
                      ) : (
                        <TestTubeIcon className="mr-2 size-4" />
                      )}
                      Testen
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(key.id)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  Key: {key.keyHint}
                  {key.lastTestedAt && (
                    <> • Zuletzt getestet: {new Date(key.lastTestedAt).toLocaleString("de-DE")}</>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
