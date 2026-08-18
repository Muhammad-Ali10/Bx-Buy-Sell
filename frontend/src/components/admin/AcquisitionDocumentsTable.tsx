import { useEffect, useState } from "react";
import { Eye, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/api";
import {
  DOC_STATUS_DOT,
  DOC_STATUS_LABEL,
  DOC_STATUS_TEXT,
  money,
  type CapacityCase,
  type CapacityUpload,
  type DocumentStatus,
} from "@/types/acquisitionCapacity";

const formatDate = (value?: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const looksLikeImage = (url: string) => /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);

/**
 * The documents behind one case, each judged on its own.
 *
 * A buyer may send a bank statement that holds up and a screenshot that does
 * not, so every row carries its own verdict, note and amount. The case total
 * above is the sum of the verified ones and is recomputed by the server after
 * each change here — it is never typed, so the headline figure cannot drift
 * away from the evidence.
 */
export const AcquisitionDocumentsTable = ({
  caseItem,
  onChanged,
  onMarkCompleted,
}: {
  caseItem: CapacityCase;
  onChanged: () => void | Promise<void>;
  onMarkCompleted: () => void | Promise<void>;
}) => {
  const documents = caseItem.uploads ?? [];
  const [drafts, setDrafts] = useState<Record<string, { note: string; capital: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CapacityUpload | null>(null);
  const [completing, setCompleting] = useState(false);

  // Reset the typed-but-unsaved values whenever a different case is opened.
  useEffect(() => {
    setDrafts({});
  }, [caseItem.id]);

  const draftFor = (doc: CapacityUpload) =>
    drafts[doc.id] ?? {
      note: doc.note ?? "",
      capital: doc.verifiedCapital != null ? String(doc.verifiedCapital) : "",
    };

  const setDraft = (doc: CapacityUpload, patch: Partial<{ note: string; capital: string }>) =>
    setDrafts((prev) => ({ ...prev, [doc.id]: { ...draftFor(doc), ...patch } }));

  const save = async (doc: CapacityUpload, status: DocumentStatus) => {
    const draft = draftFor(doc);
    const trimmed = draft.capital.replace(/[^0-9.]/g, "");
    const capital = trimmed === "" ? null : Number(trimmed);

    if (capital !== null && Number.isNaN(capital)) {
      toast.error("Verified capital must be a number");
      return;
    }

    setSavingId(doc.id);
    try {
      const response = await apiClient.reviewAcquisitionDocument(
        doc.id,
        status,
        draft.note.trim() === "" ? null : draft.note.trim(),
        capital,
      );
      if (!response.success) {
        throw new Error(response.error || "Could not save this document");
      }
      toast.success("Document updated");
      await onChanged();
    } catch (error: any) {
      toast.error(error.message || "Could not save this document");
    } finally {
      setSavingId(null);
    }
  };

  const awaiting = documents.filter((doc) => doc.status === "IN_REVIEW").length;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Verified Documents</h2>

        {caseItem.status !== "COMPLETED" && (
          <Button
            className="gap-2 rounded-full bg-accent text-black hover:bg-accent/90"
            disabled={awaiting > 0 || completing || documents.length === 0}
            title={
              awaiting > 0
                ? `${awaiting} document${awaiting === 1 ? "" : "s"} still awaiting a verdict`
                : undefined
            }
            onClick={async () => {
              setCompleting(true);
              try {
                await onMarkCompleted();
              } finally {
                setCompleting(false);
              }
            }}
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Mark as completed
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          This buyer has not uploaded any documents yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Document Name</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Notes</th>
                <th className="px-3 py-2 font-medium">Verified Capital</th>
                <th className="px-3 py-2 font-medium">View</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const draft = draftFor(doc);
                const saving = savingId === doc.id;

                return (
                  <tr key={doc.id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[180px] truncate px-3 py-3" title={doc.name}>
                      {doc.name}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {formatDate(doc.created_at)}
                    </td>

                    <td className="px-3 py-3">
                      <Select
                        value={doc.status}
                        onValueChange={(value) => save(doc, value as DocumentStatus)}
                        disabled={saving}
                      >
                        <SelectTrigger className="h-8 w-[130px]">
                          <span className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${DOC_STATUS_DOT[doc.status]}`} />
                            <span className={DOC_STATUS_TEXT[doc.status]}>
                              {DOC_STATUS_LABEL[doc.status]}
                            </span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VERIFIED">Verified</SelectItem>
                          <SelectItem value="DECLINED">Declined</SelectItem>
                          <SelectItem value="IN_REVIEW">In Review</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    <td className="px-3 py-3">
                      <Input
                        value={draft.note}
                        onChange={(event) => setDraft(doc, { note: event.target.value })}
                        onBlur={() => {
                          if ((doc.note ?? "") !== draft.note.trim()) save(doc, doc.status);
                        }}
                        placeholder="—"
                        className="h-8 w-[180px]"
                      />
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={draft.capital}
                          onChange={(event) => setDraft(doc, { capital: event.target.value })}
                          onBlur={() => {
                            const current = doc.verifiedCapital != null ? String(doc.verifiedCapital) : "";
                            if (current !== draft.capital.trim()) save(doc, doc.status);
                          }}
                          placeholder="$0"
                          inputMode="numeric"
                          className="h-8 w-[110px]"
                        />
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setPreview(doc)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted"
                        aria-label={`View ${doc.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {documents.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Verified total:{" "}
          <span className="font-semibold text-foreground">
            {caseItem.verifiedFunds != null ? money(caseItem.verifiedFunds) : "—"}
          </span>{" "}
          — the sum of the documents marked Verified.
        </p>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.name}</DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="flex flex-col gap-3">
              {looksLikeImage(preview.url) ? (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-h-[70vh] w-full rounded-lg object-contain"
                />
              ) : (
                // Anything that is not an image — a PDF, a spreadsheet — is
                // shown in a frame, with a link out for formats the browser
                // will not render inline.
                <iframe
                  src={preview.url}
                  title={preview.name}
                  className="h-[70vh] w-full rounded-lg border border-border"
                />
              )}
              <a
                href={preview.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-accent underline underline-offset-2"
              >
                Open in a new tab
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
