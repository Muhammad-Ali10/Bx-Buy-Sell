import { useMemo } from "react";

import { useCategories } from "@/hooks/useCategories";

/**
 * The id of the category a listing is being written under.
 *
 * The wizard does not agree with itself about what `formData.category` holds.
 * `CategoryStep` puts the category's **id** there, but a listing loaded for
 * editing resolves the same field to the category's **name** first — see the
 * chain in `Dashboard.tsx` that reads `c0.category.name` before it looks at any
 * id. That was harmless while every category asked the same questions. It is
 * not harmless now: a name handed to an endpoint that matches on id returns
 * nothing, and the seller would open an existing listing to find every question
 * gone.
 *
 * So the ambiguity is resolved in one place. Whatever is in the field, an id
 * comes out — or `undefined`, which asks for the category-less set and is the
 * same thing the wizard was shown before categories existed.
 */
export const useListingCategoryId = (formData: unknown): string | undefined => {
  /*
   * The same options `CategoryStep` asks with, so the same cache entry answers.
   *
   * React Query keys this list by that flag, so asking without it opened a
   * second, empty entry: the step the seller lands on after choosing a category
   * had no categories yet, resolved no id, and fetched the category-less
   * questions before fetching the right ones. Harmless while every category
   * asks the same things — a visible flash of the wrong form the moment they
   * differ.
   */
  const { data: categories } = useCategories({ nocache: true });

  return useMemo(() => {
    const raw = (formData as { category?: unknown } | null | undefined)?.category;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return undefined;

    const list = Array.isArray(categories) ? (categories as any[]) : [];
    if (list.some((category) => String(category?.id) === value)) return value;

    const byName = list.find(
      (category) =>
        String(category?.name ?? "").trim().toLowerCase() === value.toLowerCase(),
    );
    return byName ? String(byName.id) : undefined;
  }, [formData, categories]);
};
