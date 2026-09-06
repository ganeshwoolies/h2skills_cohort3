import type { CalendarMeeting, DriveDoc, AutoScanRecommendation, AutoScanResult } from '../types';

/**
 * Parses Google Docs structural elements into plain text
 */
export function extractDocText(docData: any): string {
  if (!docData || !docData.body || !Array.isArray(docData.body.content)) {
    return '';
  }

  const chunks: string[] = [];

  for (const element of docData.body.content) {
    if (element.paragraph && Array.isArray(element.paragraph.elements)) {
      for (const el of element.paragraph.elements) {
        if (el.textRun && typeof el.textRun.content === 'string') {
          chunks.push(el.textRun.content);
        }
      }
    } else if (element.table && Array.isArray(element.table.tableRows)) {
      for (const row of element.table.tableRows) {
        if (Array.isArray(row.tableCells)) {
          for (const cell of row.tableCells) {
            if (Array.isArray(cell.content)) {
              for (const cellEl of cell.content) {
                if (cellEl.paragraph?.elements) {
                  for (const el of cellEl.paragraph.elements) {
                    if (el.textRun?.content) {
                      chunks.push(el.textRun.content);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return chunks.join('').trim();
}

/**
 * Fetch calendar events (past lookbackDays and future lookaheadDays) from Google Calendar API
 */
export async function fetchRecentAndUpcomingMeetings(
  accessToken: string,
  lookbackDays = 3,
  lookaheadDays = 7
): Promise<CalendarMeeting[]> {
  const timeMin = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + lookaheadDays * 24 * 60 * 60 * 1000).toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');
  url.searchParams.set('maxResults', '30');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Calendar API error:', res.status, errorText);
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Failed to load calendar events: ${res.statusText}`);
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item: any) => {
    const isAllDay = !item.start?.dateTime && !!item.start?.date;
    const startTime = item.start?.dateTime || item.start?.date || '';
    const endTime = item.end?.dateTime || item.end?.date || '';

    return {
      id: item.id || String(Math.random()),
      title: item.summary?.trim() || 'Untitled Meeting',
      description: item.description || '',
      startTime,
      endTime,
      isAllDay,
      meetUrl: item.hangoutLink || item.conferenceData?.entryPoints?.[0]?.uri || undefined,
      location: item.location || undefined,
      organizer: item.organizer
        ? {
            email: item.organizer.email || '',
            displayName: item.organizer.displayName,
          }
        : undefined,
      attendees: Array.isArray(item.attendees)
        ? item.attendees.map((att: any) => ({
            email: att.email || '',
            displayName: att.displayName,
            responseStatus: att.responseStatus,
            self: att.self,
          }))
        : [],
    };
  });
}

/**
 * Fetch Google Docs from Google Drive that can be imported as meeting notes
 */
export async function fetchMeetingNotesDocs(
  accessToken: string,
  searchFilter?: string
): Promise<DriveDoc[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  let q = "mimeType='application/vnd.google-apps.document' and trashed=false";

  if (searchFilter && searchFilter.trim()) {
    // Escape single quotes for drive query
    const escaped = searchFilter.trim().replace(/'/g, "\\'");
    q += ` and name contains '${escaped}'`;
  }

  url.searchParams.set('q', q);
  url.searchParams.set('fields', 'files(id, name, modifiedTime, webViewLink)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', '25');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Drive API error:', res.status, errorText);
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Failed to load Google Docs: ${res.statusText}`);
  }

  const data = await res.json();
  const files = Array.isArray(data.files) ? data.files : [];

  return files.map((file: any) => ({
    id: file.id,
    name: file.name || 'Untitled Document',
    modifiedTime: file.modifiedTime || new Date().toISOString(),
    webViewLink: file.webViewLink,
  }));
}

/**
 * Fetch full content of a Google Doc using the Google Docs API
 */
export async function fetchGoogleDocContent(
  accessToken: string,
  documentId: string
): Promise<{ title: string; text: string }> {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Docs API error:', res.status, errorText);
    if (res.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`Failed to read Google Doc: ${res.statusText}`);
  }

  const data = await res.json();
  const text = extractDocText(data);

  return {
    title: data.title || 'Untitled Document',
    text,
  };
}

/**
 * Formats meeting metadata and notes into a structured reflection session payload
 * Includes OWASP LLM01 indirect prompt injection bounding.
 */
export function buildReflectionPrompt(params: {
  meeting?: CalendarMeeting | null;
  docContent?: { title: string; text: string } | null;
  personalNotes?: string;
}): {
  initialUserMessage: string;
  defaultTitle: string;
  tags: string[];
} {
  const { meeting, docContent, personalNotes } = params;

  // Derive title
  let defaultTitle = 'Meeting Reflection';
  if (meeting?.title) {
    defaultTitle = `Debrief: ${meeting.title}`;
  } else if (docContent?.title) {
    defaultTitle = `Notes: ${docContent.title}`;
  }

  // Derive tags
  const tags: string[] = ['meeting'];
  if (meeting) tags.push('calendar');
  if (docContent) tags.push('notes');

  const parts: string[] = [];

  parts.push('Please help me reflect on, analyze, and synthesize the following meeting:');
  parts.push('');

  if (meeting) {
    parts.push('=== MEETING METADATA ===');
    parts.push(`Title: ${meeting.title}`);
    if (meeting.startTime) {
      const start = new Date(meeting.startTime).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const end = meeting.endTime
        ? new Date(meeting.endTime).toLocaleTimeString(undefined, { timeStyle: 'short' })
        : '';
      parts.push(`Schedule: ${start}${end ? ` - ${end}` : ''}`);
    }

    if (meeting.organizer?.email) {
      parts.push(
        `Organizer: ${meeting.organizer.displayName || meeting.organizer.email}`
      );
    }

    if (meeting.attendees && meeting.attendees.length > 0) {
      const attendeeList = meeting.attendees
        .map((a) => a.displayName || a.email.split('@')[0])
        .slice(0, 8)
        .join(', ');
      parts.push(`Key Participants (${meeting.attendees.length}): ${attendeeList}`);
    }

    if (meeting.location) {
      parts.push(`Location: ${meeting.location}`);
    }
    if (meeting.meetUrl) {
      parts.push(`Virtual Link: ${meeting.meetUrl}`);
    }

    if (meeting.description?.trim()) {
      parts.push('');
      parts.push('Meeting Agenda / Calendar Description:');
      // Truncate to reasonable length to avoid blowing token window
      const cleanDesc = meeting.description.trim().slice(0, 1500);
      parts.push('```');
      parts.push(cleanDesc);
      parts.push('```');
    }
  }

  if (docContent) {
    parts.push('');
    parts.push(`=== MEETING NOTES (Document: "${docContent.title}") ===`);
    // Safe length bounding (up to 4000 characters)
    const cleanText = docContent.text.trim().slice(0, 4000);
    parts.push('```');
    parts.push(cleanText || '(No text found in selected Google Doc)');
    parts.push('```');
  }

  if (personalNotes && personalNotes.trim()) {
    parts.push('');
    parts.push('=== MY PERSONAL REFLECTIONS & OBSERVATIONS ===');
    parts.push(personalNotes.trim());
  } else {
    parts.push('');
    parts.push('=== REFLECTION GOAL ===');
    parts.push(
      'Help me evaluate: What were the key takeaways, emotional undertones, unresolved tensions, and concrete next actions from this discussion?'
    );
  }

  return {
    initialUserMessage: parts.join('\n'),
    defaultTitle,
    tags: Array.from(new Set(tags)),
  };
}

/**
 * Formats an ISO date string into a friendly relative or short time
 */
export function formatTimeRelative(dateString: string): string {
  if (!dateString) return '';
  const now = Date.now();
  const time = new Date(dateString).getTime();
  const diffMs = now - time;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));

  if (diffMinutes < 0 && Math.abs(diffMinutes) < 60) {
    return `In ${Math.abs(diffMinutes)} mins`;
  } else if (diffMinutes < 5) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} mins ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffHours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }
}

/**
 * Automatically scans recent Google Calendar events and recently modified Google Docs
 * to identify un-debriefed meetings and notes requiring reflection.
 */
export async function autoScanRecentNotesAndMeetings(params: {
  accessToken: string;
  existingSessionTitles?: string[];
  maxRecommendations?: number;
}): Promise<AutoScanResult> {
  const { accessToken, existingSessionTitles = [], maxRecommendations = 4 } = params;

  // Run calendar & docs fetch in parallel
  // Look back 2 days (48 hours) for meetings, look ahead 4 hours for today's current/upcoming
  const [meetings, docs] = await Promise.all([
    fetchRecentAndUpcomingMeetings(accessToken, 2, 0.2).catch((err) => {
      console.warn('AutoScan: calendar fetch error:', err);
      return [] as CalendarMeeting[];
    }),
    fetchMeetingNotesDocs(accessToken).catch((err) => {
      console.warn('AutoScan: docs fetch error:', err);
      return [] as DriveDoc[];
    }),
  ]);

  const existingTitlesLower = existingSessionTitles.map((t) => t.toLowerCase());

  // Function to check if a meeting or doc has already been debriefed
  const isAlreadyDebriefed = (name: string): boolean => {
    if (!name || name.length < 3) return false;
    const clean = name.toLowerCase().trim();
    return existingTitlesLower.some(
      (existing) => existing.includes(clean) || clean.includes(existing)
    );
  };

  // Filter meetings from past 48 hours or today
  const nowMs = Date.now();
  const twoDaysAgoMs = nowMs - 48 * 60 * 60 * 1000;

  const candidateMeetings = meetings.filter((m) => {
    if (!m.startTime) return false;
    const startMs = new Date(m.startTime).getTime();
    // Must be within past 48 hours or up to next 2 hours
    if (startMs < twoDaysAgoMs || startMs > nowMs + 2 * 60 * 60 * 1000) return false;
    // Skip if already debriefed
    if (isAlreadyDebriefed(m.title)) return false;
    return true;
  });

  // Filter docs modified in the past 48 hours
  const candidateDocs = docs.filter((d) => {
    if (!d.modifiedTime) return false;
    const modMs = new Date(d.modifiedTime).getTime();
    if (modMs < twoDaysAgoMs) return false;
    if (isAlreadyDebriefed(d.name)) return false;
    return true;
  });

  const recommendations: AutoScanRecommendation[] = [];
  const usedDocIds = new Set<string>();
  const usedMeetingIds = new Set<string>();

  // 1. Attempt smart pairing: match meetings with docs by name similarity
  for (const m of candidateMeetings) {
    if (recommendations.length >= maxRecommendations) break;

    const mWords = m.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const matchedDoc = candidateDocs.find((d) => {
      if (usedDocIds.has(d.id)) return false;
      const dNameLower = d.name.toLowerCase();
      // Check word overlap or substring
      return (
        dNameLower.includes(m.title.toLowerCase()) ||
        mWords.some((w) => dNameLower.includes(w))
      );
    });

    if (matchedDoc) {
      usedDocIds.add(matchedDoc.id);
      usedMeetingIds.add(m.id);
      recommendations.push({
        id: `paired-${m.id}-${matchedDoc.id}`,
        type: 'paired',
        title: m.title,
        subtitle: `Meeting & Notes: "${matchedDoc.name}"`,
        timeDisplay: formatTimeRelative(m.endTime || m.startTime),
        meeting: m,
        doc: matchedDoc,
      });
    }
  }

  // 2. Add remaining unreviewed meetings
  for (const m of candidateMeetings) {
    if (recommendations.length >= maxRecommendations) break;
    if (usedMeetingIds.has(m.id)) continue;

    usedMeetingIds.add(m.id);
    const timeDisplay = formatTimeRelative(m.endTime || m.startTime);
    const subtitle = m.attendees && m.attendees.length > 0
      ? `Ended ${timeDisplay} • ${m.attendees.length} participants`
      : `Ended ${timeDisplay}`;

    recommendations.push({
      id: `meeting-${m.id}`,
      type: 'meeting',
      title: m.title,
      subtitle,
      timeDisplay,
      meeting: m,
    });
  }

  // 3. Add remaining recent docs
  for (const d of candidateDocs) {
    if (recommendations.length >= maxRecommendations) break;
    if (usedDocIds.has(d.id)) continue;

    usedDocIds.add(d.id);
    const timeDisplay = formatTimeRelative(d.modifiedTime);
    recommendations.push({
      id: `doc-${d.id}`,
      type: 'doc',
      title: d.name,
      subtitle: `Google Doc edited ${timeDisplay}`,
      timeDisplay,
      doc: d,
    });
  }

  return {
    recommendations,
    scannedAt: new Date().toISOString(),
  };
}

