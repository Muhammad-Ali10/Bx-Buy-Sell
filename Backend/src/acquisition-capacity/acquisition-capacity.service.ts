import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Buyers' verified purchasing power.
 *
 * A buyer uploads proof of funds once; a moderator reviews it and records the
 * amount they could verify. Listings compare that amount with their asking
 * price so sellers can see how realistic an interested buyer is.
 */
@Injectable()
export class AcquisitionCapacityService {
  constructor(private readonly db: PrismaService) {}

  /** The buyer's own record, including anything still under review. */
  async findForBuyer(buyerId: string) {
    return this.db.acquisitionCapacity.findUnique({
      where: { buyerId },
      select: {
        id: true,
        documents: true,
        verifiedFunds: true,
        status: true,
        reviewedAt: true,
        created_at: true,
        updated_at: true,
        uploads: {
          select: {
            id: true,
            name: true,
            url: true,
            status: true,
            note: true,
            reviewedAt: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  /**
   * A file's own name, recovered from its URL when the client did not send one.
   *
   * The account page lists documents by name — "IMG3483.png" — so a row with
   * no name would read as a blank line.
   */
  private static nameFromUrl(url: string): string {
    try {
      const path = new URL(url).pathname;
      const last = decodeURIComponent(path.split('/').filter(Boolean).pop() || '');
      return last || 'Document';
    } catch {
      const last = url.split('?')[0].split('/').filter(Boolean).pop();
      return last || 'Document';
    }
  }

  /**
   * Buyer submits (or adds to) their proof of funds. New documents send the
   * case back into the queue, since the verified amount may now be out of date.
   */
  async submitDocuments(
    buyerId: string,
    documents: Array<string | { url: string; name?: string }>,
  ) {
    const clean = (documents || [])
      .map((entry) =>
        typeof entry === 'string'
          ? { url: entry.trim(), name: '' }
          : { url: String(entry?.url || '').trim(), name: String(entry?.name || '').trim() },
      )
      .filter((entry) => entry.url !== '')
      .map((entry) => ({
        url: entry.url,
        name: entry.name || AcquisitionCapacityService.nameFromUrl(entry.url),
      }));

    if (clean.length === 0) {
      throw new BadRequestException('No documents were provided.');
    }

    const existing = await this.db.acquisitionCapacity.findUnique({
      where: { buyerId },
      select: { id: true, documents: true },
    });

    const record = await this.db.acquisitionCapacity.upsert({
      where: { buyerId },
      create: {
        buyerId,
        documents: clean.map((entry) => entry.url),
        status: 'UNASSIGNED',
      },
      update: {
        documents: [...(existing?.documents ?? []), ...clean.map((entry) => entry.url)],
        // New evidence puts the case back in the queue: the amount verified
        // before may no longer be the whole picture.
        status: 'UNASSIGNED',
      },
    });

    await this.db.acquisitionDocument.createMany({
      data: clean.map((entry) => ({
        capacityId: record.id,
        name: entry.name,
        url: entry.url,
        status: 'IN_REVIEW' as const,
      })),
    });

    return this.findForBuyer(buyerId);
  }

  /**
   * Moderator's verdict on one file.
   *
   * Separate from the case-level review because the two answer different
   * questions: whether this particular document stands up, and how much the
   * team could verify overall.
   */
  /**
   * A buyer's proven capital: the sum of what each verified document showed.
   *
   * Declined documents contribute nothing — that is the point of declining one
   * — and neither do documents still awaiting a verdict, because an unjudged
   * upload proves nothing yet. Recomputed after every change so the headline
   * figure can never disagree with the evidence beneath it.
   */
  private async recalculateVerifiedFunds(capacityId: string) {
    const verified = await this.db.acquisitionDocument.findMany({
      where: { capacityId, status: 'VERIFIED' },
      select: { verifiedCapital: true },
    });

    const total = verified.reduce((sum, doc) => sum + (doc.verifiedCapital ?? 0), 0);

    await this.db.acquisitionCapacity.update({
      where: { id: capacityId },
      data: { verifiedFunds: verified.length ? total : null },
    });

    return total;
  }

  async reviewDocument(
    documentId: string,
    input: {
      status: 'IN_REVIEW' | 'VERIFIED' | 'DECLINED';
      note?: string | null;
      verifiedCapital?: number | null;
    },
  ) {
    const document = await this.db.acquisitionDocument.findUnique({
      where: { id: documentId },
      select: { id: true, capacityId: true },
    });
    if (!document) throw new NotFoundException('Document not found');

    const updated = await this.db.acquisitionDocument.update({
      where: { id: documentId },
      data: {
        status: input.status,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.verifiedCapital !== undefined
          ? { verifiedCapital: input.verifiedCapital }
          : {}),
        reviewedAt: input.status === 'IN_REVIEW' ? null : new Date(),
      },
    });

    await this.recalculateVerifiedFunds(document.capacityId);
    return updated;
  }

  /**
   * Put a case in someone's hands. Picking up an untouched case starts the
   * review, which is what the overview shows: a case with a name against it is
   * never still "Unassigned".
   */
  async assignReviewer(id: string, reviewerId: string | null) {
    const existing = await this.db.acquisitionCapacity.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Case not found');

    if (reviewerId) {
      const member = await this.db.user.findUnique({
        where: { id: reviewerId },
        select: { id: true, role: true },
      });
      if (!member) throw new NotFoundException('Team member not found');
      if (member.role !== 'ADMIN' && member.role !== 'MONITER') {
        throw new BadRequestException(
          'Only admins and moderators can review a case',
        );
      }
    }

    return this.db.acquisitionCapacity.update({
      where: { id },
      data: {
        reviewerId,
        status:
          reviewerId && existing.status === 'UNASSIGNED'
            ? 'IN_REVIEW'
            : existing.status,
      },
      include: {
        reviewer: {
          select: { id: true, first_name: true, last_name: true, profile_pic: true },
        },
      },
    });
  }

  /**
   * A buyer's verified amount, for someone who is actually dealing with them.
   *
   * Verified capital is sensitive, so it is only released to a seller who has a
   * chat with that buyer (or to the team). Everyone else gets null, which the UI
   * shows as "Not Verified".
   */
  async findForCounterparty(buyerId: string, viewerId: string, viewerRole?: string | null) {
    const role = String(viewerRole || '').toUpperCase();
    const isStaff = role === 'ADMIN' || role === 'MONITER' || role === 'MODERATOR';

    if (!isStaff && viewerId !== buyerId) {
      const sharedChat = await this.db.chat.findFirst({
        where: { userId: buyerId, sellerId: viewerId },
        select: { id: true },
      });
      if (!sharedChat) return { verifiedFunds: null };
    }

    return { verifiedFunds: await this.getVerifiedFunds(buyerId) };
  }

  /** Review queue for moderators. */
  async findAll(filters?: {
    status?: 'UNASSIGNED' | 'IN_REVIEW' | 'COMPLETED';
    reviewerId?: string;
    minFunds?: number;
    maxFunds?: number;
  }) {
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.reviewerId) where.reviewerId = filters.reviewerId;
    if (filters?.minFunds !== undefined || filters?.maxFunds !== undefined) {
      where.verifiedFunds = {};
      if (filters.minFunds !== undefined) where.verifiedFunds.gte = filters.minFunds;
      if (filters.maxFunds !== undefined) where.verifiedFunds.lte = filters.maxFunds;
    }

    const [cases, totals] = await Promise.all([
      this.db.acquisitionCapacity.findMany({
        where,
        include: {
          buyer: {
            select: { id: true, first_name: true, last_name: true, email: true, profile_pic: true },
          },
          reviewer: {
            select: { id: true, first_name: true, last_name: true },
          },
          uploads: {
            select: {
              id: true,
              name: true,
              url: true,
              status: true,
              note: true,
              verifiedCapital: true,
              reviewedAt: true,
              created_at: true,
            },
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.db.acquisitionCapacity.aggregate({ _sum: { verifiedFunds: true } }),
    ]);

    return { cases, totalVerifiedFunds: totals._sum.verifiedFunds ?? 0 };
  }

  /**
   * Moderator records the outcome. Assigning a reviewer to an untouched case
   * moves it into review automatically, as the admin screen expects.
   */
  async review(
    id: string,
    reviewerId: string,
    input: {
      verifiedFunds?: number | null;
      status?: 'UNASSIGNED' | 'IN_REVIEW' | 'COMPLETED';
      notes?: string | null;
    },
  ) {
    const existing = await this.db.acquisitionCapacity.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Case not found');

    const status =
      input.status ??
      (existing.status === 'UNASSIGNED' ? 'IN_REVIEW' : existing.status);

    // A case cannot be finished while one of its documents has had no verdict:
    // "Completed" would then mean nothing, and the total under it would be
    // missing whatever that document turns out to prove.
    if (status === 'COMPLETED') {
      const undecided = await this.db.acquisitionDocument.count({
        where: { capacityId: id, status: 'IN_REVIEW' },
      });
      if (undecided > 0) {
        throw new BadRequestException(
          `${undecided} document${undecided === 1 ? '' : 's'} still awaiting a verdict`,
        );
      }
    }

    // verifiedFunds is deliberately not writable here. It is the sum of the
    // verified documents, kept in step by recalculateVerifiedFunds(); letting
    // it also be typed would give one number two sources that drift apart.
    return this.db.acquisitionCapacity.update({
      where: { id },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        status,
        // Only claim the case if nobody else already has it.
        reviewerId: existing.reviewerId ?? reviewerId,
        reviewedAt: status === 'COMPLETED' ? new Date() : existing.reviewedAt,
      },
    });
  }

  /**
   * Verified funds for a buyer, used to rate them against a listing price.
   * Only a completed review counts — an unreviewed upload proves nothing.
   */
  async getVerifiedFunds(buyerId: string): Promise<number | null> {
    const record = await this.db.acquisitionCapacity.findUnique({
      where: { buyerId },
      select: { verifiedFunds: true, status: true },
    });
    if (!record || record.status !== 'COMPLETED') return null;
    return record.verifiedFunds ?? null;
  }
}
