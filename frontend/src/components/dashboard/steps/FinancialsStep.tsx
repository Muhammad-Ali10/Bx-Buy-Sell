import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencySelect, getCurrencySymbol } from "@/components/CurrencySelect";
import { toast } from "sonner";
import {
  displayRowLabel,
  GROSS_REVENUE_ROW,
  OVERALL_COSTS_ROW,
  REVENUE_ROW,
  FINANCIALS_TEMPLATE_UPDATED_EVENT,
  fetchAdminFinancialsTemplate,
  loadAdminFinancialsTemplate,
  mergeFinancialCellValues,
  normalizeFinancialData,
  normalizeRowLabels,
  syncFinancialGrid,
  type AdminFinancialsTemplate,
  type FinancialColumn,
} from "@/lib/financialTableUtils";
import { usePersistOnUnmount } from "@/hooks/usePersistOnUnmount";

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
const sanitizeNumber = (raw: string): string => {
  let v = raw.replace(/[^0-9.]/g, "");
  const dot = v.indexOf(".");
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, "");
  }
  return v;
};

/** "Forecast 2025" -> "Forecast <current year>" (unless the label was customized). */
const displayColumnLabel = (col: FinancialColumn): string => {
  if (!col.labelCustomized && /^Forecast\s+\d{4}$/.test(col.label)) {
    return `Forecast ${CURRENT_YEAR}`;
  }
  return col.label;
};

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

const defaultColumnLabels = (): FinancialColumn[] => [
  { key: "2023", label: "2023" },
  { key: "2024", label: "2024" },
  { key: "today", label: getTodayDate(), isToday: true },
  { key: "Forecast 2025", label: "Forecast 2025" },
];

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

const buildDefaultTableState = () => {
  const cols = defaultColumnLabels();
  const rows = defaultRowLabels;
  return {
    rowLabels: rows,
    columnLabels: cols,
    financialData: syncFinancialGrid(rows, cols, {}),
    fromAdmin: false,
  };
};

