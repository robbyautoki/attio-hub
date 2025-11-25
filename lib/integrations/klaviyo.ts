const KLAVIYO_API_BASE = "https://a.klaviyo.com/api";

export interface KlaviyoProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Klaviyo API Client
 */
export class KlaviyoClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${KLAVIYO_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Klaviyo-API-Key ${this.apiKey}`,
        "Content-Type": "application/json",
        revision: "2024-02-15", // Klaviyo API version
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Klaviyo API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Try to get account info
      await this.request("/accounts/");
      return { success: true, message: "Verbindung erfolgreich!" };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Verbindung fehlgeschlagen",
      };
    }
  }

  /**
   * Create or update a profile in Klaviyo
   */
  async upsertProfile(data: {
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    properties?: Record<string, unknown>;
  }): Promise<unknown> {
    const attributes: Record<string, unknown> = {
      email: data.email,
    };

    if (data.firstName) attributes.first_name = data.firstName;
    if (data.lastName) attributes.last_name = data.lastName;
    if (data.phone) attributes.phone_number = data.phone;
    if (data.properties) attributes.properties = data.properties;

    const payload = {
      data: {
        type: "profile",
        attributes,
      },
    };

    return this.request("/profiles/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Subscribe a profile to a list
   */
  async subscribeToList(
    listId: string,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<unknown> {
    const payload = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [
              {
                type: "profile",
                attributes: {
                  email,
                  ...(firstName && { first_name: firstName }),
                  ...(lastName && { last_name: lastName }),
                },
              },
            ],
          },
        },
        relationships: {
          list: {
            data: {
              type: "list",
              id: listId,
            },
          },
        },
      },
    };

    return this.request("/profile-subscription-bulk-create-jobs/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get all lists
   */
  async getLists(): Promise<unknown> {
    return this.request("/lists/");
  }

  /**
   * Find profile by email
   */
  async findProfileByEmail(email: string): Promise<unknown> {
    return this.request(`/profiles/?filter=equals(email,"${encodeURIComponent(email)}")`);
  }
}

/**
 * Create a Klaviyo client instance
 */
export function createKlaviyoClient(apiKey: string): KlaviyoClient {
  return new KlaviyoClient(apiKey);
}
