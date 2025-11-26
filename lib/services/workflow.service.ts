import { db } from "@/lib/db";
import { workflows, type Workflow, type NewWorkflow } from "@/lib/db/schema";
import { generateWebhookPath, generateWebhookSecret } from "@/lib/crypto";
import { eq, and, desc } from "drizzle-orm";

export type TriggerType = "webhook" | "manual" | "schedule";
export type WorkflowStatus = "draft" | "active" | "paused" | "error";

/**
 * Creates a new workflow
 */
export async function createWorkflow(
  userId: string,
  data: {
    name: string;
    description?: string;
    triggerType: TriggerType;
    triggerConfig?: Record<string, unknown>;
    requiredIntegrations?: string[];
  }
): Promise<Workflow> {
  const id = crypto.randomUUID();
  const now = new Date();

  // Generate webhook path and secret for webhook triggers
  // Use fixed path if provided in triggerConfig (e.g., for Attio webhooks)
  const fixedPath = data.triggerConfig?.fixedWebhookPath as string | undefined;
  const webhookPath = data.triggerType === "webhook"
    ? (fixedPath || generateWebhookPath())
    : null;
  const webhookSecret = data.triggerType === "webhook" ? generateWebhookSecret() : null;

  const [newWorkflow] = await db
    .insert(workflows)
    .values({
      id,
      userId,
      name: data.name,
      description: data.description || null,
      triggerType: data.triggerType,
      triggerConfig: data.triggerConfig || null,
      webhookPath,
      webhookSecret,
      requiredIntegrations: data.requiredIntegrations || [],
      isEnabled: false,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return newWorkflow;
}

/**
 * Gets all workflows for a user
 */
export async function getWorkflowsByUser(userId: string): Promise<Workflow[]> {
  return db
    .select()
    .from(workflows)
    .where(eq(workflows.userId, userId))
    .orderBy(desc(workflows.createdAt));
}

/**
 * Gets a single workflow by ID
 */
export async function getWorkflowById(
  id: string,
  userId: string
): Promise<Workflow | null> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

  return workflow || null;
}

/**
 * Gets a workflow by webhook path (for webhook handler)
 */
export async function getWorkflowByWebhookPath(
  webhookPath: string
): Promise<Workflow | null> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.webhookPath, webhookPath));

  return workflow || null;
}

/**
 * Updates a workflow
 */
export async function updateWorkflow(
  id: string,
  userId: string,
  data: Partial<{
    name: string;
    description: string;
    triggerConfig: Record<string, unknown>;
    code: string;
    requiredIntegrations: string[];
    isEnabled: boolean;
    status: WorkflowStatus;
  }>
): Promise<Workflow | null> {
  const existing = await getWorkflowById(id, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(workflows)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)))
    .returning();

  return updated;
}

/**
 * Toggles workflow enabled state
 */
export async function toggleWorkflow(
  id: string,
  userId: string
): Promise<Workflow | null> {
  const existing = await getWorkflowById(id, userId);
  if (!existing) return null;

  const newEnabled = !existing.isEnabled;
  const newStatus: WorkflowStatus = newEnabled ? "active" : "paused";

  return updateWorkflow(id, userId, {
    isEnabled: newEnabled,
    status: newStatus,
  });
}

/**
 * Deletes a workflow
 */
export async function deleteWorkflow(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

  return result.rowsAffected > 0;
}

/**
 * Increments execution counters
 */
export async function incrementExecutionStats(
  id: string,
  success: boolean
): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) return;

  await db
    .update(workflows)
    .set({
      totalExecutions: (workflow.totalExecutions || 0) + 1,
      successfulExecutions: success
        ? (workflow.successfulExecutions || 0) + 1
        : workflow.successfulExecutions,
      failedExecutions: !success
        ? (workflow.failedExecutions || 0) + 1
        : workflow.failedExecutions,
      lastExecutedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, id));
}

/**
 * Gets the full webhook URL for a workflow
 */
export function getWebhookUrl(webhookPath: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/webhooks/${webhookPath}`;
}
