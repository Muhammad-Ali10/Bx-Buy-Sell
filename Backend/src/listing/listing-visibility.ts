/**
 * Who may see what on a listing.
 *
 * Every rule the client gave us lives in the tables below, and every read path
 * goes through `maskListingFor`. Keeping it in one place is the point: the
 * requirement was that the rules hold "consistently throughout the platform",
 * and a checklist of screens only holds until someone adds a screen.
 *
 * Three levels, each a superset of the one before:
 *
 *   PUBLIC        anyone, including logged out
 *   REGISTERED    signed in
 *   CONFIDENTIAL  signed in and accepted this listing's agreement
 *
 * The seller and staff bypass all three.
 */

export type VisibilityLevel = 'PUBLIC' | 'REGISTERED' | 'CONFIDENTIAL';

const LEVEL_ORDER: Record<VisibilityLevel, number> = {
  PUBLIC: 0,
  REGISTERED: 1,
  CONFIDENTIAL: 2,
};

export interface ListingViewer {
  userId?: string;
  role?: string | null;
  /** True once this viewer has accepted the listing's confidentiality agreement. */
  hasConfidentialAccess?: boolean;
}

/** How much of the description a logged-out visitor gets — roughly three lines. */
export const PUBLIC_DESCRIPTION_CHARS = 300;

const REGISTER_LABEL = 'register to unlock 🔓';
const REGISTER_REDIRECT = '/register';
const AGREEMENT_LABEL = 'accept the agreement to unlock 🔓';

const STAFF_ROLES = new Set(['ADMIN', 'MONITER', 'MODERATOR']);

/**
 * Section-level rules. A question inherits its section unless one of the
 * per-question rules below overrides it.
 *
 * Financials and Handover are public by the client's own list — they were
 * hidden before, and opening them was confirmed deliberately.
 */
const SECTION_LEVEL: Record<string, VisibilityLevel> = {
  brand: 'PUBLIC',
  advertisement: 'PUBLIC',
  financials: 'PUBLIC',
  handover: 'PUBLIC',
  // Listed as public on purpose rather than by omission: a section missing from
  // this table is never walked at all, so leaving one out hides nothing.
  tools: 'PUBLIC',
  statistics: 'REGISTERED',
  productQuestion: 'REGISTERED',
  managementQuestion: 'REGISTERED',
  social_account: 'CONFIDENTIAL',
};

export const LISTING_SECTIONS = Object.keys(SECTION_LEVEL);

/** The two statistics the client wants readable without an account. */
const PUBLIC_STATISTIC_PATTERNS = [/returning\s*customer/i, /refund\s*rate/i];

/** Confidential wherever it appears, whatever section holds it. */
const CONFIDENTIAL_QUESTION_PATTERNS = [/domain/i];

/** Uploads are confidential wherever they appear: listing images, attachments. */
const CONFIDENTIAL_ANSWER_TYPES = new Set(['PHOTO', 'FILE']);

/**
 * The business's name, wherever it is written.
 *
 * A passer-by sees that a business is for sale and what kind it is; which
 * business it is takes an account. The card falls back to the register prompt
 * in place of the name, the same way the picture falls back to a blur.
 */
const REGISTERED_QUESTION_PATTERNS = [
  /^\s*title\s*$/i,
  /listing\s*title/i,
  /brand\s*name/i,
  /business\s*name/i,
  /company\s*name/i,
];

const isDescription = (question: string) => /description/i.test(question);

/** What a viewer is entitled to see on this listing. */
export function resolveViewerLevel(
  listing: { userId?: string | null },
  viewer?: ListingViewer,
): VisibilityLevel {
  if (!viewer?.userId) return 'PUBLIC';
  if (STAFF_ROLES.has(String(viewer.role || '').toUpperCase())) return 'CONFIDENTIAL';
  if (listing?.userId && listing.userId === viewer.userId) return 'CONFIDENTIAL';
  return viewer.hasConfidentialAccess ? 'CONFIDENTIAL' : 'REGISTERED';
}

