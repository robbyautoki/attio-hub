const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackMessage {
  text?: string;
  blocks?: unknown[];
}

interface ExecutionLogData {
  workflowName: string;
  status: string;
  durationMs: number;
  triggerType: string;
  stepLogs?: Array<{ name: string; status: string; error?: string }>;
  errorMessage?: string;
}

/**
 * Send a notification to Slack via webhook
 */
export async function sendSlackNotification(message: SlackMessage): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not configured");
    return false;
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Slack webhook error:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

/**
 * Format an execution log for Slack using Block Kit
 */
export function formatExecutionLogForSlack(log: ExecutionLogData): SlackMessage {
  const isSuccess = log.status === "success";
  const emoji = isSuccess ? "white_check_mark" : "x";
  const statusText = isSuccess ? "Workflow erfolgreich" : "Workflow fehlgeschlagen";

  // Format step logs
  const stepsText = log.stepLogs
    ?.map((step) => {
      const stepEmoji = step.status === "success" ? ":white_check_mark:" :
                        step.status === "skipped" ? ":fast_forward:" : ":x:";
      const errorText = step.error ? ` - ${step.error}` : "";
      return `${stepEmoji} ${step.name}${errorText}`;
    })
    .join("\n") || "Keine Schritte";

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `:${emoji}: ${statusText}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Workflow:*\n${log.workflowName}`,
        },
        {
          type: "mrkdwn",
          text: `*Dauer:*\n${log.durationMs}ms`,
        },
        {
          type: "mrkdwn",
          text: `*Trigger:*\n${log.triggerType}`,
        },
        {
          type: "mrkdwn",
          text: `*Status:*\n${log.status}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Schritte:*\n${stepsText}`,
      },
    },
  ];

  // Add error message if present
  if (log.errorMessage) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Fehler:*\n\`\`\`${log.errorMessage}\`\`\``,
      },
    });
  }

  // Add divider at the end
  blocks.push({
    type: "divider",
  });

  return {
    text: `${isSuccess ? "Erfolg" : "Fehler"}: ${log.workflowName}`,
    blocks,
  };
}

/**
 * Send a test message to Slack
 */
export async function sendSlackTestMessage(): Promise<boolean> {
  return sendSlackNotification({
    text: "Test von Attio Hub - Slack Integration funktioniert!",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: ":test_tube: Test-Nachricht",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Die Slack-Integration von *Attio Hub* funktioniert einwandfrei!",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Gesendet am ${new Date().toLocaleString("de-DE")}`,
          },
        ],
      },
    ],
  });
}
