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
  Heart, Share2, MessageSquare, ArrowLeft, Globe, MapPin, DollarSign, 
  TrendingUp, Users, Calendar, Download, FileText, Info, CheckCircle2,
  Instagram, Twitter, Music, Mail, ShoppingBag, Building2, Clock,
  PieChart as PieChartIcon, Settings, Globe as GlobeIcon
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import ListingCard from "@/components/ListingCard";
import { calculateBusinessAgeFromListing } from "@/lib/dateUtils";
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountQuestions } from "@/hooks/useAccountQuestions";
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
import PdfIcon from "@/assets/pdf.svg";
import InfoIcon from "@/assets/i.svg";
import RequestIcon from "@/assets/request.svg";
import DateIcon from "@/assets/date.svg";

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
    const url = normalizeSocialUrl(seg);
    if (url) {
      const urlBucket = inferBucketFromUrlString(seg);
      const canAttachUrl = urlBucket === bucket || (allowGenericUrlForBucket && urlBucket === null);
      if (canAttachUrl && !out[bucket].url) out[bucket].url = url;
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
const MediaCarousel = ({ images, isFavorite, isTogglingFavorite, onFavorite, onShare, categoryName }: {
  images: string[];
  isFavorite: boolean;
  isTogglingFavorite: boolean;
  onFavorite: () => void;
  onShare: () => void;
  categoryName?: string;
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
        {categoryName && (
          <div className="absolute bottom-4 left-4">
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
      <Carousel setApi={setApi} className="w-full h-full">
        <CarouselContent className="h-full">
          {images.map((img, index) => (
            <CarouselItem key={index} className="h-full">
              <div className="relative w-full h-full">
                <img
                  src={img}
                  alt={`Listing image ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  sizes="100vw"
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
      
      {/* Category badge */}
      {categoryName && (
        <div className="absolute bottom-4 left-4">
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
              className={`w-2 h-2 rounded-full transition-colors ${
                index === current ? "bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// SummaryCard Component
const SummaryCard = ({ listing, onContactSeller, onMakeOffer, isStartingChat }: {
  listing: any;
  onContactSeller: () => void;
  onMakeOffer: () => void;
  isStartingChat: boolean;
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

  // Get the listing title (business name)
  const listingTitle = getAnswerByQuestion(listing?.brand || [], ['business name', 'company name', 'brand name']) || 
                       listing?.title || 'Untitled Listing';

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
            Pay in {Math.round(parseFloat(askingPrice.toString()) / 10)}$ monthly
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
            10 installments
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
        <Button
          onClick={onMakeOffer}
          style={{
            width: '347px',
            height: '53px',
            borderRadius: '62px',
            borderWidth: '1px',
            border: '1px solid rgba(0, 0, 0, 1)',
            padding: '10px',
            gap: '10px',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img 
            src={MakeOfferIcon} 
            alt="Make Offer" 
            style={{
              width: '32px',
              height: '32px',
            }}
          />
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
            Make Offer
          </span>
        </Button>
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
}: {
  label: string;
  value: string | number;
  icon?: any;
  image?: string;
  customWidth?: string;
  customHeight?: string;
  onUnlockClick?: () => void;
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
      }}
    >
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
          <button
            type="button"
            onClick={onUnlockClick}
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '20px',
              lineHeight: '120%',
              letterSpacing: '0%',
              color: '#0067ff',
              textDecoration: 'underline',
              background: 'transparent',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            {value}
          </button>
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
            }}
          >
            {value}
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
}: {
  label: string;
  value: string | number;
  onUnlockClick?: () => void;
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
        }}
      >
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
        <button
          type="button"
          onClick={onUnlockClick}
          style={{
            fontFamily: 'Lufga',
            fontWeight: 600,
            fontStyle: 'normal',
            fontSize: '20px',
            lineHeight: '120%',
            letterSpacing: '0%',
            color: '#0067ff',
            textDecoration: 'underline',
            background: 'transparent',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          {value}
        </button>
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
      }}
    >
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

// AttachmentCard Component
const AttachmentCard = ({ fileName, fileSize, url }: { fileName: string; fileSize?: string; url?: string }) => {
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
      link.download = fileName || 'document.pdf';
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
      <img
        src={PdfIcon}
        alt="PDF"
        style={{
          width: '50px',
          height: '50px',
        }}
      />
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
  const { data: similarListings = [] } = useQuery({
    queryKey: ["similar-listings", id, listing?.category?.[0]?.id, isAuthenticated],
    queryFn: async () => {
      try {
        const response = isAuthenticated
          ? await apiClient.getSecureListings()
          : await apiClient.getListings(); // Cached public feed (TTL ~10s, purged on create/update/delete)
        if (response.success && response.data) {
          const allListings = Array.isArray(response.data) ? response.data : [];
          // Filter out current listing and get published listings (get more for carousel)
          const similar = allListings
            .filter((l: any) => l.id !== id && (l.status?.toUpperCase() === 'PUBLISH' || l.status?.toUpperCase() === 'PUBLISHED'));
          return similar;
        }
        return [];
      } catch (error) {
        console.error('Error fetching similar listings:', error);
        return [];
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
  const businessName = getAnswerByQuestion(listing?.brand || [], ['business name', 'company name', 'brand name']) || 
                      listing?.title || 'Untitled Listing';
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
  const businessAge = getAnswerByQuestion(listing?.brand || [], ['business age', 'age', 'years']) || '5 years';
  const website = getAnswerByQuestion(listing?.brand || [], ['website', 'url', 'domain']) || 'www.beauty.de';
  
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

  // Extract images
  const images = listing?.advertisement?.filter((a: any) => 
    a.answer_type === 'PHOTO' && a.answer
  ).map((a: any) => a.answer) || [];
  
  if (images.length === 0) {
    const photo = listing?.advertisement?.find((a: any) => 
      a.question?.toLowerCase().includes('photo') || a.answer_type === 'PHOTO'
    )?.answer || listing?.image_url;
    if (photo) images.push(photo);
  }

  // Statistics
  const conversionRate = getAnswerByQuestion(listing?.statistics || [], ['conversion rate', 'conversion']) || '7%';
  const refundRate = getAnswerByQuestion(listing?.statistics || [], ['refund rate', 'refund']) || '40%';
  const returningCustomers = getAnswerByQuestion(listing?.statistics || [], ['returning customer', 'returning', 'repeat']) || '20%';
  const emailSubscribers = getAnswerByQuestion(listing?.statistics || [], ['email subscriber', 'subscriber', 'email']) || '7493';
  const avgOrderValue = getAnswerByQuestion(listing?.statistics || [], ['average order', 'aov', 'order value']) || '$344';
  const customerBase = getAnswerByQuestion(listing?.statistics || [], ['customer base', 'total customer', 'customers']) || '8099';
  const pageViews = getAnswerByQuestion(listing?.statistics || [], ['page views', 'views', 'traffic']) || '1266 p/m';

  // Financials
  const financials = listing?.financials || [];
  console.log('🔍 Full listing object:', listing);
  console.log('🔍 Listing financials field:', listing?.financials);
  const monthlyFinancials = financials.filter((f: any) => f.type === 'monthly');
  const yearlyFinancials = financials.filter((f: any) => f.type === 'yearly');
  
  const totalRevenue = financials.reduce((sum: number, f: any) => sum + parseFloat(f.revenue_amount || 0), 0);
  const totalCost = financials.reduce((sum: number, f: any) => sum + parseFloat(f.annual_cost || 0), 0);
  const totalProfit = financials.reduce((sum: number, f: any) => sum + parseFloat(f.net_profit || 0), 0);
  const avgMonthlyProfit = monthlyFinancials.length > 0 
    ? monthlyFinancials.reduce((sum: number, f: any) => sum + parseFloat(f.net_profit || 0), 0) / monthlyFinancials.length 
    : 4360;
  const profitMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 30;
  const profitMultiple = totalProfit > 0 && avgMonthlyProfit > 0 ? (parseFloat(askingPrice.toString()) / (avgMonthlyProfit * 12)).toFixed(1) : '1.5x';
  const revenueMultiple = totalRevenue > 0 
    ? `${(parseFloat(askingPrice.toString()) / totalRevenue).toFixed(1)}x Revenue`
    : '0.5x Revenue';
  const profitMultipleDisplay = profitMultiple.toString().replace(/x$/i, '');

  const unreadMessagesCount = listing?.unread_messages_count ?? 0;
  const requestsCount = listing?.requests_count ?? 0;
  const createdAtDate = listing?.created_at || listing?.createdAt || listing?.createdAtDate;
  const createdAtLabel = createdAtDate
    ? formatDistanceToNow(new Date(createdAtDate), { addSuffix: true })
    : '-';
  const adminIntroRaw = intro || adDescription || businessDescription || '';
  const adminIntro = adminIntroRaw.length > 140 ? `${adminIntroRaw.slice(0, 140)}...` : adminIntroRaw;
  const unlockRedirect = listing?.lockAction?.redirectTo || '/register';
  const unlockCtaText = listing?.lockAction?.ctaText || 'register to unlock 🔓';

  const handleUpgradeUnlockClick = () => {
    navigate(unlockRedirect);
  };

  const handleLockClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const text = (target.textContent || '').toLowerCase();
    if (!text.includes('to unlock')) return;
    event.preventDefault();
    event.stopPropagation();
    handleUpgradeUnlockClick();
  };

  // Management
  const freelancers = getAnswerByQuestion(listing?.managementQuestion || [], ['freelancer', 'freelance']) || '2';
  const employees = getAnswerByQuestion(listing?.managementQuestion || [], ['employee', 'staff', 'team member']) || '5';
  const ceoTime = getAnswerByQuestion(listing?.managementQuestion || [], ['ceo time', 'owner time', 'hours per week']) || '40 hours';

  // Products
  const numProducts = getAnswerByQuestion(listing?.productQuestion || [], ['number of product', 'product count', 'products']) || '12';
  const sellingModel = getAnswerByQuestion(listing?.productQuestion || [], ['selling model', 'model', 'dropshipping']) || 'Dropshipping';
  const hasInventory = getAnswerByQuestion(listing?.productQuestion || [], ['inventory', 'stock', 'has inventory']) || 'Yes';
  const inventoryValue = getAnswerByQuestion(listing?.productQuestion || [], ['inventory value', 'stock value', 'how much']) || '$233';
  const inventoryIncluded = getAnswerByQuestion(listing?.productQuestion || [], ['included in price', 'inventory included']) || 'Yes';

  // Handover
  const handoverItems = listing?.handover || [];
  const assetsIncluded = getHandoverAssets(handoverItems);
  const postSalesSupport =
    getAnswerByQuestion(listing?.handover || [], [
      "post sale",
      "post purchase",
      "support",
    ]) || "Not provided";
  const supportDuration =
    getAnswerByQuestion(listing?.handover || [], [
      "support duration",
      "support period",
      "months",
    ]) || "Not provided";

  // Attachments
  const hasLockedAttachments = (listing?.advertisement || []).some(
    (a: any) => a.answer_type === 'FILE' && isLockedValue(a.answer),
  );
  const attachments = listing?.advertisement?.filter((a: any) => 
    a.answer_type === 'FILE' && a.answer && !isLockedValue(a.answer)
  ).map((a: any) => ({
    fileName: a.answer.split('/').pop() || 'Document',
    url: a.answer,
    fileSize: '23.3 MB' // TODO: Calculate actual file size if available
  })) || [];

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
  const formatNumber = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

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

  const handleShare = async () => {
    const listingUrl = `${window.location.origin}/listing/${id}`;
    const shareData = {
      title: businessName,
      text: businessDescription,
      url: listingUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success("Shared successfully");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          await navigator.clipboard.writeText(listingUrl);
          toast.success("Link copied to clipboard");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(listingUrl);
        toast.success("Link copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy link");
      }
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

  const handleMakeOffer = () => {
    toast.info("Make Offer feature coming soon");
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
                  color: 'rgba(0, 0, 0, 1)',
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
                      Multiple {profitMultipleDisplay}x Profit
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
                    Pay in {Math.round(resolvedPrice / 10)}$ monthly
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
                    10 installments
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
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={ownerAvatar || undefined} />
                        <AvatarFallback
                          style={{
                            background: '#AEF31F',
                            color: 'rgba(0, 0, 0, 1)',
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '18px',
                          }}
                        >
                          {(ownerName?.charAt(0) || 'U').toUpperCase()}
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
                        {ownerName}
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
                  categoryName={categoryName}
                />
              </div>

              <div className="lg:col-span-1">
                <SummaryCard
                  listing={listing}
                  onContactSeller={handleContactSeller}
                  onMakeOffer={handleMakeOffer}
                  isStartingChat={isStartingChat}
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
                color: 'rgba(0, 0, 0, 1)',
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
                <button
                  type="button"
                  onClick={handleUpgradeUnlockClick}
                  style={{
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontStyle: 'normal',
                    fontSize: getFontSize('14px', '20px', '28px'),
                    lineHeight: '120%',
                    letterSpacing: '0%',
                    color: '#0067ff',
                    textDecoration: 'underline',
                    wordBreak: 'break-all',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {website}
                </button>
              ) : (
                <a 
                  href={`https://${website}`} 
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
                    }}
                  >
                    {readMore ? adDescription : `${adDescription.substring(0, isMobile ? 200 : 300)}...`}
                  </div>
                </div>
                {adDescription.length > (isMobile ? 200 : 300) && (
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
                image={MapImage}
              />
              <MetricCard
                label="Business Age"
                value={businessAge}
              />
              <MetricCard
                label="Monthly Profit"
                value={`${Math.round(avgMonthlyProfit).toLocaleString()}$/m`}
              />
              <MetricCard
                label="Profit Margin"
                value={`${profitMargin}%`}
              />
              <MetricCard
                label="Page Views"
                value={pageViews}
              />
              <MetricCard
                label="Profit Multiple"
                value={profitMultiple}
              />
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
                        width: `${isMobile ? 120 : columnWidth}px`,
                        minWidth: `${isMobile ? 120 : columnWidth}px`,
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
                              width: `${isMobile ? 120 : columnWidth}px`,
                              minWidth: `${isMobile ? 120 : columnWidth}px`,
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
                          width: `${isMobile ? 120 : columnWidth}px`,
                          minWidth: `${isMobile ? 120 : columnWidth}px`,
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
              />
              <ProgressMetricCard
                label="Refund Rate"
                value={refundRate}
                onUnlockClick={handleUpgradeUnlockClick}
              />
              <ProgressMetricCard
                label="Returning customers"
                value={returningCustomers}
                onUnlockClick={handleUpgradeUnlockClick}
              />
              <MetricCard
                label="E-Mail Subscribers"
                value={emailSubscribers}
                onUnlockClick={handleUpgradeUnlockClick}
              />
              <MetricCard
                label="Average order value"
                value={avgOrderValue}
                onUnlockClick={handleUpgradeUnlockClick}
              />
              <MetricCard
                label="Customer base"
                value={customerBase}
                onUnlockClick={handleUpgradeUnlockClick}
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
              {[
                { id: 'sales-channels', title: 'Sales Channels', icon: Settings, useSvg: true },
                { id: 'country-split', title: 'Sales Country Split', icon: GlobeIcon, useSvg: false },
                { id: 'advertising', title: 'Advertising Channels', icon: PieChartIcon, useSvg: false },
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
                      {isActive && tab.useSvg ? (
                        <img
                          src={SettingCardIcon}
                          alt={tab.title}
                          style={{
                            width: '80px',
                            height: '80px',
                          }}
                        />
                      ) : !isActive && tab.id === 'country-split' ? (
                        <div
                          style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'rgba(250, 250, 250, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={GlobIcon}
                            alt={tab.title}
                            style={{
                              width: '32px',
                              height: '32px',
                            }}
                          />
                        </div>
                      ) : !isActive && tab.id === 'advertising' ? (
                        <div
                          style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'rgba(250, 250, 250, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <img
                            src={AdverIcon}
                            alt={tab.title}
                            style={{
                              width: '32px',
                              height: '32px',
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent
                            className="w-6 h-6"
                            style={{ color: isActive ? '#000000' : '#FFFFFF' }}
                          />
                        </div>
                      )}
                      <div>
                        <div
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontStyle: 'normal',
                            fontSize: isActive && tab.useSvg ? '32px' : !isActive ? '32px' : '18px',
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
                            fontSize: isActive && tab.useSvg ? '22px' : !isActive ? '22px' : '12px',
                            lineHeight: '120%',
                            letterSpacing: '0%',
                            color: isActive && tab.useSvg ? 'rgba(255, 255, 255, 0.5)' : isActive ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          {tab.id === "sales-channels"
                            ? salesChannelsSummary
                            : tab.id === "country-split"
                              ? (salesCountrySplitList.length > 0 ? `${salesCountrySplitList.length} entries` : "No data provided")
                              : advertisingChannelsSummary}
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
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: isMobile ? '250px' : 'auto' }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ height: isMobile ? '200px' : '300px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeChartHasData ? (
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
                  label="Number Shop products"
                  value={numProducts}
                  customWidth={isMobile ? "100%" : "570.5px"}
                  customHeight="124.01px"
                  onUnlockClick={handleUpgradeUnlockClick}
                />
                <MetricCard
                  label="Selling Model"
                  value={sellingModel}
                  customWidth={isMobile ? "100%" : "570.5px"}
                  customHeight="124.01px"
                  onUnlockClick={handleUpgradeUnlockClick}
                />
              </div>
              
              {/* Second Row - 3 cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ width: '100%', gap: isMobile ? '12px' : '20px' }}>
                <MetricCard
                  label="Seller has inventory?"
                  value={hasInventory}
                  onUnlockClick={handleUpgradeUnlockClick}
                />
                <MetricCard
                  label="how much?"
                  value={inventoryValue}
                  onUnlockClick={handleUpgradeUnlockClick}
                />
                <MetricCard
                  label="Is it included in the price?"
                  value={inventoryIncluded}
                  onUnlockClick={handleUpgradeUnlockClick}
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
              />
              <MetricCard
                label="Employees"
                value={employees}
                onUnlockClick={handleUpgradeUnlockClick}
              />
              <MetricCard
                label="CEO Time Invest per week"
                value={ceoTime}
                onUnlockClick={handleUpgradeUnlockClick}
              />
            </div>
          </div>

          {/* Handover Section */}
          <div
            style={{
              width: '1209.44px',
              maxWidth: '100%',
              height: isMobile ? 'auto' : '430.03px',
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
                  height: '172px',
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
                  Assets Included in the Sale
                </h4>
                
                {/* Assets List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {assetsIncluded.length === 0 ? (
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
                      No handover assets provided.
                    </span>
                  ) : (
                    assetsIncluded.map((asset, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {asset.included ? (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              background: 'rgba(197, 253, 31, 1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4 text-black" style={{ width: '16px', height: '16px', color: 'rgba(0, 0, 0, 1)' }} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              border: '1px solid rgba(0, 0, 0, 0.3)',
                              background: 'rgba(255, 255, 255, 1)',
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 400,
                            fontStyle: 'normal',
                            fontSize: '16px',
                            lineHeight: '150%',
                            letterSpacing: '0%',
                            color: asset.included ? 'rgba(0, 0, 0, 1)' : 'rgba(0, 0, 0, 0.5)',
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

          {/* Social Media Section */}
          <div
            style={{
              width: '1209.44px',
              maxWidth: '100%',
              height: isMobile ? 'auto' : '212.02px',
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
            <div style={{ display: 'flex', gap: isMobile ? '12px' : '10px', flexWrap: 'wrap' }}>
              {[
                { name: "Instagram", icon: InstagramIcon, data: instagramSocial },
                { name: "X", icon: XIcon, data: twitterSocial },
                { name: "Tiktok", icon: TikTokIcon, data: tiktokSocial },
              ].map((platform) => {
                const secondaryLabel = platform.data.followers !== "0 Followers"
                  ? platform.data.followers
                  : getSocialDisplayLabel(platform.data.url, platform.data.followers);
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
                          textDecoration: platform.data.url ? 'underline' : 'none',
                        }}
                      >
                        {platform.name}
                      </div>
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
                        {secondaryLabel}
                      </div>
                    </div>
                  </div>
                );

                if (!platform.data.url) return <div key={platform.name}>{card}</div>;
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
                    fileSize={attachment.fileSize}
                    url={attachment.url}
                  />
                ))}
                {hasLockedAttachments && (
                  <button
                    type="button"
                    onClick={handleUpgradeUnlockClick}
                    style={{
                      width: '100%',
                      maxWidth: isMobile ? '100%' : '373.67px',
                      minHeight: '98px',
                      borderRadius: '20px',
                      border: '1px solid rgba(0, 103, 255, 0.35)',
                      padding: '24px',
                      background: 'rgba(0, 103, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Lufga',
                      fontWeight: 600,
                      fontSize: '18px',
                      color: '#0067ff',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                    }}
                  >
                    {unlockCtaText}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Similar Listings Section */}
          {similarListings.length > 0 && (
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
                Similar Listings
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
                    {similarListings.map((similarListing: any) => {
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
                      
                      const businessName = getBrandAnswer(['business name', 'company name', 'brand name', 'name']) || 
                                          brandQuestions[0]?.answer || 
                                          similarListing.title || 
                                          'Unnamed Business';
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
                        imageUrl = Array.isArray(photoQuestion.answer) ? photoQuestion.answer[0] : photoQuestion.answer;
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
                            price={`$${Number(askingPrice).toLocaleString()}`}
                            profitMultiple={profitMultiple}
                            revenueMultiple={revenueMultiple}
                            location={location}
                            locationFlag={location}
                            businessAge={businessAge}
                            netProfit={totalNetProfit > 0 ? `$${Math.round(totalNetProfit).toLocaleString()}` : undefined}
                            revenue={totalRevenue > 0 ? `$${Math.round(totalRevenue).toLocaleString()}` : undefined}
                            managedByEx={similarListing.managed_by_ex === true || similarListing.managed_by_ex === 1 || similarListing.managed_by_ex === 'true' || similarListing.managed_by_ex === '1'}
                            listingId={similarListing.id}
                            sellerId={similarListing.userId || similarListing.user_id}
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

  return isAdminView ? (
    <div className="bg-background">{content}</div>
  ) : (
    <div className="min-h-screen bg-background">
      <Header />
      {content}
      <Footer />
    </div>
  );
};

export default ListingDetail;
