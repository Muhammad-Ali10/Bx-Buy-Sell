import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { uploadMultipleToCloudinary } from "@/lib/cloudinary";
import { ACQUISITION_CAPACITY_INFO } from "@/lib/acquisitionCapacity";

type CapacityStatus = "UNASSIGNED" | "IN_REVIEW" | "COMPLETED";

type DocumentStatus = "IN_REVIEW" | "VERIFIED" | "DECLINED";

interface CapacityUpload {
  id: string;
  name: string;
  url: string;
  status: DocumentStatus;
  note?: string | null;
  created_at?: string | null;
}

interface CapacityRecord {
  documents?: string[];
  uploads?: CapacityUpload[];
  verifiedFunds?: number | null;
  status?: CapacityStatus;
}

const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; color: string; dot: string }> = {
  IN_REVIEW: { label: "In Review", color: "#B45309", dot: "#F59E0B" },
  VERIFIED: { label: "Verified", color: "#15803D", dot: "#22C55E" },
  DECLINED: { label: "Declined", color: "#B91C1C", dot: "#EF4444" },
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Lets a buyer upload proof of funds and see where the review stands.
 *
 * The amount is never entered by the buyer — a moderator reads the documents
 * and records what they could actually verify, which is what sellers then see.
 */
export const AcquisitionCapacityUpload = () => {
  const [record, setRecord] = useState<CapacityRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const load = async () => {
    try {
      const res = await apiClient.getMyAcquisitionCapacity();
      setRecord(res.success ? ((res.data as CapacityRecord) ?? null) : null);
    } catch {
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const all = Array.from(fileList);
    const valid = all.filter((f) => f.size <= MAX_FILE_SIZE);
    if (all.length !== valid.length) {
      toast.error(`${all.length - valid.length} file(s) skipped — max 10MB each`);
    }
    if (valid.length === 0) return;

    setIsUploading(true);
    try {
      const results = await uploadMultipleToCloudinary(valid, "acquisition-capacity");
      // Pair each url back with the file the buyer chose, so the review table
      // can list it by the name they recognise rather than a Cloudinary id.
      const uploaded = results
        .map((result, index) => ({
          url: result.url as string,
          name: valid[index]?.name || "",
          ok: result.success && Boolean(result.url),
        }))
        .filter((entry) => entry.ok)
        .map(({ url, name }) => ({ url, name }));

      if (uploaded.length === 0) {
        toast.error("Upload failed. Please try again.");
        return;
      }

      const res = await apiClient.submitAcquisitionDocuments(uploaded);
      if (!res.success) {
        toast.error(res.error || "Could not submit the documents");
        return;
      }

      toast.success("Documents submitted. Our team will review them shortly.");
      await load();
    } catch (error) {
      console.error("Capacity upload error:", error);
      toast.error("Could not upload the documents");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border p-6 text-muted-foreground text-sm">
        Loading verification status…
      </div>
    );
  }

  const status = record?.status;
  const documents = record?.documents ?? [];
  const uploads = record?.uploads ?? [];

  return (
    <div className="rounded-2xl border border-border p-6">
      <h2 className="text-lg font-semibold">Acquisition Capacity</h2>
      <p className="mt-1 text-sm text-muted-foreground">{ACQUISITION_CAPACITY_INFO}</p>

      {/* Where the review currently stands. */}
      {status === "COMPLETED" ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent/10 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>
            Verified capital:{" "}
            <span className="font-semibold">
              ${Math.round(record?.verifiedFunds ?? 0).toLocaleString("en-US")}
            </span>
          </span>
        </div>
      ) : documents.length > 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm">
          <Clock className="h-4 w-4 flex-shrink-0" />
          <span>Your documents are with our team for review.</span>
        </div>
      ) : null}

      {/* Verified Documents — each file with its own outcome. A bank statement
          can check out while a screenshot does not, so one verdict over the
          whole pile would tell the buyer nothing about what to re-send. */}
      <div className="mt-6">
        <h4 className="m-0 text-[15px] font-semibold text-foreground">Verified Documents</h4>

        {uploads.length === 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-3 text-sm text-muted-foreground">
            <span>No documents uploaded yet</span>
            <span className="text-[#B45309]">Not Submitted</span>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Document Name", "Date", "Status"].map((heading) => (
                    <th
                      key={heading}
                      className="pb-2 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => {
                  const style = DOCUMENT_STATUS[upload.status] ?? DOCUMENT_STATUS.IN_REVIEW;
                  return (
                    <tr key={upload.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-3">
                        <a
                          href={upload.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[13px] font-medium text-foreground hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          <span className="truncate">{upload.name}</span>
                        </a>
                        {upload.status === "DECLINED" && upload.note && (
                          <p className="m-0 mt-1 text-[11.5px] text-[#B91C1C]">{upload.note}</p>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-[12.5px] text-muted-foreground">
                        {upload.created_at
                          ? new Date(upload.created_at).toLocaleDateString("en-US", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium"
                          style={{ color: style.color }}
                        >
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{ background: style.dot }}
                          />
                          {style.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <input
        type="file"
        multiple
        id="capacity-documents"
        className="hidden"
        disabled={isUploading}
        onChange={(e) => {
          void handleUpload(e.target.files);
          e.target.value = "";
        }}
      />
      <label
        htmlFor="capacity-documents"
        className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-accent"
      >
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground">
          {isUploading
            ? "Uploading…"
            : documents.length > 0
              ? "Upload additional proof of funds"
              : "Upload proof of funds (bank statement, portfolio, etc.)"}
        </span>
        {!isUploading && (
          <span className="mt-1 inline-flex items-center rounded-md border border-border bg-background px-4 py-1.5 text-sm font-medium">
            Select Files
          </span>
        )}
      </label>

      <p className="mt-3 text-xs text-muted-foreground">
        Adding new documents sends your case back for review, so the verified amount always
        reflects the latest evidence.
      </p>
    </div>
  );
};

export default AcquisitionCapacityUpload;
