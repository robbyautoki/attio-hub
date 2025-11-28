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
    // New fields for Academy
    linkedinUrl?: string | null;
    jobTitle?: string | null;
  }): Promise<unknown> {
    const values: Record<string, unknown> = {
      email_addresses: [{ email_address: data.email }],
    };

    // Add name - Attio requires ALL fields: full_name, first_name, last_name
    // For single-word names, use the same value for all fields
    if (data.name && data.name.trim()) {
      const trimmedName = data.name.trim();
      const nameParts = trimmedName.split(" ");
      const firstName = nameParts[0] || trimmedName;
      const lastName = nameParts.slice(1).join(" ") || trimmedName; // Single word: use same name

      values.name = [{
        full_name: trimmedName,
        first_name: firstName,
        last_name: lastName,
      }];
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

    // Add LinkedIn handle (slug: linkedin)
    // Attio expects just the handle, not full URL
    // Extract from: https://linkedin.com/in/username or https://www.linkedin.com/in/username/
    if (data.linkedinUrl) {
      let linkedinHandle = data.linkedinUrl.trim();

      // Extract handle from URL if it's a full URL
      const linkedinMatch = linkedinHandle.match(/linkedin\.com\/in\/([^/?]+)/i);
      if (linkedinMatch) {
        linkedinHandle = linkedinMatch[1];
      }

      // Remove trailing slashes
      linkedinHandle = linkedinHandle.replace(/\/$/, "");

      if (linkedinHandle) {
        values.linkedin = linkedinHandle;
      }
    }

    // Add Job Title (text field, slug: job_title)
    if (data.jobTitle) {
      values.job_title = data.jobTitle;
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
   * Create or update a company in Attio (upsert by domain)
   */
  async upsertCompany(data: {
    domain: string;
    name?: string | null;
    industry?: string | null;
    companySize?: string | null;
  }): Promise<unknown> {
    const values: Record<string, unknown> = {
      domains: [{ domain: data.domain }],
    };

    // Add company name
    if (data.name) {
      values.name = data.name;
    }

    // Add industry (select field, slug: industry)
    // Attio has specific German industry options
    if (data.industry) {
      // Valid Attio industry options
      const validIndustries = [
        "SAAS / Software",
        "E-Commerce",
        "Agentur / Beratung",
        "Finanzdienstleistungen",
        "Immobilien",
        "Gesundheitswesen",
        "Bildung",
        "Produktion / Fertigung",
        "Sonstiges",
      ];

      // Map common English/variant names to Attio options
      const industryMap: Record<string, string> = {
        // English to German
        "software": "SAAS / Software",
        "saas": "SAAS / Software",
        "tech": "SAAS / Software",
        "technology": "SAAS / Software",
        "ecommerce": "E-Commerce",
        "e-commerce": "E-Commerce",
        "retail": "E-Commerce",
        "agency": "Agentur / Beratung",
        "consulting": "Agentur / Beratung",
        "beratung": "Agentur / Beratung",
        "finance": "Finanzdienstleistungen",
        "financial": "Finanzdienstleistungen",
        "banking": "Finanzdienstleistungen",
        "real estate": "Immobilien",
        "realestate": "Immobilien",
        "healthcare": "Gesundheitswesen",
        "health": "Gesundheitswesen",
        "medical": "Gesundheitswesen",
        "education": "Bildung",
        "manufacturing": "Produktion / Fertigung",
        "production": "Produktion / Fertigung",
        "other": "Sonstiges",
      };

      const lowerIndustry = data.industry.toLowerCase().trim();
      let mappedIndustry = industryMap[lowerIndustry];

      // If not in map, check if it's already a valid option
      if (!mappedIndustry) {
        const exactMatch = validIndustries.find(
          (v) => v.toLowerCase() === lowerIndustry
        );
        mappedIndustry = exactMatch || "Sonstiges";
      }

      values.industry = mappedIndustry;
    }

    // Add company size (select field, slug: unternehmensgrosse)
    // Attio expects German format with "Mitarbeiter" suffix
    if (data.companySize) {
      // Map common formats to Attio's German options
      const sizeMap: Record<string, string> = {
        "1-10": "1-10 Mitarbeiter",
        "11-50": "11-50 Mitarbeiter",
        "51-200": "51-200 Mitarbeiter",
        "201-1000": "201-1000 Mitarbeiter",
        "1000+": "1000+ Mitarbeiter",
        // Also accept already formatted values
        "1-10 Mitarbeiter": "1-10 Mitarbeiter",
        "11-50 Mitarbeiter": "11-50 Mitarbeiter",
        "51-200 Mitarbeiter": "51-200 Mitarbeiter",
        "201-1000 Mitarbeiter": "201-1000 Mitarbeiter",
        "1000+ Mitarbeiter": "1000+ Mitarbeiter",
      };

      const mappedSize = sizeMap[data.companySize] || `${data.companySize} Mitarbeiter`;
      values.unternehmensgrosse = mappedSize;
    }

    // Use PUT with matching_attribute for upsert behavior
    return this.request("/objects/companies/records?matching_attribute=domains", {
      method: "PUT",
      body: JSON.stringify({
        data: { values },
      }),
    });
  }

  /**
   * Add a note to a person record
   */
  async addNoteToPerson(data: {
    recordId: string;
    title: string;
    content: string;
  }): Promise<unknown> {
    return this.request("/notes", {
      method: "POST",
      body: JSON.stringify({
        data: {
          parent_object: "people",
          parent_record_id: data.recordId,
          title: data.title,
          format: "plaintext",
          content: data.content,
        },
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

  /**
   * Create a deal in Attio
   * Links to person and optionally company
   */
  async createDeal(data: {
    name: string;
    personRecordId: string;
    companyRecordId?: string | null;
    stageStatusId?: string;
  }): Promise<unknown> {
    // Default stage: "Discovery Call" status ID
    const DISCOVERY_CALL_STATUS_ID = "0feb4f77-f994-4347-b058-c43f5b3c8070";

    const values: Record<string, unknown> = {
      name: data.name,
      stage: [{ status_id: data.stageStatusId || DISCOVERY_CALL_STATUS_ID }],
      associated_people: [{ target_record_id: data.personRecordId }],
    };

    // Add company link if provided
    if (data.companyRecordId) {
      values.associated_company = [{ target_record_id: data.companyRecordId }];
    }

    return this.request("/objects/deals/records", {
      method: "POST",
      body: JSON.stringify({
        data: { values },
      }),
    });
  }

  /**
   * Find a company by domain
   */
  async findCompanyByDomain(domain: string): Promise<{ data?: Array<{ id?: { record_id?: string } }> }> {
    return this.request("/objects/companies/records/query", {
      method: "POST",
      body: JSON.stringify({
        filter: {
          domains: {
            domain: { "$eq": domain },
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
