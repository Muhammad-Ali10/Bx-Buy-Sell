import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { trimListingFeedRecord } from 'common/util/trim-listing-feed.util';
import { maskListingFor } from '../listing/listing-visibility';
import type { UpdateUserType, UserType } from './dto/user.dto';
import type {
  UpdateAdminUserType,
  UserAdminUpdateSchema,
} from './dto/add-user.dto';
@Injectable()
export class UserService {
  constructor(private db: PrismaService) {}

  /** Drop embedded base64 / huge strings that break HTTP responses behind proxies. */
  private trimHeavyUserMediaFields(user: any) {
    if (!user || typeof user !== 'object') return user;
    const max = 48_000;
    const fix = (v: unknown) => {
      if (typeof v !== 'string') return v;
      if (v.length <= max && !/^data:/i.test(v)) return v;
      if (/^https?:\/\//i.test(v) && v.length <= max) return v;
      return null;
    };
    return {
      ...user,
      profile_pic: fix(user.profile_pic),
      background: fix(user.background),
    };
  }
  async findAll() {
    return await this.db.user.findMany({
      omit: {
        password_hash: true,
        refresh_token: true,
        otp_code: true,
      },
      include: {
        // The overview marks paying members with a PRO badge, so the plan has
        // to travel with the row rather than being fetched per user.
        subscription: {
          select: {
            status: true,
            billingCycle: true,
            endDate: true,
            plan: { select: { name: true, slug: true, title: true } },
          },
        },
      },
    });
  }

  /**
   * Addresses are compared case-insensitively so "A@b.com" and "a@b.com" cannot
   * become two accounts, and so anyone who registered with capitals can still
   * sign in after we started storing addresses folded.
   */
  static normalizeEmail(email: string | null | undefined) {
    return (email ?? '').trim().toLowerCase();
  }

  async findOneByEmail(email: string) {
    return this.db.user.findFirst({
      where: { email: { equals: UserService.normalizeEmail(email), mode: 'insensitive' } },
      // While duplicates still exist, which account a person signs into must not
      // depend on the order the database happens to return rows in — that could
      // move them between accounts from one login to the next. Oldest wins, and
      // the duplicates report says the same, so the two cannot disagree.
      orderBy: { created_at: 'asc' },
    });
  }

  /**
   * Every account on an address, oldest first. Sign-in resolves to the oldest,
   * so a duplicate silently shadows the newer account: changing the password on
   * the newer one appears to do nothing, and the older password keeps working.
   */
  async findAllByEmail(email: string) {
    return this.db.user.findMany({
      where: { email: { equals: UserService.normalizeEmail(email), mode: 'insensitive' } },
      orderBy: { created_at: 'asc' },
    });
  }

  /** Throws if the address is taken, ignoring `exceptId` (the account being edited). */
  async assertEmailIsFree(email: string, exceptId?: string) {
    const taken = await this.findAllByEmail(email);
    const clash = taken.find((u) => u.id !== exceptId);
    if (clash) {
      throw new HttpException(
        'An account with this email address already exists',
        409,
      );
    }
  }

  /**
   * What a team member is actually looking after. Each figure is the same
   * question the corresponding overview answers when filtered by this member,
   * so the numbers and the linked screens cannot disagree.
   */
  async getTeamMemberStats(userId: string) {
    const [managedListings, managedChats, activityLog] = await Promise.all([
      this.db.listing.count({ where: { responsibleId: userId } }),
      this.db.chat.count({ where: { responsibleId: userId } }),
      this.db.activityLog.count({ where: { actorId: userId } }),
    ]);
    return { managedListings, managedChats, activityLog };
  }

  /** Accounts sharing an address, for the admin to resolve by hand. */
  async findDuplicateEmailAccounts() {
    const users = await this.db.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        first_name: true,
        last_name: true,
        created_at: true,
        blocked: true,
      },
      orderBy: { created_at: 'asc' },
    });

    const groups = new Map<string, typeof users>();
    for (const user of users) {
      const key = UserService.normalizeEmail(user.email);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, [] as any);
      groups.get(key)!.push(user);
    }

    return [...groups.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([email, rows]) => ({
        email,
        count: rows.length,
        // The one sign-in actually resolves to; the rest are unreachable.
        accounts: rows.map((row, index) => ({ ...row, isActiveOnSignIn: index === 0 })),
      }));
  }

  async findOneByID(id: string) {
    const user = await this.db.user.findUnique({
      where: { id: id },
      omit: {
        password_hash: true,
        refresh_token: true,
        // Verification codes must never travel back to the browser. The whole
        // point of emailing a code to a new address is that only whoever reads
        // that inbox can complete the change — returning it here would let
        // anyone request a change to an address they do not own and then read
        // their own code out of this response. `findAll` already hid otp_code;
        // this path did not.
        otp_code: true,
        phone_otp: true,
        email_otp: true,
      },
      include: {
        preferences: {
          include: {
            businessCategory: true,
            niche: true,
            financial: {
              include: {
                age_range: true,
                yearly_profit_range: true,
                profit_multiple_range: true,
                revenue_multiple_range: true,
              },
            },
          },
        },
        // The details page shows the amount a moderator could actually verify,
        // rather than a bare "Funds Verified" tick with no figure behind it.
        acquisitionCapacity: {
          select: { verifiedFunds: true, status: true, reviewedAt: true },
        },
        subscription: {
          select: {
            status: true,
            billingCycle: true,
            startDate: true,
            endDate: true,
            stripeCurrentPeriodEnd: true,
            plan: {
              select: { name: true, slug: true, title: true, monthlyPrice: true, yearlyPrice: true },
            },
          },
        },
      },
    });
    return this.trimHeavyUserMediaFields(user);
  }

  /**
   * The four things an account can have verified, in one answer.
   *
   * Gathered server-side rather than assembled from three separate calls in the
   * browser: the screen shows four badges that must agree with each other, and
   * three independent requests can land out of order and disagree.
   */
  async getVerificationOverview(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        phone: true,
        is_phone_verified: true,
        email: true,
        is_email_verified: true,
        verified: true,
        identity_status: true,
        acquisitionCapacity: {
          select: { status: true, verifiedFunds: true, reviewedAt: true },
        },
      },
    });
    if (!user) throw new HttpException('User not found', 404);

    const capacity = user.acquisitionCapacity;
    // Funds count as verified only once a review is finished with an amount —
    // an uploaded document on its own proves nothing.
    const fundsVerified =
      capacity?.status === 'COMPLETED' &&
      typeof capacity.verifiedFunds === 'number' &&
      capacity.verifiedFunds > 0;

    return {
      sms: { verified: Boolean(user.is_phone_verified), value: user.phone ?? null },
      email: { verified: Boolean(user.is_email_verified), value: user.email ?? null },
      identity: {
        verified: Boolean(user.verified),
        status: user.identity_status ?? null,
      },
      funds: {
        verified: Boolean(fundsVerified),
        status: capacity?.status ?? null,
        reviewedAt: capacity?.reviewedAt ?? null,
      },
    };
  }

  /** Read on every guarded request, so keep the projection tiny. */
  async findRoleByID(id: string) {
    return this.db.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        role: true,
        blocked: true,
      },
    });
  }

  async createUser(body) {
    const payload = { ...body, email: UserService.normalizeEmail(body.email) };
    await this.assertEmailIsFree(payload.email);
    return await this.db.user.create({ data: payload });
  }
  async createUserByAdmin(body) {
    let payload = { ...body };
    // The DTO has already hashed this; it arrives as `password`.
    payload.password_hash = body.password;
    payload.verified = body.active;
    payload.email = UserService.normalizeEmail(body.email);
    delete payload.password;
    delete payload.confirm_password;
    delete payload.active;
    // Without this an admin could create a second account on an address that
    // already exists, which then shadows the original at sign-in.
    await this.assertEmailIsFree(payload.email);
    return await this.db.user.create({ data: payload });
  }

  /**
   * @param id     whose favourites these are
   * @param viewer who is looking. Defaults to the owner, which covers the
   *               normal case; staff reading someone else's list must pass
   *               their own role, or the listings come back masked as that
   *               member would see them rather than as a moderator.
   */
  async getAllFavourite(id: string, viewer?: { userId?: string; role?: string }) {
    const rows = await this.db.favourite.findMany({
      where: {
        userId: `${id}`,
      },
      // The favourites grid renders the same card as the feed, so it only needs
      // these relations. Skipping tools/productQuestion/managementQuestion/
      // social_account/handover means fewer DB round-trips per favourite. The
      // user is narrowed to safe public fields (never password_hash/refresh_token).
      include: {
        listing: {
          include: {
            user: {
              select: {
                id: true,
                created_at: true,
                first_name: true,
                last_name: true,
                profile_pic: true,
              },
            },
            brand: true,
            advertisement: true,
            category: true,
            financials: true,
            statistics: true,
          },
        },
      },
    });

    // Favouriting a listing grants no extra sight of it, so these run through
    // the same rules as the feed. One query covers every agreement this user
    // has already accepted.
    const listingIds = rows
      .map((row) => row.listing?.id)
      .filter((listingId): listingId is string => Boolean(listingId));

    const accessRows = listingIds.length
      ? await this.db.listingConfidentialAccess.findMany({
          where: { buyerId: id, listingId: { in: listingIds } },
          select: { listingId: true },
        })
      : [];
    const accessible = new Set(accessRows.map((row) => row.listingId));

    return rows.map((row) => ({
      ...row,
      listing: row.listing
        ? maskListingFor(trimListingFeedRecord(row.listing as Record<string, any>), {
            userId: viewer?.userId ?? id,
            role: viewer?.role,
            hasConfidentialAccess: accessible.has(row.listing.id),
          })
        : row.listing,
    }));
  }

  async getFavouriteCount(id: string) {
    return this.db.favourite.count({
      where: {
        userId: `${id}`,
      },
    });
  }

  async addToFavourite(id: string, listingId: string) {
    return this.db.favourite.create({
      data: {
        userId: `${id}`,
        listingId: `${listingId}`,
      },
    });
  }

  async removeFromFavourite(userId: string, listingId: string) {
    const favourite = await this.db.favourite.findFirst({
      where: {
        userId: `${userId}`,
        listingId: `${listingId}`,
      },
    });

    if(!favourite)
    {
      throw new HttpException("Favourite not found", 404)
    }
    return this.db.favourite.delete({
      where: {
       id: favourite.id,
      },
    });
  }


  async updateUser(id: string, body: UpdateUserType | UpdateAdminUserType) {
    const data: any = { ...body };
    if (body && (body as any).is_online === false) {
      data.last_offline = new Date();
    }

    if (typeof data.email === 'string') {
      data.email = UserService.normalizeEmail(data.email);
      await this.assertEmailIsFree(data.email, id);
    }

    // A new password must end the sessions opened with the old one, otherwise
    // whoever was already signed in stays signed in indefinitely.
    if (typeof data.password_hash === 'string' && data.password_hash.length > 0) {
      data.refresh_token = null;
    }

    return await this.db.user.update({ where: { id: id }, data });
  }

  /**
   * Blocking is enforced at sign-in and on every guarded request, and it drops
   * the refresh token so sessions already open die at once rather than living
   * on until the access token expires.
   */
  async setBlocked(
    id: string,
    blocked: boolean,
    options: { reason?: string | null; byUserId?: string } = {},
  ) {
    return this.db.user.update({
      where: { id },
      data: blocked
        ? {
            blocked: true,
            blocked_at: new Date(),
            blocked_reason: options.reason ?? null,
            blocked_by: options.byUserId ?? null,
            refresh_token: null,
            is_online: false,
            last_offline: new Date(),
          }
        : {
            blocked: false,
            blocked_at: null,
            blocked_reason: null,
            blocked_by: null,
          },
    });
  }

  /**
   * Close one's own account.
   *
   * Marked closed rather than erased. The row is referenced by listings, chats,
   * payments and moderation records belonging to other people — removing it
   * would leave those pointing at nothing, and would take the other side of
   * every conversation with it. Sign-in refuses a closed account, so this ends
   * access even though the row survives.
   */
  async closeOwnAccount(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, deleted_at: true },
    });
    if (!user) throw new HttpException('User not found', 404);
    if (user.deleted_at) return { success: true, alreadyClosed: true };

    const closedAt = new Date();

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: {
          deleted_at: closedAt,
          is_online: false,
          last_offline: closedAt,
          // Ends any session already open, not just future sign-ins.
          refresh_token: null,
        },
      }),
      // Their listings leave the marketplace. Left published, buyers would keep
      // enquiring about businesses nobody is there to sell.
      this.db.listing.updateMany({
        where: { userId, status: 'PUBLISH' },
        data: { status: 'DRAFT' },
      }),
    ]);

    return { success: true, closedAt };
  }

  async deleteUser(id: string) {
    return await this.db.user.delete({ where: { id: id } });
  }

  async upsertPreferences(
    userId: string,
    payload: {
      background?: string | null;
      businessCategories?: string[];
      niches?: string[];
      sellerLocation?: string | null;
      targetLocation?: string | null;
      listingPriceRange?: { min?: string | null; max?: string | null } | null;
      businessAgeRange?: { min?: string | null; max?: string | null } | null;
      yearlyProfitRange?: { min?: string | null; max?: string | null } | null;
      profitMultipleRange?: { min?: string | null; max?: string | null } | null;
    },
  ) {
    if (payload.background !== undefined) {
      await this.db.user.update({
        where: { id: userId },
        data: { background: payload.background || null },
      });
    }

    const existing = await this.db.preference.findUnique({
      where: { userId },
      include: {
        financial: {
          include: {
            age_range: true,
            yearly_profit_range: true,
            profit_multiple_range: true,
            revenue_multiple_range: true,
          },
        },
      },
    });

    const businessCategories = (payload.businessCategories || [])
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    const niches = (payload.niches || [])
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    const rangeData = (range?: { min?: string | null; max?: string | null } | null, country?: string | null) => {
      if (!range?.min && !range?.max && !country) return null;
      return {
        min: range?.min || "",
        max: range?.max || "",
        country: country || null,
      };
    };

    const listingPriceRange = rangeData(payload.listingPriceRange, payload.targetLocation);
    const businessAgeRange = rangeData(payload.businessAgeRange);
    const yearlyProfitRange = rangeData(payload.yearlyProfitRange);
    const profitMultipleRange = rangeData(payload.profitMultipleRange);

    if (existing) {
      await this.db.businessCategory.deleteMany({ where: { preferenceId: existing.id } });
      await this.db.niche.deleteMany({ where: { preferenceId: existing.id } });

      const financialUpdate: any = {
        seller_location: payload.sellerLocation || null,
      };

      if (businessAgeRange) {
        financialUpdate.age_range = existing.financial?.age_range
          ? { update: businessAgeRange }
          : { create: businessAgeRange };
      }

      if (yearlyProfitRange) {
        financialUpdate.yearly_profit_range = existing.financial?.yearly_profit_range
          ? { update: yearlyProfitRange }
          : { create: yearlyProfitRange };
      }

      if (profitMultipleRange) {
        financialUpdate.profit_multiple_range = existing.financial?.profit_multiple_range
          ? { update: profitMultipleRange }
          : { create: profitMultipleRange };
      }

      if (listingPriceRange) {
        financialUpdate.revenue_multiple_range = existing.financial?.revenue_multiple_range
          ? { update: listingPriceRange }
          : { create: listingPriceRange };
      }

      return this.db.preference.update({
        where: { id: existing.id },
        data: {
          businessCategory: businessCategories.length ? { create: businessCategories } : undefined,
          niche: niches.length ? { create: niches } : undefined,
          financial: existing.financial
            ? { update: financialUpdate }
            : {
                create: {
                  seller_location: payload.sellerLocation || null,
                  age_range: businessAgeRange ? { create: businessAgeRange } : undefined,
                  yearly_profit_range: yearlyProfitRange ? { create: yearlyProfitRange } : undefined,
                  profit_multiple_range: profitMultipleRange ? { create: profitMultipleRange } : undefined,
                  revenue_multiple_range: listingPriceRange ? { create: listingPriceRange } : undefined,
                },
              },
        },
      });
    }

    return this.db.preference.create({
      data: {
        user: { connect: { id: userId } },
        businessCategory: businessCategories.length ? { create: businessCategories } : undefined,
        niche: niches.length ? { create: niches } : undefined,
        financial: {
          create: {
            seller_location: payload.sellerLocation || null,
            age_range: businessAgeRange ? { create: businessAgeRange } : undefined,
            yearly_profit_range: yearlyProfitRange ? { create: yearlyProfitRange } : undefined,
            profit_multiple_range: profitMultipleRange ? { create: profitMultipleRange } : undefined,
            revenue_multiple_range: listingPriceRange ? { create: listingPriceRange } : undefined,
          },
        },
      },
    });
  }
}
