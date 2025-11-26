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
      phone_numbers?: Array<{ original_phone_number: string }>;
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
   * Create or update a person in Attio (upsert by email)
   */
  async upsertPerson(data: {
    email: string;
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    bookingStatus?: string | null;
    meetingType?: string | null;
  }): Promise<unknown> {
    const values: Record<string, unknown> = {
      email_addresses: [{ email_address: data.email }],
    };

    // Add name
    if (data.name || data.firstName || data.lastName) {
      values.name = [
        {
          full_name: data.name || undefined,
          first_name: data.firstName || undefined,
          last_name: data.lastName || undefined,
        },
      ];
    }

    // Add phone
    if (data.phone) {
      values.phone_numbers = [{ original_phone_number: data.phone }];
    }

    // Add booking_status (select field)
    if (data.bookingStatus) {
      values.booking_status = data.bookingStatus;
    }

    // Add meeting_type (select or text field)
    if (data.meetingType) {
      values.meeting_type = data.meetingType;
    }

    // Use PUT with matching_attribute for upsert behavior
    // This creates if not exists, updates if exists (matched by email)
    return this.request("/objects/people/records?matching_attribute=email_addresses", {
      method: "PUT",
      body: JSON.stringify({
        data: { values },
      }),
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
