import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { trimListingFeedRecord } from 'common/util/trim-listing-feed.util';
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
      },
    });
  }

  async findOneByEmail(email: string) {
    return this.db.user.findFirst({ where: { email: email } });
  }

  async findOneByID(id: string) {
    const user = await this.db.user.findUnique({
      where: { id: id },
      omit: {
        password_hash: true,
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
      },
    });
    return this.trimHeavyUserMediaFields(user);
  }

  async findRoleByID(id: string) {
    return this.db.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        role: true,
      },
    });
  }

  async createUser(body) {
    return await this.db.user.create({ data: body });
  }
  async createUserByAdmin(body) {
    let payload = { ...body };
    payload.password_hash = body.password;
    payload.verified = body.active;
    delete payload.password;
    delete payload.confirm_password;
    delete payload.active;
    console.log(payload);
    return await this.db.user.create({ data: payload });
  }

  async getAllFavourite(id: string) {
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
                email: true,
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
    return rows.map((row) => ({
      ...row,
      listing: row.listing
        ? trimListingFeedRecord(row.listing as Record<string, any>)
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
    return await this.db.user.update({ where: { id: id }, data });
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
