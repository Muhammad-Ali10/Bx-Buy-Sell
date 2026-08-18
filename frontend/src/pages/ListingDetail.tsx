import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import {
  Heart, Share2, MessageSquare, Check , ArrowLeft, Globe, MapPin, DollarSign,
  TrendingUp, Users, Calendar, Download, FileText, CheckCircle2,
  Instagram, Twitter, Music, Mail, ShoppingBag, Building2, Clock,
  PieChart as PieChartIcon, Settings, Globe as GlobeIcon, Lock, AlertTriangle
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import ListingCard from "@/components/ListingCard";
import { calculateBusinessAgeFromListing, formatListingBusinessAge } from "@/lib/dateUtils";
import {
  computeListingFinancialMetrics,
  getMultipleRating,
  type MultipleKind,
} from "@/lib/financialTableUtils";
import { resolveListingTitle, LISTING_TITLE_COLOR } from "@/lib/listingTitle";
import FlagIcon from "@/components/FlagIcon";
import AcquisitionCapacityCard from "@/components/AcquisitionCapacityCard";
import ShareListingDialog from "@/components/ShareListingDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {SalesChannels, Country, AdvertisingChannels, Info, Dollar, Customer} from "@/assets/svg"
/**
 * Instalment plan shown next to the asking price: businesses under $10,000 are
 * financed over 48 months, anything above over 96.
 */
const financingInstalments = (price: number): number => (price < 10_000 ? 48 : 96);

/** Shown wherever the seller has not supplied enough data to derive a figure. */
const UNKNOWN_LABEL = "Unknown";

/** Four slides of three — past that nobody scrolls, and each card costs work. */
const MAX_SIMILAR_LISTINGS = 12;

/**
 * Drawn behind the unlock prompt so the chart area keeps its shape. Invented
 * proportions, never the seller's — the real split is not sent at all.
 */
const LOCKED_CHART_PLACEHOLDER = [
  { name: 'a', value: 45, color: 'rgba(198, 254, 31, 1)' },
  { name: 'b', value: 30, color: 'rgba(0, 0, 0, 1)' },
  { name: 'c', value: 25, color: 'rgba(0, 0, 0, 0.35)' },
];

/** Empty state for the Statistics cards, which the client words differently. */
const NOT_AVAILABLE_LABEL = "not available";

/**
 * Prefixes a money answer with the listing's currency symbol.
 *
 * Statistics answers are free text the seller typed, so nothing is converted —
 * the symbol only labels their own number. Left alone when there is no figure,
 * or when the seller already wrote a currency themselves ("$344", "344 EUR").
 */
const withCurrencySymbol = (value: string | number, symbol: string): string | number => {
  const text = String(value).trim();
  if (!text) return value;
  if (text === UNKNOWN_LABEL || text === NOT_AVAILABLE_LABEL) return value;
  if (!/\d/.test(text)) return value;
  // Already carries a symbol (any currency) or a three-letter code.
  if (/[$€£¥₹₽₺₩฿]|\b[A-Z]{3}\b/.test(text)) return value;
  return `${symbol}${text}`;
};
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountQuestions } from "@/hooks/useAccountQuestions";
import { parseMediaUrls } from "@/lib/mediaUtils";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Legend, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FaceScanSquareIcon from "@/assets/Face Scan Square.svg";
import MakeOfferIcon from "@/assets/fi_3585639.svg";
import LinkIcon from "@/assets/link.svg";
import MapImage from "@/assets/map.png";
import SettingCardIcon from "@/assets/setting card.svg";
import GlobIcon from "@/assets/Glob.svg";
import AdverIcon from "@/assets/adver.svg";
import InstagramIcon from "@/assets/instaaa.svg";
import XIcon from "@/assets/x.svg";
import TikTokIcon from "@/assets/tiktok.svg";
import InfoIcon from "@/assets/i.svg";
import CustomerIcon from "@/assets/svg/customer.svg";
import FileTypeIcon from "@/components/FileTypeIcon";
import ListingImage from "@/components/ListingImage";
import ExIcon from "@/assets/Ex icon.svg";
import { getCurrencySymbol } from "@/components/CurrencySelect";
import { getListingCurrencySymbol } from "@/lib/listingCurrency";
import RequestIcon from "@/assets/request.svg";
import DateIcon from "@/assets/date.svg";

import { formatNumber } from "@/lib/formatNumber";
// Helper function to extract answer from question array by question text
const getAnswerByQuestion = (questions: any[], searchText: string | string[]): string | null => {
  if (!questions || !Array.isArray(questions)) return null;

  const searchTerms = Array.isArray(searchText) ? searchText : [searchText];

  for (const question of questions) {
    const questionText = (question.question || '').toLowerCase();
    if (searchTerms.some(term => questionText.includes(term.toLowerCase()))) {
      return question.answer || null;
    }
  }
  return null;
};

// Helper function to get all answers from question array
const getAllAnswers = (questions: any[]): Record<string, string> => {
  if (!questions || !Array.isArray(questions)) return {};

  const result: Record<string, string> = {};
  questions.forEach(q => {
    if (q.question && q.answer) {
      result[q.question] = q.answer;
    }
  });
  return result;
};

const parseMultiValueAnswer = (raw: unknown): string[] => {
  const sanitize = (items: string[]) =>
    items.filter(
      (item) =>
        item.length > 0 &&
        item.toLowerCase() !== "[object object]",
    );

  if (Array.isArray(raw)) {
    return sanitize(
      raw
        .map((item) => String(item).trim())
    );
  }
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return sanitize(
        parsed
          .map((item) => String(item).trim())
      );
    }
  } catch {
    // fall through to delimiter parsing
  }
  return sanitize(
    trimmed
      .split(",")
      .map((item) => item.trim()),
  );
};

const getHandoverAssets = (
  questions: any[],
): Array<{ name: string; included: boolean }> => {
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  const assetQuestion = questions.find((question) => {
    const questionText = String(question?.question || "").toLowerCase();
    return (
      Array.isArray(question?.option) &&
      question.option.length > 0 &&
      (questionText.includes("asset") ||
        questionText.includes("included") ||
        questionText.includes("handover"))
    );
  });

  if (assetQuestion) {
    const selected = new Set(
      parseMultiValueAnswer(assetQuestion.answer).map((item) =>
        item.toLowerCase(),
      ),
    );
    return (assetQuestion.option || []).map((option: string) => {
      const normalizedOption = String(option).trim();
      return {
        name: normalizedOption,
        included: selected.has(normalizedOption.toLowerCase()),
      };
    });
  }

  const selectedOnly: string[] = [];
  const seen = new Set<string>();

  questions.forEach((question) => {
    parseMultiValueAnswer(question?.answer).forEach((value) => {
      const normalizedValue = value.trim();
      const key = normalizedValue.toLowerCase();
      if (!normalizedValue || seen.has(key)) return;
      seen.add(key);
      selectedOnly.push(normalizedValue);
    });
  });

  return selectedOnly.map((name) => ({ name, included: true }));
};

const parseSplitAnswer = (raw: unknown): Array<{ name: string; value: number }> => {
  if (!raw) return [];
  const normalizeEntry = (entry: any): { name: string; value: number } | null => {
    if (!entry) return null;
    if (typeof entry === "object" && !Array.isArray(entry)) {
      const name = String(entry.name || entry.label || "").trim();
      const value = Number(entry.percent ?? entry.value ?? 0);
      if (!name || !Number.isFinite(value) || value <= 0) return null;
      return { name, value };
    }
    if (typeof entry === "string") {
      const token = entry.trim();
      if (!token) return null;
      const percentMatch = token.match(/(\d+(\.\d+)?)\s*%?/);
      const value = percentMatch ? Number(percentMatch[1]) : NaN;
      const name = token
        .replace(/(\d+(\.\d+)?)\s*%?/g, "")
        .replace(/[:\-]/g, "")
        .trim();
      if (!name || !Number.isFinite(value) || value <= 0) return null;
      return { name, value };
    }
    return null;
  };

  if (Array.isArray(raw)) {
    return raw.map(normalizeEntry).filter((v): v is { name: string; value: number } => Boolean(v));
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeEntry).filter((v): v is { name: string; value: number } => Boolean(v));
      }
    } catch {
      const parts = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
      return parts.map(normalizeEntry).filter((v): v is { name: string; value: number } => Boolean(v));
    }
  }

  return [];
};

/** API may return `answer` as a string or a single-element array. */
const pickListingAnswer = (entry: any): unknown => {
  const raw = entry?.answer;
  if (Array.isArray(raw)) return raw.length ? raw[0] : undefined;
  return raw;
};

const normalizeSocialUrl = (rawValue: unknown): string | null => {
  if (typeof rawValue !== "string") return null;
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.toLowerCase().includes("follower")) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.href;
  } catch {
    return null;
  }
};

const getSocialDisplayLabel = (url: string | null, fallback: string): string => {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    const host = String(parsed.hostname || "").replace(/^www\./i, "");
    const path = String(parsed.pathname || "").replace(/^\/+/, "");
    if (path) {
      const firstSegment = path.split("/")[0];
      return `@${firstSegment}`;
    }
    return host;
  } catch {
    return fallback;
  }
};

type SocialBucket = "instagram" | "twitter" | "tiktok";

/**
 * Wizard rows from PackagesStep use `{uuid} account` or `{PlatformName} account`.
 * On the public listing page, `useAccounts()` may be empty (admin endpoint), so we
 * must still allow attaching URLs for these rows even when the hostname is not
 * instagram.com / tiktok.com / x.com (handles, link-in-bio domains, etc.).
 */
const wizardStructuredSocialQuestion = (question: string): boolean => {
  const q = question.trim();
  if (/^[a-f0-9-]{36}\s*account/i.test(q)) return true;
  const mentionsSupportedPlatform =
    /\binstagram\b/i.test(q) ||
    /\btiktok\b/i.test(q) ||
    /\btik\s+tok\b/i.test(q) ||
    /\b(twitter|x\.com)\b/i.test(q) ||
    /^x$/i.test(q) ||
    /\bx\s*\(/i.test(q);
  // PackagesStep saves `{platform} account`; DB rows may omit "account" or use mixed case.
  if (/\baccount\s*$/i.test(q)) return mentionsSupportedPlatform;
  return mentionsSupportedPlatform;
};

const inferBucketFromUrlString = (raw: string): SocialBucket | null => {
  const parsed = normalizeSocialUrl(raw);
  if (!parsed) return null;
  try {
    const host = new URL(parsed).hostname.toLowerCase().replace(/^www\./, "");
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("twitter") || host === "x.com" || host.endsWith(".twitter.com")) return "twitter";
  } catch {
    /* ignore */
  }
  return null;
};

const inferBucketFromUuidAccountQuestion = (
  question: string,
  idToOptionLower: Record<string, string>,
): SocialBucket | null => {
  const m = question.trim().match(/^([a-f0-9-]{36})\s*account/i);
  if (!m) return null;
  const opt = idToOptionLower[m[1].toLowerCase()] || "";
  if (opt.includes("instagram")) return "instagram";
  if (opt.includes("tiktok")) return "tiktok";
  if (opt.includes("twitter") || opt === "x" || opt.includes("(twitter)")) return "twitter";
  return null;
};

