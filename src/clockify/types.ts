import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  defaultWorkspace: z.string().optional(),
  activeWorkspace: z.string().optional(),
  settings: z.object({ timeZone: z.string().optional() }).partial().optional()
});
export type User = z.infer<typeof UserSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string()
}).passthrough();
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  color: z.string().optional(),
  billable: z.boolean().optional()
}).passthrough();
export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  status: z.enum(["ACTIVE", "DONE"]).optional(),
  assigneeIds: z.array(z.string()).optional()
}).passthrough();
export type Task = z.infer<typeof TaskSchema>;

export const TimeIntervalSchema = z.object({
  start: z.string(),
  end: z.string().nullable().optional(),
  duration: z.string().nullable().optional()
}).passthrough();

export const TimeEntrySchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  billable: z.boolean().optional(),
  timeInterval: TimeIntervalSchema.optional()
}).passthrough();
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const TagSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean().optional()
}).passthrough();
export type Tag = z.infer<typeof TagSchema>;

export const ClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean().optional(),
  address: z.string().optional(),
  note: z.string().optional()
}).passthrough();
export type Client = z.infer<typeof ClientSchema>;
