import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CurrencySelect, getCurrencySymbol } from "@/components/CurrencySelect";
import { toast } from "sonner";
import {
  calculateNetProfitForColumn,
  displayRowLabel,
  GROSS_REVENUE_ROW,
  OVERALL_COSTS_ROW,
  REVENUE_ROW,
  FINANCIALS_TEMPLATE_UPDATED_EVENT,
  displayColumnLabel,
  fetchAdminFinancialsTemplate,
  loadAdminFinancialsTemplate,
  normalizeFinancialData,
  normalizeRowLabels,
  syncFinancialGrid,
  type AdminFinancialsTemplate,
  type FinancialColumn,
  canonicalFinancialTable,
  sellerFinancialColumns,
  financialColumnsToStore,
  financialsReminders,
  isOpenYear,
  dataThroughLimits,
  clampDataThrough,
  coversFullYear,
  coverageLabel,
} from "@/lib/financialTableUtils";
import { usePersistOnUnmount } from "@/hooks/usePersistOnUnmount";
import { sanitizeNumberInput } from "@/lib/numberInput";

interface FinancialsStepProps {
  formData?: any;
  isEditListing?: boolean;
  onNext: (data: any) => void;
  onBack: () => void;
  onPersist?: (data: any) => void;
}

// Get today's date in DD.MM.YYYY format
const getTodayDate = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
};

const CURRENT_YEAR = new Date().getFullYear();

/** Only digits and a single decimal point (blocks + - ` e and other symbols). */
// The same rule the rest of the wizard runs, rather than a second copy of it
// here — this one still allowed a decimal point after the shared one stopped.
const sanitizeNumber = sanitizeNumberInput;

const isoToDmy = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};

