// Type definitions for Listing data structure
// This will be used when fetching from database/API

export interface Listing {
  id: number;
  image: string;
  category: string;
  name: string;
  description: string;
  price: string;
  profitMultiple: string;
  revenueMultiple: string;
  location: string;
  locationFlag: string;
  businessAge: number;
  netProfit: string;
  revenue: string;
  createdAt?: string;
  updatedAt?: string;
  sellerId?: string;
  isFeatured?: boolean;
  isVerified?: boolean;
}

export interface ListingFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  location?: string;
  minBusinessAge?: number;
  maxBusinessAge?: number;
}