/** Map admin SOCIAL account question (exact label match) to a public card bucket. */
const inferBucketFromAdminQuestion = (
  question: string,
  accountQuestions: Array<{ question: string }>,
): SocialBucket | null => {
  const qn = question.trim().toLowerCase();
  const aq = accountQuestions.find((q) => (q.question || "").trim().toLowerCase() === qn);
  if (!aq) return null;
  const t = (aq.question || "").toLowerCase();
  if (t.includes("facebook") && !t.includes("instagram")) return null;
  if (t.includes("instagram")) return "instagram";
  if (t.includes("tiktok") || t.includes("tik tok")) return "tiktok";
  if (t.includes("twitter") || t.includes("x.com") || /\bx\s*\(/.test(t)) return "twitter";
  return null;
};

const parseFollowersLabel = (segment: string): string | null => {
  const s = segment.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (low.includes("follower")) return s;
  const compact = s.replace(/\s/g, "");
  if (!/^\d[,.\d]*$/.test(compact)) return null;
  const n = parseInt(compact.replace(/[^0-9]/g, ""), 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return `${n.toLocaleString("en-US")} Followers`;
};

/** Canonical profile-URL prefixes so a bare handle still opens a working link. */
const PLATFORM_PROFILE_BASE: Record<SocialBucket, string> = {
  instagram: "https://instagram.com/",
  twitter: "https://x.com/",
  tiktok: "https://tiktok.com/@",
};

/**
 * Turn a seller's answer segment (a full URL OR a bare handle like "@name") into
 * a working profile link for the given card. Full/real URLs are normalized and
 * kept as-is; a handle is expanded onto the platform base so clicking actually
 * opens the profile instead of a broken "https://name" link.
 */
const buildBucketUrl = (bucket: SocialBucket, segment: string): string | null => {
  const trimmed = segment.trim();
  if (!trimmed || trimmed.toLowerCase().includes("follower")) return null;
  const withoutAt = trimmed.replace(/^@+/, "");
  // Looks like a real URL / domain (has protocol or a dotted TLD) → keep normalized.
  if (/^https?:\/\//i.test(trimmed) || /\.[a-z]{2,}(\/|$)/i.test(withoutAt)) {
    return normalizeSocialUrl(trimmed);
  }
  // Otherwise treat it as a username/handle for this specific platform.
  const handle = withoutAt.replace(/\s+/g, "");
  return handle ? `${PLATFORM_PROFILE_BASE[bucket]}${handle}` : null;
};

/** Merge all listing `social_account` rows into the three public cards (URLs + follower counts). */
const aggregateSocialByPlatform = (
  entries: any[],
  platformDefs: Array<{ id: string; social_account_option?: string; platform?: string }>,
  accountQuestions: Array<{ question: string }>,
): Record<SocialBucket, { url: string | null; followers: string }> => {
  const empty = (): Record<SocialBucket, { url: string | null; followers: string }> => ({
    instagram: { url: null, followers: "0 Followers" },
    twitter: { url: null, followers: "0 Followers" },
    tiktok: { url: null, followers: "0 Followers" },
  });
  const out = empty();
  if (!Array.isArray(entries) || entries.length === 0) return out;

  const idToOptionLower: Record<string, string> = {};
  platformDefs.forEach((p) => {
    idToOptionLower[String(p.id).toLowerCase()] = String(
      p.social_account_option || p.platform || "",
    ).toLowerCase();
  });

  const applySegment = (
    bucket: SocialBucket,
    segment: string,
    allowGenericUrlForBucket: boolean,
  ) => {
    const seg = segment.trim();
    if (!seg) return;
    if (!out[bucket].url && !seg.toLowerCase().includes("follower")) {
      const urlBucket = inferBucketFromUrlString(seg);
      if (urlBucket === bucket) {
        // Full platform URL that matches this exact card.
        out[bucket].url = normalizeSocialUrl(seg);
      } else if (urlBucket === null && allowGenericUrlForBucket) {
        // Bare handle or non-platform URL under a question we know maps to this
        // card → expand it into a working profile link.
        out[bucket].url = buildBucketUrl(bucket, seg);
      }
      // urlBucket === a different platform → skip (avoid cross-contamination).
    }
    const fl = parseFollowersLabel(seg);
    if (fl) out[bucket].followers = fl;
  };

  const sorted = [...entries].sort((a, b) => {
    const qa = String(a?.question ?? "").trim();
    const qb = String(b?.question ?? "").trim();
    const ua = /^[a-f0-9-]{36}\s*account/i.test(qa);
    const ub = /^[a-f0-9-]{36}\s*account/i.test(qb);
    if (ua && !ub) return -1;
    if (!ua && ub) return 1;
    return 0;
  });

  sorted.forEach((entry: any) => {
    const rawAns = pickListingAnswer(entry);
    const answerText =
      rawAns !== undefined && rawAns !== null ? String(rawAns).trim() : "";
    if (!answerText) return;
    const question = String(entry?.question ?? "");
    const questionLower = question.toLowerCase();

    if (/facebook/i.test(question) && !/instagram|tiktok|twitter|tik tok/i.test(question)) {
      return;
    }

    const segments = answerText.includes("|")
      ? answerText.split("|").map((s) => s.trim()).filter(Boolean)
      : [answerText];

    let bucket: SocialBucket | null = null;
    for (const seg of segments) {
      bucket = inferBucketFromUrlString(seg);
      if (bucket) break;
    }

    const bucketFromUuid = inferBucketFromUuidAccountQuestion(question, idToOptionLower);
    if (!bucket) bucket = bucketFromUuid;
    if (!bucket) bucket = inferBucketFromAdminQuestion(question, accountQuestions);

    if (!bucket) {
      if (questionLower.includes("tiktok") || questionLower.includes("tik tok")) {
        bucket = "tiktok";
      } else if (
        questionLower.includes("twitter") ||
        questionLower.includes("x.com") ||
        /\bx\s*\(twitter\)/i.test(question) ||
        /\bx account/i.test(questionLower)
      ) {
        bucket = "twitter";
      } else if (questionLower.includes("instagram")) {
        bucket = "instagram";
      }
    }
    if (!bucket) return;

    const allowGenericUrl = wizardStructuredSocialQuestion(question);

    segments.forEach((seg) => applySegment(bucket!, seg, allowGenericUrl));
  });

  return out;
};

const isLockedValue = (value: unknown): value is string =>
  typeof value === "string" &&
  value.toLowerCase().includes("to unlock");

// MediaCarousel Component
/** The lime "Managed by EX" pill, as it appears on the listing cards. */
const ManagedByExBadge = () => (
  <div
    className="flex items-center gap-1.5"
    style={{
      height: '36px',
      borderRadius: '60px',
      padding: '7px 14px',
      background: 'rgba(197, 253, 31, 1)',
    }}
  >
    <img src={ExIcon} alt="" style={{ width: '18px', height: '18px' }} />
    <span
      style={{
        fontFamily: 'Lufga',
        fontWeight: 500,
        fontSize: '14px',
        lineHeight: '140%',
        color: 'rgba(0, 0, 0, 1)',
        whiteSpace: 'nowrap',
      }}
    >
      Managed by EX
    </span>
  </div>
);

const MediaCarousel = ({ images, isFavorite, isTogglingFavorite, onFavorite, onShare, categoryName, managedByEx, locked, lockCtaText, onUnlockClick }: {
  images: string[];
  isFavorite: boolean;
  isTogglingFavorite: boolean;
  onFavorite: () => void;
  onShare: () => void;
  categoryName?: string;
  /** Listing is looked after by the platform team. */
  managedByEx?: boolean;
  /** Photos are blurred previews until the viewer earns the real ones. */
  locked?: boolean;
  lockCtaText?: string;
  onUnlockClick?: () => void;
}) => {
  const [api, setApi] = useState<any>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  if (!images || images.length === 0) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-2">📷</div>
          <p>No image available</p>
        </div>
        {(categoryName || managedByEx) && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            {managedByEx && <ManagedByExBadge />}
            <div
              style={{
                height: '36px',
                borderRadius: '60px',
                gap: '10px',
                padding: '7px 17px',
                background: 'rgba(0, 0, 0, 0.25)',
                backdropFilter: 'blur(44px)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '16px',
                lineHeight: '140%',
                letterSpacing: '0%',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 1)',
                whiteSpace: 'nowrap',
              }}
            >
              {categoryName}
            </div>
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={onFavorite}
            disabled={isTogglingFavorite}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {isTogglingFavorite ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground"></div>
            ) : (
              <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
            )}
          </button>
          <button
            onClick={onShare}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
      {/* Sits above the blurred previews the server sent. */}
      {locked && (
        <button
          type="button"
          onClick={onUnlockClick}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/25 cursor-pointer border-0"
        >
          <Lock className="w-8 h-8 text-white" />
          <span className="text-white text-lg font-medium underline capitalize">
            {lockCtaText || 'register to unlock 🔓'}
          </span>
        </button>
      )}
      <Carousel setApi={setApi} className="w-full h-full">
        <CarouselContent className="h-full">
          {images.map((img, index) => (
            <CarouselItem key={index} className="h-full">
              <div className="relative w-full h-full">
                <ListingImage
                  src={img}
                  alt={`Listing image ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="100vw"
                  blurred={locked}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <>
            <CarouselPrevious className="left-4" />
            <CarouselNext className="right-4" />
          </>
        )}
      </Carousel>

      {/* Managed-by-EX and category badges, side by side as on the cards */}
      {(categoryName || managedByEx) && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          {managedByEx && <ManagedByExBadge />}
          <div
            style={{
              height: '36px',
              borderRadius: '60px',
              gap: '10px',
              padding: '7px 17px',
              background: 'rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(44px)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: '16px',
              lineHeight: '140%',
              letterSpacing: '0%',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 1)',
              whiteSpace: 'nowrap',
            }}
          >
            {categoryName}
          </div>
        </div>
      )}

      {/* Floating action buttons */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={onFavorite}
          disabled={isTogglingFavorite}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {isTogglingFavorite ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground"></div>
          ) : (
            <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
          )}
        </button>
        <button
          onClick={onShare}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Pagination dots */}
      {images.length > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          {images.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${index === current ? "bg-white" : "bg-white/50"
                }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// SummaryCard Component
const SummaryCard = ({
  listing,
  onContactSeller,
  isStartingChat,
  showReport,
  onReport,
  showCapacity,
  verifiedFunds,
  listingPriceNumber,
}: {
  listing: any;
  onContactSeller: () => void;
  isStartingChat: boolean;
  /** Hidden on your own listing and in the admin view, which has its own tools. */
  showReport?: boolean;
  onReport?: () => void;
  /** Only a signed-in buyer has capital to compare against this price. */
  showCapacity?: boolean;
  verifiedFunds?: number | null;
  listingPriceNumber?: number;
}) => {
  const formatPrice = (price: number | string | undefined) => {
    if (!price) return "$0";
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return "$0";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  // Public title: the seller's Ad Information title, falling back to the brand.
  const listingTitle = resolveListingTitle(listing);

  // Get description from brand or advertisement
  const brandAnswers = getAllAnswers(listing?.brand || []);
  const advertisementAnswers = getAllAnswers(listing?.advertisement || []);

  // Helper functions to get answers (same as listing cards)
  const getBrandAnswer = (searchTerms: string[]) => {
    const brandQuestions = listing?.brand || [];
    const question = brandQuestions.find((b: any) =>
      searchTerms.some(term => b.question?.toLowerCase().includes(term.toLowerCase()))
    );
    return question?.answer || null;
  };

  const getAdAnswer = (searchTerms: string[]) => {
    const adQuestions = listing?.advertisement || [];
    const question = adQuestions.find((a: any) =>
      searchTerms.some(term => a.question?.toLowerCase().includes(term.toLowerCase()))
    );
    return question?.answer || null;
  };

  // Get listing price from advertisement questions first (same as listing cards)
  const askingPrice = getAdAnswer(['listing price', 'price']) ||
    getBrandAnswer(['asking price', 'price', 'selling price']) ||
    listing?.price ||
    '0';

  console.log('💰 SummaryCard Price Extraction:', {
    askingPrice,
    fromAd: getAdAnswer(['listing price', 'price']),
    fromBrand: getBrandAnswer(['asking price', 'price', 'selling price']),
    listingPrice: listing?.price,
    brandQuestions: listing?.brand?.length || 0,
    adQuestions: listing?.advertisement?.length || 0,
  });

  const fullDescription = getAnswerByQuestion(listing?.brand || [], ['description', 'about', 'business description']) ||
    advertisementAnswers['Description'] ||
    advertisementAnswers['description'] ||
    'No description available';

  // Limit description to 109 characters
  const truncatedDescription = fullDescription.length > 109
    ? fullDescription.substring(0, 109) + '...'
    : fullDescription;

  // Calculate financials for profit/revenue multiples (same as listing cards)
  const financials = listing?.financials || [];
  const monthlyFinancials = financials.filter((f: any) => f.type === 'monthly');
  const totalRevenue = financials.reduce((sum: number, f: any) => sum + parseFloat(f.revenue_amount || 0), 0);
  const totalProfit = financials.reduce((sum: number, f: any) => sum + parseFloat(f.net_profit || 0), 0);
  const avgMonthlyProfit = monthlyFinancials.length > 0
    ? monthlyFinancials.reduce((sum: number, f: any) => sum + parseFloat(f.net_profit || 0), 0) / monthlyFinancials.length
    : 0;

  // Calculate profit multiple and revenue multiple (same as listing cards)
  const profitMultiple = totalProfit > 0 && avgMonthlyProfit > 0
    ? `Multiple ${(parseFloat(askingPrice.toString()) / (avgMonthlyProfit * 12)).toFixed(1)}x Profit`
    : 'Multiple 1.5x Profit';
  const revenueMultiple = totalRevenue > 0
    ? `${(parseFloat(askingPrice.toString()) / totalRevenue).toFixed(1)}x Revenue`
    : '0.5x Revenue';

  return (
    <div className="sticky top-24 bg-card border border-border rounded-2xl p-6 space-y-6">
      {/* Title */}
      <div>
        <h1
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '24px',
            lineHeight: '120%',
            letterSpacing: '0%',
            color: '#000000',
            marginBottom: '8px',
            textTransform: 'capitalize',
          }}
        >
          {listingTitle}
        </h1>
        {/* Description */}
        <p
          style={{
            fontFamily: 'Lufga',
            fontWeight: 400,
            fontStyle: 'normal',
            fontSize: '12px',
            lineHeight: '150%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 0.5)',
            marginTop: '8px',
          }}
        >
          {truncatedDescription}
        </p>
      </div>

      {/* Price */}
      <div>
        <div
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '38px',
            lineHeight: '120%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 1)',
            marginBottom: '4px',
          }}
        >
          {formatPrice(askingPrice)}
        </div>
        {/* Profit/Revenue Multiple Section (same as listing cards) */}
        <div
          className="flex items-center bg-white border rounded-full overflow-hidden"
          style={{
            width: 'auto',
            height: '25px',
            borderRadius: '60px',
            border: '1px solid rgba(0, 0, 0, 0.3)',
            background: 'rgba(255, 255, 255, 1)',
            gap: '10px',
            display: 'inline-flex',
            marginTop: '8px',
            marginBottom: '8px',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              paddingTop: '5px',
              paddingRight: '12px',
              paddingBottom: '5px',
              paddingLeft: '12px',
              borderRight: '1px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            <span
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '10px',
                lineHeight: '150%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
              }}
            >
              {profitMultiple}
            </span>
          </div>
          <div
            className="flex items-center justify-center"
            style={{
              paddingTop: '5px',
              paddingRight: '12px',
              paddingBottom: '5px',
              paddingLeft: '12px',
            }}
          >
            <span
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '10px',
                lineHeight: '150%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
              }}
            >
              {revenueMultiple}
            </span>
          </div>
        </div>
        {/* Payment Information - Single Line */}
        <div className="flex items-center gap-2" style={{ marginTop: '8px', marginBottom: '8px' }}>
          <span
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: '16px',
              lineHeight: '120%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 0.7)',
            }}
          >
            Pay in {getListingCurrencySymbol(listing)}{formatNumber(Math.round(parseFloat(askingPrice.toString()) / financingInstalments(parseFloat(askingPrice.toString()) || 0)))} monthly
          </span>
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: 'rgba(217, 217, 217, 1)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: '16px',
              lineHeight: '120%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 0.7)',
            }}
          >
            {financingInstalments(parseFloat(askingPrice.toString()) || 0)} installments
          </span>
        </div>
        <a
          href="#"
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '16px',
            lineHeight: '120%',
            letterSpacing: '0%',
            textDecoration: 'underline',
            textDecorationStyle: 'solid',
            textUnderlineOffset: '0px',
            textDecorationThickness: 'auto',
            textDecorationSkipInk: 'auto',
            color: 'rgba(0, 103, 255, 1)',
            cursor: 'pointer',
          }}
        >
          Financing
        </a>
        {/* Divider Line */}
        <div
          style={{
            width: '347px',
            height: '0px',
            border: '1px solid rgba(0, 0, 0, 0.05)',
            marginTop: '16px',
            marginBottom: '16px',
          }}
        />
      </div>

      {/* Seller info */}
      {listing?.profile && (
        <div
          className="flex items-start gap-3"
        >
          <Avatar
            className="h-16 w-16 flex-shrink-0"
            style={{
              borderRadius: '50%',
            }}
          >
            <AvatarImage src={listing.profile.avatar_url || undefined} />
            <AvatarFallback
              style={{
                background: '#AEF31F',
                color: 'rgba(0, 0, 0, 1)',
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontSize: '20px',
              }}
            >
              {(listing.profile.full_name?.charAt(0) || 'U').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col gap-2">
            {/* Name */}
            <h3
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '24px',
                lineHeight: '120%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
                margin: 0,
              }}
            >
              {listing.profile.full_name || "Unknown User"}
            </h3>
            {/* ID Verified */}
            <div className="flex items-center gap-2">
              <img
                src={FaceScanSquareIcon}
                alt="ID Verified"
                style={{
                  width: '20px',
                  height: '20px',
                }}
              />
              <span
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '20px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(125, 125, 125, 1)',
                }}
              >
                ID Verified
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3 pt-4">
        <Button
          onClick={onContactSeller}
          disabled={isStartingChat || !listing?.userId && !listing?.user_id}
          style={{
            width: '347px',
            height: '53px',
            borderRadius: '62px',
            padding: '10px',
            gap: '10px',
            background: 'rgba(197, 253, 31, 1)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isStartingChat ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
              <span
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '18px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)',
                }}
              >
                Starting...
              </span>
            </>
          ) : (
            <span
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '18px',
                lineHeight: '120%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
              }}
            >
              Contact Seller
            </span>
          )}
        </Button>

        {showCapacity && (
          <div style={{ marginTop: '16px' }}>
            <AcquisitionCapacityCard
              verifiedFunds={verifiedFunds}
              listingPrice={listingPriceNumber}
            />
          </div>
        )}

        {showReport && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle
                style={{ width: '18px', height: '18px', color: 'rgba(0, 0, 0, 1)' }}
              />
              <span
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 600,
                  fontSize: '16px',
                  lineHeight: '120%',
                  color: 'rgba(0, 0, 0, 1)',
                }}
              >
                Report Listing
              </span>
            </div>
            <p
              style={{
                fontFamily: 'Lufga',
                fontWeight: 400,
                fontSize: '14px',
                lineHeight: '150%',
                color: 'rgba(0, 0, 0, 0.5)',
                margin: 0,
              }}
            >
              {/* Not "anonymous": the report records who sent it so the team can
                  follow up. The seller is the one who never finds out, and that
                  is what the reporter actually needs to hear. */}
              Think this listing violates our policies? Your report is confidential —
              the seller is never told who sent it.
            </p>
            <button
              type="button"
              onClick={onReport}
              style={{
                alignSelf: 'flex-start',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontSize: '14px',
                lineHeight: '150%',
                color: 'rgba(0, 0, 0, 1)',
                textDecoration: 'underline',
              }}
            >
              Report Listing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * The green "Register To Unlock" pill, used everywhere a value is withheld so
 * the treatment reads the same on every section of the page.
 */
const UnlockPill = ({
  label,
  onClick,
  fullWidth = false,
}: {
  label?: string | number;
  onClick?: () => void;
  fullWidth?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      width: fullWidth ? '100%' : 'auto',
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
      padding: '8px 16px',
      borderRadius: '60px',
      background: 'rgba(198, 254, 31, 1)',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'Lufga',
      fontWeight: 500,
      fontSize: '14px',
      lineHeight: '120%',
      color: 'rgba(0, 0, 0, 1)',
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}
  >
    <Lock style={{ width: '14px', height: '14px', flexShrink: 0 }} />
    {/* The emoji belongs to the server's label, not to this design. */}
    {String(label ?? 'register to unlock').replace(/[🔓🔒]/g, '').trim()}
  </button>
);

/**
 * Stands in for a value the viewer has not earned yet — the seller's name, the
 * domain — drawn as blurred placeholder text.
 *
 * Deliberately *not* the real value under a CSS blur: that would still ship the
 * secret to the browser, where anyone could read it off the network tab. The
 * server never sends it; this only fills the space the design expects.
 */
const LockedBlur = ({
  chars = 12,
  fontSize = 'inherit',
}: {
  chars?: number;
  fontSize?: string;
}) => (
  <span
    aria-label="Hidden until unlocked"
    style={{
      filter: 'blur(5px)',
      userSelect: 'none',
      pointerEvents: 'none',
      opacity: 0.55,
      fontSize,
      letterSpacing: '0.05em',
    }}
  >
    {'█'.repeat(Math.max(3, Math.round(chars * 0.5)))}
  </span>
);

/**
 * The ⓘ every metric card carries in its top-right corner. The card it sits on
 * must be `position: relative`.
 */
const InfoBadge = ({ text }: { text: string }) => (
  <span
    title={text}
    aria-label={text}
    style={{ position: 'absolute', top: '16px', right: '16px', cursor: 'help', lineHeight: 0 }}
  >
    <Info style={{ width: '16px', height: '16px', color: 'rgba(0,0,0,0.35)' }} />
  </span>
);

/**
 * Customer Type is a B2B/B2C split, shown as one bar rather than a number.
 * Falls back to "Unknown" when the seller has not filled it in.
 */
const CustomerTypeCard = ({
  segments,
  info,
}: {
  segments: Array<{ name: string; percent: number }>;
  info?: string;
}) => {
  const total = segments.reduce((sum, s) => sum + s.percent, 0);
  const colours = ['rgba(197, 253, 31, 1)', 'rgba(0, 0, 0, 1)'];

  return (
    <div
      style={{
        borderRadius: '20px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '20px',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative',
      }}
    >
      {info && <InfoBadge text={info} />}
      <div style={{
        fontFamily: 'Lufga', fontSize: '20px', color: '#000000', fontWeight: 500,
        fontStyle: 'normal',
        lineHeight: '120%',
        letterSpacing: '0%',
      }}>
        Customer Type
      </div>

      {total <= 0 ? (
        <div style={{ fontFamily: 'Lufga', fontWeight: 600, fontSize: '20px' }}>{NOT_AVAILABLE_LABEL}</div>
      ) : (
        <>
          <div style={{ display: 'flex', height: '10px', borderRadius: '999px', overflow: 'hidden' }}>
            {segments.map((s, i) => (
              <div
                key={s.name}
                style={{ width: `${(s.percent / total) * 100}%`, background: colours[i % colours.length] }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {segments.map((s, i) => (
              <span
                key={s.name}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'Lufga', fontSize: '12px' }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: colours[i % colours.length],
                  }}
                />
                {Math.round(s.percent)}% = {s.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** Light grey panel with a title and an info icon, holding white metric cards. */
const SectionBox = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    style={{
      borderRadius: '20px',
      background: 'rgba(250, 250, 250, 1)',
      border: '1px solid rgba(0, 0, 0, 0.06)',
      padding: '16px',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
      }}
    >
      <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '15px', color: '#000' }}>
        {title}
      </span>
      <Info style={{ width: '15px', height: '15px', color: 'rgba(0,0,0,0.35)' }} />
    </div>
    {children}
  </div>
);

/** One figure in the Averages box; shows "Unknown" when it cannot be derived. */
const AverageCell = ({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note: string;
}) => (
  <div
    style={{
      background: '#fff',
      borderRadius: '14px',
      padding: '14px 16px',
    }}
  >
    <div style={{ fontFamily: 'Lufga', fontSize: '12px', color: 'rgba(0,0,0,0.55)' }}>{label}</div>
    <div
      style={{
        fontFamily: 'Lufga',
        fontWeight: 600,
        fontSize: '22px',
        color: '#000',
        margin: '2px 0 4px',
      }}
    >
      {value !== null ? `$${Math.round(value).toLocaleString('en-US')}` : UNKNOWN_LABEL}
    </div>
    <div style={{ fontFamily: 'Lufga', fontSize: '10px', color: 'rgba(0,0,0,0.4)' }}>{note}</div>
  </div>
);

/**
 * A multiple with its market rating. An unprofitable business has no meaningful
 * multiple, so it reads "Unknown" / "No data available" and the High–Fair–Low
 * price indicator is left out entirely.
 */
const MultipleRow = ({
  label,
  value,
  kind,
}: {
  label: string;
  value: number | null;
  kind: MultipleKind;
}) => {
  const rating = getMultipleRating(value, kind);

  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '80px' }}>
        <div>
          <div style={{ fontFamily: 'Lufga', fontSize: '13px', color: 'rgba(0,0,0,0.55)' }}>{label}</div>
          <div
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontSize: '26px',
              color: '#000',
              margin: '2px 0 4px',
            }}
          >
            {rating && value !== null ? `${value.toFixed(1)}x` : UNKNOWN_LABEL}
          </div>
          <div style={{ fontFamily: 'Lufga', fontSize: '10px', color: 'rgba(0,0,0,0.4)' }}>
            Compared with Similar Listings
          </div>
        </div>

        <div className="flex flex-col flex-1">
          <span
            style={{
              fontFamily: 'Lufga',
              fontSize: '10px',
              lineHeight: "16px",
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
              background: 'rgba(197, 253, 31, 1)',
              color: '#000',
              width: 'fit-content'
            }}
          >
            {rating ? rating.label : 'No data available'}
          </span>
          {rating && (
            <div style={{ marginTop: '36px' }}>
              <div
                style={{
                  position: 'relative',
                  height: '8px',
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, rgba(230,255,150,1) 0%, rgba(197,253,31,1) 100%)',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    // Sits just above the bar; the pointer below reaches down to it.
                    bottom: '13px',
                    left: `${rating.markerPercent}%`,
                    transform: 'translateX(-50%)',
                    background: '#000',
                    color: '#fff',
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontSize: '10px',
                    lineHeight: 1,
                    padding: '4px 8px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {value !== null ? value.toFixed(1) : ''}
                  {/* Tooltip pointer aiming at the position on the bar. */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderTop: '5px solid #000',
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '6px',
                  fontFamily: 'Lufga',
                  fontSize: '10px',
                  color: 'rgba(0,0,0,0.4)',
                }}
              >
                <span>High</span>
                <span>Fair</span>
                <span>Low Price</span>
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

// MetricCard Component
const MetricCard = ({
  label,
  value,
  icon: Icon,
  image,
  customWidth,
  customHeight,
  onUnlockClick,
  info,
  flagCountry,
  valuePrefix,
}: {
  label: string;
  value: string | number;
  /** Country name shown as a flag next to the value. */
  flagCountry?: string;
  icon?: any;
  image?: string;
  customWidth?: string;
  customHeight?: string;
  onUnlockClick?: () => void;
  /** Tooltip text; showing it also puts the ⓘ symbol on the card. */
  info?: string;
  /** Icon shown immediately left of the value, on the same line. */
  valuePrefix?: React.ReactNode;
}) => {
  return (
    <div
      style={{
        width: customWidth || '100%',
        maxWidth: customWidth || '389.67px',
        height: customHeight || '118px',
        borderRadius: '20px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '24px',
        background: 'rgba(255, 255, 255, 1)',
        display: 'flex',
        flexDirection: image ? 'row' : 'column',
        gap: '10px',
        alignItems: image ? 'center' : 'flex-start',
        justifyContent: image ? 'space-between' : 'flex-start',
        position: 'relative',
      }}
    >
      {info && <InfoBadge text={info} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: image ? 1 : 'none' }}>
        <div
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '20px',
            lineHeight: '120%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          {label}
        </div>
        {isLockedValue(value) ? (
          <UnlockPill label={value} onClick={onUnlockClick} />
        ) : (
          <div
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: '28px',
              lineHeight: '120%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {valuePrefix}
            {value}
            {/* Country flag beside the location, e.g. "USA 🇺🇸". */}
            {flagCountry ? <FlagIcon country={flagCountry} className="w-7 h-5" /> : null}
          </div>
        )}
      </div>
      {image && (
        <img
          src={image}
          alt={label}
          style={{
            width: 'auto',
            height: '100%',
            objectFit: 'contain',
            maxHeight: '70px',
          }}
        />
      )}
      {!image && Icon && <Icon style={{ width: '16px', height: '16px', color: 'rgba(0, 0, 0, 0.5)' }} />}
    </div>
  );
};

// ProgressMetricCard Component (with progress bar)
const ProgressMetricCard = ({
  label,
  value,
  onUnlockClick,
  info,
}: {
  label: string;
  value: string | number;
  onUnlockClick?: () => void;
  /** Tooltip text; showing it also puts the ⓘ symbol on the card. */
  info?: string;
}) => {
  if (isLockedValue(value)) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '389.67px',
          minHeight: '118px',
          borderRadius: '20px',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          padding: '24px',
          background: 'rgba(255, 255, 255, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          position: 'relative',
        }}
      >
        {info && <InfoBadge text={info} />}
        <div
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '20px',
            lineHeight: '120%',
            letterSpacing: '0%',
            color: '#000000',
          }}
        >
          {label}
        </div>
        <UnlockPill label={value} onClick={onUnlockClick} />
      </div>
    );
  }

  // Extract percentage from value (e.g., "45%" -> 45, or just use the number)
  const percentage = typeof value === 'string'
    ? parseFloat(String(value).replace('%', '')) || 0
    : typeof value === 'number'
      ? value
      : 0;

  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  // Calculate progress bar width (325px is the track width)
  const trackWidth = 325;
  const progressWidth = (clampedPercentage / 100) * trackWidth;

  // Position of circular indicator (at the end of progress, but ensure it's within bounds)
  // Center the indicator on the progress edge
  const indicatorPosition = Math.max(Math.min(progressWidth, trackWidth - 18), 18);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '389.67px',
        height: '118px',
        borderRadius: '20px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '24px',
        background: 'rgba(255, 255, 255, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative',
      }}
    >
      {info && <InfoBadge text={info} />}
      {/* Label */}
      <div
        style={{
          fontFamily: 'Lufga',
          fontWeight: 500,
          fontStyle: 'normal',
          fontSize: '20px',
          lineHeight: '120%',
          letterSpacing: '0%',
          color: '#000000',
        }}
      >
        {label}
      </div>

      {/* Progress Bar Container */}
      <div style={{ position: 'relative', width: '100%', marginTop: '10px' }}>
        {/* Empty Track */}
        <div
          style={{
            width: `${trackWidth}px`,
            maxWidth: '100%',
            height: '17px',
            borderRadius: '50px',
            background: '#FAFAFA',
            position: 'relative',
            overflow: 'visible',
          }}
        >
          {/* Filled Progress Bar with Diagonal Stripes */}
          {clampedPercentage > 0 && (
            <div
              style={{
                width: `${progressWidth}px`,
                height: '17px',
                borderRadius: '50px',
                background: '#C5FE1F',
                position: 'absolute',
                top: 0,
                left: 0,
                overflow: 'hidden',
              }}
            >
              {/* Diagonal Stripe Pattern - using -123.16deg angle */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundImage: `repeating-linear-gradient(
                    -123.16deg,
                    transparent,
                    transparent 4px,
                    rgba(0, 0, 0, 0.9) 4px,
                    rgba(0, 0, 0, 0.9) 5px
                  )`,
                }}
              />
            </div>
          )}

          {/* Circular Indicator */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.1)',
              border: '1px solid #FFFFFF',
              backdropFilter: 'blur(24px)',
              position: 'absolute',
              top: '-9.5px', // Center it vertically: (36 - 17) / 2 = 9.5px above
              left: `${indicatorPosition}px`,
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '12px',
                lineHeight: '120%',
                letterSpacing: '0%',
                textAlign: 'center',
                color: '#000000',
              }}
            >
              {clampedPercentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

// AttachmentCard Component
/** Pick the icon that matches the uploaded file rather than always showing PDF. */
const AttachmentCard = ({ fileName, url }: { fileName: string; url?: string }) => {
  // The size is not stored with the answer, so ask the CDN for it. Stays hidden
  // rather than showing a made-up number when the request cannot be made.
  const [fileSize, setFileSize] = useState<string | null>(null);

  useEffect(() => {
    if (!url || url === '#') return;
    let cancelled = false;

    fetch(url, { method: 'HEAD' })
      .then((response) => {
        const bytes = Number(response.headers.get('content-length'));
        if (!cancelled && Number.isFinite(bytes) && bytes > 0) {
          setFileSize(formatBytes(bytes));
        }
      })
      .catch(() => {
        /* size stays unknown */
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url || url === '#') return;

    try {
      // Fetch the file
      const response = await fetch(url);
      const blob = await response.blob();

      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  return (
    <div
      style={{
        width: '373.67px',
        height: '98px',
        borderRadius: '20px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        padding: '24px',
        background: 'rgba(255, 255, 255, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      <FileTypeIcon fileName={fileName} size={40} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <div
          style={{
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: '20px',
            lineHeight: '120%',
            letterSpacing: '0%',
            color: 'rgba(0, 0, 0, 1)',
          }}
        >
          {fileName}
        </div>
        {fileSize && (
          <div
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '120%',
              letterSpacing: '0%',
              color: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            {fileSize}
          </div>
        )}
      </div>
      <button
        onClick={handleDownload}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Download className="w-5 h-5" style={{ color: 'rgba(0, 0, 0, 1)' }} />
      </button>
    </div>
  );
};


type ListingDetailProps = {
  embedded?: boolean;
  adminLayout?: boolean;
};

const ListingDetail = ({ embedded = false, adminLayout = false }: ListingDetailProps = {}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Helper function to get responsive font size
  const getFontSize = (mobile: string, tablet: string, desktop: string) => {
    if (isMobile) return mobile;
    if (isTablet) return tablet;
    return desktop;
  };
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  // Confidentiality agreement gate for buyers.
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [isAcceptingAgreement, setIsAcceptingAgreement] = useState(false);
  const [hasConfidentialAccess, setHasConfidentialAccess] = useState(false);
  // The viewer's own verified capital, compared against this listing's price.
  const [myVerifiedFunds, setMyVerifiedFunds] = useState<number | null>(null);
  // Reporting a listing to the moderation team.
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [selectedChartTab, setSelectedChartTab] = useState('sales-channels');
  const [chartPeriod, setChartPeriod] = useState('monthly');

  const { data: listing, isLoading, error } = useQuery({
    queryKey: ["listing", id, isAuthenticated],
    queryFn: async () => {
      if (!id) throw new Error("Listing ID is required");

      const listingResponse = isAuthenticated
        ? await apiClient.getSecureListingById(id)
        : await apiClient.getListingById(id, true);

      if (!listingResponse.success || !listingResponse.data) {
        throw new Error(listingResponse.error || 'Failed to fetch listing');
      }

      const listingData: any = listingResponse.data;

      console.log("📦 Listing data from API (using getListings - same as listing cards):", listingData);
      console.log("🔍 Checking all required fields:");
      console.log("- brand:", listingData?.brand?.length || 0, "items", listingData?.brand);
      console.log("- advertisement:", listingData?.advertisement?.length || 0, "items", listingData?.advertisement);
      console.log("- statistics:", listingData?.statistics?.length || 0, "items");
      console.log("- productQuestion:", listingData?.productQuestion?.length || 0, "items");
      console.log("- managementQuestion:", listingData?.managementQuestion?.length || 0, "items");
      console.log("- social_account:", listingData?.social_account?.length || 0, "items");
      console.log("- handover:", listingData?.handover?.length || 0, "items");
      console.log("- financials:", listingData?.financials?.length || 0, "items");
      console.log("- category:", listingData?.category?.length || 0, "items");
      console.log("- tools:", listingData?.tools?.length || 0, "items");
      console.log("- user:", listingData?.user ? "present" : "missing");

      // Extract title from brand questions (same logic as listing cards)
      let title = 'Untitled Listing';
      if (listingData.brand && Array.isArray(listingData.brand) && listingData.brand.length > 0) {
        const businessNameQuestion = listingData.brand.find((b: any) =>
          b.question?.toLowerCase().includes('business') ||
          b.question?.toLowerCase().includes('name') ||
          b.question?.toLowerCase().includes('company') ||
          b.question?.toLowerCase().includes('brand')
        );
        if (businessNameQuestion?.answer) {
          title = businessNameQuestion.answer;
        } else if (listingData.brand[0]?.answer) {
          title = listingData.brand[0].answer;
        }
      }

      // Normalize status
      let normalizedStatus = listingData.status?.toLowerCase() || 'draft';
      if (normalizedStatus === 'publish') normalizedStatus = 'published';

      // Get category info
      const categoryInfo = Array.isArray(listingData.category) && listingData.category.length > 0
        ? listingData.category[0]
        : listingData.category || null;

      // Use user data from listing (now included in API response from getListings)
      let profile = null;
      if (listingData.user) {
        const user = listingData.user as any;
        profile = {
          id: user.id,
          full_name: user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`.trim()
            : user.first_name || user.last_name || null,
          avatar_url: user.profile_pic || null,
          user_type: user.user_type || user.role || null,
          id_verified: user.id_verified ?? null,
        };
      } else if (listingData.user_id || listingData.userId) {
        // Fallback: fetch user if not included
        try {
          const userResponse = await apiClient.getUserById(listingData.user_id || listingData.userId);
          if (userResponse.success && userResponse.data) {
            const user = userResponse.data as any;
            profile = {
              id: user.id,
              full_name: user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`.trim()
                : user.first_name || user.last_name || null,
              avatar_url: user.profile_pic || null,
              user_type: user.user_type || user.role || null,
              id_verified: user.id_verified ?? null,
            };
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }

      // Return ALL data from API - using the SAME structure as listing cards
      // getListings() includes: brand, category, tools, financials, statistics, productQuestion, 
      // managementQuestion, social_account, advertisement, handover, user
      return {
        ...listingData,
        id: listingData.id,
        title: title,
        status: normalizedStatus,
        created_at: listingData.created_at || listingData.createdAt || new Date().toISOString(),
        updated_at: listingData.updated_at || listingData.updatedAt || new Date().toISOString(),
        user_id: listingData.user_id || listingData.userId || listingData.user?.id || null,
        category: categoryInfo ? [categoryInfo] : (listingData.category || []),
        profile: profile,
        // All arrays are already included from getListings API (same as listing cards)
        brand: listingData.brand || [],
        advertisement: listingData.advertisement || [],
        statistics: listingData.statistics || [],
        productQuestion: listingData.productQuestion || [],
        managementQuestion: listingData.managementQuestion || [],
        social_account: listingData.social_account || [],
        handover: listingData.handover || [],
        financials: listingData.financials || [],
        tools: listingData.tools || [],
      };
    },
    enabled: !!id,
  });

  console.log("detasdetail", listing)

  // Fetch similar listings (get more than 3 for carousel)
  // A buyer sees how far their own verified capital goes against this listing.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiClient
      .getMyAcquisitionCapacity()
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { verifiedFunds?: number | null; status?: string } | undefined;
        // Only a completed review counts as verified capital.
        const funds =
          res.success && data?.status === 'COMPLETED' ? (data.verifiedFunds ?? null) : null;
        setMyVerifiedFunds(funds);
      })
      .catch(() => {
        /* leave it unverified */
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // A buyer who already accepted (or was approved) should not be asked again.
  // Checked on every listing — the agreement gate is no longer tied to the
  // seller's confidentialControl setting.
  useEffect(() => {
    if (!user || !listing?.id) return;
    if (listing.userId === user.id || listing.user_id === user.id) {
      setHasConfidentialAccess(true);
      return;
    }
    let cancelled = false;
    apiClient
      .getMyConfidentialAccessStatus(listing.id)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { hasAccess?: boolean } | undefined;
        setHasConfidentialAccess(Boolean(res.success && data?.hasAccess));
      })
      .catch(() => {
        /* leave it locked; the agreement dialog will ask again */
      });
    return () => {
      cancelled = true;
    };
  }, [user, listing?.id, listing?.userId, listing?.user_id]);

  const { data: similarResult } = useQuery({
    // "v2" because this query used to resolve to a plain array; without it a
    // session still holding the old cached shape would read items off an array.
    queryKey: ["similar-listings", "v2", id, listing?.category?.[0]?.id, isAuthenticated],
    queryFn: async () => {
      try {
        const response = isAuthenticated
          ? await apiClient.getSecureListings()
          : await apiClient.getListings(); // Cached public feed (TTL ~10s, purged on create/update/delete)
        if (response.success && response.data) {
          const allListings = Array.isArray(response.data) ? response.data : [];

          // Similar means: same category and an asking price within ±50% of this
          // one, newest first. Without a price to compare against, fall back to
          // category alone rather than showing nothing.
          const priceOf = (l: any): number => {
            const rows = [...(l?.advertisement || []), ...(l?.brand || [])];
            const row = rows.find((q: any) =>
              /listing\s*price|asking\s*price|^\s*price\s*$/i.test(String(q?.question || '')),
            );
            return parseFloat(String(row?.answer ?? '').replace(/[^0-9.]/g, '')) || 0;
          };

          const currentCategory = String(listing?.category?.[0]?.name || '').toLowerCase();
          const currentPrice = priceOf(listing);
          const lowerBound = currentPrice * 0.5;
          const upperBound = currentPrice * 1.5;

          const newestFirst = (a: any, b: any) =>
            new Date(b.created_at || b.createdAt || 0).getTime() -
            new Date(a.created_at || a.createdAt || 0).getTime();

          // Someone else's live listing — the pool every tier draws from.
          const candidates = allListings
            .filter((l: any) => {
              if (l.id === id) return false;
              const status = l.status?.toUpperCase();
              return status === 'PUBLISH' || status === 'PUBLISHED';
            })
            .sort(newestFirst);

          const sameCategory = currentCategory
            ? candidates.filter(
                (l: any) =>
                  String(l.category?.[0]?.name || '').toLowerCase() === currentCategory,
              )
            : [];

          const inPriceRange = sameCategory.filter((l: any) => {
            if (currentPrice <= 0) return true;
            const price = priceOf(l);
            return price > 0 && price >= lowerBound && price <= upperBound;
          });

          // What the client asked for comes first. When nothing matches, widen
          // rather than leave the page ending on an empty section — and say so
          // in the heading, so a loose match is never passed off as a close one.
          if (inPriceRange.length > 0) {
            return { tier: 'similar' as const, items: inPriceRange.slice(0, MAX_SIMILAR_LISTINGS) };
          }
          if (sameCategory.length > 0) {
            return { tier: 'category' as const, items: sameCategory.slice(0, MAX_SIMILAR_LISTINGS) };
          }
          return { tier: 'newest' as const, items: candidates.slice(0, MAX_SIMILAR_LISTINGS) };
        }
        return { tier: 'newest' as const, items: [] };
      } catch (error) {
        console.error('Error fetching similar listings:', error);
        return { tier: 'newest' as const, items: [] };
      }
    },
    enabled: !!id && !!listing,
  });

  const formatPrice = (price: number | string | undefined) => {
    if (!price) return "$0";
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    if (isNaN(numPrice)) return "$0";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  // Extract data from question arrays
  const brandAnswers = getAllAnswers(listing?.brand || []);
  const statisticsAnswers = getAllAnswers(listing?.statistics || []);
  const managementAnswers = getAllAnswers(listing?.managementQuestion || []);
  const productAnswers = getAllAnswers(listing?.productQuestion || []);
  const handoverAnswers = getAllAnswers(listing?.handover || []);
  const advertisementAnswers = getAllAnswers(listing?.advertisement || []);
  const { data: socialAccountDefinitions = [] } = useAccounts();
  const { data: accountQuestionDefs = [] } = useAccountQuestions();
  const socialAccountsRaw = listing?.social_account;
  const socialByPlatform = useMemo(
    () =>
      aggregateSocialByPlatform(
        socialAccountsRaw || [],
        socialAccountDefinitions,
        accountQuestionDefs,
      ),
    [socialAccountsRaw, socialAccountDefinitions, accountQuestionDefs],
  );
  const instagramSocial = socialByPlatform.instagram;
  const twitterSocial = socialByPlatform.twitter;
  const tiktokSocial = socialByPlatform.tiktok;

  // Extract specific values
  const businessName = resolveListingTitle(listing);
  const businessDescription = getAnswerByQuestion(listing?.brand || [], ['description', 'about', 'business description']) ||
    advertisementAnswers['Description'] || advertisementAnswers['description'] ||
    'No description available';
  const location = getAnswerByQuestion(listing?.brand || [], ['country', 'location', 'address']) ||
    'USA';
  const adQuestions = listing?.advertisement || [];
  const askingPrice = getAnswerByQuestion(adQuestions, ['listing price', 'price']) ||
    getAnswerByQuestion(listing?.brand || [], ['asking price', 'price', 'selling price']) ||
    listing?.price ||
    '0';
  const businessAge =
    formatListingBusinessAge(
      getAnswerByQuestion(listing?.brand || [], ['starting date', 'start date', 'founded']),
    ) || NOT_AVAILABLE_LABEL;
  const website = getAnswerByQuestion(listing?.brand || [], ['website', 'url', 'domain']) || '';
  // The seller may or may not have typed a protocol; adding one blindly produced
  // links like "https://https://example.com".
  const websiteHref = /^https?:\/\//i.test(website) ? website : `https://${website}`;

  // Advertisement fields - extract dynamically from advertisement questions
  const introRaw = getAnswerByQuestion(listing?.advertisement || [], ['intro text', 'intro', 'Intro']) ||
    advertisementAnswers['Intro'] ||
    advertisementAnswers['intro'] ||
    null;
  const intro = introRaw && introRaw.trim() ? introRaw.trim() : null;

  const uspRaw = getAnswerByQuestion(listing?.advertisement || [], ['usps', 'usp', 'USP', 'unique selling point']) ||
    advertisementAnswers['USP'] ||
    advertisementAnswers['usp'] ||
    null;
  const usp = uspRaw && uspRaw.trim() ? uspRaw.trim() : null;
  const adDescription = getAnswerByQuestion(listing?.advertisement || [], ['description', 'Description']) ||
    advertisementAnswers['Description'] ||
    advertisementAnswers['description'] ||
    businessDescription;

  // Extract category name
  const categoryName = listing?.category?.[0]?.name ||
    (Array.isArray(listing?.category) && listing?.category.length > 0
      ? listing?.category[0]?.name
      : listing?.category?.name) ||
    null;

  // Extract images (a photo answer may hold a JSON array of URLs, a legacy
  // comma-joined string, or a single URL — parseMediaUrls handles all of them).
  const photoRows = (listing?.advertisement || []).filter(
    (a: any) => a.answer_type === 'PHOTO' && a.answer,
  );
  /** Photos are held back until the agreement; the server sends blurred previews. */
  const imagesLocked = photoRows.some((a: any) => a.locked);
  const images: string[] = photoRows
    // A row the server replaced with prompt text carries no URL — never feed
    // that to an <img>, or the carousel renders a broken-image icon.
    .filter((a: any) => !isLockedValue(a.answer))
    .flatMap((a: any) => parseMediaUrls(a.answer));

  if (images.length === 0) {
    const photoRow = (listing?.advertisement || []).find((a: any) =>
      a.question?.toLowerCase().includes('photo') || a.answer_type === 'PHOTO'
    );
    const parsed = photoRow ? parseMediaUrls(photoRow.answer) : [];
    if (parsed.length > 0) images.push(...parsed);
    else if (listing?.image_url) images.push(listing.image_url);
  }

  // Statistics
  const conversionRate = getAnswerByQuestion(listing?.statistics || [], ['conversion rate', 'conversion']) || NOT_AVAILABLE_LABEL;
  const refundRate = getAnswerByQuestion(listing?.statistics || [], ['refund rate', 'refund']) || NOT_AVAILABLE_LABEL;
  const returningCustomers = getAnswerByQuestion(listing?.statistics || [], ['returning customer', 'returning', 'repeat']) || NOT_AVAILABLE_LABEL;
  const emailSubscribers = getAnswerByQuestion(listing?.statistics || [], ['email subscriber', 'subscriber', 'email']) || UNKNOWN_LABEL;

  // Customer Type is stored like the other percentage splits: [{ name, percent }].
  const customerTypeSegments = (() => {
    const raw = getAnswerByQuestion(listing?.statistics || [], ['customer type']);
    if (!raw) return [];
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row: any) => ({
          name: String(row?.name || '').trim(),
          percent: parseFloat(String(row?.percent ?? row?.percentage ?? '')) || 0,
        }))
        .filter((row) => row.name && row.percent > 0);
    } catch {
      return [];
    }
  })();
  const avgOrderValue = getAnswerByQuestion(listing?.statistics || [], ['average order', 'aov', 'order value']) || NOT_AVAILABLE_LABEL;
  const customerBase = getAnswerByQuestion(listing?.statistics || [], ['customer base', 'total customer', 'customers']) || NOT_AVAILABLE_LABEL;
  const pageViews = getAnswerByQuestion(listing?.statistics || [], ['page views', 'views', 'traffic']) || NOT_AVAILABLE_LABEL;

  // Financials
  const financials = listing?.financials || [];
  console.log('🔍 Full listing object:', listing);
  console.log('🔍 Listing financials field:', listing?.financials);
  const monthlyFinancials = financials.filter((f: any) => f.type === 'monthly');
  const yearlyFinancials = financials.filter((f: any) => f.type === 'yearly');

  // Headline figures are derived from the seller's financial grid: every actual
  // year counts equally and an unfinished year is projected to twelve months
  // first. Anything that cannot be derived stays null and reads "Unknown"
  // rather than falling back to an invented number.
  const financialMetrics = computeListingFinancialMetrics(
    (() => {
      const marker = financials.find(
        (f: any) => f.name === '__FINANCIAL_TABLE__' && f.revenue_amount,
      );
      if (!marker) return null;
      try {
        return JSON.parse(marker.revenue_amount);
      } catch {
        return null;
      }
    })(),
  );

  /**
   * Currency the seller picked in the Financials step, stored inside the
   * financial-table marker. It is the only per-listing currency the app keeps,
   * so money answers are labelled with it. Older listings fall back to USD.
   */
  const listingCurrencySymbol = getListingCurrencySymbol(listing);

  // Read defensively: the query is still in flight on first paint, and a cache
  // left over from an older build can hold a different shape entirely.
  const similarItems: any[] = Array.isArray((similarResult as any)?.items)
    ? (similarResult as any).items
    : [];
  const similarTier = (similarResult as any)?.tier ?? 'newest';

  /** The heading names what the carousel actually found, never over-promising. */
  const similarHeading =
    similarTier === 'similar'
      ? 'Similar Listings'
      : similarTier === 'category'
        ? `More in ${listing?.category?.[0]?.name || 'this category'}`
        : 'Recently Added';

  const askingPriceNum = parseFloat(String(askingPrice)) || 0;
  const annualRevenue = financialMetrics.annualRevenue;
  const annualProfit = financialMetrics.annualProfit;
  const avgMonthlyProfit = financialMetrics.monthlyProfit;

  const totalRevenue = annualRevenue ?? 0;
  const totalProfit = annualProfit ?? 0;

  const profitMarginDisplay =
    financialMetrics.profitMarginPercent !== null
      ? `${Math.round(financialMetrics.profitMarginPercent)}%`
      : NOT_AVAILABLE_LABEL;
  const monthlyProfitDisplay =
    avgMonthlyProfit !== null
      ? `${listingCurrencySymbol}${formatNumber(Math.round(avgMonthlyProfit))}/m`
      : NOT_AVAILABLE_LABEL;

  // A business that is not profitable has no meaningful profit multiple.
  const profitMultipleValue =
    askingPriceNum > 0 && annualProfit !== null && annualProfit > 0
      ? askingPriceNum / annualProfit
      : null;
  const revenueMultipleValue =
    askingPriceNum > 0 && annualRevenue !== null && annualRevenue > 0
      ? askingPriceNum / annualRevenue
      : null;

  const profitMultiple =
    profitMultipleValue !== null ? `${profitMultipleValue.toFixed(1)}x` : UNKNOWN_LABEL;
  const revenueMultiple =
    revenueMultipleValue !== null
      ? `${revenueMultipleValue.toFixed(1)}x Revenue`
      : UNKNOWN_LABEL;
  const profitMultipleLabel =
    profitMultipleValue !== null
      ? `Multiple ${profitMultipleValue.toFixed(1)}x Profit`
      : UNKNOWN_LABEL;

  const unreadMessagesCount = listing?.unread_messages_count ?? 0;
  const requestsCount = listing?.requests_count ?? 0;
  const createdAtDate = listing?.created_at || listing?.createdAt || listing?.createdAtDate;
  const createdAtLabel = createdAtDate
    ? formatDistanceToNow(new Date(createdAtDate), { addSuffix: true })
    : '-';
  const adminIntroRaw = intro || adDescription || businessDescription || '';
  const adminIntro = adminIntroRaw.length > 140 ? `${adminIntroRaw.slice(0, 140)}...` : adminIntroRaw;

  /**
   * The server cut the description short because nobody is signed in, so the
   * local "Read More" toggle has nothing left to reveal — offer registering
   * instead.
   */
  const descriptionIsCapped = listing?.viewerLevel === 'PUBLIC';
  const unlockRedirect = listing?.lockAction?.redirectTo || '/register';
  const unlockCtaText = listing?.lockAction?.ctaText || 'register to unlock 🔓';

  /**
   * Two different locks reach this handler. A logged-out visitor needs an
   * account, so send them to register. A signed-in buyer only needs to accept
   * this listing's agreement, which happens in a dialog — navigating them away
   * would be the wrong answer to what they clicked.
   */
  /**
   * Reporting is offered to everyone except the seller themselves, but the
   * report needs an account behind it — an anonymous endpoint would just be a
   * spam button. A logged-out visitor sees the card and is sent to sign in.
   */
  const isOwnListing = Boolean(
    user && (listing?.userId === user.id || listing?.user_id === user.id),
  );

  const handleReportClick = () => {
    if (!user) {
      toast.error("Please log in to report a listing");
      navigate("/login");
      return;
    }
    setReportOpen(true);
  };

  const handleUpgradeUnlockClick = () => {
    if (listing?.lockAction?.lockType === 'CONFIDENTIAL_AGREEMENT') {
      setAgreementOpen(true);
      return;
    }
    navigate(unlockRedirect);
  };

  const handleLockClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Only the "…to unlock" label itself should navigate. Containers report the
    // text of everything inside them, so without this check a click on the empty
    // margins beside the page counted as a click on the label and sent
    // logged-out visitors to the register page.
    if (target.children.length > 0) return;

    const text = (target.textContent || '').toLowerCase();
    if (!text.includes('to unlock')) return;

    event.preventDefault();
    event.stopPropagation();
    handleUpgradeUnlockClick();
  };

  // Management
  const freelancers = getAnswerByQuestion(listing?.managementQuestion || [], ['freelancer', 'freelance']) || NOT_AVAILABLE_LABEL;
  const employees = getAnswerByQuestion(listing?.managementQuestion || [], ['employee', 'staff', 'team member']) || NOT_AVAILABLE_LABEL;
  const ceoTime = getAnswerByQuestion(listing?.managementQuestion || [], ['ceo time', 'owner time', 'hours per week']) || NOT_AVAILABLE_LABEL;

  // Products
  const numProducts = getAnswerByQuestion(listing?.productQuestion || [], ['number of product', 'product count', 'products']) || NOT_AVAILABLE_LABEL;
  const sellingModel = getAnswerByQuestion(listing?.productQuestion || [], ['selling model', 'model', 'dropshipping']) || NOT_AVAILABLE_LABEL;
  const hasInventory = getAnswerByQuestion(listing?.productQuestion || [], ['inventory', 'stock', 'has inventory']) || NOT_AVAILABLE_LABEL;
  const inventoryValue = getAnswerByQuestion(listing?.productQuestion || [], ['inventory value', 'stock value', 'how much']) || NOT_AVAILABLE_LABEL;
  const inventoryIncluded = getAnswerByQuestion(listing?.productQuestion || [], ['included in price', 'inventory included']) || NOT_AVAILABLE_LABEL;

  // Handover
  const handoverItems = listing?.handover || [];
  const assetsIncluded = getHandoverAssets(handoverItems);
  // The buyer only cares about what is included, so unselected assets are not listed.
  const includedAssets = assetsIncluded.filter((asset) => asset.included);
  const postSalesSupport =
    getAnswerByQuestion(listing?.handover || [], [
      "post sale",
      "post purchase",
      "support",
    ]) || NOT_AVAILABLE_LABEL;
  const supportDuration =
    getAnswerByQuestion(listing?.handover || [], [
      "support duration",
      "support period",
      "months",
    ]) || NOT_AVAILABLE_LABEL;

  // Attachments
  /** Social links are held back until the agreement, like attachments. */
  const hasLockedSocial = (listing?.social_account || []).some(
    (s: any) => s?.locked || isLockedValue(s?.answer),
  );
  const hasLockedAttachments = (listing?.advertisement || []).some(
    (a: any) => a.answer_type === 'FILE' && isLockedValue(a.answer),
  );
  const attachments = (listing?.advertisement || [])
    .filter((a: any) => a.answer_type === 'FILE' && a.answer && !isLockedValue(a.answer))
    .flatMap((a: any) => parseMediaUrls(a.answer))
    .map((url: string) => ({
      // Cloudinary percent-encodes spaces and the like in the stored name.
      fileName: decodeURIComponent(url.split('/').pop() || '') || 'Document',
      url,
    }));

  // Extract Financial Table Data
  // Look for the special marker record that contains table data as JSON
  let financialTableData: any = null;

  console.log('🔍 Financials data:', financials);
  console.log('🔍 Looking for __FINANCIAL_TABLE__ marker');

  const tableFinancial = financials.find((f: any) =>
    f.name === '__FINANCIAL_TABLE__' && f.revenue_amount
  );

  console.log('🔍 Found tableFinancial:', tableFinancial);

  if (tableFinancial && tableFinancial.revenue_amount) {
    try {
      // Parse JSON data stored in revenue_amount field
      console.log('🔍 Parsing revenue_amount:', tableFinancial.revenue_amount);
      financialTableData = JSON.parse(tableFinancial.revenue_amount);
      // Normalize legacy "Gross Revenue" -> "Revenue" so labels & calculations match.
      if (financialTableData?.rowLabels && Array.isArray(financialTableData.rowLabels)) {
        financialTableData.rowLabels = financialTableData.rowLabels.map((r: string) =>
          r === 'Gross Revenue' ? 'Revenue' : r,
        );
      }
      if (financialTableData?.financialData && typeof financialTableData.financialData === 'object') {
        const fd = financialTableData.financialData;
        if (fd['Gross Revenue'] && !fd['Revenue']) {
          fd['Revenue'] = fd['Gross Revenue'];
          delete fd['Gross Revenue'];
        }
      }
      console.log('✅ Parsed financialTableData:', financialTableData);
    } catch (e) {
      console.error('❌ Error parsing financial table data:', e);
      console.error('❌ Revenue amount value:', tableFinancial.revenue_amount);
    }
  } else {
    console.warn('⚠️ No table financial data found. Available financials:', financials.map((f: any) => ({ name: f.name, type: f.type })));
  }

  // Helper to format numbers for display
  const OVERALL_COSTS_ROW = 'Overall Costs';

  // Calculate Net Profit for a column (matches FinancialsStep.tsx)
  const calculateNetProfitForColumn = (colKey: string, tableData: any): number => {
    if (!tableData || !tableData.financialData) return 0;
    const fd = tableData.financialData;
    const isSimple = tableData.financialType === 'simple';

    if (isSimple) {
      const gross = parseFloat(fd['Revenue']?.[colKey] || '0');
      const costs = parseFloat(fd[OVERALL_COSTS_ROW]?.[colKey] || '0');
      return gross - costs;
    }

    const labels: string[] = Array.isArray(tableData.rowLabels) ? tableData.rowLabels : [];
    let total = 0;
    labels.forEach((rowLabel: string) => {
      if (rowLabel === OVERALL_COSTS_ROW) return;
      const value = parseFloat(fd[rowLabel]?.[colKey] || '0');
      if (rowLabel.toLowerCase().includes('revenue')) {
        total += value;
      } else {
        total -= value;
      }
    });
    return total;
  };

  // Default values if no table data
  const defaultRowLabels = [
    'Revenue',
    'Net Revenue',
    'Cost of Goods',
    'Advertising costs',
    'Freelancer/Employees',
    'Transaction Costs',
    'Other Expenses',
  ];
  const defaultColumnLabels = [
    { key: '2023', label: '2023' },
    { key: '2024', label: '2024' },
    { key: 'today', label: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) },
  ];

  const rowLabels = (financialTableData?.rowLabels || defaultRowLabels).map((r: string) =>
    r === 'Gross Revenue' ? 'Revenue' : r,
  );
  const columnLabels = financialTableData?.columnLabels || defaultColumnLabels;
  const financialData = (() => {
    const fd = financialTableData?.financialData || {};
    if (fd['Gross Revenue'] && !fd['Revenue']) {
      return { ...fd, Revenue: fd['Gross Revenue'] };
    }
    return fd;
  })();
  const profitLossDisplayMode =
    financialTableData?.financialType === 'simple' ? 'simple' : 'detailed';
  const profitLossVisibleRows =
    profitLossDisplayMode === 'simple'
      ? rowLabels.filter(
        (row: string) => row === 'Revenue' || row === OVERALL_COSTS_ROW,
      )
      : rowLabels.filter((row: string) => row !== OVERALL_COSTS_ROW);
  const columnWidth = 200; // Reduced from 280 to fit table within container (first column remains 325px with +45px)

  const statisticsQuestions = listing?.statistics || [];
  const findStatisticEntry = (terms: string[]) =>
    statisticsQuestions.find((item: any) =>
      terms.some((term) => String(item?.question || "").toLowerCase().includes(term)),
    );

  const salesChannelsEntry = findStatisticEntry(["sales channels", "sales channel"]);
  const advertisingChannelsEntry = findStatisticEntry(["advertising channels", "advertising channel", "adverstising channel"]);
  const salesCountrySplitEntry = findStatisticEntry(["sales countries", "sales country split", "country split"]);

  const salesChannelsSplitList = parseSplitAnswer(salesChannelsEntry?.answer);
  const advertisingChannelsSplitList = parseSplitAnswer(advertisingChannelsEntry?.answer);
  const salesCountrySplitList = parseSplitAnswer(salesCountrySplitEntry?.answer);
  const salesChannelsList = parseMultiValueAnswer(salesChannelsEntry?.answer);
  const advertisingChannelsList = parseMultiValueAnswer(advertisingChannelsEntry?.answer);

  const colorPalette = [
    "rgba(198, 255, 28, 1)",
    "rgba(19, 100, 255, 1)",
    "rgba(255, 182, 39, 1)",
    "rgba(255, 92, 135, 1)",
    "rgba(92, 214, 255, 1)",
    "rgba(143, 102, 255, 1)",
  ];
  const toDonutDataFromSplit = (items: Array<{ name: string; value: number }>) => {
    if (items.length === 0) return [];
    return items.map((item, index) => ({
      name: item.name,
      value: item.value,
      color: colorPalette[index % colorPalette.length],
    }));
  };
  const salesChannelsData = toDonutDataFromSplit(salesChannelsSplitList);
  const advertisingChannelsData = toDonutDataFromSplit(advertisingChannelsSplitList);
  const salesCountrySplitData = salesCountrySplitList.map((item, index) => ({
    name: item.name,
    value: item.value,
    color: colorPalette[index % colorPalette.length],
  }));
  const toTextSummary = (splitItems: Array<{ name: string; value: number }>, fallbackItems: string[]) => {
    if (splitItems.length > 0) {
      return splitItems.map((item) => `${item.name} ${item.value}%`).join(", ");
    }
    if (fallbackItems.length > 0) {
      return fallbackItems.join(", ");
    }
    return "Not specified";
  };
  const salesChannelsSummary = toTextSummary(salesChannelsSplitList, salesChannelsList);
  const advertisingChannelsSummary = toTextSummary(advertisingChannelsSplitList, advertisingChannelsList);
  const chartDataByTab: Record<string, Array<{ name: string; value: number; color: string }>> = {
    "sales-channels": salesChannelsData,
    "country-split": salesCountrySplitData,
    advertising: advertisingChannelsData,
  };
  const activeChartData = chartDataByTab[selectedChartTab] || [];
  const activeChartHasData = activeChartData.length > 0;
  /** The chart's numbers live in statistics, so they lock with that section. */
  const chartsLocked = [salesChannelsEntry, advertisingChannelsEntry, salesCountrySplitEntry].some(
    (entry: any) => entry?.locked || isLockedValue(entry?.answer),
  );

  useEffect(() => {
    if (!listing?.id) return;
    console.log("ListingDetail channel data debug", {
      listingId: listing.id,
      statisticsRaw: statisticsQuestions,
      salesChannelsEntry,
      salesCountrySplitEntry,
      advertisingChannelsEntry,
      salesChannelsSplitList,
      salesCountrySplitList,
      advertisingChannelsSplitList,
      salesChannelsSummary,
      advertisingChannelsSummary,
    });
  }, [
    listing?.id,
    statisticsQuestions,
    salesChannelsEntry,
    salesCountrySplitEntry,
    advertisingChannelsEntry,
    salesChannelsSplitList,
    salesCountrySplitList,
    advertisingChannelsSplitList,
    salesChannelsSummary,
    advertisingChannelsSummary,
  ]);

  // Keep this static data for now (outside requested scope)
  const revenueExpensesData = [
    { month: 'Jan 24', revenue: 18000, profit: 5400 },
    { month: 'Feb 24', revenue: 19000, profit: 5700 },
    { month: 'Mar 24', revenue: 20000, profit: 6000 },
    { month: 'Apr 24', revenue: 21000, profit: 6300 },
    { month: 'May 24', revenue: 20500, profit: 6150 },
    { month: 'Jun 24', revenue: 22000, profit: 6600 },
    { month: 'Jul 24', revenue: 21500, profit: 6450 },
    { month: 'Aug 24', revenue: 22500, profit: 6750 },
    { month: 'Sep 24', revenue: 21000, profit: 6300 },
    { month: 'Oct 24', revenue: 23000, profit: 6900 },
    { month: 'Nov 24', revenue: 22000, profit: 6600 },
    { month: 'Dec 24', revenue: 24000, profit: 7200 },
  ];

  // Check if listing is favorited
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!user || !id) return;

      try {
        const response = await apiClient.getFavorites();
        if (response.success && response.data) {
          const favorites = Array.isArray(response.data) ? response.data : [];
          const isFavorited = favorites.some((fav: any) =>
            fav.listingId === id || fav.listing?.id === id || fav.id === id
          );
          setIsFavorite(isFavorited);
        }
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    if (isAuthenticated && user) {
      checkFavoriteStatus();
    }
  }, [user, id, isAuthenticated]);

  const handleFavorite = async () => {
    if (!isAuthenticated || !user) {
      toast.error("Please log in to add favorites");
      navigate("/login");
      return;
    }

    if (!id) {
      toast.error("Listing ID not available");
      return;
    }

    setIsTogglingFavorite(true);
    try {
      if (isFavorite) {
        const response = await apiClient.removeFavorite(id);
        if (response.success) {
          setIsFavorite(false);
          toast.success("Removed from favorites");
          queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
        } else {
          throw new Error(response.error || "Failed to remove favorite");
        }
      } else {
        const response = await apiClient.addFavorite(id);
        if (response.success) {
          setIsFavorite(true);
          toast.success("Added to favorites");
          queryClient.invalidateQueries({ queryKey: ["user-favorites"] });
        } else {
          throw new Error(response.error || "Failed to add favorite");
        }
      }
    } catch (error: any) {
      console.error("Error toggling favorite:", error);
      toast.error(error.message || "Failed to update favorite");
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const shareUrl = `${window.location.origin}/listing/${id}`;

  const handleShare = () => {
    setShareOpen(true);
  };

  /**
   * A buyer must accept the confidentiality agreement before contacting the
   * seller. Once accepted the chat opens straight away, unless the seller
   * reviews buyers manually — then it waits for their approval.
   */
  const handleAcceptAgreement = async () => {
    if (!listing?.id) return;
    setIsAcceptingAgreement(true);
    try {
      const response = await apiClient.acceptConfidentialityAgreement(listing.id);
      if (!response.success) {
        toast.error(response.error || "Could not accept the agreement");
        return;
      }

      const result = response.data as { granted?: boolean; pendingApproval?: boolean } | undefined;
      setAgreementOpen(false);

      if (result?.pendingApproval) {
        setHasConfidentialAccess(false);
        toast.success("Request sent. The seller will review it before granting access.");
        return;
      }

      setHasConfidentialAccess(true);
      toast.success("Agreement accepted");
      void startChat();
    } catch (error) {
      console.error("Agreement error:", error);
      toast.error("Could not accept the agreement");
    } finally {
      setIsAcceptingAgreement(false);
    }
  };

  const handleContactSeller = async () => {
    if (!user) {
      toast.error("Please log in to contact the seller");
      navigate("/login");
      return;
    }

    if (!listing?.userId && !listing?.user_id) {
      toast.error("Seller information not available");
      return;
    }

    // Every listing requires the agreement first.
    if (!hasConfidentialAccess) {
      setAgreementOpen(true);
      return;
    }

    await startChat();
  };

  const startChat = async () => {
    if (!user) return;
    if (!listing?.userId && !listing?.user_id) return;

    if (!listing?.id) {
      toast.error("Listing information not available");
      return;
    }

    setIsStartingChat(true);
    try {
      const sellerId = listing.userId || listing.user_id;
      const listingId = listing.id;

      let chatResponse: any = await apiClient.getChatRoom(user.id, sellerId);
      let chatId: string;

      const chatData = chatResponse.data?.data || chatResponse.data;

      if (chatResponse.success && chatData && chatData.id) {
        chatId = chatData.id;
      } else {
        const createResponse: any = await apiClient.createChatRoom(user.id, sellerId, listingId);
        const createData = createResponse.data?.data || createResponse.data;

        if (!createResponse.success || !createData?.id) {
          chatResponse = await apiClient.getChatRoom(user.id, sellerId);
          const retryChatData = (chatResponse as any).data?.data || (chatResponse as any).data;

          if (chatResponse.success && retryChatData && retryChatData.id) {
            chatId = retryChatData.id;
          } else {
            throw new Error(createResponse.error || "Failed to create chat room");
          }
        } else {
          chatId = createData.id;
        }
      }

      navigate(`/chat?chatId=${chatId}&userId=${user.id}&sellerId=${sellerId}`);
      toast.success("Opening chat...");
    } catch (error: any) {
      console.error("Error starting chat:", error);
      toast.error(error.message || "Failed to start chat. Please try again.");
    } finally {
      setIsStartingChat(false);
    }
  };

  if (isLoading) {
    return embedded ? (
      <div className="bg-background">
        <div className="flex items-center justify-center min-h-[60vh] pt-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading listing...</p>
          </div>
        </div>
      </div>
    ) : (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh] pt-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading listing...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !listing) {
    return embedded ? (
      <div className="bg-background">
        <div className="flex items-center justify-center min-h-[60vh] pt-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
            <p className="text-muted-foreground mb-6">The listing you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate(-1)} className="rounded-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    ) : (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh] pt-24">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
            <p className="text-muted-foreground mb-6">The listing you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate("/")} className="rounded-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const isAdminView = adminLayout || embedded || routeLocation.pathname.startsWith('/admin/listings/');
  /** Staff reviewing a listing have their own tools, so no report card there. */
  const canReportListing = Boolean(listing?.id) && !isAdminView && !isOwnListing;
  /**
   * Shown to every visitor except the seller on their own listing, where there
   * is no buyer to rate. A logged-out visitor reads "Not Verified", which is
   * true of them and points at what verifying would change — hiding it instead
   * would keep the chart from most of the people who visit.
   */
  const showAcquisitionCapacity = !isAdminView && !isOwnListing;

  const parsedAskingPrice = Number.parseFloat(String(askingPrice));
  const fallbackPrice = listing?.price || listing?.asking_price || listing?.askingPrice || listing?.price_amount;
  const resolvedPrice = !Number.isNaN(parsedAskingPrice) && parsedAskingPrice > 0
    ? parsedAskingPrice
    : Number.parseFloat(String(fallbackPrice || 0)) || 0;

  const ownerProfile: any = listing?.user || listing?.profile || {};
  const ownerName = ownerProfile.full_name
    || [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(" ")
    || "Unknown User";
  const ownerAvatar = ownerProfile.avatar_url || ownerProfile.profile_pic || null;
  /** The server withheld the seller's identity; show the design's blurred field. */
  const sellerIsLocked = Boolean(ownerProfile.locked) || isLockedValue(ownerName);
  const ownerUserType = (ownerProfile.user_type || ownerProfile.role || '').toLowerCase();
  const ownerIsPro = ownerUserType === 'seller';
  const ownerIdVerified = Boolean(ownerProfile.id_verified);

  const content = (
    <div
      className={`${isAdminView ? 'pt-6' : 'pt-24'} ${isMobile ? 'pb-12' : 'pb-20'}`}
      onClickCapture={handleLockClickCapture}
    >
      <div className={`container mx-auto ${isMobile ? 'px-4' : 'px-4'} max-w-7xl`}>
        {!isAdminView && (
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-6"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: getFontSize('14px', '16px', '20px'),
              lineHeight: '150%',
              letterSpacing: '0%',
              textTransform: 'capitalize',
              color: 'rgba(0, 0, 0, 1)',
              background: 'transparent',
              padding: 0
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        )}

        {isAdminView ? (
          <div className="flex flex-col gap-6 mb-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <img src={InfoIcon} alt="" style={{ width: '14px', height: '14px' }} />
                  <span style={{
                    fontFamily: 'ABeeZee',
                    fontWeight: 400,
                    fontStyle: 'normal',
                    fontSize: '12px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: '#808080',
                  }}>
                    unanswered messages
                  </span>
                  <span style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '12px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}>
                    {unreadMessagesCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={RequestIcon} alt="" style={{ width: '14px', height: '14px' }} />
                  <span style={{
                    fontFamily: 'ABeeZee',
                    fontWeight: 400,
                    fontStyle: 'normal',
                    fontSize: '12px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: '#808080',
                  }}>
                    Request
                  </span>
                  <span style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '12px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}>
                    {requestsCount}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <img src={DateIcon} alt="" style={{ width: '14px', height: '14px' }} />
                  <span style={{
                    fontFamily: 'ABeeZee',
                    fontWeight: 400,
                    fontStyle: 'normal',
                    fontSize: '12px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: '#808080',
                  }}>
                    Created at Date
                  </span>
                  <span style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '12px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}>
                    {createdAtLabel}
                  </span>
                </div>
              </div>

              <h2 style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: '24.07px',
                lineHeight: '120%',
                letterSpacing: '0%',
                color: LISTING_TITLE_COLOR,
              }}>
                {businessName}
              </h2>

              <p style={{
                fontFamily: 'ABeeZee',
                fontWeight: 400,
                fontStyle: 'normal',
                fontSize: '12.04px',
                lineHeight: '150%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 0.5)',
              }}>
                {adminIntro}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '38.11px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)',
                }}>
                  {formatPrice(resolvedPrice)}
                </span>

                <div style={{
                  height: '25.08px',
                  borderRadius: '60.18px',
                  borderWidth: '1px',
                  paddingTop: '5.02px',
                  paddingRight: '12.04px',
                  paddingBottom: '5.02px',
                  paddingLeft: '12.04px',
                  background: 'rgba(255, 255, 255, 1)',
                  border: '1px solid rgba(0, 0, 0, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10.03px',
                }}>
                  <span style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '10px',
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                    paddingRight: '12px',
                    borderRight: '1px solid rgba(0, 0, 0, 0.1)',
                  }}>
                    {profitMultipleLabel}
                  </span>
                  <span style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '10px',
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}>
                    {revenueMultiple}
                  </span>
                </div>

                <span style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '16.05px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 0.7)',
                }}>
                  Pay in {listingCurrencySymbol}{formatNumber(Math.round(resolvedPrice / financingInstalments(resolvedPrice)))} monthly
                </span>

                <div style={{
                  width: '7.02px',
                  height: '7.02px',
                  borderRadius: '50%',
                  background: 'rgba(217, 217, 217, 1)',
                  flexShrink: 0,
                }} />

                <span style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '16.05px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 0.7)',
                }}>
                  {financingInstalments(parseFloat(askingPrice.toString()) || 0)} installments
                </span>
              </div>

              <a
                href="#"
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '16.05px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  textDecoration: 'underline',
                  textDecorationStyle: 'solid',
                  textUnderlineOffset: '0%',
                  textDecorationThickness: 'auto',
                  textDecorationSkipInk: 'auto',
                  color: 'rgba(0, 103, 255, 1)',
                  display: 'inline-block',
                }}
              >
                Financing
              </a>

              <div
                style={{
                  width: '100%',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                }}
              />

              {ownerProfile && (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar
                      className="h-14 w-14"
                      // Blurred rather than an initial — an initial would give
                      // away the first letter of a name we are hiding.
                      style={sellerIsLocked ? { filter: 'blur(6px)' } : undefined}
                    >
                      <AvatarImage src={ownerAvatar || undefined} />
                      <AvatarFallback
                        style={{
                          background: sellerIsLocked ? 'rgba(0,0,0,0.25)' : '#AEF31F',
                          color: 'rgba(0, 0, 0, 1)',
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '18px',
                        }}
                      >
                        {sellerIsLocked ? '' : (ownerName?.charAt(0) || 'U').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {ownerIsPro && (
                      <div
                        style={{
                          position: 'absolute',
                          left: '-6px',
                          bottom: '-6px',
                          padding: '3px 8px',
                          borderRadius: '40px',
                          background: '#C6FE1F',
                          fontFamily: 'Lufga',
                          fontWeight: 600,
                          fontSize: '12px',
                          lineHeight: '100%',
                          color: '#000000',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        Pro
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 600,
                        fontStyle: 'normal',
                        fontSize: '20px',
                        lineHeight: '120%',
                        letterSpacing: '0%',
                        color: 'rgba(0, 0, 0, 1)',
                      }}
                    >
                      {sellerIsLocked ? <LockedBlur chars={16} /> : ownerName}
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={FaceScanSquareIcon}
                        alt="ID Verified"
                        style={{ width: '24px', height: '24px' }}
                      />
                      <span
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          fontSize: '20.06px',
                          lineHeight: '120%',
                          letterSpacing: '0%',
                          color: 'rgba(125, 125, 125, 1)',
                        }}
                      >
                        ID Verified
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <MediaCarousel
                images={images}
                isFavorite={isFavorite}
                isTogglingFavorite={isTogglingFavorite}
                onFavorite={handleFavorite}
                onShare={handleShare}
                managedByEx={listing?.managed_by_ex === true || listing?.managed_by_ex === 1 || listing?.managed_by_ex === "true" || listing?.managed_by_ex === "1"}
                locked={imagesLocked}
                lockCtaText={unlockCtaText}
                onUnlockClick={handleUpgradeUnlockClick}
                categoryName={categoryName}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <MediaCarousel
                images={images}
                isFavorite={isFavorite}
                isTogglingFavorite={isTogglingFavorite}
                onFavorite={handleFavorite}
                onShare={handleShare}
                managedByEx={listing?.managed_by_ex === true || listing?.managed_by_ex === 1 || listing?.managed_by_ex === "true" || listing?.managed_by_ex === "1"}
                locked={imagesLocked}
                lockCtaText={unlockCtaText}
                onUnlockClick={handleUpgradeUnlockClick}
                categoryName={categoryName}
              />
            </div>

            <div className="lg:col-span-1">
              <SummaryCard
                listing={listing}
                onContactSeller={handleContactSeller}
                isStartingChat={isStartingChat}
                showReport={canReportListing}
                onReport={handleReportClick}
                showCapacity={showAcquisitionCapacity}
                verifiedFunds={myVerifiedFunds}
                listingPriceNumber={askingPriceNum}
              />
            </div>
          </div>
        )}

        {/* Description Section */}
        <div className="mb-6">
          {/* Title */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('20px', '26px', '32px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: LISTING_TITLE_COLOR,
              marginBottom: '12px',
            }}
          >
            {businessName}
          </h2>

          {/* Link with Icon */}
          <div className="flex items-center gap-2 mb-6">
            <img
              src={LinkIcon}
              alt="Link"
              style={{
                width: isMobile ? '24px' : '32px',
                height: isMobile ? '24px' : '32px',
              }}
            />
            {isLockedValue(website) ? (
              // Blurred, as in the design — the big call to action lives on the
              // listing image, so this field does not repeat it.
              <LockedBlur chars={22} fontSize={getFontSize('14px', '20px', '28px')} />
            ) : (
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: getFontSize('14px', '20px', '28px'),
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)',
                  textDecoration: 'none',
                  wordBreak: 'break-all',
                }}
              >
                {website}
              </a>
            )}
          </div>

          {/* Content Sections */}
          <div>
            {/* Intro */}
            {intro && (
              <div style={{ marginBottom: '18px' }}>
                <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} gap-2`}>
                  <span
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 600,
                      fontStyle: 'normal',
                      fontSize: getFontSize('14px', '16px', '20px'),
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 0.5)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Intro:
                  </span>
                  <p
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 400,
                      fontStyle: 'normal',
                      fontSize: getFontSize('14px', '16px', '20px'),
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 0.5)',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {intro}
                  </p>
                </div>
              </div>
            )}

            {/* USPs */}
            {usp && (
              <div style={{ marginBottom: '18px' }}>
                <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} gap-2`}>
                  <span
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 600,
                      fontStyle: 'normal',
                      fontSize: getFontSize('14px', '16px', '20px'),
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 0.5)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    USPs:
                  </span>
                  <p
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 400,
                      fontStyle: 'normal',
                      fontSize: getFontSize('14px', '16px', '20px'),
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 0.5)',
                      margin: 0,
                      // Keep the seller's line breaks instead of running the
                      // text together into one block.
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {usp}
                  </p>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} gap-2`}>
                <span
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 600,
                    fontStyle: 'normal',
                    fontSize: getFontSize('14px', '16px', '20px'),
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 0.5)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Description:
                </span>
                <div
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 400,
                    fontStyle: 'normal',
                    fontSize: getFontSize('14px', '16px', '20px'),
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 0.5)',
                    whiteSpace: 'pre-wrap',
                    // A logged-out visitor gets three lines. The server already
                    // capped the text; clamping makes the cut land on a line
                    // boundary whatever the screen width.
                    ...(descriptionIsCapped
                      ? {
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical' as const,
                          overflow: 'hidden',
                        }
                      : {}),
                  }}
                >
                  {descriptionIsCapped
                    ? adDescription
                    : readMore
                      ? adDescription
                      : `${adDescription.substring(0, isMobile ? 200 : 300)}...`}
                </div>
              </div>
              {descriptionIsCapped ? (
                <button
                  onClick={() => navigate('/register')}
                  style={{
                    height: isMobile ? '40px' : '46px',
                    borderRadius: '60px',
                    padding: '8px 16px',
                    background: 'rgba(198, 254, 31, 1)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '10px',
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontSize: getFontSize('14px', '16px', '18px'),
                    color: 'rgba(0, 0, 0, 1)',
                  }}
                >
                  <Lock style={{ width: '16px', height: '16px' }} />
                  Register To Read More
                </button>
              ) : adDescription.length > (isMobile ? 200 : 300) && (
                <button
                  onClick={() => setReadMore(!readMore)}
                  style={{
                    width: isMobile ? '140px' : '157px',
                    height: isMobile ? '40px' : '46px',
                    borderRadius: '60px',
                    paddingTop: '8px',
                    paddingBottom: '8px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    gap: '10px',
                    background: 'rgba(198, 254, 31, 1)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '10px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 500,
                      fontStyle: 'normal',
                      fontSize: getFontSize('14px', '16px', '20px'),
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      textTransform: 'capitalize',
                      color: 'rgba(0, 0, 0, 1)',
                    }}
                  >
                    {readMore ? 'Read Less' : 'Read More'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* General Metrics Grid (6 cards) */}
        <div
          style={{
            width: '100%',
            maxWidth: '1209.44px',
            minHeight: isMobile ? 'auto' : '382px',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: '#FAFAFA',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Heading */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('18px', '24px', '28px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#000000',
              marginBottom: '10px',
            }}
          >
            General
          </h2>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ width: '100%', gap: '20px' }}>
            <MetricCard
              label="Location"
              value={location}
              flagCountry={location}
              image={MapImage}
            />
            <MetricCard
              label="Business Age"
              value={businessAge}
              info="How long the business has been running, based on its starting date."
            />
            <MetricCard
              label="Monthly Profit"
              value={monthlyProfitDisplay}
              info="Average annual profit divided by twelve."
            />
            {/* <MetricCard
              label="Profit Margin"
              value={profitMarginDisplay}
              info="Annual profit as a percentage of annual revenue."
            />
            <MetricCard
              label="Page Views"
              value={pageViews}
            /> */}
          </div>

          {/* Averages + Multiples */}
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ width: '100%', gap: '20px', marginTop: '20px' }}>
            <SectionBox title="Averages">
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
                <AverageCell label="⌀ Annual Revenue" value={annualRevenue} note="Average generated per year" />
                <AverageCell label="⌀ Monthly Revenue" value={financialMetrics.monthlyRevenue} note="Average generated per month" />
                <AverageCell label="⌀ Annual Profit" value={annualProfit} note="Average generated per year" />
                <AverageCell label="⌀ Monthly Profit" value={avgMonthlyProfit} note="Average generated per month" />
              </div>
            </SectionBox>

            <SectionBox title="Multiples">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <MultipleRow label="Revenue Multiple" value={revenueMultipleValue} kind="revenue" />
                <MultipleRow label="Profit Multiple" value={profitMultipleValue} kind="profit" />
              </div>
            </SectionBox>
          </div>
        </div>

        {/* Profit & Loss Table Section */}
        <div
          style={{
            width: '100%',
            maxWidth: '1209px',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: '#FAFAFA',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Profit & Loss Header */}
          <div
            style={{
              width: '100%',
              height: isMobile ? '60px' : '108.62px',
              backgroundColor: '#000000',
              borderRadius: isMobile ? '12px' : '16.57px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0',
            }}
          >
            <h3
              style={{
                fontFamily: 'Lufga',
                fontWeight: 600,
                fontStyle: 'normal',
                fontSize: getFontSize('20px', '32px', '41.18px'),
                lineHeight: '100%',
                letterSpacing: '0%',
                color: 'rgba(255, 255, 255, 1)',
                textAlign: 'center',
              }}
            >
              Profit & Loss
            </h3>
          </div>

          {/* Table Container */}
          <div style={{ width: '100%', marginTop: '0', overflowX: isMobile ? 'auto' : 'visible' }}>
            <div style={{ width: isMobile ? 'max-content' : '100%', minWidth: isMobile ? `${(isMobile ? 120 : columnWidth + 45) + (columnLabels.length * (isMobile ? 120 : columnWidth))}px` : '100%' }}>
              {/* Header Row */}
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: isMobile ? '50px' : '76.03px',
                  backgroundColor: '#C6FE1F',
                }}
              >
                <div
                  style={{
                    width: `${isMobile ? 120 : columnWidth + 45}px`,
                    minWidth: `${isMobile ? 120 : columnWidth + 45}px`,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: isMobile ? '0 8px' : '0 16px',
                    border: `${isMobile ? '1.5px' : '2.66px'} solid rgba(255, 255, 255, 1)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 700,
                      fontStyle: 'normal',
                      fontSize: getFontSize('12px', '20px', '27.46px'),
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 1)',
                    }}
                  >
                    Timeframe
                  </span>
                </div>
                {columnLabels.map((col) => (
                  <div
                    key={col.key}
                    style={{
                      // Share the row evenly on desktop so no empty strip is left
                      // to the right of the last column.
                      flex: isMobile ? '0 0 auto' : '1 1 0',
                      width: isMobile ? '120px' : 'auto',
                      minWidth: isMobile ? '120px' : 0,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `${isMobile ? '1.5px' : '2.66px'} solid rgba(255, 255, 255, 1)`,
                      padding: isMobile ? '0 4px' : '0',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontStyle: 'normal',
                        fontSize: getFontSize('12px', '20px', '27.46px'),
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: 'rgba(0, 0, 0, 1)',
                        textAlign: 'center',
                      }}
                    >
                      {col.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Data Rows (simple vs detailed matches FinancialsStep) */}
              {profitLossVisibleRows.map((row: string) => {
                const isGrossRevenue = row === 'Revenue';
                const bgColor = isGrossRevenue ? 'rgba(66, 66, 66, 1)' : '#F3F8E8';
                const textColor = isGrossRevenue ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';

                return (
                  <div
                    key={row}
                    style={{
                      display: 'flex',
                      width: '100%',
                      height: isMobile ? '60px' : '91.12px',
                      backgroundColor: bgColor,
                    }}
                  >
                    <div
                      style={{
                        width: `${isMobile ? 120 : columnWidth + 45}px`,
                        minWidth: `${isMobile ? 120 : columnWidth + 45}px`,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        padding: isMobile ? '0 8px' : '0 16px',
                        border: `${isMobile ? '1.5px' : '2.66px'} solid rgba(255, 255, 255, 1)`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          fontSize: getFontSize('10px', '16px', '20.59px'),
                          lineHeight: '100%',
                          letterSpacing: '0%',
                          color: textColor,
                        }}
                      >
                        {row}
                      </span>
                    </div>
                    {columnLabels.map((col) => {
                      const cellValue = financialData[row]?.[col.key] || '';
                      return (
                        <div
                          key={col.key}
                          style={{
                            flex: isMobile ? '0 0 auto' : '1 1 0',
                            width: isMobile ? '120px' : 'auto',
                            minWidth: isMobile ? '120px' : 0,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: bgColor,
                            border: `${isMobile ? '1.5px' : '2.66px'} solid rgba(255, 255, 255, 1)`,
                            padding: isMobile ? '0 4px' : '0',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'Lufga',
                              fontWeight: 500,
                              fontStyle: 'normal',
                              fontSize: getFontSize('10px', '16px', '20.59px'),
                              lineHeight: '100%',
                              letterSpacing: '0%',
                              color: textColor,
                              textAlign: 'center',
                            }}
                          >
                            {cellValue ? formatNumber(cellValue) : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Net Profit Row */}
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: isMobile ? '60px' : '91.12px',
                  backgroundColor: '#C6FE1F',
                }}
              >
                <div
                  style={{
                    width: `${isMobile ? 120 : columnWidth + 45}px`,
                    minWidth: `${isMobile ? 120 : columnWidth + 45}px`,
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    padding: isMobile ? '0 8px' : '0 16px',
                    border: `${isMobile ? '1.5px' : '2.66px'} solid rgba(255, 255, 255, 1)`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 700,
                      fontStyle: 'normal',
                      fontSize: getFontSize('10px', '16px', '20.59px'),
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 1)',
                    }}
                  >
                    Net Profit
                  </span>
                </div>
                {columnLabels.map((col) => {
                  const profit = calculateNetProfitForColumn(col.key, financialTableData);
                  return (
                    <div
                      key={col.key}
                      style={{
                        flex: isMobile ? '0 0 auto' : '1 1 0',
                        width: isMobile ? '120px' : 'auto',
                        minWidth: isMobile ? '120px' : 0,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#C6FE1F',
                        border: `${isMobile ? '1.5px' : '2.66px'} solid rgba(255, 255, 255, 1)`,
                        padding: isMobile ? '0 4px' : '0',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 700,
                          fontStyle: 'normal',
                          fontSize: getFontSize('10px', '16px', '20.59px'),
                          lineHeight: '100%',
                          letterSpacing: '0%',
                          color: 'rgba(0, 0, 0, 1)',
                          textAlign: 'center',
                        }}
                      >
                        {profit !== 0 ? formatNumber(profit) : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section (6 cards) */}
        <div
          style={{
            width: '100%',
            maxWidth: '1209.44px',
            minHeight: isMobile ? 'auto' : '382px',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: '#FAFAFA',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Heading */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('18px', '24px', '28px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#000000',
              marginBottom: '10px',
            }}
          >
            Statistics
          </h2>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ width: '100%', gap: isMobile ? '12px' : '20px' }}>
            <ProgressMetricCard
              label="Conversion Rate"
              value={conversionRate}
              onUnlockClick={handleUpgradeUnlockClick}
              info="The share of visitors who complete a purchase."
            />
            <ProgressMetricCard
              label="Refund Rate"
              value={refundRate}
              onUnlockClick={handleUpgradeUnlockClick}
              info="The share of orders that were refunded."
            />
            <ProgressMetricCard
              label="Returning customers"
              value={returningCustomers}
              onUnlockClick={handleUpgradeUnlockClick}
              info="The share of customers who bought more than once."
            />
            <CustomerTypeCard
              segments={customerTypeSegments}
              info="How the customer base splits between business (B2B) and consumer (B2C) buyers."
            />
            <MetricCard
              label="Average order value"
              value={withCurrencySymbol(avgOrderValue, listingCurrencySymbol)}
              onUnlockClick={handleUpgradeUnlockClick}
              info="The average amount a customer spends per order."
            />
            <MetricCard
              label="Customer base"
              value={customerBase}
              onUnlockClick={handleUpgradeUnlockClick}
              info="The total number of customers the business has served."
              valuePrefix={
                <img src={CustomerIcon} alt="" style={{ width: '26px', height: '26px' }} />
              }
            />
          </div>
        </div>

        {/* Charts Section (left tabs + donut chart) */}
        <div
          style={{
            width: '100%',
            maxWidth: '1209px',
            height: isMobile ? 'auto' : '508px',
            borderRadius: isMobile ? '24px' : '32px',
            background: 'rgba(250, 250, 250, 1)',
            padding: isMobile ? '16px' : '24px',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '16px' : '24px',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Left - Chart Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', width: isMobile ? '100%' : '548px' }}>
            <h2
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontSize: getFontSize('18px', '24px', '28px'),
                lineHeight: '120%',
                color: '#000000',
                marginBottom: '12px',
              }}
            >
              Charts
            </h2>
            {[
              { id: 'sales-channels', title: 'Sales Channels', icon: SalesChannels, useSvg: true },
              { id: 'country-split', title: 'Sales Country Split', icon: Country, useSvg: false },
              { id: 'advertising', title: 'Advertising Channels', icon: AdvertisingChannels, useSvg: false },
            ].map((tab, index) => {
              const isActive = selectedChartTab === tab.id;
              const IconComponent = tab.icon;

              return (
                <div
                  key={tab.id}
                  onClick={() => setSelectedChartTab(tab.id)}
                  style={{
                    width: isMobile ? '100%' : '548px',
                    height: isMobile ? '100px' : '146.67px',
                    borderRadius: isMobile ? '20px' : '32px',
                    marginTop: index > 0 && !isMobile ? '-10px' : '0px',
                    ...(isActive
                      ? {
                        border: '1px solid rgba(0, 0, 0, 1)',
                        background: 'rgba(0, 0, 0, 1)',
                        position: 'relative',
                        zIndex: index + 1,
                      }
                      : {
                        background: 'rgba(255, 255, 255, 1)',
                        boxShadow: '0px -3px 51.7px 0px rgba(0, 0, 0, 0.09)',
                        position: 'relative',
                        zIndex: index + 1,
                      }),
                    padding: '37px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {/* Info Icon - Top Right Corner (for all cards) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '18px',
                      height: '18px',
                      border: '1.5px solid rgba(0, 0, 0, 0.5)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255, 255, 255, 1)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: 'rgba(0, 0, 0, 0.5)',
                        lineHeight: '1',
                      }}
                    >
                      i
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* The icon stays the same whether or not the tab is open,
                        so tapping through the charts does not change it. */}
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent  className="w-6 h-6" style={{ color: '#FFFFFF' }}/>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          fontSize: isMobile ? '18px' : '22px',
                          lineHeight: '120%',
                          letterSpacing: '0%',
                          color: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)',
                          marginBottom: '4px',
                        }}
                      >
                        {tab.title}
                      </div>
                      <div
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontStyle: 'normal',
                          fontSize: '13px',
                          lineHeight: '120%',
                          letterSpacing: '0%',
                          color: isActive && tab.useSvg ? 'rgba(255, 255, 255, 0.5)' : isActive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        {/* The values live in the chart; the row just invites a tap. */}
                        Tab to view details
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isActive && (
                      <div
                        style={{
                          width: '29px',
                          height: '29px',
                          borderRadius: '50%',
                          background: 'rgba(0, 0, 0, 1)',
                          border: '5px solid rgba(255, 255, 255, 1)',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right - Donut Chart */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: isMobile ? '250px' : 'auto', position: 'relative' }}>
            {/* Only the chart is withheld — the tabs beside it stay readable. */}
            {chartsLocked && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UnlockPill label={unlockCtaText} onClick={handleUpgradeUnlockClick} />
              </div>
            )}
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                ...(chartsLocked ? { filter: 'blur(8px)', opacity: 0.7 } : {}),
              }}
            >
              <div style={{ height: isMobile ? '200px' : '300px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {chartsLocked ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={LOCKED_CHART_PLACEHOLDER}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={isMobile ? 70 : 100}
                        innerRadius={isMobile ? 40 : 60}
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {LOCKED_CHART_PLACEHOLDER.map((entry, index) => (
                          <Cell key={`locked-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : activeChartHasData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={isMobile ? 70 : 100}
                        innerRadius={isMobile ? 40 : 60}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {activeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      width: "100%",
                      height: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(0, 0, 0, 0.5)",
                      fontFamily: "Lufga",
                      fontSize: "16px",
                    }}
                  >
                    No data provided
                  </div>
                )}
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : '24px', marginTop: isMobile ? '16px' : '24px', width: '100%', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                {activeChartData.map((entry, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: isMobile ? '16px' : '20px',
                        height: isMobile ? '16px' : '20px',
                        borderRadius: '50%',
                        background: entry.color,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        fontStyle: 'normal',
                        fontSize: getFontSize('14px', '16px', '20px'),
                        lineHeight: '120%',
                        letterSpacing: '0%',
                        color: 'rgba(0, 0, 0, 0.5)',
                      }}
                    >
                      {entry.name}
                    </span>
                    {/* The share belongs next to the label, as in the design. */}
                    <span
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 600,
                        fontSize: getFontSize('14px', '16px', '20px'),
                        lineHeight: '120%',
                        color: 'rgba(0, 0, 0, 1)',
                      }}
                    >
                      {Math.round(Number(entry.value) || 0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Products Section (5 cards) */}
        <div
          style={{
            width: '100%',
            maxWidth: '1209.44px',
            minHeight: isMobile ? 'auto' : '382px',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: '#FAFAFA',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Heading */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('18px', '24px', '28px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#000000',
              marginBottom: '10px',
            }}
          >
            Products
          </h2>

          {/* Cards Grid - First row: 2 cards, Second row: 3 cards */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px' }}>
            {/* First Row - 2 cards (wider to align with second row start/end) */}
            <div style={{ width: '100%', display: 'flex', gap: isMobile ? '12px' : '10px', flexWrap: 'wrap' }}>
              <MetricCard
                label="Number of Products"
                value={numProducts}
                customWidth={isMobile ? "100%" : "570.5px"}
                customHeight="124.01px"
                onUnlockClick={handleUpgradeUnlockClick}
                info="How many distinct products the business sells."
              />
              <MetricCard
                label="Selling Model"
                value={sellingModel}
                customWidth={isMobile ? "100%" : "570.5px"}
                customHeight="124.01px"
                onUnlockClick={handleUpgradeUnlockClick}
                info="How orders are fulfilled — for example own fulfillment, dropshipping or print on demand."
              />
            </div>

            {/* Second Row - 3 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ width: '100%', gap: isMobile ? '12px' : '20px' }}>
              <MetricCard
                label="Seller has inventory?"
                value={hasInventory}
                onUnlockClick={handleUpgradeUnlockClick}
                info="Whether the seller currently holds stock that comes with the business."
              />
              <MetricCard
                label="Inventory Value"
                value={withCurrencySymbol(inventoryValue, listingCurrencySymbol)}
                onUnlockClick={handleUpgradeUnlockClick}
                info="What the stock currently in hand is worth."
              />
              <MetricCard
                label="Is it included in the price?"
                value={inventoryIncluded}
                onUnlockClick={handleUpgradeUnlockClick}
                info="Whether the inventory value is part of the asking price or charged on top of it."
              />
            </div>
          </div>
        </div>

        {/* Management Section (3 cards) */}
        <div
          style={{
            width: '1209.44px',
            maxWidth: '100%',
            height: isMobile ? 'auto' : '238.03px',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: '#FAFAFA',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Heading */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('18px', '24px', '28px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#000000',
              marginBottom: '10px',
            }}
          >
            Management
          </h2>

          {/* Cards Grid - 3 cards in one row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ width: '100%', gap: isMobile ? '12px' : '20px' }}>
            <MetricCard
              label="Freelancers"
              value={freelancers}
              onUnlockClick={handleUpgradeUnlockClick}
              info="How many freelancers the business works with regularly."
            />
            <MetricCard
              label="Employees"
              value={employees}
              onUnlockClick={handleUpgradeUnlockClick}
              info="How many people the business employs."
            />
            <MetricCard
              label="Owner Hours per Week"
              value={ceoTime}
              onUnlockClick={handleUpgradeUnlockClick}
              info="How many hours a week the current owner spends running the business."
            />
          </div>
        </div>

        {/* Handover Section */}
        <div
          style={{
            width: '1209.44px',
            maxWidth: '100%',
            // minHeight, not height — the assets card inside grows with the
            // number of assets the seller actually selected.
            minHeight: isMobile ? 'auto' : '430.03px',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: 'rgba(250, 250, 250, 1)',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Heading */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('18px', '24px', '28px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#000000',
              marginBottom: '10px',
            }}
          >
            Handover
          </h2>

          {/* Content Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {/* First Card - Assets Included in the Sale */}
            <div
              style={{
                width: '1161px',
                maxWidth: '100%',
                // Grows with the list: only selected assets are shown, so the
                // count varies per listing.
                minHeight: '172px',
                gap: '10px',
                borderRadius: '20px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                padding: '24px',
                background: 'rgba(255, 255, 255, 1)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {/* Info Icon */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  width: '18px',
                  height: '18px',
                  border: '1.5px solid rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 1)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'rgba(0, 0, 0, 0.5)',
                    lineHeight: '1',
                  }}
                >
                  i
                </span>
              </div>

              {/* Title */}
              <h4
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 500,
                  fontStyle: 'normal',
                  fontSize: '20px',
                  lineHeight: '120%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 0.5)',
                  marginBottom: '16px',
                }}
              >
                Assets included in the Sale
              </h4>

              {/* Assets List — laid out in two columns, as in the design. */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2"
                style={{ gap: '12px', columnGap: '24px' }}
              >
                {includedAssets.length === 0 ? (
                  <span
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 400,
                      fontStyle: 'normal',
                      fontSize: '16px',
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    No assets selected.
                  </span>
                ) : (
                  includedAssets.map((asset, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Only selected assets reach here, so the box is always ticked. */}
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          background: 'rgba(197, 253, 31, 1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Check style={{ width: '16px', height: '16px', color: 'rgba(0, 0, 0, 1)' }} />
                      </div>
                      <span
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 400,
                          fontStyle: 'normal',
                          fontSize: '16px',
                          lineHeight: '150%',
                          letterSpacing: '0%',
                          color: 'rgba(0, 0, 0, 1)',
                        }}
                      >
                        {asset.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Second Row - Two Cards */}
            <div style={{ display: 'flex', gap: isMobile ? '12px' : '10px', flexWrap: 'wrap' }}>
              {/* Post Sales Support Card */}
              <div
                style={{
                  width: isMobile ? '100%' : '570.5px',
                  height: isMobile ? 'auto' : '124.01px',
                  minHeight: isMobile ? '100px' : '124.01px',
                  borderRadius: '20px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  padding: '24px',
                  background: 'rgba(255, 255, 255, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Info Icon */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '18px',
                    height: '18px',
                    border: '1.5px solid rgba(0, 0, 0, 0.5)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 1)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'rgba(0, 0, 0, 0.5)',
                      lineHeight: '1',
                    }}
                  >
                    i
                  </span>
                </div>

                {/* Label */}
                <div
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '20px',
                    lineHeight: '120%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 0.5)',
                    marginBottom: '8px',
                  }}
                >
                  Seller offers Post sales support?
                </div>

                {/* Value */}
                <div
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '28px',
                    lineHeight: '120%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}
                >
                  {postSalesSupport}
                </div>
              </div>

              {/* Post Purchase Support Card */}
              <div
                style={{
                  width: isMobile ? '100%' : '570.5px',
                  height: isMobile ? 'auto' : '124.01px',
                  minHeight: isMobile ? '100px' : '124.01px',
                  borderRadius: '20px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  padding: '24px',
                  background: 'rgba(255, 255, 255, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                {/* Info Icon */}
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '18px',
                    height: '18px',
                    border: '1.5px solid rgba(0, 0, 0, 0.5)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 1)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Arial, sans-serif',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'rgba(0, 0, 0, 0.5)',
                      lineHeight: '1',
                    }}
                  >
                    i
                  </span>
                </div>

                {/* Label */}
                <div
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '20px',
                    lineHeight: '120%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 0.5)',
                    marginBottom: '8px',
                  }}
                >
                  Post purchase Support
                </div>

                {/* Value */}
                <div
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: '28px',
                    lineHeight: '120%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)',
                  }}
                >
                  {supportDuration}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Media Section — hidden when the seller linked no platforms. */}
        {(hasLockedSocial ||
          [instagramSocial, twitterSocial, tiktokSocial].some((s) => Boolean(s.url))) && (
        <div
          style={{
            width: '1209.44px',
            maxWidth: '100%',
            height: isMobile ? 'auto' : 'auto',
            gap: '10px',
            borderRadius: isMobile ? '24px' : '32px',
            padding: isMobile ? '16px' : '24px',
            background: 'rgba(250, 250, 250, 1)',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: isMobile ? '16px' : '24px',
          }}
        >
          {/* Heading */}
          <h2
            style={{
              fontFamily: 'Lufga',
              fontWeight: 500,
              fontStyle: 'normal',
              fontSize: getFontSize('18px', '24px', '28px'),
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#000000',
              marginBottom: '10px',
            }}
          >
            Social Media
          </h2>

          {/* Social Media Cards */}
          <div
            style={{
              display: 'flex',
              gap: isMobile ? '12px' : '10px',
              flexWrap: 'wrap',
              position: 'relative',
              minHeight: hasLockedSocial ? '98px' : undefined,
            }}
          >
            {/* Withheld: the cards behind are placeholders, not the real links. */}
            {hasLockedSocial && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UnlockPill label={unlockCtaText} onClick={handleUpgradeUnlockClick} />
              </div>
            )}
            {hasLockedSocial &&
              [0, 1, 2].map((index) => (
                <div
                  key={`locked-social-${index}`}
                  style={{
                    width: isMobile ? '100%' : '373.67px',
                    minHeight: '98px',
                    borderRadius: '20px',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    padding: '24px',
                    background: 'rgba(255, 255, 255, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    filter: 'blur(5px)',
                  }}
                >
                  <span
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.15)',
                      flexShrink: 0,
                    }}
                  />
                  <LockedBlur chars={18} />
                </div>
              ))}
            {!hasLockedSocial && [
              { name: "Instagram", icon: InstagramIcon, data: instagramSocial },
              { name: "X", icon: XIcon, data: twitterSocial },
              { name: "Tiktok", icon: TikTokIcon, data: tiktokSocial },
            ]
              // Only platforms the seller actually linked are shown.
              .filter((platform) => Boolean(platform.data.url))
              .map((platform) => {
              const card = (
                <div
                  style={{
                    width: isMobile ? '100%' : '373.67px',
                    height: isMobile ? 'auto' : '98px',
                    minHeight: isMobile ? '80px' : '98px',
                    borderRadius: '20px',
                    border: platform.data.url ? '1px solid rgba(0, 0, 0, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                    padding: '24px',
                    background: 'rgba(255, 255, 255, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    cursor: platform.data.url ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <img
                    src={platform.icon}
                    alt={platform.name}
                    style={{
                      width: '50px',
                      height: '50px',
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        fontStyle: 'normal',
                        fontSize: '20px',
                        lineHeight: '120%',
                        letterSpacing: '0%',
                        color: 'rgba(0, 0, 0, 1)',
                        textDecoration: 'underline',
                      }}
                    >
                      {platform.name}
                    </div>
                  </div>
                </div>
              );

              return (
                <a
                  key={platform.name}
                  href={platform.data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {card}
                </a>
              );
            })}
          </div>
        </div>
        )}

        {/* Attachments Section */}
        {(attachments.length > 0 || hasLockedAttachments) && (
          <div
            style={{
              width: '1209.44px',
              maxWidth: '100%',
              minHeight: isMobile ? 'auto' : '212.02px',
              gap: '10px',
              borderRadius: isMobile ? '24px' : '32px',
              padding: isMobile ? '16px' : '24px',
              background: 'rgba(250, 250, 250, 1)',
              display: 'flex',
              flexDirection: 'column',
              marginBottom: isMobile ? '16px' : '24px',
            }}
          >
            {/* Heading */}
            <h2
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: getFontSize('18px', '24px', '28px'),
                lineHeight: '120%',
                letterSpacing: '0%',
                color: '#000000',
                marginBottom: '10px',
              }}
            >
              Attachments
            </h2>

            {/* Attachment Cards */}
            <div style={{ display: 'flex', gap: isMobile ? '12px' : '10px', flexWrap: 'wrap' }}>
              {attachments.map((attachment, index) => (
                <AttachmentCard
                  key={index}
                  fileName={attachment.fileName}
                  url={attachment.url}
                />
              ))}
              {hasLockedAttachments && (
                <div
                  style={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : '373.67px',
                    minHeight: '98px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UnlockPill label={unlockCtaText} onClick={handleUpgradeUnlockClick} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Similar Listings Section */}
        {similarItems.length > 0 && (
          <div
            style={{
              width: '1209.44px',
              maxWidth: '100%',
              height: isMobile ? 'auto' : '750px',
              gap: '10px',
              borderRadius: isMobile ? '24px' : '32px',
              padding: isMobile ? '16px' : '24px',
              background: 'rgba(250, 250, 250, 1)',
              display: 'flex',
              flexDirection: 'column',
              marginBottom: isMobile ? '16px' : '24px',
            }}
          >
            {/* Heading */}
            <h2
              style={{
                fontFamily: 'Lufga',
                fontWeight: 500,
                fontStyle: 'normal',
                fontSize: getFontSize('18px', '24px', '28px'),
                lineHeight: '120%',
                letterSpacing: '0%',
                textTransform: 'capitalize',
                color: 'rgba(0, 0, 0, 1)',
                marginBottom: '10px',
              }}
            >
              {similarHeading}
            </h2>

            {/* Carousel with 3 cards per slide (1 on mobile) */}
            <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: isMobile ? '400px' : 'auto' }}>
              <Carousel
                opts={{
                  align: "start",
                  loop: false,
                }}
                className="w-full"
              >
                <CarouselContent style={{ display: 'flex', gap: isMobile ? '12px' : '10px' }}>
                  {similarItems.map((similarListing: any) => {
                    // Extract data using same logic as AllListings
                    const brandQuestions = similarListing.brand || [];
                    const adQuestions = similarListing.advertisement || [];

                    const getBrandAnswer = (searchTerms: string[]) => {
                      const question = brandQuestions.find((b: any) =>
                        searchTerms.some(term => b.question?.toLowerCase().includes(term.toLowerCase()))
                      );
                      return question?.answer || null;
                    };

                    const getAdAnswer = (searchTerms: string[]) => {
                      const question = adQuestions.find((a: any) =>
                        searchTerms.some(term => a.question?.toLowerCase().includes(term.toLowerCase()))
                      );
                      return question?.answer || null;
                    };

                    const businessName = resolveListingTitle(similarListing, 'Unnamed Business');
                    const categoryName = similarListing.category?.[0]?.name || 'Other';
                    const askingPrice = parseFloat(getAdAnswer(['listing price', 'price']) ||
                      getBrandAnswer(['asking price', 'price', 'selling price']) ||
                      similarListing.price ||
                      0) || 0;
                    const location = getBrandAnswer(['country', 'location', 'address']) ||
                      similarListing.location ||
                      'Not specified';

                    // Calculate business age (same logic as AllListings)
                    const businessAgeFromAnswer = getBrandAnswer(['business age', 'age', 'years']);
                    let businessAge = 0;

                    if (businessAgeFromAnswer) {
                      businessAge = parseInt(String(businessAgeFromAnswer).replace(/[^0-9]/g, '')) || 0;
                    } else {
                      const listingCreatedAt = similarListing.created_at || similarListing.createdAt || similarListing.createdAtDate;
                      const userCreatedAt = similarListing.user?.created_at || similarListing.user?.createdAt || similarListing.user?.createdAtDate;
                      businessAge = calculateBusinessAgeFromListing(listingCreatedAt, userCreatedAt);
                    }

                    // Calculate financials
                    const allFinancials = similarListing.financials || [];
                    const totalRevenue = allFinancials.reduce((sum: number, f: any) =>
                      sum + (parseFloat(f.revenue_amount || 0) || 0), 0
                    ) || 0;
                    const totalNetProfit = allFinancials.reduce((sum: number, f: any) =>
                      sum + (parseFloat(f.net_profit || 0) || 0), 0
                    ) || 0;

                    // Calculate multiples
                    const revenueMultiple = (askingPrice > 0 && totalRevenue > 0) ? (askingPrice / totalRevenue).toFixed(1) + 'x Revenue' : '0.5x Revenue';
                    const profitMultiple = (askingPrice > 0 && totalNetProfit > 0) ? 'Multiple ' + (askingPrice / totalNetProfit).toFixed(1) + 'x Profit' : 'Multiple 1.5x Profit';

                    // Get image
                    const photoQuestion = adQuestions.find((a: any) =>
                      a.question?.toLowerCase().includes('photo') ||
                      a.answer_type === 'PHOTO'
                    );
                    let imageUrl = '';
                    if (photoQuestion?.answer) {
                      imageUrl = parseMediaUrls(photoQuestion.answer)[0] || '';
                    }
                    if (!imageUrl && brandQuestions && brandQuestions.length > 0) {
                      const brandInfo = brandQuestions[0];
                      if (brandInfo?.businessPhoto?.[0]) {
                        imageUrl = brandInfo.businessPhoto[0];
                      } else if (brandInfo?.logo) {
                        imageUrl = brandInfo.logo;
                      }
                    }
                    if (!imageUrl) {
                      imageUrl = similarListing.image_url || similarListing.image || '';
                    }

                    // Get description
                    const adAnswers = getAllAnswers(adQuestions);
                    const adDescription = getAdAnswer(['description', 'Description']) ||
                      adAnswers['Description'] || adAnswers['description'] ||
                      getBrandAnswer(['description', 'about']) ||
                      'No description available';

                    return (
                      <CarouselItem
                        key={similarListing.id}
                        className={isMobile ? "!basis-full pl-4" : "!basis-1/3 pl-4"}
                      >
                        <ListingCard
                          image={imageUrl}
                          category={categoryName}
                          name={businessName}
                          description={adDescription}
                          price={`${getListingCurrencySymbol(similarListing)}${formatNumber(Number(askingPrice))}`}
                          profitMultiple={profitMultiple}
                          revenueMultiple={revenueMultiple}
                          location={location}
                          locationFlag={location}
                          businessAge={businessAge}
                          netProfit={totalNetProfit > 0 ? `${getListingCurrencySymbol(similarListing)}${formatNumber(Math.round(totalNetProfit))}` : undefined}
                          revenue={totalRevenue > 0 ? `${getListingCurrencySymbol(similarListing)}${formatNumber(Math.round(totalRevenue))}` : undefined}
                          managedByEx={similarListing.managed_by_ex === true || similarListing.managed_by_ex === 1 || similarListing.managed_by_ex === 'true' || similarListing.managed_by_ex === '1'}
                          isPremium={String(similarListing.selectedPackage || '').toUpperCase() === 'PREMIUM'}
                          listingId={similarListing.id}
                          sellerId={similarListing.userId || similarListing.user_id}
                          imageLocked={Boolean(photoQuestion?.locked)}
                        />
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious />
                <CarouselNext />
              </Carousel>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const handleSubmitReport = async () => {
    if (!user) {
      toast.error("Please log in to report a listing");
      navigate("/login");
      return;
    }
    if (!listing?.id || !reportReason) return;

    setIsSubmittingReport(true);
    try {
      const response = await apiClient.reportListing({
        listingId: listing.id,
        reason: reportReason,
        notes: reportNotes,
      });
      if (!response.success) {
        toast.error(response.error || "Could not send the report");
        return;
      }
      setReportOpen(false);
      setReportReason("");
      setReportNotes("");
      toast.success("Thank you. Our team will review this listing.");
    } catch (error) {
      console.error("Report error:", error);
      toast.error("Could not send the report");
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const reportDialog = (
    <Dialog open={reportOpen} onOpenChange={setReportOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Report this listing</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Tell us what is wrong with this listing and our team will look into it.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium">Reason</label>
          <Select value={reportReason} onValueChange={setReportReason}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="misleading">Misleading or false information</SelectItem>
              <SelectItem value="scam">Scam or fraud</SelectItem>
              <SelectItem value="offensive">Offensive or inappropriate content</SelectItem>
              <SelectItem value="duplicate">Duplicate listing</SelectItem>
              <SelectItem value="other">Something else</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Details (optional)</label>
          <Textarea
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            placeholder="Add anything that helps us understand the problem"
            className="min-h-24"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="rounded-full h-11 px-6"
            onClick={() => setReportOpen(false)}
            disabled={isSubmittingReport}
          >
            Cancel
          </Button>
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-11 flex-1 font-semibold"
            onClick={handleSubmitReport}
            disabled={!reportReason || isSubmittingReport}
          >
            {isSubmittingReport ? "Sending..." : "Send report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const agreementDialog = (
    <Dialog open={agreementOpen} onOpenChange={setAgreementOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Confidentiality Agreement</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          This listing contains confidential business information. Before you can contact the
          seller, you must accept our confidentiality agreement.
        </p>

        <div className="rounded-2xl bg-muted/40 p-4">
          <p className="text-sm font-semibold mb-2">By continuing, you agree to:</p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>→ Treat all information about this business as confidential</li>
            <li>→ Not share it with third parties</li>
            <li>→ Use it solely to evaluate a possible acquisition</li>
            <li>→ Conduct all communication through the EX Platform</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Breaching these terms may result in account suspension, legal action, and other remedies
          available under our Terms and Conditions.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            className="rounded-full h-11 px-6"
            onClick={() => setAgreementOpen(false)}
            disabled={isAcceptingAgreement}
          >
            Cancel
          </Button>
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground rounded-full h-11 flex-1 font-semibold"
            onClick={handleAcceptAgreement}
            disabled={isAcceptingAgreement}
          >
            {isAcceptingAgreement ? "Please wait..." : "Accept & Contact Seller"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return isAdminView ? (
    <div className="bg-background">
      {content}
      {agreementDialog}
      {reportDialog}
      <ShareListingDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={businessName}
      />
    </div>
  ) : (
    <div className="min-h-screen bg-background">
      <Header />
      {content}
      <Footer />
      {agreementDialog}
      {reportDialog}
      <ShareListingDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        url={shareUrl}
        title={businessName}
      />
    </div>
  );
};

export default ListingDetail;