const dmyToIso = (dmy: string): string => {
  const m = dmy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/** Legacy tables / localStorage may omit the simple-mode aggregate row. */
const insertOverallCostsRow = (labels: string[]): string[] => {
  if (labels.includes(OVERALL_COSTS_ROW)) return labels;
  const revenueIndex = labels.indexOf(REVENUE_ROW);
  const grossRevenueIndex = labels.indexOf(GROSS_REVENUE_ROW);
  const idx = revenueIndex !== -1 ? revenueIndex : grossRevenueIndex;
  if (idx === -1) return [REVENUE_ROW, OVERALL_COSTS_ROW, ...labels];

  // If we have legacy "Gross Revenue", treat it as "Revenue" for display/state.
  const normalized = labels.map((l) => (l === GROSS_REVENUE_ROW ? REVENUE_ROW : l));
  const normalizedRevenueIndex = normalized.indexOf(REVENUE_ROW);
  if (normalizedRevenueIndex === -1) {
    return [REVENUE_ROW, OVERALL_COSTS_ROW, ...normalized];
  }

  return [
    ...normalized.slice(0, normalizedRevenueIndex + 1),
    OVERALL_COSTS_ROW,
    ...normalized.slice(normalizedRevenueIndex + 1),
  ];
};

const padOverallCostsData = (
  data: Record<string, Record<string, string>>,
  cols: Array<{ key: string }>,
): Record<string, Record<string, string>> => {
  if (data[OVERALL_COSTS_ROW]) return data;
  const row: Record<string, string> = {};
  cols.forEach((c) => {
    row[c.key] = "";
  });
  return { ...data, [OVERALL_COSTS_ROW]: row };
};

/**
 * The stored columns and every figure, and the four of them the form shows.
 *
 * What is stored can hold more years than the form shows: the listing page may
 * still be showing last year's window after the form has moved on to the new
 * year, so a year the form no longer draws keeps its figures.
 */
const tableColumnsFor = (stored: FinancialColumn[], today: Date = new Date()) =>
  financialColumnsToStore(stored, sellerFinancialColumns(stored, today));

const defaultRowLabels = [
  REVENUE_ROW,
  OVERALL_COSTS_ROW,
  "Net Revenue",
  "Cost of Goods",
  "Advertising costs",
  "Freelancer/Employees",
  "Transaction Costs",
  "Other Expenses",
];

const resolveRowsForMode = (
  rows: string[],
  mode: "simple" | "detailed",
  fromAdmin: boolean,
): string[] => {
  const normalized = normalizeRowLabels(rows);
  if (mode === "simple") {
    return insertOverallCostsRow(normalized);
  }
  if (fromAdmin) {
    return normalized;
  }
  return insertOverallCostsRow(normalized);
};

const buildDefaultTableState = (rows: string[] = defaultRowLabels) => ({
  rowLabels: rows,
  columnLabels: [] as FinancialColumn[],
  financialData: syncFinancialGrid(rows, tableColumnsFor([]), {}),
});

/**
 * The table before the listing's own figures are loaded.
 *
 * The admin template supplies the rows and nothing else: its columns carried a
 * date — 08.06.2026, the day it was saved — that every listing then took for
 * its own. The years come from the calendar and the date from the listing.
 */
const buildInitialTableState = (isEditListing: boolean) => {
  const adminTemplate = isEditListing ? loadAdminFinancialsTemplate() : null;
  return buildDefaultTableState(
    adminTemplate ? normalizeRowLabels(adminTemplate.rowLabels) : defaultRowLabels,
  );
};

export const FinancialsStep = ({
  formData: parentFormData,
  isEditListing = false,
  onNext,
  onBack,
  onPersist,
}: FinancialsStepProps) => {
  const initialTable = buildInitialTableState(isEditListing);
  const [financialType, setFinancialType] = useState<"detailed" | "simple">("detailed");
  const [columnLabels, setColumnLabels] = useState<FinancialColumn[]>(initialTable.columnLabels);
  const [rowLabels, setRowLabels] = useState<string[]>(initialTable.rowLabels);
  const [financialData, setFinancialData] = useState<Record<string, Record<string, string>>>(
    initialTable.financialData,
  );
  const [templateLoading, setTemplateLoading] = useState(!isEditListing);
  const financialDataRef = useRef(financialData);
  financialDataRef.current = financialData;
  const columnLabelsRef = useRef(columnLabels);
  columnLabelsRef.current = columnLabels;

  // The four the seller fills in, and everything that is saved.
  const shownColumns = sellerFinancialColumns(columnLabels);
  const tableColumns = financialColumnsToStore(columnLabels, shownColumns);
  // A date of 31 December waiting for the seller to confirm it.
  const [closingYear, setClosingYear] = useState<{ col: FinancialColumn; dmy: string } | null>(null);
  // Kept while the dialog fades out, so its text does not go blank.
  const lastClosingYear = useRef<number | undefined>(undefined);
  if (closingYear) lastClosingYear.current = closingYear.col.year;
  const closingYearLabel = closingYear?.col.year ?? lastClosingYear.current;

  // The listing's currency. Figures are entered and stored in it exactly as
  // typed; what they come to in other currencies is worked out by the server
  // from the ECB rates.
  const [currency, setCurrency] = useState<string>(parentFormData?.currency || "USD");
  // Inline editing state for the "as-of" date column (#4) and custom rows (#6).
  // Which column's date is open for editing. Was a single boolean, so only the
  // year-to-date column could ever be changed.
  const [editingDateKey, setEditingDateKey] = useState<string | null>(null);
  const [customRows, setCustomRows] = useState<string[]>([]);
  const [addingRow, setAddingRow] = useState(false);
  const [newRowName, setNewRowName] = useState("");

  // Restore the seller's saved currency when editing an existing listing.
  useEffect(() => {
    if (parentFormData?.currency) {
      setCurrency(parentFormData.currency);
    }
  }, [parentFormData?.currency]);

  /**
   * Records how far a column's figures run.
   *
   * Kept apart from the label: the label names the year, the date says how
   * much of it is covered. Storing the date *as* the label is what made a
   * column's meaning depend on its position.
   */
  const setColumnDataThrough = (col: FinancialColumn, dmy: string) => {
    // Kept inside the column's year and never after today.
    const date = clampDataThrough(col, dmy);
    if (!date) return;
    if (date !== col.dataThrough && coversFullYear(date)) {
      // Closing a year is final — the pencil goes with it — so it is asked first.
      setClosingYear({ col, dmy: date });
      return;
    }
    saveColumnDate(col, date);
  };

  const saveColumnDate = (col: FinancialColumn, date: string) => {
    setColumnLabels((prev) =>
      financialColumnsToStore(prev, [
        { ...col, kind: col.kind === "forecast" ? "forecast" : "ytd", dataThrough: date },
      ]),
    );
  };

  const addCustomRow = () => {
    const name = newRowName.trim();
    if (!name) return;
    if (rowLabels.includes(name)) {
      toast.error("A row with this name already exists");
      return;
    }
    const newRows = [...rowLabels, name];
    setRowLabels(newRows);
    setFinancialData((prev) => syncFinancialGrid(newRows, tableColumns, prev));
    setCustomRows((prev) => [...prev, name]);
    setNewRowName("");
    setAddingRow(false);
  };

  const removeCustomRow = (label: string) => {
    setRowLabels((prev) => prev.filter((r) => r !== label));
    setFinancialData((prev) => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
    setCustomRows((prev) => prev.filter((r) => r !== label));
  };

  /**
   * Loads a table in whatever shape it was stored.
   *
   * Filed by calendar year on the way in: older listings keep their figures
   * under keys like "2023" and "today" that no longer say which year they are
   * about, and the form only ever works with years.
   */
  const applyTable = (
    rows: string[],
    cols: FinancialColumn[],
    data: Record<string, Record<string, string>>,
    type: "simple" | "detailed" = financialType,
    fromAdmin = false,
  ) => {
    const resolvedRows = resolveRowsForMode(rows, type, fromAdmin);
    const table = canonicalFinancialTable(cols, data);
    const allColumns = tableColumnsFor(table.columns);
    setRowLabels(resolvedRows);
    setColumnLabels(table.columns);
    setFinancialData(
      padOverallCostsData(syncFinancialGrid(resolvedRows, allColumns, table.financialData), allColumns),
    );
    setFinancialType(type);
  };

  /**
   * The admin template's rows around the seller's own figures.
   *
   * Only the rows. The template's columns and their date are not the
   * listing's; the listing brings its own, or starts from the calendar.
   */
  const applyAdminTemplate = (
    adminTemplate: AdminFinancialsTemplate,
    draftFinancialData?: Record<string, Record<string, string>>,
    draftColumns?: FinancialColumn[],
  ) => {
    const baseRows = normalizeRowLabels(adminTemplate.rowLabels);
    let data = normalizeFinancialData(draftFinancialData ?? parentFormData?.financialData ?? {});
    const ownColumns = draftColumns ?? parentFormData?.columnLabels;
    const hasOwnColumns = Array.isArray(ownColumns) && ownColumns.length > 0;
    if (!hasOwnColumns) {
      // A draft saved without its columns filed its figures under the
      // template's keys. Those keys say where the figures are, but the
      // template's columns — and their date — are not taken on.
      data = canonicalFinancialTable(adminTemplate.columnLabels, data).financialData;
    }
    applyTable(
      baseRows,
      hasOwnColumns ? ownColumns : [],
      data,
      parentFormData?.financialType === "simple" ? "simple" : "detailed",
      true,
    );
  };

  const syncTableFromSources = (
    draftFinancialData?: Record<string, Record<string, string>>,
    adminTemplate?: AdminFinancialsTemplate | null,
  ) => {
    if (
      isEditListing &&
      parentFormData?.financialsFromListing &&
      parentFormData?.financialData &&
      Array.isArray(parentFormData?.rowLabels) &&
      parentFormData.rowLabels.length > 0
    ) {
      applyTable(
        parentFormData.rowLabels,
        parentFormData.columnLabels || [],
        normalizeFinancialData(parentFormData.financialData),
        parentFormData.financialType === "simple" ? "simple" : "detailed",
        false,
      );
      return;
    }

    const template = adminTemplate ?? loadAdminFinancialsTemplate();
    if (template) {
      applyAdminTemplate(template, draftFinancialData);
      return;
    }

    // New listings must follow admin template from server — never stale draft columns/rows.
    if (!isEditListing) return;

    if (parentFormData?.financialData && parentFormData?.rowLabels) {
      applyTable(
        parentFormData.rowLabels,
        parentFormData.columnLabels || [],
        normalizeFinancialData(parentFormData.financialData),
        parentFormData.financialType === "simple" ? "simple" : "detailed",
        false,
      );
    }
  };

  useLayoutEffect(() => {
    if (!isEditListing) return;
    syncTableFromSources();
    setTemplateLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditListing) return;
    let cancelled = false;
    void fetchAdminFinancialsTemplate(true, { serverOnly: true }).then((template) => {
      if (cancelled) return;
      if (template) {
        applyAdminTemplate(template, parentFormData?.financialData);
      }
      setTemplateLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditListing]);

  useEffect(() => {
    const onTemplateUpdated = () => {
      if (!isEditListing) {
        setTemplateLoading(true);
        void fetchAdminFinancialsTemplate(true, { serverOnly: true }).then((template) => {
          if (template) {
            applyAdminTemplate(template, financialDataRef.current, tableColumnsFor(columnLabelsRef.current));
          }
          setTemplateLoading(false);
        });
      }
    };
    window.addEventListener(FINANCIALS_TEMPLATE_UPDATED_EVENT, onTemplateUpdated);
    return () => window.removeEventListener(FINANCIALS_TEMPLATE_UPDATED_EVENT, onTemplateUpdated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditListing]);

  // Handle cell value change
  const handleCellChange = (row: string, col: string, value: string) => {
    setFinancialData(prev => ({
      ...prev,
      [row]: {
        ...prev[row] || {},
        [col]: sanitizeNumber(value)
      }
    }));
  };

  // Calculate Net Profit for a column. Shared with the listing page so the
  // seller is shown the same figure the buyer will be.
  // Keep full precision; rounding happens at display time (in the shown currency).
  const calculateNetProfit = (col: string) =>
    String(calculateNetProfitForColumn({ financialData, rowLabels, financialType }, col));

  const visibleDataRows =
    financialType === "simple"
      ? rowLabels.filter((row) => row === REVENUE_ROW || row === OVERALL_COSTS_ROW)
      : rowLabels.filter((row) => row !== OVERALL_COSTS_ROW);


  // Validate and continue
  usePersistOnUnmount(onPersist, () => ({
    financialType,
    rowLabels,
    // Every year with its date — this is where a new listing's year to date
    // gets today's date stored with it.
    columnLabels: tableColumnsFor(columnLabelsRef.current),
    financialData,
    currency,
    financialsFromListing: isEditListing ? parentFormData?.financialsFromListing : false,
  }));

  const handleContinue = () => {
    const isFilled = (row: string) =>
      tableColumns.some(
        (col) =>
          !!financialData[row]?.[col.key] &&
          parseFloat(financialData[row][col.key] || "0") !== 0,
      );

    // Mandatory (#9): at least Revenue AND one cost field, from any year.
    const hasRevenue = isFilled(REVENUE_ROW) || isFilled(GROSS_REVENUE_ROW);
    const costRows =
      financialType === "simple"
        ? [OVERALL_COSTS_ROW]
        : visibleDataRows.filter((r) => !r.toLowerCase().includes("revenue"));
    const hasCost = costRows.some((r) => isFilled(r));

    if (!hasRevenue) {
      toast.error("Please enter Revenue for at least one year.");
      return;
    }
    if (!hasCost) {
      toast.error("Please enter at least one cost field (any year).");
      return;
    }

    // Output the current table as-is so per-listing edits (custom date/rows) persist.
    onNext({
      financialType,
      rowLabels,
      columnLabels: tableColumns,
      financialData,
      currency,
      financialsFromListing: isEditListing ? parentFormData?.financialsFromListing : false,
    });
  };

  // Compact column width so the table stays a reasonable size.
  const columnWidth = 150;
  const gridWidth = columnWidth * (shownColumns.length + 1);

  const currencySymbol = getCurrencySymbol(currency);
  const reminders = financialsReminders(shownColumns);
  const formatAmount = (value: string): string => {
    const n = parseFloat(value || "0");
    if (Number.isNaN(n)) return "0";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };

  /**
   * A stored figure as a whole number, which is all this field takes.
   *
   * Earlier builds converted what the seller typed into US dollars and kept
   * the result to full precision — 1161.9408595341315 behind a round €1,000.
   * Shown raw in a field that strips the decimal point, the seller's next
   * keystroke would turn one of those into 11619408595341315. Rounding on the
   * way out means what is in the box is always something they could have
   * typed.
   */
  const asWholeUnits = (stored: string): string => {
    const n = parseFloat(stored || "");
    if (Number.isNaN(n)) return "";
    return String(Math.round(n));
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        borderRadius: '24px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        background: 'rgba(255, 255, 255, 1)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Heading */}
      <h2
        style={{
          fontFamily: 'Lufga',
          fontWeight: 500,
          fontStyle: 'normal',
          fontSize: '26px',
          lineHeight: '140%',
          letterSpacing: '0%',
          color: 'rgba(0, 0, 0, 1)',
          marginBottom: '12px',
        }}
      >
        Financials
      </h2>

      {/* Description */}
      <p
        style={{
          fontFamily: 'Lufga',
          fontWeight: 500,
          fontStyle: 'normal',
          fontSize: '16px',
          lineHeight: '140%',
          letterSpacing: '0%',
          color: 'rgba(0, 0, 0, 0.5)',
          marginBottom: '24px',
        }}
      >
        Choose if you want to show numbers detailed or simple. We recommend strongly detailed!
      </p>

      {/* Toggle Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={() => {
            setFinancialType("simple");
            setRowLabels((prev) => insertOverallCostsRow(prev));
            setFinancialData((prev) =>
              padOverallCostsData(prev, tableColumns),
            );
          }}
          style={{
            width: '160px',
            height: '44px',
            borderRadius: '40px',
            paddingTop: '13px',
            paddingRight: '16px',
            paddingBottom: '13px',
            paddingLeft: '16px',
            background: financialType === "simple" ? 'rgba(198, 254, 31, 1)' : 'rgba(238, 238, 238, 1)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '160%',
              letterSpacing: '0%',
              textAlign: 'center',
              color: 'rgba(0, 0, 0, 1)',
            }}
          >
            Simple
          </span>
        </button>
        <button
          onClick={() => {
            const adminTemplate = !isEditListing ? loadAdminFinancialsTemplate() : null;
            const templateRows = adminTemplate
              ? normalizeRowLabels(adminTemplate.rowLabels)
              : rowLabels.filter((row) => row !== OVERALL_COSTS_ROW);
            const baseRows = [
              ...templateRows,
              ...customRows.filter((r) => !templateRows.includes(r)),
            ];
            setFinancialType("detailed");
            setRowLabels(baseRows);
            setFinancialData((prev) => syncFinancialGrid(baseRows, tableColumns, prev));
          }}
          style={{
            width: '160px',
            height: '44px',
            borderRadius: '40px',
            paddingTop: '13px',
            paddingRight: '16px',
            paddingBottom: '13px',
            paddingLeft: '16px',
            background: financialType === "detailed" ? 'rgba(198, 254, 31, 1)' : 'rgba(238, 238, 238, 1)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '14px',
              lineHeight: '160%',
              letterSpacing: '0%',
              textAlign: 'center',
              color: 'rgba(0, 0, 0, 1)',
            }}
          >
            Detailed
          </span>
        </button>
      </div>

      {templateLoading && (
        <p
          style={{
            fontFamily: 'Lufga',
            fontSize: '14px',
            color: 'rgba(0, 0, 0, 0.5)',
            marginBottom: '12px',
          }}
        >
          Loading financial table from admin settings…
        </p>
      )}

      {/* Only for a year that is over and still open — from 1 January until
          the seller sets it to 31 December. During the year it is normal that
          the figures only run to today. Only the seller sees it. */}
      {reminders.length > 0 && (
        <div
          style={{
            width: '100%',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            background: 'rgba(254, 243, 199, 1)',
            border: '1px solid rgba(251, 211, 141, 1)',
            fontFamily: 'Lufga',
            fontWeight: 500,
            fontSize: '13px',
            lineHeight: '150%',
            color: 'rgba(120, 53, 15, 1)',
          }}
        >
          {reminders.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}

      {/* Profit & Loss Table Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          opacity: templateLoading ? 0.5 : 1,
          pointerEvents: templateLoading ? 'none' : 'auto',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
          overflowX: 'auto',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          position: 'relative',
        }}
      >
        {/* Black Header Section */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%', minWidth: `${gridWidth}px`,
            minHeight: '58px',
            backgroundColor: '#000000',
            padding: '8px 16px',
            marginBottom: 0,
          }}
        >
          <h3
            className="font-lufga text-white text-center px-2"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontSize: '22px',
              lineHeight: '100%',
              color: 'rgba(255, 255, 255, 1)',
            }}
          >
            Profit & Loss
          </h3>
          <div
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontFamily: 'Lufga', fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>
              Currency
            </span>
            <CurrencySelect value={currency} onChange={setCurrency} />
          </div>
        </div>

        {/* Green Header Row */}
        <div
          className="flex"
          style={{
            width: '100%', minWidth: `${gridWidth}px`,
            height: '48px',
            backgroundColor: '#C6FE1F',
          }}
        >
          <div
            className="flex items-center px-3"
            style={{
              flex: '1 1 0px', minWidth: 0,
              alignSelf: 'stretch',
              border: '1px solid rgba(255, 255, 255, 1)',
            }}
          >
            <span
              className="font-lufga text-black"
              style={{ fontFamily: 'Lufga', fontWeight: 700, fontSize: '15px', color: 'rgba(0, 0, 0, 1)' }}
            >
              Timeframe
            </span>
          </div>
          {shownColumns.map((col) => (
            <div
              key={col.key}
              className="flex items-center justify-center"
              style={{
                flex: '1 1 0px', minWidth: 0,
                alignSelf: 'stretch',
                border: '1px solid rgba(255, 255, 255, 1)',
              }}
            >
              {editingDateKey === col.key ? (
                <input
                  type="date"
                  autoFocus
                  defaultValue={dmyToIso(col.dataThrough || "")}
                  // Within the column's own year and never after today: in
                  // September there is no 31 December to choose yet, and a
                  // date in the future would pass a part year off as a whole
                  // one — the exact thing these dates exist to prevent.
                  min={dataThroughLimits(col)?.min}
                  max={dataThroughLimits(col)?.max}
                  onBlur={(e) => {
                    const dmy = isoToDmy(e.target.value);
                    if (dmy) setColumnDataThrough(col, dmy);
                    setEditingDateKey(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // Or the same Enter goes on to press the first button of
                      // the dialog that closing a year opens — "Cancel".
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") setEditingDateKey(null);
                  }}
                  style={{
                    width: '90%',
                    fontFamily: 'Lufga',
                    fontSize: '12px',
                    border: '1px solid rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    padding: '2px 4px',
                  }}
                />
              ) : (
                <span
                  className="font-lufga text-black text-center px-1 inline-flex flex-col items-center"
                  style={{ fontFamily: 'Lufga', fontWeight: 700, fontSize: '14px', color: 'rgba(0, 0, 0, 1)' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {displayColumnLabel(col)}
                    {/* Only on a year still open: the running year, and last
                        year until it is closed off at 31 December — so for a
                        while after New Year there are two. A completed year
                        and a forecast have no date and nothing to edit. */}
                    {isOpenYear(col) && (
                        <button
                          type="button"
                          onClick={() => setEditingDateKey(col.key)}
                          title="Edit the date these figures run to"
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                        >
                          <Pencil style={{ width: 12, height: 12 }} />
                        </button>
                      )}
                  </span>
                  {/* Shown only while the year is unfinished; on a whole year
                      the date says nothing the heading does not. */}
                  {coverageLabel(col) && (
                    <span style={{ fontWeight: 500, fontSize: '11px', opacity: 0.75 }}>
                      {coverageLabel(col)}
                    </span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Data Rows */}
        <div>
          {visibleDataRows.map((row) => {
            const isGrossRevenue = row === REVENUE_ROW || row === GROSS_REVENUE_ROW;
            const bgColor = isGrossRevenue ? 'rgba(66, 66, 66, 1)' : '#F3F8E8';
            const textColor = isGrossRevenue ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 1)';
                
            return (
              <div 
                key={row}
                className="flex"
                style={{
                  width: '100%', minWidth: `${gridWidth}px`,
                  minHeight: '46px',
                  backgroundColor: bgColor,
                }}
              >
                <div 
                  className="flex items-center justify-between gap-1 px-3"
                  style={{
                    flex: '1 1 0px', minWidth: 0,
                    minHeight: '46px',
                    border: '1px solid rgba(255, 255, 255, 1)',
                  }}
                >
                  <span
                    className="font-lufga break-words"
                    style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '13px', lineHeight: 1.2, color: textColor }}
                  >
                    {displayRowLabel(row)}
                  </span>
                  {customRows.includes(row) && (
                    <button
                      type="button"
                      onClick={() => removeCustomRow(row)}
                      title="Remove row"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: textColor, padding: 0, display: 'inline-flex' }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  )}
                </div>
                {shownColumns.map((col) => (
                  <div 
                    key={col.key}
                    className="flex items-center justify-center"
                    style={{
                      flex: '1 1 0px', minWidth: 0,
                      alignSelf: 'stretch',
                      backgroundColor: bgColor,
                      border: '1px solid rgba(255, 255, 255, 1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '92%' }}>
                      <span style={{ fontFamily: 'Lufga', fontSize: '12px', color: textColor, opacity: 0.55 }}>{currencySymbol}</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={asWholeUnits(financialData[row]?.[col.key] || "")}
                        onChange={(e) =>
                          handleCellChange(row, col.key, sanitizeNumber(e.target.value))
                        }
                        className="text-center"
                        style={{
                          width: '100%',
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '13px',
                          height: '32px',
                          borderRadius: '8px',
                          color: textColor,
                          background: isGrossRevenue ? 'rgba(255,255,255,0.08)' : '#ffffff',
                          border: isGrossRevenue ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(0,0,0,0.12)',
                        }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Add custom cost row (#6) — detailed mode */}
          {financialType === "detailed" && (
            <div
              className="flex items-center"
              style={{ width: '100%', minWidth: `${gridWidth}px`, minHeight: '46px', backgroundColor: '#F3F8E8', padding: '6px 12px', gap: '8px' }}
            >
              {addingRow ? (
                <>
                  <Input
                    autoFocus
                    value={newRowName}
                    onChange={(e) => setNewRowName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCustomRow();
                      if (e.key === "Escape") { setAddingRow(false); setNewRowName(""); }
                    }}
                    placeholder="Row name (e.g. Software)"
                    style={{ height: '32px', width: '220px', fontFamily: 'Lufga', fontSize: '13px' }}
                  />
                  <Button type="button" onClick={addCustomRow} style={{ height: '32px', padding: '0 14px' }}>
                    Add
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setAddingRow(false); setNewRowName(""); }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Lufga', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingRow(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#000000', color: '#C6FE1F', border: 'none', borderRadius: '20px', padding: '7px 20px', cursor: 'pointer', fontFamily: 'Lufga', fontWeight: 600, fontSize: '13px' }}
                >
                  Add row
                </button>
              )}
            </div>
          )}

          {/* Net Profit Row */}
          <div 
            className="flex"
            style={{
              width: '100%', minWidth: `${gridWidth}px`,
              minHeight: '46px',
              backgroundColor: '#C6FE1F',
            }}
          >
            <div 
              className="flex items-center px-4"
              style={{
                flex: '1 1 0px', minWidth: 0,
                alignSelf: 'stretch',
                border: '1px solid rgba(255, 255, 255, 1)',
              }}
            >
              <span 
                className="font-lufga text-black break-words"
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 700,
                  fontStyle: 'normal',
                  fontSize: '16px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)',
                }}
              >
                Net Profit
              </span>
            </div>
            {shownColumns.map((col) => {
              const profit = calculateNetProfit(col.key);
              const profitNum = parseFloat(profit) || 0;
              return (
                <div 
                  key={col.key}
                  className="flex items-center justify-center"
                  style={{
                    flex: '1 1 0px', minWidth: 0,
                    alignSelf: 'stretch',
                    backgroundColor: '#C6FE1F',
                    border: '1px solid rgba(255, 255, 255, 1)',
                  }}
                >
                  <span
                    className="font-lufga px-1"
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 700,
                      fontSize: '14px',
                      lineHeight: '100%',
                      whiteSpace: 'nowrap',
                      color:
                        profitNum === 0
                          ? 'rgba(0,0,0,0.4)'
                          : profitNum < 0
                            ? '#b00020'
                            : 'rgba(0,0,0,1)',
                    }}
                  >
                    {profitNum !== 0 ? `${currencySymbol} ${formatAmount(profit)}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Closing a year off. Once it runs to 31 December it is a completed
          year — no projection and no pencil — so a slip of the date picker is
          caught here rather than being impossible to undo. */}
      <AlertDialog open={closingYear !== null} onOpenChange={(open) => !open && setClosingYear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete {closingYearLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are these the full-year figures for {closingYearLabel}? After this,{" "}
              {closingYearLabel} counts as a complete year: it is no longer projected and its
              date can no longer be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (closingYear) saveColumnDate(closingYear.col, closingYear.dmy);
                setClosingYear(null);
              }}
            >
              Yes, complete {closingYearLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', gap: '16px', marginTop: 'auto', paddingTop: '24px' }}>
        <Button variant="outline" onClick={onBack} style={{ padding: '8px 32px' }}>
          Back
        </Button>
        <Button 
          onClick={handleContinue}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          style={{ padding: '8px 64px', marginLeft: 'auto' }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};
