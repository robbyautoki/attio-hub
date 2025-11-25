import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusIcon, KeyIcon, WorkflowIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Willkommen bei Attio Hub - deiner Workflow-Automatisierung
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WorkflowIcon className="size-5" />
              Workflows
            </CardTitle>
            <CardDescription>
              Erstelle und verwalte deine Automatisierungen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/workflows">
                Workflows anzeigen
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusIcon className="size-5" />
              Neuer Workflow
            </CardTitle>
            <CardDescription>
              Erstelle einen neuen Workflow mit Prompts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/workflows/new">
                Workflow erstellen
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="size-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Verwalte deine API-Zugänge für Attio, Klaviyo & mehr
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/api-keys">
                API Keys verwalten
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Erste Schritte</CardTitle>
          <CardDescription>
            So richtest du deinen ersten Workflow ein
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              1
            </div>
            <div>
              <h3 className="font-medium">API Keys hinzufügen</h3>
              <p className="text-sm text-muted-foreground">
                Füge deine API-Zugänge für Attio, Klaviyo und Cal.com hinzu
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              2
            </div>
            <div>
              <h3 className="font-medium">Workflow erstellen</h3>
              <p className="text-sm text-muted-foreground">
                Beschreibe deinen Workflow und ich generiere den Code
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              3
            </div>
            <div>
              <h3 className="font-medium">Webhook konfigurieren</h3>
              <p className="text-sm text-muted-foreground">
                Kopiere die Webhook-URL in Cal.com und aktiviere den Workflow
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
