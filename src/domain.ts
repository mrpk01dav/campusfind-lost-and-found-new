export type ItemType = 'lost' | 'found';
export type ItemStatus = 'Open' | 'Possible Match' | 'Claim Pending' | 'Recovered' | 'Closed';
export type ClaimStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected' | 'removed';
export type UserRole = 'student' | 'staff' | 'moderator' | 'admin';

export interface UserNotificationPreferences {
  emailMatches?: boolean;
  claimUpdates?: boolean;
  newClaimsReceived?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  phoneNumber?: string;
  department?: string;
  preferredContactMethod?: 'email' | 'phone' | 'in_person';
  notificationPreferences?: UserNotificationPreferences;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  category: string;
  description: string;
  color: string;
  location: string;
  date: string;
  time?: string;
  image?: string;
  imageUrl?: string;
  handover: boolean;
  status: ItemStatus;
  owner: string; // for backward compatibility with existing tests and UI
  ownerId?: string;
  ownerName?: string;
  demo?: boolean;
  isDemo?: boolean;
  moderationStatus?: ModerationStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Claim {
  id: string;
  itemId: string;
  itemTitle?: string;
  itemOwnerId?: string; // UID of user who posted the item
  claimant: string;
  claimantId?: string;
  claimantName?: string;
  claimantEmail?: string;
  contactPhone?: string;
  details: string;
  evidenceUrl?: string;
  status: ClaimStatus;
  reviewerId?: string;
  reviewerName?: string;
  resolutionNote?: string;
  returnConfirmedAt?: string;
  returnConfirmedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AbuseReport {
  id: string;
  itemId: string;
  reporterId: string;
  reporterName?: string;
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'action_taken';
  createdAt: string;
}

export type NotificationType =
  | 'match_alert'
  | 'claim_submitted'
  | 'claim_approved'
  | 'claim_rejected'
  | 'evidence_requested'
  | 'handover_completed';

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  type: NotificationType;
  title: string;
  message: string;
  itemId: string;
  itemTitle: string;
  foundItemId?: string;
  claimId?: string;
  read: boolean;
  createdAt: string;
}

export const categories = [
  'Electronics',
  'ID & Cards',
  'Books & Notes',
  'Keys',
  'Bags',
  'Clothing',
  'Water Bottles',
  'Accessories',
  'Other',
];

// Fictional sample records used ONLY for development seeding
export const demoItems: Item[] = [
  {
    id: 'demo-lost-id',
    type: 'lost',
    title: '[DEMO / TEST DATA] Student ID card',
    category: 'ID & Cards',
    description: 'A student ID card in a clear sleeve. The name and ID number are intentionally not shown.',
    color: 'Transparent',
    location: 'Central Library',
    date: '2026-10-22',
    status: 'Open',
    owner: 'Demo Student',
    ownerId: 'demo-user-1',
    ownerName: 'Demo Student',
    handover: false,
    demo: true,
    isDemo: true,
    moderationStatus: 'approved',
    createdAt: '2026-10-22T09:00:00.000Z',
  },
  {
    id: 'demo-found-notebook',
    type: 'found',
    title: '[DEMO / TEST DATA] Blue lecture notebook',
    category: 'Books & Notes',
    description: 'A blue ruled notebook found near the study tables.',
    color: 'Blue',
    location: 'Central Library',
    date: '2026-10-22',
    status: 'Open',
    owner: 'Demo Student',
    ownerId: 'demo-user-1',
    ownerName: 'Demo Student',
    handover: false,
    demo: true,
    isDemo: true,
    moderationStatus: 'approved',
    createdAt: '2026-10-22T10:00:00.000Z',
  },
  {
    id: 'demo-lost-earbuds',
    type: 'lost',
    title: '[DEMO / TEST DATA] Wireless earphones case',
    category: 'Electronics',
    description: 'Small charging case, matte finish. Please keep model details private.',
    color: 'White',
    location: 'Cafeteria',
    date: '2026-10-23',
    status: 'Open',
    owner: 'Demo Student',
    ownerId: 'demo-user-1',
    ownerName: 'Demo Student',
    handover: false,
    demo: true,
    isDemo: true,
    moderationStatus: 'approved',
    createdAt: '2026-10-23T08:00:00.000Z',
  },
  {
    id: 'demo-found-keys',
    type: 'found',
    title: '[DEMO / TEST DATA] Small bunch of keys',
    category: 'Keys',
    description: 'Three keys on a plain metal ring. No identifying tag.',
    color: 'Silver',
    location: 'Main Gate',
    date: '2026-10-23',
    status: 'Open',
    owner: 'Demo Student',
    ownerId: 'demo-user-1',
    ownerName: 'Demo Student',
    handover: false,
    demo: true,
    isDemo: true,
    moderationStatus: 'approved',
    createdAt: '2026-10-23T09:00:00.000Z',
  },
  {
    id: 'demo-lost-bottle',
    type: 'lost',
    title: '[DEMO / TEST DATA] Steel water bottle',
    category: 'Water Bottles',
    description: 'Reusable steel bottle with a dark lid.',
    color: 'Silver',
    location: 'Sports Complex',
    date: '2026-10-21',
    status: 'Open',
    owner: 'Demo Student',
    ownerId: 'demo-user-1',
    ownerName: 'Demo Student',
    handover: false,
    demo: true,
    isDemo: true,
    moderationStatus: 'approved',
    createdAt: '2026-10-21T07:00:00.000Z',
  },
];

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  );

const similarity = (a: string, b: string) => {
  const aa = words(a),
    bb = words(b);
  if (!aa.size || !bb.size) return 0;
  let n = 0;
  aa.forEach((w) => {
    if (bb.has(w)) n++;
  });
  return n / (aa.size + bb.size - n);
};