/** What a single answer requires. */
function levelForQuestion(section: string, item: any): VisibilityLevel {
  if (CONFIDENTIAL_ANSWER_TYPES.has(String(item?.answer_type || ''))) {
    return 'CONFIDENTIAL';
  }

  const question = String(item?.question || '');
  if (CONFIDENTIAL_QUESTION_PATTERNS.some((re) => re.test(question))) {
    return 'CONFIDENTIAL';
  }
  if (
    section === 'statistics' &&
    PUBLIC_STATISTIC_PATTERNS.some((re) => re.test(question))
  ) {
    return 'PUBLIC';
  }

  const sectionLevel = SECTION_LEVEL[section] ?? 'PUBLIC';
  if (
    sectionLevel === 'PUBLIC' &&
    REGISTERED_QUESTION_PATTERNS.some((re) => re.test(question))
  ) {
    return 'REGISTERED';
  }

  return sectionLevel;
}

const canSee = (viewerLevel: VisibilityLevel, required: VisibilityLevel) =>
  LEVEL_ORDER[viewerLevel] >= LEVEL_ORDER[required];

/**
 * The prompt that replaces a hidden value. Which one depends on what the
 * viewer is missing — an account, or the agreement — so the page can send them
 * to the right place.
 */
function lockFor(viewerLevel: VisibilityLevel) {
  if (viewerLevel === 'PUBLIC') {
    return {
      answer: REGISTER_LABEL,
      locked: true,
      lockType: 'AUTH_REQUIRED' as const,
      redirectTo: REGISTER_REDIRECT,
    };
  }
  return {
    answer: AGREEMENT_LABEL,
    locked: true,
    lockType: 'CONFIDENTIAL_AGREEMENT' as const,
    redirectTo: null,
  };
}

/** URLs out of an answer, which may be a JSON array, a comma list, or one URL. */
function readUrls(answer: unknown): string[] {
  const raw = String(answer ?? '').trim();
  if (!raw) return [];

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\//i.test(item));
}

/**
 * A locked listing photo is still shown — heavily blurred, as the design asks —
 * by pointing at a Cloudinary derivative rather than the original: 80px wide,
 * lowest quality, maximum blur. The real image cannot be reconstructed from it,
 * so this is a preview, not a leak.
 *
 * Anything not served by Cloudinary cannot be blurred safely, so it is dropped
 * rather than passed through.
 */
/**
 * The listing's own photograph, blurred — not a stand-in for it.
 *
 * This used to ask Cloudinary for `w_80,q_1,e_blur:2000`: eighty pixels wide at
 * the lowest quality, then blurred to the maximum. Stretched back up to card
 * width that produced flat coloured blocks, so visitors saw what looked like a
 * dummy placeholder rather than a hint of the real business.
 *
 * Six hundred pixels keeps the composition readable at any card size, and the
 * blur is what hides the detail. Shrinking first matters: it throws the fine
 * detail away for good, so the result cannot be sharpened back into a legible
 * picture the way a light blur over a full-resolution image can.
 */
function blurredPreview(url: string): string | null {
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url)) return null;
  if (!url.includes('/upload/')) return null;
  return url.replace('/upload/', '/upload/w_600,e_blur:900,q_auto/');
}

function maskSection(section: string, items: any[], viewerLevel: VisibilityLevel) {
  if (!Array.isArray(items)) return items;

  return items.map((item) => {
    const required = levelForQuestion(section, item);
    if (!canSee(viewerLevel, required)) {
      // Photos stay visible as blurred previews; everything else is replaced
      // by the unlock prompt.
      if (String(item?.answer_type) === 'PHOTO') {
        const previews = readUrls(item?.answer)
          .map(blurredPreview)
          .filter((url): url is string => Boolean(url));

        // Empty rather than prompt text when no preview can be built: the
        // answer of a PHOTO row is read as an image source, and prompt text
        // there renders as a broken image.
        return {
          ...item,
          ...lockFor(viewerLevel),
          answer: previews.length > 0 ? JSON.stringify(previews) : '',
          blurredPreview: previews.length > 0,
        };
      }

      return { ...item, ...lockFor(viewerLevel) };
    }

    // Visible, but a logged-out visitor only gets the opening of a description.
    if (
      viewerLevel === 'PUBLIC' &&
      isDescription(String(item?.question || '')) &&
      typeof item?.answer === 'string' &&
      item.answer.length > PUBLIC_DESCRIPTION_CHARS
    ) {
      return {
        ...item,
        answer: `${item.answer.slice(0, PUBLIC_DESCRIPTION_CHARS).trimEnd()}…`,
        truncated: true,
      };
    }

    return item;
  });
}

