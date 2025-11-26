/**
 * Seed script to create the Academy workflow in the database
 *
 * Run with: npx tsx scripts/seed-academy-workflow.ts
 */

import { db } from "../lib/db";
import { workflows } from "../lib/db/schema";
import { generateWebhookSecret } from "../lib/crypto";
import { eq } from "drizzle-orm";

async function seedAcademyWorkflow() {
  console.log("Creating Academy workflow...");

  // First, get the userId from an existing workflow
  const existingWorkflows = await db.select().from(workflows).limit(1);

  if (existingWorkflows.length === 0) {
    console.error("No existing workflows found. Cannot determine userId.");
    console.error("Please create a workflow via the UI first, then run this script again.");
    process.exit(1);
  }

  const userId = existingWorkflows[0].userId;
  console.log(`Using userId: ${userId}`);

  // Check if academy workflow already exists
  const existing = await db
    .select()
    .from(workflows)
    .where(eq(workflows.webhookPath, "academy"));

  if (existing.length > 0) {
    console.log("Academy workflow already exists!");
    console.log(`ID: ${existing[0].id}`);
    console.log(`Name: ${existing[0].name}`);
    process.exit(0);
  }

  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(workflows).values({
    id,
    userId,
    name: "Academy Notifications",
    description: "Sendet Academy-Events (Signup, Enrollment, Completion, etc.) an den dedizierten Slack-Channel",
    triggerType: "webhook",
    triggerConfig: {
      provider: "academy",
      events: ["signup", "enroll", "complete", "progress", "cancel"]
    },
    webhookPath: "academy",
    webhookSecret: generateWebhookSecret(),
    requiredIntegrations: ["slack"],
    isEnabled: true,
    status: "active",
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    createdAt: now,
    updatedAt: now,
  });

  console.log("Academy workflow created successfully!");
  console.log(`ID: ${id}`);
  console.log(`Webhook URL: https://attio-hub.vercel.app/api/webhooks/academy`);
}

seedAcademyWorkflow()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
