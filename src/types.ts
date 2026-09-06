export interface AuthUserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type ReflectionMode = 'reflect' | 'summarize' | 'brainstorm';

export interface InteractionMessage {
  id: string;
  sender: 'user' | 'gemini';
  content: string;
  timestamp: number;
  modelUsed?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  entryText: string;
  mode: ReflectionMode;
  conversation: InteractionMessage[];
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  sequence: number;
}

export interface SessionSummary {
  headline: string;
  coreThemes: string[];
  keyTakeaways: string[];
  actionableHorizon: string;
}

export interface JournalSession {
  id: string;
  title: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  summary: string | null;
  summaryUpdatedAt: string | null;
  messageCount: number;
  schemaVersion: number;
}

export interface CompassNextAction {
  priority: number;
  action: string;
  rationale: string;
}

export interface CompassContent {
  headline: string;
  keyThemes: string[];
  winsAndProgress: string[];
  recurringChallenges: string[];
  nextActions: CompassNextAction[];
  reflectionQuestions: string[];
}

export interface ReflectionCompassReport {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  content: CompassContent;
  schemaVersion: number;
}

export type ActiveAppView =
  | 'dashboard'
  | 'session'
  | 'compass'
  | 'progress'
  | 'discover'
  | 'trusted_people'
  | 'shared_with_me';

export interface TrustedPerson {
  id: string;
  ownerUid: string;
  email: string;
  displayName: string;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface ShareGrant {
  id: string;
  ownerUid: string;
  ownerDisplayName: string;
  viewerEmail: string;
  viewerUid?: string;
  reportId: string;
  reportTitle: string;
  grantedAt: string;
  status: 'active' | 'revoked';
  revokedAt?: string;
}

export interface SharedReportView {
  grantId: string;
  ownerUid: string;
  ownerDisplayName: string;
  reportId: string;
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  content: CompassContent;
}

export interface ProgressStreak {
  currentStreak: number;
  longestStreak: number;
  activeDays: string[];
}

export interface ThemeCount {
  theme: string;
  count: number;
}

export interface ChallengeCount {
  challenge: string;
  occurrences: number;
}

export interface WeekActivity {
  week: string;
  count: number;
  startDate: string;
}

export interface ProgressSnapshot {
  streak: ProgressStreak;
  totalSessions: number;
  totalReports: number;
  themeFrequency: ThemeCount[];
  recurringChallenges: ChallengeCount[];
  activityByWeek: WeekActivity[];
  rangeDays: number;
}

export interface DiscoveryRecommendation {
  type: 'creator' | 'article' | 'book' | 'podcast';
  title: string;
  description: string;
  url?: string;
  sourceName: string;
}

export interface DiscoveryTheme {
  theme: string;
  recommendations: DiscoveryRecommendation[];
}

export interface DiscoveryRecord {
  id: string;
  userId: string;
  themes: string[];
  content: DiscoveryTheme[];
  generatedAt: string;
}

export interface CalendarMeeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  meetUrl?: string;
  location?: string;
  organizer?: { email: string; displayName?: string };
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string; self?: boolean }>;
}

export interface DriveDoc {
  id: string;
  name: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface AutoScanRecommendation {
  id: string;
  type: 'meeting' | 'doc' | 'paired';
  title: string;
  timeDisplay: string;
  subtitle: string;
  meeting?: CalendarMeeting;
  doc?: DriveDoc;
}

export interface AutoScanResult {
  recommendations: AutoScanRecommendation[];
  scannedAt: string;
}
