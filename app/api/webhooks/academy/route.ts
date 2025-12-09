import { NextResponse } from "next/server";
import { getWorkflowByWebhookPath, incrementExecutionStats } from "@/lib/services/workflow.service";
import { createExecutionLog, updateExecutionLog } from "@/lib/services/execution.service";
import { createAttioClient } from "@/lib/integrations/attio";
import { getDecryptedApiKeyByService } from "@/lib/services/api-key.service";

// Academy Slack Webhook URL from environment
const ACADEMY_SLACK_WEBHOOK = process.env.ACADEMY_SLACK_WEBHOOK_URL;

// Academy List ID in Attio (from the URL: /collection/cd17dadd-2553-4477-8620-fa56045d88a4)
const ACADEMY_LIST_ID = "cd17dadd-2553-4477-8620-fa56045d88a4";

interface StepLog {
  name: string;
  status: "success" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs: number;
  timestamp: string;
}

// Slack Block Kit types
interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
  elements?: { type: string; text?: { type: string; text: string }; url?: string; style?: string }[];
}

/**
 * Send Block Kit notification to Academy Slack channel
 */
async function sendAcademySlackBlocks(blocks: SlackBlock[], fallbackText: string): Promise<void> {
  if (!ACADEMY_SLACK_WEBHOOK) {
    throw new Error("ACADEMY_SLACK_WEBHOOK_URL not configured");
  }

  const response = await fetch(ACADEMY_SLACK_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: fallbackText,
      blocks
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack notification failed: ${response.status}`);
  }
}

/**
 * Format Registration event as Slack Block Kit
 */
function formatRegistrationBlocks(user: Record<string, unknown>): SlackBlock[] {
  const name = (user.full_name || user.name || "Unbekannt") as string;
  const email = (user.email || "") as string;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🎉 Neue Academy Registrierung",
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name:*\n${name}` },
        { type: "mrkdwn", text: `*Email:*\n${email}` },
      ],
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `📅 ${new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}` },
      ],
    },
  ];
}

/**
 * Format Profile Update event as Slack Block Kit
 */
function formatProfileUpdateBlocks(user: Record<string, unknown>): SlackBlock[] {
  const name = (user.full_name || user.name || "Unbekannt") as string;
  const email = (user.email || "") as string;
  const companyName = (user.company_name || "") as string;
  const website = (user.website || "") as string;
  const jobTitle = (user.job_title || user.jobTitle || "") as string;
  const industry = (user.industry || "") as string;
  const companySize = (user.company_size || user.companySize || "") as string;
  const linkedinUrl = (user.linkedin_url || user.linkedinUrl || "") as string;

  const fields: { type: string; text: string }[] = [
    { type: "mrkdwn", text: `*Name:*\n${name}` },
    { type: "mrkdwn", text: `*Email:*\n${email}` },
  ];

  if (companyName) fields.push({ type: "mrkdwn", text: `*Unternehmen:*\n${companyName}` });
  if (website) fields.push({ type: "mrkdwn", text: `*Website:*\n${website}` });
  if (jobTitle) fields.push({ type: "mrkdwn", text: `*Position:*\n${jobTitle}` });
  if (industry) fields.push({ type: "mrkdwn", text: `*Branche:*\n${industry}` });
  if (companySize) fields.push({ type: "mrkdwn", text: `*Unternehmensgröße:*\n${companySize}` });

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📝 Profil aktualisiert",
        emoji: true,
      },
    },
    {
      type: "section",
      fields,
    },
  ];

  // Add LinkedIn button if URL provided
  if (linkedinUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "🔗 LinkedIn Profil" },
          url: linkedinUrl,
          style: "primary",
        },
      ],
    });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `📅 ${new Date().toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}` },
    ],
  });

  return blocks;
}

/**
 * Format generic Academy event for Slack (fallback)
 */
