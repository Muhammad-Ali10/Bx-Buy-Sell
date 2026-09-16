import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AD_FIELD_HINTS } from "@/lib/adFieldHints";
import { useAdFieldHints, useSaveAdFieldHints } from "@/hooks/useAdFieldHints";

/**
 * The ⓘ wording for the figures on a published ad that no question stands
 * behind.
 *
 * Every other ⓘ on an ad belongs to a question, so its wording is written in
 * that question's "Public Text Hint" box. These figures are worked out from the
 * table above and from the asking price — there is no question to write them
 * in, and their sentences lived in the page's code. An administrator filling in
 * hints saw nothing change beside exactly these figures, which is what this is
 * for.
 *
 * Leaving a box empty is not a blank explanation: the ad keeps the sentence it
 * already had.
 */
export const AdFieldHintsPanel = () => {
  const { data: saved, isLoading } = useAdFieldHints();
  const save = useSaveAdFieldHints();
  const [draft, setDraft] = useState<Record<string, string>>({});

  // What is on the server is what the boxes start with — until the
  // administrator types, and then their words stay put through any refetch.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || !saved) return;
    setDraft(Object.fromEntries(AD_FIELD_HINTS.map(({ key }) => [key, saved[key] ?? ""])));
  }, [saved, touched]);

  const onSave = () => {
    save.mutate(
      Object.fromEntries(AD_FIELD_HINTS.map(({ key }) => [key, (draft[key] ?? "").trim()])),
      {
        onSuccess: () => {
          setTouched(false);
          toast.success("The hints on the ad have been saved.");
        },
        onError: (error: any) =>
          toast.error(error?.message || "The hints could not be saved."),
      },
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <h3 className="text-base sm:text-lg font-bold text-foreground">
          Info hints on the ad
        </h3>
        <Button
          onClick={onSave}
          disabled={save.isPending || isLoading}
          className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 h-9 text-sm w-full sm:w-auto"
        >
          {save.isPending ? "Saving…" : "Save Hints"}
        </Button>
      </div>
      <p className="text-xs sm:text-sm text-muted-foreground mb-4">
        These figures are worked out from the table above, so they have no
        question of their own. What you write here is shown under the ⓘ beside
        them on a published ad. Every other ⓘ is the matching question's
        “Public Text Hint”. Leave a box empty and the ad keeps its own wording.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {AD_FIELD_HINTS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`ad-hint-${key}`} className="text-sm font-medium">
              {label}
            </Label>
            <Textarea
              id={`ad-hint-${key}`}
              rows={2}
              maxLength={400}
              placeholder="Shown under the ⓘ beside this figure"
              value={draft[key] ?? ""}
              onChange={(event) => {
                setTouched(true);
                setDraft((prev) => ({ ...prev, [key]: event.target.value }));
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
