import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface FinancialsStepProps {
  formData?: any;
  isEditListing?: boolean;
  onNext: (data: any) => void;
  onBack: () => void;
}

// Get today's date in DD.MM.YYYY format
const getTodayDate = () => {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${day}.${month}.${year}`;
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
        [col]: value
      }
    }));
  };

  // Calculate Net Profit for a column
  const calculateNetProfit = (col: string) => {
    if (financialType === "simple") {
      const gross = parseFloat(financialData[REVENUE_ROW]?.[col] || financialData[GROSS_REVENUE_ROW]?.[col] || "0");
      const costs = parseFloat(financialData[OVERALL_COSTS_ROW]?.[col] || "0");
      return (gross - costs).toFixed(2);
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
    return total.toFixed(2);
  };

  const visibleDataRows =
    financialType === "simple"
      ? rowLabels.filter((row) => row === REVENUE_ROW || row === OVERALL_COSTS_ROW)
      : rowLabels.filter((row) => row !== OVERALL_COSTS_ROW);


  // Validate and continue
  const handleContinue = () => {
    // Check if at least one cell has data
    let hasData = false;
    visibleDataRows.forEach((row) => {
      columnLabels.forEach((col) => {
        if (financialData[row]?.[col.key] && parseFloat(financialData[row][col.key]) !== 0) {
          hasData = true;
        }
      });
    });

    if (!hasData) {
      toast.error("Please enter financial data in at least one cell");
      return;
    }

    let outRows = rowLabels;
    let outCols = columnLabels;
    let outData = financialData;

    if (!isEditListing) {
      const adminTemplate = loadAdminFinancialsTemplate();
      if (adminTemplate) {
        outRows = resolveRowsForMode(adminTemplate.rowLabels, financialType, true);
        outCols = adminTemplate.columnLabels;
        outData = mergeFinancialCellValues(
          adminTemplate.financialData,
          financialData,
          normalizeRowLabels(adminTemplate.rowLabels),
          outCols,
        );
      }
    }

    onNext({
      financialType,
      rowLabels: outRows,
      columnLabels: outCols,
      financialData: outData,
      financialsFromListing: isEditListing ? parentFormData?.financialsFromListing : false,
    });
  };

  // Slightly narrower columns so the table fits more comfortably
  const columnWidth = 200;

  return (
    <div
      style={{
        width: '1050px',
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
            const baseRows = adminTemplate
              ? normalizeRowLabels(adminTemplate.rowLabels)
              : rowLabels.filter((row) => row !== OVERALL_COSTS_ROW);
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
          height: '650px',
          opacity: templateLoading ? 0.5 : 1,
          pointerEvents: templateLoading ? 'none' : 'auto',
          border: '3px solid rgba(255, 255, 255, 1)',
          borderRadius: '14px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Black Header Section */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: `${columnWidth * (columnLabels.length + 1)}px`,
            height: '80px',
            backgroundColor: '#000000',
            marginBottom: 0,
          }}
        >
          <h3 
            className="font-lufga text-white text-center px-2"
            style={{
              fontFamily: 'Lufga',
              fontWeight: 600,
              fontStyle: 'normal',
              fontSize: '32px',
              lineHeight: '100%',
              letterSpacing: '0%',
              color: 'rgba(255, 255, 255, 1)',
            }}
          >
            Profit & Loss
          </h3>
        </div>

        {/* Green Header Row */}
        <div 
          className="flex"
          style={{
            width: `${columnWidth * (columnLabels.length + 1)}px`,
            height: '60px',
            backgroundColor: '#C6FE1F',
          }}
        >
          <div 
            className="flex items-center px-4"
            style={{
              width: `${columnWidth}px`,
              height: '100%',
              border: '2.66px solid rgba(255, 255, 255, 1)',
            }}
          >
            <span 
              className="font-lufga text-black"
              style={{
                fontFamily: 'Lufga',
                fontWeight: 700,
                fontStyle: 'normal',
                fontSize: '20px',
                lineHeight: '100%',
                letterSpacing: '0%',
                color: 'rgba(0, 0, 0, 1)',
              }}
            >
              Timeframe
            </span>
          </div>
          {columnLabels.map((col) => (
            <div 
              key={col.key}
              className="flex items-center justify-center"
              style={{
                width: `${columnWidth}px`,
                height: '100%',
                border: '2.66px solid rgba(255, 255, 255, 1)',
              }}
            >
              <span 
                className="font-lufga text-black text-center px-1"
                style={{
                  fontFamily: 'Lufga',
                  fontWeight: 700,
                  fontStyle: 'normal',
                  fontSize: '20px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)',
                }}
              >
                {col.label}
              </span>
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
                  width: `${columnWidth * (columnLabels.length + 1)}px`,
                  height: '64px',
                  backgroundColor: bgColor,
                }}
              >
                <div 
                  className={`flex items-center px-4`}
                  style={{
                    width: `${columnWidth}px`,
                    height: '100%',
                    border: '2.66px solid rgba(255, 255, 255, 1)',
                  }}
                >
                  <span 
                    className="font-lufga break-words"
                    style={{
                      fontFamily: 'Lufga',
                      fontWeight: 500,
                      fontStyle: 'normal',
                      fontSize: '16px',
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      color: textColor,
                    }}
                  >
                    {displayRowLabel(row)}
                  </span>
                </div>
                {columnLabels.map((col) => (
                  <div 
                    key={col.key}
                    className="flex items-center justify-center"
                    style={{
                      width: `${columnWidth}px`,
                      height: '100%',
                      backgroundColor: bgColor,
                      border: '2.66px solid rgba(255, 255, 255, 1)',
                    }}
                  >
                    <Input
                      type="number"
                      value={financialData[row]?.[col.key] || ""}
                      onChange={(e) => handleCellChange(row, col.key, e.target.value)}
                      className="w-11/12 text-center border-2 bg-transparent"
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        fontStyle: 'normal',
                        fontSize: '16px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: textColor,
                        borderColor: 'rgba(0, 0, 0, 0.3)',
                      }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {/* Net Profit Row */}
          <div 
            className="flex"
            style={{
              width: `${columnWidth * (columnLabels.length + 1)}px`,
              height: '64px',
              backgroundColor: '#C6FE1F',
            }}
          >
            <div 
              className="flex items-center px-4"
              style={{
                width: `${columnWidth}px`,
                height: '100%',
                border: '2.66px solid rgba(255, 255, 255, 1)',
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
              return (
                <div 
                  key={col.key}
                  className="flex items-center justify-center"
                  style={{
                    width: `${columnWidth}px`,
                    height: '100%',
                    backgroundColor: '#C6FE1F',
                    border: '2.66px solid rgba(255, 255, 255, 1)',
                  }}
                >
                  <span 
                    className="font-lufga text-black px-1"
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
                    {profit !== "0.00" ? profit : "-"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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
