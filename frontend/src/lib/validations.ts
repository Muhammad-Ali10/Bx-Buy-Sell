import { z } from "zod";
import { DOMAIN_VALIDATION_MESSAGE, isValidDomain } from "./domainUtils";

const optionalDomainField = z
  .string()
  .refine((value) => !value || isValidDomain(value), DOMAIN_VALIDATION_MESSAGE)
  .optional()
  .or(z.literal(""));

export const brandInformationSchema = z.object({
  brandName: z.string().min(2, "Brand name must be at least 2 characters").max(100, "Brand name must be less than 100 characters"),
  website: optionalDomainField,
  foundedYear: z.string().regex(/^\d{4}$/, "Please enter a valid year (YYYY)"),
  location: z.string().min(2, "Location is required").max(100, "Location must be less than 100 characters"),
});

export const financialsSchema = z.object({
  financialType: z.enum(["monthly", "yearly"], {
    required_error: "Please select a financial type",
  }),
  years: z.array(z.object({
    year: z.string(),
    revenue: z.string().min(1, "Revenue is required"),
    cost: z.string().min(1, "Cost is required"),
    profit: z.string().min(1, "Profit is required"),
  })).min(1, "At least one year of financial data is required"),
});

export const accountsSchema = z.object({
  facebook: z.object({
    url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    followers: z.string().optional(),
  }),
  instagram: z.object({
    url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    followers: z.string().optional(),
  }),
  twitter: z.object({
    url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    followers: z.string().optional(),
  }),
  pinterest: z.object({
    url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    followers: z.string().optional(),
  }),
  tiktok: z.object({
    url: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
    followers: z.string().optional(),
  }),
});

export const adInformationsSchema = z.object({
  photo: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  listingPrice: z.string().min(1, "Listing price is required"),
  title: z.string().min(5, "Title must be at least 5 characters").max(100, "Title must be less than 100 characters"),
  introText: z.string().min(10, "Intro text must be at least 10 characters").max(500, "Intro text must be less than 500 characters"),
  usps: z.string().min(10, "USPs must be at least 10 characters").max(500, "USPs must be less than 500 characters"),
  description: z.string().min(50, "Description must be at least 50 characters").max(2000, "Description must be less than 2000 characters"),
});

export const handoverSchema = z.object({
  includedAssets: z.array(z.string()).min(1, "Please select at least one asset"),
  postSalesSupport: z.enum(["yes", "no"], {
    required_error: "Please select post-sales support option",
  }),
  supportDuration: z.string().optional(),
});

export type BrandInformationFormData = z.infer<typeof brandInformationSchema>;
export type FinancialsFormData = z.infer<typeof financialsSchema>;
export type AccountsFormData = z.infer<typeof accountsSchema>;
export type AdInformationsFormData = z.infer<typeof adInformationsSchema>;
export type HandoverFormData = z.infer<typeof handoverSchema>;