function formatGenericBlocks(payload: Record<string, unknown>): SlackBlock[] {
  const eventType = payload.event || payload.type || "unknown";
  const user = payload.user as Record<string, unknown> | undefined;
  const name = user ? (user.full_name || user.name || "Unbekannt") as string : "Unbekannt";
  const email = user ? (user.email || "") as string : "";

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📣 Academy Event: ${eventType}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name:*\n${name}` },
        { type: "mrkdwn", text: `*Email:*\n${email}` },
      ],
    },
  ];
}

/**
 * Add a person to the Academy list in Attio
 * Uses the Attio Lists API to add entries
 * @param recordId - The record ID from the upsertPerson result
 */
async function addPersonToAcademyList(apiKey: string, recordId: string): Promise<void> {
  // Add person to the Academy list
  // Attio Lists API: POST /v2/lists/{list_id}/entries
  const response = await fetch(`https://api.attio.com/v2/lists/${ACADEMY_LIST_ID}/entries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        parent_record_id: recordId,
        parent_object: "people",
        entry_values: {},
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    // Ignore 409 conflict (already in list)
    if (response.status !== 409) {
      throw new Error(`Failed to add to Academy list: ${response.status} - ${errorText}`);
    }
    console.log("Person already in Academy list");
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const stepLogs: StepLog[] = [];
  let logId: string | null = null;
  let workflow: Awaited<ReturnType<typeof getWorkflowByWebhookPath>> = null;

  try {
    const payload = await request.json();

    console.log("Academy webhook received:", JSON.stringify(payload, null, 2));

    // Get the workflow for this webhook
    workflow = await getWorkflowByWebhookPath("academy");

    // Create execution log if workflow exists
    if (workflow) {
      const log = await createExecutionLog(workflow.id, "webhook", payload);
      logId = log.id;
      await updateExecutionLog(logId, { status: "running" });
    }

    // Step 1: Parse Academy Payload
    const stepStartParse = Date.now();
    stepLogs.push({
      name: "Parse Academy Payload",
      status: "success",
      input: payload,
      output: {
        eventType: payload.event || payload.type || "unknown",
        hasUser: !!payload.user || !!payload.member,
        hasCourse: !!payload.course || !!payload.product,
      },
      durationMs: Date.now() - stepStartParse,
      timestamp: new Date().toISOString(),
    });

    // Determine event type early for Slack formatting
    const eventType = String(payload.event || payload.type || "").toLowerCase();
    const isRegistration = eventType.includes("registration") || eventType.includes("signup") || eventType.includes("created");
    const isProfileUpdate = eventType.includes("profile_update") || eventType.includes("profile.update");

    // Step 2: Format and send Slack notification with Block Kit
    const stepStartSlack = Date.now();
    try {
      const user = payload.user as Record<string, unknown> | undefined;
      let blocks: SlackBlock[];
      let fallbackText: string;

      if (isRegistration && user) {
        blocks = formatRegistrationBlocks(user);
        fallbackText = `🎉 Neue Academy Registrierung: ${user.full_name || user.name || user.email}`;
      } else if (isProfileUpdate && user) {
        blocks = formatProfileUpdateBlocks(user);
        fallbackText = `📝 Profil aktualisiert: ${user.full_name || user.name || user.email}`;
      } else {
        blocks = formatGenericBlocks(payload);
        fallbackText = `📣 Academy Event: ${payload.event || payload.type}`;
      }

      await sendAcademySlackBlocks(blocks, fallbackText);

      stepLogs.push({
        name: "Send Academy Slack Notification",
        status: "success",
        output: { blocks, fallbackText },
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      stepLogs.push({
        name: "Send Academy Slack Notification",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        durationMs: Date.now() - stepStartSlack,
        timestamp: new Date().toISOString(),
      });
    }

    const isLeadInquiry = eventType.includes("lead.inquiry") || eventType.includes("lead_inquiry");

    // Get Attio API key once for all Attio operations
    let attioApiKey: string | null = null;
    if (workflow) {
      attioApiKey = await getDecryptedApiKeyByService(workflow.userId, "attio");
    }

    // Step 3: Handle user.registration - Add to Attio + Academy List
    if (isRegistration && payload.user) {
      const stepStartAttio = Date.now();
      try {
        const user = payload.user as Record<string, unknown>;
        const email = user.email as string;
        const fullName = (user.full_name || user.name || "") as string;

        if (email && attioApiKey) {
          const attioClient = createAttioClient(attioApiKey);

          const attioResult = await attioClient.upsertPerson({
            email,
            name: fullName.trim() || undefined,
          }) as { data?: { id?: { record_id?: string } } };

          const recordId = attioResult?.data?.id?.record_id;
          if (recordId) {
            await addPersonToAcademyList(attioApiKey, recordId);
          }

          stepLogs.push({
            name: "Add to Attio Academy List",
            status: "success",
            input: { email, fullName },
            output: attioResult,
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        } else {
          stepLogs.push({
            name: "Add to Attio Academy List",
            status: "skipped",
            error: !email ? "No email in payload" : "Attio API key not configured",
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        stepLogs.push({
          name: "Add to Attio Academy List",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 4: Handle user.profile_update - Update Person + Company in Attio
    if (isProfileUpdate && payload.user) {
      const stepStartAttio = Date.now();
      try {
        const user = payload.user as Record<string, unknown>;
        const email = user.email as string;
        const jobTitle = (user.job_title || user.jobTitle || "") as string;
        const industry = (user.industry || "") as string;
        const companySize = (user.company_size || user.companySize || "") as string;

        if (email && attioApiKey) {
          const attioClient = createAttioClient(attioApiKey);

          // Update person with job_title
          const personResult = await attioClient.upsertPerson({
            email,
            jobTitle: jobTitle.trim() || undefined,
          }) as { data?: { id?: { record_id?: string } } };

          // If industry or company_size provided, update/create company
          let companyResult = null;
          if (industry || companySize) {
            // Extract domain from email for company matching
            const domain = email.split("@")[1];
            if (domain && !domain.includes("gmail") && !domain.includes("yahoo") && !domain.includes("hotmail") && !domain.includes("outlook")) {
              companyResult = await attioClient.upsertCompany({
                domain,
                industry: industry || undefined,
                companySize: companySize || undefined,
              });
            }
          }

          stepLogs.push({
            name: "Update Attio Profile",
            status: "success",
            input: { email, jobTitle, industry, companySize },
            output: { personResult, companyResult },
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        } else {
          stepLogs.push({
            name: "Update Attio Profile",
            status: "skipped",
            error: !email ? "No email in payload" : "Attio API key not configured",
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        stepLogs.push({
          name: "Update Attio Profile",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Step 5: Handle lead.inquiry - Update Person with LinkedIn + Company
    if (isLeadInquiry && payload.lead) {
      const stepStartAttio = Date.now();
      try {
        const lead = payload.lead as Record<string, unknown>;
        const email = (lead.email || "") as string;
        const linkedinUrl = (lead.linkedin_url || lead.linkedinUrl || "") as string;
        const jobTitle = (lead.job_title || lead.jobTitle || "") as string;
        const industry = (lead.industry || "") as string;
        const companySize = (lead.company_size || lead.companySize || "") as string;

        if (email && attioApiKey) {
          const attioClient = createAttioClient(attioApiKey);

          // Update person with LinkedIn and job_title
          const personResult = await attioClient.upsertPerson({
            email,
            linkedinUrl: linkedinUrl.trim() || undefined,
            jobTitle: jobTitle.trim() || undefined,
          }) as { data?: { id?: { record_id?: string } } };

          // Add note about lead inquiry
          const recordId = personResult?.data?.id?.record_id;
          if (recordId) {
            await attioClient.addNoteToPerson({
              recordId,
              title: "Lead-Anfrage aus Academy",
              content: `Lead-Anfrage erhalten am ${new Date().toLocaleDateString("de-DE")}${jobTitle ? `\nJob: ${jobTitle}` : ""}${industry ? `\nBranche: ${industry}` : ""}`,
            });
          }

          // Update company if industry/size provided
          let companyResult = null;
          if (industry || companySize) {
            const domain = email.split("@")[1];
            if (domain && !domain.includes("gmail") && !domain.includes("yahoo") && !domain.includes("hotmail") && !domain.includes("outlook")) {
              companyResult = await attioClient.upsertCompany({
                domain,
                industry: industry || undefined,
                companySize: companySize || undefined,
              });
            }
          }

          stepLogs.push({
            name: "Process Lead Inquiry",
            status: "success",
            input: { email, linkedinUrl, jobTitle, industry, companySize },
            output: { personResult, companyResult },
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        } else {
          stepLogs.push({
            name: "Process Lead Inquiry",
            status: "skipped",
            error: !email ? "No email in lead payload" : "Attio API key not configured",
            durationMs: Date.now() - stepStartAttio,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        stepLogs.push({
          name: "Process Lead Inquiry",
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          durationMs: Date.now() - stepStartAttio,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update execution log
    const durationMs = Date.now() - startTime;
    const hasCriticalFailure = stepLogs.some((s) => s.status === "failed");
    const finalStatus = hasCriticalFailure ? "failed" : "success";

    if (logId && workflow) {
      await updateExecutionLog(logId, {
        status: finalStatus,
        outputPayload: payload,
        stepLogs,
        completedAt: new Date(),
        durationMs,
      });
      await incrementExecutionStats(workflow.id, !hasCriticalFailure);
    }

    return NextResponse.json({
      success: true,
      message: "Academy webhook processed",
      durationMs,
    });
  } catch (error) {
    console.error("Academy webhook error:", error);
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update execution log as failed
    if (logId && workflow) {
      await updateExecutionLog(logId, {
        status: "failed",
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        stepLogs,
        completedAt: new Date(),
        durationMs,
      });
      await incrementExecutionStats(workflow.id, false);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET for testing
export async function GET() {
  return NextResponse.json({
    status: "ok",
    handler: "academy-webhook",
    webhookUrl: "https://attio-hub.vercel.app/api/webhooks/academy",
  });
}