const buildInitialTableState = (isEditListing: boolean) => {
  if (!isEditListing) {
    return buildDefaultTableState();
  }

  const adminTemplate = loadAdminFinancialsTemplate();
  if (adminTemplate) {
    const rows = normalizeRowLabels(adminTemplate.rowLabels);
    return {
      rowLabels: rows,
      columnLabels: adminTemplate.columnLabels,
      financialData: adminTemplate.financialData,
      fromAdmin: true,
    };
  }

  return buildDefaultTableState();
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

  // Selected display currency. Amounts are stored in USD; only the chosen
  // currency code is persisted (inside the financials JSON) so it is remembered.
  const [currency, setCurrency] = useState<string>(parentFormData?.currency || "USD");
  // Inline editing state for the "as-of" date column (#4) and custom rows (#6).
  const [editingDate, setEditingDate] = useState(false);
  const [customRows, setCustomRows] = useState<string[]>([]);
  const [addingRow, setAddingRow] = useState(false);
  const [newRowName, setNewRowName] = useState("");
  // Tracks the cell being typed in, so converted editing doesn't jump mid-type.
  const [editingCell, setEditingCell] = useState<{ row: string; col: string; value: string } | null>(null);

  // Currency conversion (frontend-only): amounts are entered in USD (base) and
  // shown converted when another currency is selected. Rates fetched live.
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });

  useEffect(() => {
    let cancelled = false;
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.rates && typeof d.rates === "object") {
          setRates({ USD: 1, ...d.rates });
        }
      })
      .catch(() => {
        // Approximate fallback if the rates API is unreachable.
        if (!cancelled) {
          setRates({
            USD: 1, EUR: 0.92, GBP: 0.79, PKR: 278, INR: 83, AED: 3.67,
            CAD: 1.36, AUD: 1.52, JPY: 156, CNY: 7.2, SAR: 3.75, TRY: 32,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the seller's saved currency when editing an existing listing.
  useEffect(() => {
    if (parentFormData?.currency) {
      setCurrency(parentFormData.currency);
    }
  }, [parentFormData?.currency]);

  const setColumnLabel = (key: string, label: string) => {
    setColumnLabels((prev) =>
      prev.map((c) =>
        c.key === key ? { ...c, label, labelCustomized: true } : c,
      ),
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
    setFinancialData((prev) => syncFinancialGrid(newRows, columnLabels, prev));
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

  const applyTable = (
    rows: string[],
    cols: FinancialColumn[],
    data: Record<string, Record<string, string>>,
    type: "simple" | "detailed" = financialType,
    fromAdmin = false,
  ) => {
    const resolvedRows = resolveRowsForMode(rows, type, fromAdmin);
    setRowLabels(resolvedRows);
    setColumnLabels(cols);
    setFinancialData(
      padOverallCostsData(syncFinancialGrid(resolvedRows, cols, data), cols),
    );
    setFinancialType(type);
  };

  const applyAdminTemplate = (
    adminTemplate: AdminFinancialsTemplate,
    draftFinancialData?: Record<string, Record<string, string>>,
  ) => {
    const baseRows = normalizeRowLabels(adminTemplate.rowLabels);
    const mergedData = mergeFinancialCellValues(
      adminTemplate.financialData,
      draftFinancialData ?? parentFormData?.financialData,
      baseRows,
      adminTemplate.columnLabels,
    );
    applyTable(
      baseRows,
      adminTemplate.columnLabels,
      mergedData,
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
        parentFormData.columnLabels || defaultColumnLabels(),
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
            applyAdminTemplate(template, financialDataRef.current);
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

  // Calculate Net Profit for a column
  const calculateNetProfit = (col: string) => {
    if (financialType === "simple") {
      const gross = parseFloat(financialData[REVENUE_ROW]?.[col] || financialData[GROSS_REVENUE_ROW]?.[col] || "0");
      const costs = parseFloat(financialData[OVERALL_COSTS_ROW]?.[col] || "0");
      // Keep full precision; rounding happens at display time (in the shown currency).
      return String(gross - costs);
    }
    let total = 0;
    rowLabels.forEach((row) => {
      if (row === OVERALL_COSTS_ROW) return;
      const value = parseFloat(financialData[row]?.[col] || "0");
      if (row.toLowerCase().includes("revenue")) {
        total += value;
      } else {
        total -= value;
      }
    });
    // Keep full precision; rounding happens at display time (in the shown currency).
    return String(total);
  };

  const visibleDataRows =
    financialType === "simple"
      ? rowLabels.filter((row) => row === REVENUE_ROW || row === OVERALL_COSTS_ROW)
      : rowLabels.filter((row) => row !== OVERALL_COSTS_ROW);


  // Validate and continue
  usePersistOnUnmount(onPersist, () => ({
    financialType,
    rowLabels,
    columnLabels,
    financialData,
    currency,
    financialsFromListing: isEditListing ? parentFormData?.financialsFromListing : false,
  }));

  const handleContinue = () => {
    const isFilled = (row: string) =>
      columnLabels.some(
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
      columnLabels,
      financialData,
      currency,
      financialsFromListing: isEditListing ? parentFormData?.financialsFromListing : false,
    });
  };

  // Compact column width so the table stays a reasonable size.
  const columnWidth = 150;
  const gridWidth = columnWidth * (columnLabels.length + 1);

  // Currency conversion: values are stored in USD; convert for display only.
  const conversionRate = rates[currency] ?? 1;
  const isBaseCurrency = currency === "USD";
  const currencySymbol = getCurrencySymbol(currency);
  const formatConverted = (usd: string): string => {
    const n = parseFloat(usd || "0");
    if (Number.isNaN(n)) return "0";
    return (n * conversionRate).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });
  };

  // Editable conversion: show USD amounts in the selected currency, and convert
  // typed values back to USD for storage (so any currency stays editable).
  const usdToDisplay = (usd: string): string => {
    const n = parseFloat(usd || "");
    if (Number.isNaN(n)) return "";
    return String(Math.round(n * conversionRate * 100) / 100);
  };
  const displayToUsd = (typed: string): string => {
    const n = parseFloat(typed || "");
    if (Number.isNaN(n)) return "";
    return String(n / conversionRate);
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
              padOverallCostsData(prev, columnLabels),
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
            setFinancialData((prev) => syncFinancialGrid(baseRows, columnLabels, prev));
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
          {columnLabels.map((col) => (
            <div
              key={col.key}
              className="flex items-center justify-center"
              style={{
                flex: '1 1 0px', minWidth: 0,
                alignSelf: 'stretch',
                border: '1px solid rgba(255, 255, 255, 1)',
              }}
            >
              {editingDate && col.isToday ? (
                <input
                  type="date"
                  autoFocus
                  defaultValue={dmyToIso(col.label)}
                  onBlur={(e) => {
                    const dmy = isoToDmy(e.target.value);
                    if (dmy) setColumnLabel(col.key, dmy);
                    setEditingDate(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingDate(false);
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
                  className="font-lufga text-black text-center px-1 inline-flex items-center gap-1"
                  style={{ fontFamily: 'Lufga', fontWeight: 700, fontSize: '14px', color: 'rgba(0, 0, 0, 1)' }}
                >
                  {displayColumnLabel(col)}
                  {col.isToday && (
                    <button
                      type="button"
                      onClick={() => setEditingDate(true)}
                      title="Edit date"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                    >
                      <Pencil style={{ width: 12, height: 12 }} />
                    </button>
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
                {columnLabels.map((col) => (
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
                        inputMode="decimal"
                        value={
                          isBaseCurrency
                            ? financialData[row]?.[col.key] || ""
                            : editingCell && editingCell.row === row && editingCell.col === col.key
                              ? editingCell.value
                              : usdToDisplay(financialData[row]?.[col.key] || "")
                        }
                        onFocus={() => {
                          if (!isBaseCurrency) {
                            setEditingCell({
                              row,
                              col: col.key,
                              value: usdToDisplay(financialData[row]?.[col.key] || ""),
                            });
                          }
                        }}
                        onChange={(e) => {
                          const s = sanitizeNumber(e.target.value);
                          if (isBaseCurrency) {
                            handleCellChange(row, col.key, s);
                          } else {
                            setEditingCell({ row, col: col.key, value: s });
                            handleCellChange(row, col.key, displayToUsd(s));
                          }
                        }}
                        onBlur={() => setEditingCell(null)}
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
            {columnLabels.map((col) => {
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
                    {profitNum !== 0 ? `${currencySymbol} ${formatConverted(profit)}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {!isBaseCurrency && (
        <p style={{ fontFamily: 'Lufga', fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginTop: '10px' }}>
          Shown in {currency}, converted from the USD base · you can edit in any currency.
        </p>
      )}

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