export function scoreMatch(lost: Item, found: Item) {
  if (lost.type !== 'lost' || found.type !== 'found') return { score: 0, reasons: [] as string[] };
  const parts: [string, number, number][] = [];
  if (lost.category && found.category)
    parts.push(['Category', lost.category.toLowerCase() === found.category.toLowerCase() ? 1 : 0, 30]);
  if (lost.color && found.color) parts.push(['Color', similarity(lost.color, found.color), 25]);
  if (lost.location && found.location) parts.push(['Location', similarity(lost.location, found.location), 20]);
  if (lost.date && found.date) {
    const days = Math.abs(Date.parse(lost.date + 'T12:00:00Z') - Date.parse(found.date + 'T12:00:00Z')) / 86400000;
    parts.push(['Date proximity', Math.max(0, 1 - days / 15), 15]);
  }
  const text = similarity(lost.title + ' ' + lost.description, found.title + ' ' + found.description);
  parts.push(['Description', text, 10]);
  const totalWeight = parts.reduce((s, p) => s + p[2], 0);
  const score = totalWeight ? Math.round((parts.reduce((s, p) => s + p[1] * p[2], 0) / totalWeight) * 100) : 0;
  return {
    score,
    reasons: parts
      .filter((p) => p[1] >= 0.35)
      .sort((a, b) => b[1] * b[2] - a[1] * a[2])
      .map((p) => p[0]),
  };
}

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

export function findMatches(item: Item, all: Item[]) {
  const deduped = dedupeById(all);
  const other = deduped.filter(
    (x) =>
      x.id !== item.id &&
      x.type !== item.type &&
      !['Closed', 'Recovered'].includes(x.status) &&
      x.moderationStatus !== 'removed' &&
      x.moderationStatus !== 'rejected',
  );
  return other
    .map((candidate) => ({
      item: candidate,
      ...scoreMatch(item.type === 'lost' ? item : candidate, item.type === 'found' ? item : candidate),
    }))
    .filter((x) => x.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function searchItems(items: Item[], q: string, type: string, category: string, status: string) {
  const deduped = dedupeById(items);
  const query = q.trim().toLowerCase();
  return deduped
    .filter(
      (i) =>
        i.moderationStatus !== 'removed' &&
        i.moderationStatus !== 'rejected' &&
        (!type || type === 'all' || i.type === type) &&
        (!category || category === 'all' || i.category === category) &&
        (!status || status === 'all' || i.status === status) &&
        (!query || [i.title, i.description, i.category, i.color, i.location].some((v) => v.toLowerCase().includes(query))),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function validItemInput(v: Partial<Item>) {
  const errors: Record<string, string> = {};
  const title = v.title?.trim() || '';
  if (!title) {
    errors.title = 'Add an item title.';
  } else if (title.length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  } else if (title.length > 100) {
    errors.title = 'Title cannot exceed 100 characters.';
  }

  if (!v.category) errors.category = 'Choose a category.';

  const desc = v.description?.trim() || '';
  if (!desc) {
    errors.description = 'Describe the item.';
  } else if (desc.length < 5) {
    errors.description = 'Description must be at least 5 characters.';
  } else if (desc.length > 2000) {
    errors.description = 'Description cannot exceed 2000 characters.';
  }

  const loc = v.location?.trim() || '';
  if (!loc) {
    errors.location = 'Add an approximate location.';
  } else if (loc.length < 2) {
    errors.location = 'Location must be at least 2 characters.';
  } else if (loc.length > 150) {
    errors.location = 'Location cannot exceed 150 characters.';
  }

  if (!v.date || Number.isNaN(Date.parse(v.date)) || v.date > '9999-12-31') {
    errors.date = 'Enter a valid date.';
  } else if (v.date > getTodayDateString()) {
    errors.date = 'Date cannot be in the future.';
  }

  if (v.image && v.image.length > 5_000_000) {
    errors.image = 'Image is too large. Choose a file under 5MB.';
  }
  return errors;
}

export function validClaimInput(details: string) {
  const trimmed = details.trim();
  if (!trimmed) return 'Enter verification details for your claim.';
  if (trimmed.length < 12) return 'Add at least 12 characters of identifying details.';
  if (trimmed.length > 1500) return 'Verification details cannot exceed 1500 characters.';
  return null;
}

export function validAuthInput(email: string, password?: string, displayName?: string) {
  const errors: Record<string, string> = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email?.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!emailRegex.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (password !== undefined) {
    if (!password) {
      errors.password = 'Enter a password.';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }
  }

  if (displayName !== undefined && !displayName.trim()) {
    errors.displayName = 'Enter your name.';
  }

  return errors;
}

export function validReportInput(reason: string, details?: string) {
  const errors: Record<string, string> = {};
  if (!reason?.trim()) {
    errors.reason = 'Select or enter a reason for reporting.';
  }
  if (details && details.length > 500) {
    errors.details = 'Details cannot exceed 500 characters.';
  }
  return errors;
}

export function validProfileInput(displayName: string, phoneNumber?: string, department?: string) {
  const errors: Record<string, string> = {};
  const trimmedName = displayName?.trim() || '';
  if (!trimmedName) {
    errors.displayName = 'Display name is required.';
  } else if (trimmedName.length < 2) {
    errors.displayName = 'Name must be at least 2 characters.';
  } else if (trimmedName.length > 60) {
    errors.displayName = 'Name cannot exceed 60 characters.';
  }

  if (phoneNumber && phoneNumber.trim().length > 30) {
    errors.phoneNumber = 'Phone number cannot exceed 30 characters.';
  }

  if (department && department.trim().length > 100) {
    errors.department = 'Department / campus location cannot exceed 100 characters.';
  }

  return errors;
}

