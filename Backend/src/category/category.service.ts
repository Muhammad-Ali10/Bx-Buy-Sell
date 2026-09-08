import { Injectable, NotFoundException, HttpException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { notDeleted } from '../prisma/soft-delete';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    // Get all categories, ordered by creation date (newest first)
    // This ensures consistent ordering and helps identify duplicates
    return await this.prisma.category.findMany({
      orderBy: {
        created_at: 'desc', // Newest first
      },
    });
  }

  /**
   * The categories buyers can actually find something in, busiest first.
   *
   * The home page used to list four hand-typed topics, three of which matched
   * no category at all and opened an empty page. Reading them from the
   * listings instead means a topic can never point at nothing, and the row
   * keeps itself up to date as the marketplace fills out.
   *
   * Listings store their category by name rather than by id, and the filter
   * matches on that name — so the name is what gets counted and returned.
   */
  async getTrending(limit = 4) {
    const [rows, categories] = await Promise.all([
      this.prisma.listingCategory.findMany({
        where: {
          listing: {
            status: 'PUBLISH',
            ...notDeleted(),
          },
        },
        select: { name: true },
      }),
      this.prisma.category.findMany({ select: { name: true } }),
    ]);

    /**
     * Only a name an administrator has put on the category list may trend.
     *
     * Counting alone is not enough. Sellers type this field, so it holds
     * whatever they typed — "naeeem bhai" sat on three published listings,
     * level with Fashion and Tech, and a fourth would have carried someone's
     * note onto the home page with nobody the wiser. Named patterns cannot
     * catch that; only asking what the category list actually contains can.
     *
     * The rubbish check stays, on this side of the comparison: the list has
     * collected "string" and "undefined" rows of its own over time.
     */
    const allowed = new Set(
      categories
        .map((category) => String(category.name || '').trim())
        .filter((name) => name && !/^(undefined|string|null)$/i.test(name)),
    );

    const counts = new Map<string, number>();
    for (const row of rows) {
      // Matched exactly, because the listings filter compares exactly too — a
      // topic that differed by so much as a capital would open an empty page.
      const name = String(row.name || '').trim();
      if (!allowed.has(name)) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([name, listings]) => ({ name, listings }));
  }

  async getById(id: string) {
    return await this.prisma.category.findUnique({
      where: {
        id,
      },
    });
  }

  async create(data: any) {
    return await this.prisma.category.create({
      data,
    });
  }

  async update(id: string, data: any) {
    return await this.prisma.category.update({
      where: {
        id,
      },
      data,
    });
  }

  async delete(id: string) {
    try {
      // Ensure id is a string, not an object
      const categoryId = typeof id === 'string' ? id : (id as any)?.id || String(id);
      
      console.log('Deleting category with ID:', categoryId, 'Type:', typeof categoryId);
      
      // First, get the category to check if it exists and get the image path
      const category = await this.prisma.category.findUnique({
        where: {
          id: categoryId,
        },
      });

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      // Check if category is being used by listings
      // Note: ListingCategory stores category name, not categoryId
      const listingCount = await this.prisma.listingCategory.count({
        where: {
          name: category.name,
        },
      });

      if (listingCount > 0) {
        throw new HttpException(
          `Cannot delete category. It is being used by ${listingCount} listing(s).`,
          400
        );
      }

      // Delete the image file if it exists
      if (category.image_path) {
        try {
          // Handle both absolute and relative paths
          let imagePath: string;
          if (path.isAbsolute(category.image_path)) {
            imagePath = category.image_path;
          } else {
            imagePath = path.join(process.cwd(), category.image_path);
          }
          
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            console.log(`Deleted image file: ${imagePath}`);
          } else {
            console.warn(`Image file not found: ${imagePath}`);
          }
        } catch (fileError) {
          // Log the error but don't fail the deletion if file doesn't exist
          console.warn(`Failed to delete image file: ${category.image_path}`, fileError);
        }
      }

      // Delete the category from database
      const deletedCategory = await this.prisma.category.delete({
        where: {
          id: categoryId,
        },
      });

      return deletedCategory;
    } catch (error) {
      console.error('Error deleting category:', error);
      if (error instanceof NotFoundException || error instanceof HttpException) {
        throw error;
      }
      // Handle Prisma errors
      if (error.code === 'P2025') {
        const categoryId = typeof id === 'string' ? id : (id as any)?.id || String(id);
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }
      if (error.code === 'P2003') {
        throw new HttpException(
          'Cannot delete category. It is being used by existing listings.',
          400
        );
      }
      throw error;
    }
  }
}
