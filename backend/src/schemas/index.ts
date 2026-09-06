import { z } from 'zod';

// Session schemas
export const CreateSessionSchema = z.object({
  title: z.string().trim().max(200).optional().default('Untitled Reflection'),
  tags: z.array(z.string().trim().max(50)).max(10).optional().default([]),
});

export const UpdateSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().max(50)).max(10).optional(),
});

// Message schemas
export const CreateMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(8000, 'Message cannot exceed 8,000 characters'),
});

// Structured Summary schema
export const SessionSummarySchema = z.object({
  headline: z.string().trim().min(1),
  coreThemes: z.array(z.string().trim()).min(1).max(10),
  keyTakeaways: z.array(z.string().trim()).min(1).max(10),
  actionableHorizon: z.string().trim().min(1),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// Reflection Compass Request Schema
export const GenerateCompassRequestSchema = z.object({
  title: z.string().trim().max(200).optional(),
  periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  sessionIds: z.array(z.string().trim().max(128)).max(50).optional(),
});

// Next action item in Compass
export const CompassNextActionSchema = z.object({
  priority: z.number().int().min(1).max(5),
  action: z.string().trim().min(1).max(300),
  rationale: z.string().trim().min(1).max(500),
});

// Reflection Compass Content Schema (as defined in data model requirements)
export const CompassContentSchema = z.object({
  headline: z.string().trim().min(1),
  keyThemes: z.array(z.string().trim()).min(1).max(10),
  winsAndProgress: z.array(z.string().trim()).min(1).max(10),
  recurringChallenges: z.array(z.string().trim()).min(1).max(10),
  nextActions: z.array(CompassNextActionSchema).min(1).max(5),
  reflectionQuestions: z.array(z.string().trim()).min(1).max(8),
});

export type CompassContent = z.infer<typeof CompassContentSchema>;

// Trusted People Schemas
export const CreateTrustedPersonSchema = z.object({
  email: z.string().trim().email('Valid email address is required').toLowerCase(),
  displayName: z.string().trim().max(120).optional(),
});

export type CreateTrustedPersonInput = z.infer<typeof CreateTrustedPersonSchema>;

// Report Share Request Schema
export const ShareReportRequestSchema = z.object({
  personId: z.string().trim().min(1, 'personId is required'),
});

export type ShareReportRequestInput = z.infer<typeof ShareReportRequestSchema>;

// Progress Query Schema
export const ProgressQuerySchema = z.object({
  rangeDays: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export type ProgressQueryInput = z.infer<typeof ProgressQuerySchema>;

// Content Discovery Schemas
export const DiscoveryRecommendationSchema = z.object({
  type: z.enum(['creator', 'article', 'book', 'podcast']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(400),
  url: z.string().trim().url().optional(),
  sourceName: z.string().trim().max(120).optional(),
});

export type DiscoveryRecommendation = z.infer<typeof DiscoveryRecommendationSchema>;

export const DiscoveryThemeSchema = z.object({
  theme: z.string().trim().min(1),
  recommendations: z.array(DiscoveryRecommendationSchema).max(5),
});

export type DiscoveryTheme = z.infer<typeof DiscoveryThemeSchema>;

export const DiscoveryContentSchema = z.array(DiscoveryThemeSchema).max(5);

export type DiscoveryContent = z.infer<typeof DiscoveryContentSchema>;
