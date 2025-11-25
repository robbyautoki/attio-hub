const ATTIO_API_BASE = "https://api.attio.com/v2";

export interface AttioContact {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface AttioCreatePersonPayload {
  data: {
    values: {
      email_addresses?: Array<{ email_address: string }>;
      name?: Array<{ first_name?: string; last_name?: string; full_name?: string }>;
      phone_numbers?: Array<{ phone_number: string }>;
      [key: string]: unknown;
    };
  };
}

/**
 * Attio API Client
 */
export class AttioClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${ATTIO_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Attio API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to list objects - this verifies the API key works
      await this.request("/objects");
      return { success: true, message: "Verbindung erfolgreich!" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Verbindung fehlgeschlagen",
      };
    }
  }

  /**
   * Create or update a person in Attio
   */
  async upsertPerson(data: {
    email: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }): Promise<unknown> {
    const payload: AttioCreatePersonPayload = {
      data: {
        values: {
          email_addresses: [{ email_address: data.email }],
        },
      },
    };

    // Add name
    if (data.name || data.firstName || data.lastName) {
      payload.data.values.name = [
        {
          full_name: data.name || undefined,
          first_name: data.firstName || undefined,
          last_name: data.lastName || undefined,
        },
      ];
    }

    // Add phone
    if (data.phone) {
      payload.data.values.phone_numbers = [{ phone_number: data.phone }];
    }

    // Use assert endpoint for upsert behavior
    return this.request("/objects/people/records", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Find a person by email
   */
  async findPersonByEmail(email: string): Promise<unknown> {
    return this.request("/objects/people/records/query", {
      method: "POST",
      body: JSON.stringify({
        filter: {
          email_addresses: {
            email_address: { "$eq": email },
          },
        },
      }),
    });
  }
}

/**
 * Create an Attio client instance
 */
export function createAttioClient(apiKey: string): AttioClient {
  return new AttioClient(apiKey);
}
