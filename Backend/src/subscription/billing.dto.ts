import { z } from 'zod';

/** A text field that may be left empty; empty is stored as nothing. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

/**
 * The invoice address as the Billing tab sends it.
 *
 * Every field may be left empty. The country, when given, has to be a
 * two-letter code: that is the only form Stripe prints on an invoice.
 */
export const invoiceAddressSchema = z.object({
  company: text(120),
  vat_number: text(40),
  first_name: text(80),
  last_name: text(80),
  street: text(200),
  zip_code: text(20),
  city: text(100),
  state: text(100),
  country: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value.toUpperCase() : null))
    .refine((value) => value === null || /^[A-Z]{2}$/.test(value), {
      message: 'Choose a country from the list',
    }),
});

export type InvoiceAddressInput = z.infer<typeof invoiceAddressSchema>;
