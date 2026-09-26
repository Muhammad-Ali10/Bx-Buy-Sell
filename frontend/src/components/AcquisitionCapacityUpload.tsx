import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { openProtected } from "@/hooks/useProtectedUrl";
import AcquisitionCapacityCard from "@/components/AcquisitionCapacityCard";

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

/** The design's own limit, and the one the copy under the drop zone promises. */
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg"];
const ACCEPT_ATTR = "application/pdf,image/png,image/jpeg";

const LIME = "rgba(197, 253, 31, 1)";

const isAccepted = (file: File) =>
  ACCEPTED.some((extension) => file.name.toLowerCase().endsWith(extension));

/**
 * Proof of funds: choose the files, then send them, then wait.
 *
 * Two things about the flow are deliberate. Choosing a file no longer uploads
 * it — the buyer builds a list and presses Submit, so a mis-picked file can be
 * taken off the list instead of having to be explained to a moderator. And the
 * screen has a finished state of its own rather than a toast that scrolls away,
 * because "did that go through?" is the question this page exists to answer.
 *
 * The amount is never entered by the buyer: a moderator reads the documents and
 * records what they could actually verify, which is what sellers then see.
 */
export const AcquisitionCapacityUpload = () => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [record, setRecord] = useState<CapacityRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  /** Shared by the file dialog and the drop zone, so both reject the same things. */
  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const all = Array.from(fileList);
    const tooBig = all.filter((file) => file.size > MAX_FILE_SIZE);
    const wrongType = all.filter((file) => file.size <= MAX_FILE_SIZE && !isAccepted(file));
    const valid = all.filter((file) => file.size <= MAX_FILE_SIZE && isAccepted(file));

    if (tooBig.length) toast.error(`${tooBig.length} file(s) skipped — 20 MB maximum each`);
    if (wrongType.length) toast.error(`${wrongType.length} file(s) skipped — PDF, PNG or JPG only`);
    if (valid.length === 0) return;

    // The same file picked twice is one file, not two uploads of it.
    setPending((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...valid.filter((file) => !seen.has(`${file.name}:${file.size}`))];
    });
  };

  const removePending = (index: number) =>
    setPending((current) => current.filter((_, position) => position !== index));

  const handleSubmit = async () => {
    if (pending.length === 0) {
      toast.error("Choose at least one document first");
      return;
    }

    setIsUploading(true);
    try {
      // Through the server, one at a time: a proof of funds is readable by the
      // buyer and the team only, never on a public link.
      const results: Array<{ success: boolean; url?: string }> = [];
      for (const file of pending) {
        const response = await apiClient.uploadAcquisitionDocument(file);
        results.push({ success: response.success, url: response.data?.url });
      }
      // Pair each url back with the file the buyer chose, so the review table
      // can list it by the name they recognise rather than a Cloudinary id.
      const uploaded = results
        .map((result, index) => ({
          url: result.url as string,
          name: pending[index]?.name || "",
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

      setPending([]);
      await load();
      setSubmitted(true);
    } catch (error) {
      console.error("Capacity upload error:", error);
      toast.error("Could not upload the documents");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#E9EBF2] bg-white p-6 text-sm text-[#64748B]">
        Loading verification status…
      </div>
    );
  }

  const uploads = record?.uploads ?? [];

  return (
    <div
      className="rounded-2xl border border-[#E9EBF2] bg-white p-5 sm:p-8"
      style={{ fontFamily: "Lufga" }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-[14px] font-medium text-[#0F172A] hover:opacity-70"
      >
        <ArrowLeft className="h-4 w-4" />
        Go Back
      </button>

      <Stepper verificationDone={submitted} />

      {submitted ? (
        <Submitted
          // Back to Account Details, where Verify Now was pressed. `/dashboard`
          // is the create-listing wizard, which is where this used to land.
          onBackToDashboard={() => navigate("/profile")}
          onSubmitMore={() => setSubmitted(false)}
        />
      ) : (
        <>
          <h1 className="m-0 mt-6 text-[22px] font-semibold text-[#0F172A] sm:text-[26px]">
            Acquisition Capacity Verification
          </h1>
          <p className="m-0 mt-2 max-w-[640px] text-[12.5px] leading-relaxed text-[#64748B]">
            For verification purposes only. Your personal details will remain private and
            secure. All uploaded documents are reviewed confidentially by our verification
            team. These documents are <strong className="text-[#0F172A]">not visible</strong>{" "}
            to users of the platform.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {/* A real drop zone. It was a click-only label before, under copy
                  that invited a drag. */}
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  addFiles(event.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors"
                style={{
                  borderColor: dragging ? LIME : "rgba(0,0,0,0.15)",
                  background: dragging ? "rgba(197,253,31,0.08)" : "rgba(250,250,250,1)",
                }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                  <Upload className="h-4 w-4 text-[#0F172A]" />
                </span>
                <p className="m-0 mt-3 text-[14px] font-semibold text-[#0F172A]">
                  Drag &amp; Drop Your Files
                </p>
                <p className="m-0 mt-1 text-[11.5px] text-[#94A3B8]">
                  Upload PDF, PNG, or JPG files up to 20 MB
                </p>
                <span className="mt-4 inline-flex items-center rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-[12.5px] font-medium text-[#0F172A]">
                  Choose File
                </span>
              </div>

              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  // Cleared so choosing the same file again still fires onChange.
                  event.target.value = "";
                }}
              />

              {/* Chosen but not yet sent — removable while that is still true. */}
              {pending.length > 0 && (
                <ul className="m-0 mt-3 list-none space-y-2 p-0">
                  {pending.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}-${index}`}
                      className="flex items-center gap-2 rounded-lg bg-[#FAFAFA] px-3 py-2"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#94A3B8]" />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#0F172A]">
                        {file.name}
                      </span>
                      <span className="flex-shrink-0 text-[11px] text-[#94A3B8]">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removePending(index)}
                        className="flex-shrink-0 rounded p-1 hover:bg-black/5"
                      >
                        <X className="h-3.5 w-3.5 text-[#64748B]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isUploading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-medium text-black hover:brightness-95 disabled:opacity-60"
                style={{ background: LIME }}
              >
                {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isUploading ? "Uploading…" : "Submit New Documents"}
              </button>

              <VerifiedDocuments uploads={uploads} />
            </div>

            <HowItWorks />
          </div>
        </>
      )}
    </div>
  );
};

/** Upload, then review. The second is only done once something has been sent. */
const Stepper = ({ verificationDone }: { verificationDone: boolean }) => (
  <div className="mt-5 flex items-center justify-center">
    <Step label="Upload Documents" done />
    <span className="mx-2 mb-5 h-px w-16 bg-[#CBD5E1] sm:w-24" />
    <Step label="Verification Phase" done={verificationDone} index="02" />
  </div>
);

const Step = ({ label, done, index }: { label: string; done: boolean; index?: string }) => (
  <div className="flex flex-col items-center gap-1.5">
    <span
      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
      style={
        done
          ? { background: LIME, color: "#0F172A" }
          : { border: "1px solid rgba(0,0,0,0.2)", color: "rgba(0,0,0,0.4)" }
      }
    >
      {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index}
    </span>
    <span className="whitespace-nowrap text-[11.5px] text-[#64748B]">{label}</span>
  </div>
);

/**
 * Each file with its own outcome.
 *
 * A bank statement can check out while a screenshot does not, so one verdict
 * over the whole pile would tell the buyer nothing about what to re-send.
 */
const VerifiedDocuments = ({ uploads }: { uploads: CapacityUpload[] }) => (
  <div className="mt-6 rounded-2xl bg-[#FAFAFA] p-4 sm:p-5">
    <h2 className="m-0 text-[16px] font-semibold text-[#0F172A]">Verified Documents</h2>

    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[380px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#E9EBF2]">
            {["Document Name", "Date", "Status"].map((heading) => (
              <th key={heading} className="pb-2 text-[11.5px] font-medium text-[#94A3B8]">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {uploads.length === 0 ? (
            <tr>
              <td className="py-3 text-[13px] font-medium text-[#0F172A]">
                No Documents Uploaded Yet
              </td>
              <td className="py-3 text-[12.5px] text-[#94A3B8]">—</td>
              <td className="py-3 text-[12.5px] text-[#B45309]">Not Submitted</td>
            </tr>
          ) : (
            uploads.map((upload) => {
              const style = DOCUMENT_STATUS[upload.status] ?? DOCUMENT_STATUS.IN_REVIEW;
              return (
                <tr key={upload.id} className="border-b border-[#E9EBF2] last:border-0">
                  <td className="py-3 pr-3">
                    <a
                      href={upload.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        // A private file needs the viewer's token, which a
                        // plain link cannot send.
                        event.preventDefault();
                        void openProtected(upload.url);
                      }}
                      className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0F172A] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[#94A3B8]" />
                      <span className="truncate">{upload.name}</span>
                    </a>
                    {upload.status === "DECLINED" && upload.note && (
                      <p className="m-0 mt-1 text-[11.5px] text-[#B91C1C]">{upload.note}</p>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-[12.5px] text-[#64748B]">
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
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
);

const HowItWorks = () => (
  <aside className="rounded-2xl bg-[#FAFAFA] p-4 sm:p-5">
    <h2 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
      <span className="inline-block h-2 w-2 rounded-full bg-[#0F172A]" />
      How it works
    </h2>

    <p className="m-0 mt-3 text-[12px] leading-relaxed text-[#64748B]">
      Upload proof of funds, such as:
    </p>
    <ul className="m-0 mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] leading-relaxed text-[#64748B]">
      <li>bank account statements</li>
      <li>stock portfolio statements</li>
      <li>real estate ownership documents</li>
      <li>or other evidence</li>
    </ul>
    <p className="m-0 mt-2 text-[12px] leading-relaxed text-[#64748B]">
      demonstrating your financial capacity. Our verification team reviews all submissions
      securely within <strong className="text-[#0F172A]">48 hours</strong>. After
      verification, this rating will be displayed to sellers and callers.
    </p>

    {/* The scale a seller reads, shown here so the buyer can see what their
        documents are turned into. Not Verified is where everyone starts. */}
    <div className="mt-4">
      <AcquisitionCapacityCard verifiedFunds={null} listingPrice={null} />
    </div>

    <p className="m-0 mt-4 text-[11.5px] leading-relaxed text-[#94A3B8]">
      This rating is based on your verified capital compared to the listing price. Additional
      financing sources may not be reflected. A Moderate rating does not necessarily mean you
      cannot afford the acquisition. It only reflects the capital verified on the platform.
    </p>
  </aside>
);

const Submitted = ({
  onBackToDashboard,
  onSubmitMore,
}: {
  onBackToDashboard: () => void;
  onSubmitMore: () => void;
}) => (
  <div className="flex flex-col items-center py-12 text-center sm:py-16">
    <span
      className="flex h-16 w-16 items-center justify-center rounded-full"
      style={{ background: LIME }}
    >
      <Check className="h-8 w-8 text-[#0F172A]" strokeWidth={3} />
    </span>

    <h1 className="m-0 mt-5 text-[22px] font-semibold text-[#0F172A] sm:text-[26px]">
      Documents submitted successfully
    </h1>
    <p className="m-0 mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-[#64748B]">
      Your documents are now under review. We will contact you if any additional information
      is needed.
    </p>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onBackToDashboard}
        className="rounded-full bg-[#0F172A] px-6 py-3 text-[13px] font-medium text-white hover:opacity-90"
      >
        Return to Dashboard
      </button>
      <button
        type="button"
        onClick={onSubmitMore}
        className="rounded-full px-6 py-3 text-[13px] font-medium text-black hover:brightness-95"
        style={{ background: LIME }}
      >
        Submit More Documents
      </button>
    </div>
  </div>
);

export default AcquisitionCapacityUpload;
