import { createAttioClient, AttioClient } from "./attio";
import { createKlaviyoClient, KlaviyoClient } from "./klaviyo";
import type { ServiceType } from "@/lib/services/api-key.service";

export type IntegrationClient = AttioClient | KlaviyoClient;

/**
 * Service metadata for the UI
 */
export const SERVICE_METADATA: Record<
  ServiceType,
  {
    name: string;
    description: string;
    docsUrl: string;
    placeholder: string;
  }
> = {
  attio: {
    name: "Attio CRM",
    description: "CRM für moderne Teams",
    docsUrl: "https://developers.attio.com",
    placeholder: "attio_...",
  },
  klaviyo: {
    name: "Klaviyo",
    description: "Email & SMS Marketing",
    docsUrl: "https://developers.klaviyo.com",
    placeholder: "pk_...",
  },
  calcom: {
    name: "Cal.com",
    description: "Scheduling Infrastructure",
    docsUrl: "https://cal.com/docs/api",
    placeholder: "cal_live_...",
  },
  resend: {
    name: "Resend",
    description: "E-Mail API für Entwickler",
    docsUrl: "https://resend.com/docs",
    placeholder: "re_...",
  },
};

/**
 * Test an integration connection
 */
export async function testIntegrationConnection(
  service: ServiceType,
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  switch (service) {
    case "attio": {
      const client = createAttioClient(apiKey);
      return client.testConnection();
    }
    case "klaviyo": {
      const client = createKlaviyoClient(apiKey);
      return client.testConnection();
    }
    case "calcom": {
      // Cal.com doesn't need testing - it sends webhooks to us
      return {
        success: true,
        message: "Cal.com Webhook Secret gespeichert. Konfiguriere den Webhook in Cal.com.",
      };
    }
    case "resend": {
      // Test Resend API key by fetching domains
      try {
        const response = await fetch("https://api.resend.com/domains", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (response.ok) {
          return { success: true, message: "Verbindung erfolgreich!" };
        }
        return { success: false, message: `API Fehler: ${response.status}` };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Verbindung fehlgeschlagen",
        };
      }
    }
    default:
      return { success: false, message: "Unbekannter Service" };
  }
}

/**
 * Get an integration client by service type
 */
export function getIntegrationClient(
  service: ServiceType,
  apiKey: string
): IntegrationClient | null {
  switch (service) {
    case "attio":
      return createAttioClient(apiKey);
    case "klaviyo":
      return createKlaviyoClient(apiKey);
    default:
      return null;
  }
}