/**
 * The seller's name and photo are confidential. The email address is dropped
 * for everyone — no screen shows it, contact goes through in-app chat, so
 * returning it only ever created scraping surface.
 */
function maskSeller(user: any, viewerLevel: VisibilityLevel) {
  if (!user) return user;

  const { email, ...rest } = user;

  if (canSee(viewerLevel, 'CONFIDENTIAL')) return rest;

  const lock = lockFor(viewerLevel);
  return {
    ...rest,
    first_name: lock.answer,
    last_name: '',
    profile_pic: null,
    locked: true,
    lockType: lock.lockType,
    redirectTo: lock.redirectTo,
  };
}

/**
 * Apply every rule to one listing. Safe to call on already-masked data and on
 * partial records — anything it does not recognise is left untouched.
 */
/**
 * What the seller pays the platform, and the Stripe records behind it.
 *
 * These live on the listing row purely so billing can find them, and they were
 * going out on the public feed with everything else — the subscription ids are
 * null today only because nobody has paid yet. None of it is any visitor's
 * business, and the success fee is a commercial term between the platform and
 * that one seller.
 */
const BILLING_FIELDS = [
  'packageStripeSubscriptionId',
  'addonStripeSubscriptionId',
  'packageActive',
  'packageExpiresAt',
  'packageBillingCycle',
  'packageAddons',
  'successFeePercent',
  'addonEndsAt',
] as const;

// `selectedPackage` deliberately stays public: the listing cards read it to
// show the Premium badge, which is part of what the seller is paying for.

function stripBilling<T extends Record<string, any>>(listing: T): T {
  const out: any = { ...listing };
  for (const field of BILLING_FIELDS) delete out[field];
  return out;
}

/** Only the seller and the platform team see a listing's billing. */
function ownsOrStaffs(listing: any, viewer?: ListingViewer): boolean {
  if (!viewer?.userId) return false;
  if (STAFF_ROLES.has(String(viewer.role || '').toUpperCase())) return true;
  return Boolean(listing?.userId) && listing.userId === viewer.userId;
}

export function maskListingFor(listing: any, viewer?: ListingViewer) {
  if (!listing) return listing;

  const viewerLevel = resolveViewerLevel(listing, viewer);
  // A buyer who accepted the agreement reaches CONFIDENTIAL too, so the billing
  // check is its own question rather than a side effect of the level.
  const keepBilling = ownsOrStaffs(listing, viewer);

  if (viewerLevel === 'CONFIDENTIAL') {
    // Owner, staff, or a buyer who has accepted — still drop the email.
    // viewerLevel is set on every response, not only the masked ones, so the
    // front end can read it without having to treat "absent" as a third state.
    const full = {
      ...listing,
      user: maskSeller(listing.user, viewerLevel),
      viewerLevel,
    };
    return keepBilling ? full : stripBilling(full);
  }

  const masked: any = stripBilling({
    ...listing,
    user: maskSeller(listing.user, viewerLevel),
  });

  for (const section of LISTING_SECTIONS) {
    if (masked[section] !== undefined) {
      masked[section] = maskSection(section, masked[section], viewerLevel);
    }
  }

  // Kept for the existing front-end, which reads a single call-to-action off
  // the listing to label its lock buttons.
  const lock = lockFor(viewerLevel);
  masked.viewerLevel = viewerLevel;
  masked.lockAction = {
    lockType: lock.lockType,
    ctaText: lock.answer,
    redirectTo: lock.redirectTo,
  };
  masked.portfolioLink = lock.answer;

  return masked;
}
