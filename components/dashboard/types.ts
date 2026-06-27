/**
 * Client-facing DTOs. Standalone (no server imports) so client components never
 * pull `node:fs` into the bundle. Shapes mirror the JSON the API returns.
 */

export interface DeskProfileDTO {
  name: string;
  role: string;
  headline: string;
  context: string;
  bookingEnabled: boolean;
  accent?: string;
}

export interface DeskShareDTO {
  scope: "all" | "folders";
  access: "read" | "read_calendar" | "read_calendar_write";
  expiresIn: "1h" | "24h" | "7d" | "30d";
  notesAccess: "read" | "write" | "edit";
  identity: { loadCoo: boolean; loadUser: boolean; loadPolicy: boolean };
}

export interface AnalyticsDTO {
  uniqueVisitors: number;
  conversationCount: number;
  messageCount: number;
}

export interface DeskDTO {
  id: string;
  token: string;
  linkId: string;
  agentUrl?: string;
  publicUrl: string;
  profile: DeskProfileDTO;
  share: DeskShareDTO;
  expiry: string;
  createdAt: string;
  revoked?: boolean;
  analytics: AnalyticsDTO;
  bookings: number;
  live: boolean;
}

export interface MessageDTO {
  id: string;
  role: "visitor" | "agent";
  text: string;
  ts: string;
  tools?: string[];
  booking?: boolean;
}

export interface ConversationDTO {
  id: string;
  deskId: string;
  visitorLabel: string;
  startedAt: string;
  lastAt: string;
  messages: MessageDTO[];
}

export const ACCESS_LABELS: Record<DeskShareDTO["access"], string> = {
  read: "Read only",
  read_calendar: "Read + see calendar",
  read_calendar_write: "Read + book meetings",
};

export const EXPIRY_LABELS: Record<DeskShareDTO["expiresIn"], string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};
