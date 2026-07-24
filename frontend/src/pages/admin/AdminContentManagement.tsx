import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  cacheAdminFinancialsTemplate,
  fetchAdminFinancialsTemplate,
  notifyAdminFinancialsTemplateUpdated,
  parseFinancialAdminApiRecord,
  displayRowLabel,
  GROSS_REVENUE_ROW,
  REVENUE_ROW,
  type AdminFinancialsTemplate,
} from "@/lib/financialTableUtils";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Pencil, Trash2, MoreVertical, Facebook, Instagram, Twitter, Music, Pin, Linkedin, Youtube } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useManagementQuestions } from "@/hooks/useManagementQuestions";
import { useCategories } from "@/hooks/useCategories";
import { useBrandQuestions } from "@/hooks/useBrandQuestions";
import { useStatisticQuestions } from "@/hooks/useStatisticQuestions";
import { useProductQuestions } from "@/hooks/useProductQuestions";
import { useAdInformationQuestions } from "@/hooks/useAdInformationQuestions";
import { useHandoverQuestions } from "@/hooks/useHandoverQuestions";
import { useTools } from "@/hooks/useTools";
import { useAccounts } from "@/hooks/useAccounts";
import { useAccountQuestions } from "@/hooks/useAccountQuestions";
import { usePlans } from "@/hooks/usePlans";
import { resolveImageUrl } from "@/lib/imageUtils";

const AddCategoryDialog = lazy(() =>
  import("@/components/admin/content/AddCategoryDialog").then((m) => ({ default: m.AddCategoryDialog }))
);
const EditCategoryDialog = lazy(() =>
  import("@/components/admin/content/EditCategoryDialog").then((m) => ({ default: m.EditCategoryDialog }))
);
const DeleteCategoryDialog = lazy(() =>
  import("@/components/admin/content/DeleteCategoryDialog").then((m) => ({ default: m.DeleteCategoryDialog }))
);
const AddBrandQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddBrandQuestionDialog").then((m) => ({ default: m.AddBrandQuestionDialog }))
);
const EditBrandQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditBrandQuestionDialog").then((m) => ({ default: m.EditBrandQuestionDialog }))
);
const DeleteBrandQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteBrandQuestionDialog").then((m) => ({ default: m.DeleteBrandQuestionDialog }))
);
const AddStatisticQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddStatisticQuestionDialog").then((m) => ({ default: m.AddStatisticQuestionDialog }))
);
const EditStatisticQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditStatisticQuestionDialog").then((m) => ({ default: m.EditStatisticQuestionDialog }))
);
const DeleteStatisticQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteStatisticQuestionDialog").then((m) => ({ default: m.DeleteStatisticQuestionDialog }))
);
const AddProductQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddProductQuestionDialog").then((m) => ({ default: m.AddProductQuestionDialog }))
);
const EditProductQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditProductQuestionDialog").then((m) => ({ default: m.EditProductQuestionDialog }))
);
const DeleteProductQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteProductQuestionDialog").then((m) => ({ default: m.DeleteProductQuestionDialog }))
);
const AddManagementQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddManagementQuestionDialog").then((m) => ({ default: m.AddManagementQuestionDialog }))
);
const EditManagementQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditManagementQuestionDialog").then((m) => ({ default: m.EditManagementQuestionDialog }))
);
const DeleteManagementQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteManagementQuestionDialog").then((m) => ({ default: m.DeleteManagementQuestionDialog }))
);
const AddToolDialog = lazy(() =>
  import("@/components/admin/content/AddToolDialog").then((m) => ({ default: m.AddToolDialog }))
);
const EditToolDialog = lazy(() =>
  import("@/components/admin/content/EditToolDialog").then((m) => ({ default: m.EditToolDialog }))
);
const DeleteToolDialog = lazy(() =>
  import("@/components/admin/content/DeleteToolDialog").then((m) => ({ default: m.DeleteToolDialog }))
);
const AddAccountDialog = lazy(() =>
  import("@/components/admin/content/AddAccountDialog").then((m) => ({ default: m.AddAccountDialog }))
);
const EditAccountDialog = lazy(() =>
  import("@/components/admin/content/EditAccountDialog").then((m) => ({ default: m.EditAccountDialog }))
);
const DeleteAccountDialog = lazy(() =>
  import("@/components/admin/content/DeleteAccountDialog").then((m) => ({ default: m.DeleteAccountDialog }))
);
const AddAccountQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddAccountQuestionDialog").then((m) => ({ default: m.AddAccountQuestionDialog }))
);
const EditAccountQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditAccountQuestionDialog").then((m) => ({ default: m.EditAccountQuestionDialog }))
);
const DeleteAccountQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteAccountQuestionDialog").then((m) => ({ default: m.DeleteAccountQuestionDialog }))
);
const AddAdInformationQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddAdInformationQuestionDialog").then((m) => ({ default: m.AddAdInformationQuestionDialog }))
);
const EditAdInformationQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditAdInformationQuestionDialog").then((m) => ({ default: m.EditAdInformationQuestionDialog }))
);
const DeleteAdInformationQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteAdInformationQuestionDialog").then((m) => ({ default: m.DeleteAdInformationQuestionDialog }))
);
const AddHandoverQuestionDialog = lazy(() =>
  import("@/components/admin/content/AddHandoverQuestionDialog").then((m) => ({ default: m.AddHandoverQuestionDialog }))
);
const EditHandoverQuestionDialog = lazy(() =>
  import("@/components/admin/content/EditHandoverQuestionDialog").then((m) => ({ default: m.EditHandoverQuestionDialog }))
);
const DeleteHandoverQuestionDialog = lazy(() =>
  import("@/components/admin/content/DeleteHandoverQuestionDialog").then((m) => ({ default: m.DeleteHandoverQuestionDialog }))
);
const AddPlanDialog = lazy(() =>
  import("@/components/admin/content/AddPlanDialog").then((m) => ({ default: m.AddPlanDialog }))
);
const EditPlanDialog = lazy(() =>
  import("@/components/admin/content/EditPlanDialog").then((m) => ({ default: m.EditPlanDialog }))
);
const DeletePlanDialog = lazy(() =>
  import("@/components/admin/content/DeletePlanDialog").then((m) => ({ default: m.DeletePlanDialog }))
);

type FinancialColumn = { key: string; label: string; isToday?: boolean; labelCustomized?: boolean };

/** Keep every row/column cell in sync so edits always read/write the right keys. */
const syncFinancialGrid = (
  rows: string[],
  cols: FinancialColumn[],
  data: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> => {
  const synced: Record<string, Record<string, string>> = {};
  rows.forEach((row) => {
    synced[row] = {};
    cols.forEach((col) => {
      synced[row][col.key] = data[row]?.[col.key] ?? "";
    });
  });
  return synced;
};

const AdminContentManagement = () => {
  const { user } = useAuth();
  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      PHOTO: "Photo Upload",
      FILE: "File Upload",
      NUMBER: "Number",
      TEXT: "Text",
      TEXTAREA: "Text Area",
      DATE: "Date",
      BOOLEAN: "Yes / No",
      YESNO: "Yes / No",
      SELECT: "Dropdown",
      CHECKBOX: "Checkbox (Multiple)",
      CHECKBOX_GROUP: "Checkbox (Multiple)",
      URL: "Link",
    };
    return typeMap[type] || type;
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [editQuestionOpen, setEditQuestionOpen] = useState(false);
  const [deleteQuestionOpen, setDeleteQuestionOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [addToolOpen, setAddToolOpen] = useState(false);
  const [editToolOpen, setEditToolOpen] = useState(false);
  const [deleteToolOpen, setDeleteToolOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<any>(null);
  const [addStatisticQuestionOpen, setAddStatisticQuestionOpen] = useState(false);
  const [editStatisticQuestionOpen, setEditStatisticQuestionOpen] = useState(false);
  const [deleteStatisticQuestionOpen, setDeleteStatisticQuestionOpen] = useState(false);
  const [selectedStatisticQuestion, setSelectedStatisticQuestion] = useState<any>(null);
  const [addProductQuestionOpen, setAddProductQuestionOpen] = useState(false);
  const [editProductQuestionOpen, setEditProductQuestionOpen] = useState(false);
  const [deleteProductQuestionOpen, setDeleteProductQuestionOpen] = useState(false);
  const [selectedProductQuestion, setSelectedProductQuestion] = useState<any>(null);
  const [addManagementQuestionOpen, setAddManagementQuestionOpen] = useState(false);
  const [editManagementQuestionOpen, setEditManagementQuestionOpen] = useState(false);
  const [deleteManagementQuestionOpen, setDeleteManagementQuestionOpen] = useState(false);
  const [selectedManagementQuestion, setSelectedManagementQuestion] = useState<any>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [addAccountQuestionOpen, setAddAccountQuestionOpen] = useState(false);
  const [editAccountQuestionOpen, setEditAccountQuestionOpen] = useState(false);
  const [deleteAccountQuestionOpen, setDeleteAccountQuestionOpen] = useState(false);
  const [selectedAccountQuestion, setSelectedAccountQuestion] = useState<any>(null);
  const [addAdInformationQuestionOpen, setAddAdInformationQuestionOpen] = useState(false);
  const [editAdInformationQuestionOpen, setEditAdInformationQuestionOpen] = useState(false);
  const [deleteAdInformationQuestionOpen, setDeleteAdInformationQuestionOpen] = useState(false);
  const [selectedAdInformationQuestion, setSelectedAdInformationQuestion] = useState<any>(null);
  const [addHandoverQuestionOpen, setAddHandoverQuestionOpen] = useState(false);
  const [editHandoverQuestionOpen, setEditHandoverQuestionOpen] = useState(false);
  const [deleteHandoverQuestionOpen, setDeleteHandoverQuestionOpen] = useState(false);
  const [selectedHandoverQuestion, setSelectedHandoverQuestion] = useState<any>(null);
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [deletePlanOpen, setDeletePlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  
  // Get today's date in DD.MM.YYYY format (defined before state initialization)
  const getTodayDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}.${month}.${year}`;
  };
  
  // Financials table state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRowLabel, setEditingRowLabel] = useState<string | null>(null);
  const [editingColLabel, setEditingColLabel] = useState<string | null>(null);
  const [rowLabels, setRowLabels] = useState<string[]>([
    REVENUE_ROW,
    "Net Revenue",
    "Cost of Goods",
    "Advertising costs",
    "Freelancer/Employees",
    "Transaction Costs",
    "Other Expenses"
  ]);
  const [columnLabels, setColumnLabels] = useState<FinancialColumn[]>(() => [
    { key: "2023", label: "2023" },
    { key: "2024", label: "2024" },
    { key: "today", label: getTodayDate(), isToday: true },
    { key: "Forecast 2025", label: "Forecast 2025" }
  ]);
  const [financialData, setFinancialData] = useState<Record<string, Record<string, string>>>({
    [REVENUE_ROW]: { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
    "Net Revenue": { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
    "Cost of Goods": { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
    "Advertising costs": { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
    "Freelancer/Employees": { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
    "Transaction Costs": { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
    "Other Expenses": { "2023": "", "2024": "", "today": "", "Forecast 2025": "" },
  });

  const financialTableRef = useRef({
    rowLabels,
    columnLabels,
    financialData,
  });

  useEffect(() => {
    financialTableRef.current = { rowLabels, columnLabels, financialData };
  }, [rowLabels, columnLabels, financialData]);

  const applyFinancialTemplate = useCallback((template: AdminFinancialsTemplate) => {
    setRowLabels(template.rowLabels);
    setColumnLabels(template.columnLabels);
    setFinancialData(template.financialData);
  }, []);

  // Load saved financials table (API first, then local cache)
  useEffect(() => {
    let cancelled = false;
    const loadFinancialTemplate = async () => {
      try {
        const template = await fetchAdminFinancialsTemplate(true);
        if (cancelled) return;
        if (template) {
          applyFinancialTemplate(template);
          return;
        }

        const response = await apiClient.getFinancialAdminTemplate();
        if (
          !cancelled &&
          response.success &&
          response.data &&
          !parseFinancialAdminApiRecord(response.data)
        ) {
          toast.message(
            "Financial table on server uses an old format. Edit the table and click Save Table once.",
          );
        }
      } catch (error) {
        console.warn("Failed to load saved financials table:", error);
      }
    };
    void loadFinancialTemplate();
    return () => {
      cancelled = true;
    };
  }, [applyFinancialTemplate]);

  const persistFinancialsTable = useCallback(async () => {
    try {
      const { rowLabels: rows, columnLabels: cols, financialData: data } =
        financialTableRef.current;
      const synced = syncFinancialGrid(rows, cols, data);
      const template: AdminFinancialsTemplate = {
        rowLabels: rows,
        columnLabels: cols,
        financialData: synced,
      };

      if (!user?.id) {
        toast.error("You must be logged in as admin to save the financial table");
        return false;
      }

      const response = await apiClient.updateFinancialAdmin(user.id, {
        columns: cols.map((col) => col.label),
        rows: template,
      });
      if (!response.success) {
        toast.error(response.error || "Failed to save financial table to server");
        return false;
      }

      cacheAdminFinancialsTemplate(template);
      setFinancialData(synced);
      notifyAdminFinancialsTemplateUpdated();
      return true;
    } catch (error) {
      console.warn("Failed to save financials table:", error);
      return false;
    }
  }, [user?.id]);

  const handleToggleEdit = async () => {
    if (isEditMode) {
      const saved = await persistFinancialsTable();
      if (saved) {
        toast.success("Financial table saved");
      }
      setEditingRowLabel(null);
      setEditingColLabel(null);
    }
    setIsEditMode(!isEditMode);
  };

  // Handle row label edit
  const handleRowLabelEdit = (oldLabel: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) {
      setEditingRowLabel(null);
      return;
    }
    if (rowLabels.some((label) => label === trimmed && label !== oldLabel)) {
      toast.error("A row with this name already exists");
      setEditingRowLabel(null);
      return;
    }

    setRowLabels((prev) => prev.map((label) => (label === oldLabel ? trimmed : label)));
    setFinancialData((prev) => {
      const newData = { ...prev };
      if (newData[oldLabel]) {
        newData[trimmed] = newData[oldLabel];
        delete newData[oldLabel];
      }
      return newData;
    });
    setEditingRowLabel(null);
  };

  // Handle row delete
  const handleRowDelete = (rowLabel: string) => {
    if (rowLabels.length <= 1) return;
    const nextRows = rowLabels.filter((label) => label !== rowLabel);
    setRowLabels(nextRows);
    setFinancialData((prev) => {
      const newData = { ...prev };
      delete newData[rowLabel];
      return syncFinancialGrid(nextRows, columnLabels, newData);
    });
    if (editingRowLabel === rowLabel) {
      setEditingRowLabel(null);
    }
  };

  // Handle column label edit (label only — keep stable column key for data)
  const handleColLabelEdit = (colKey: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    const targetCol = columnLabels.find((col) => col.key === colKey);
    if (!trimmed || !targetCol) {
      setEditingColLabel(null);
      return;
    }
    if (
      columnLabels.some(
        (col) => col.key !== colKey && col.label.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      toast.error("A column with this name already exists");
      setEditingColLabel(null);
      return;
    }

    setColumnLabels((prev) =>
      prev.map((col) =>
        col.key === colKey ? { ...col, label: trimmed, labelCustomized: true } : col,
      ),
    );
    setEditingColLabel(null);
  };

  // Handle column delete
  const handleColDelete = (colKey: string) => {
    if (columnLabels.length <= 1 || columnLabels.find((col) => col.key === colKey)?.isToday) {
      return;
    }
    const nextCols = columnLabels.filter((col) => col.key !== colKey);
    setColumnLabels(nextCols);
    setFinancialData((prev) => {
      const newData: Record<string, Record<string, string>> = {};
      Object.keys(prev).forEach((rowKey) => {
        newData[rowKey] = { ...prev[rowKey] };
        delete newData[rowKey][colKey];
      });
      return syncFinancialGrid(rowLabels, nextCols, newData);
    });
    if (editingColLabel === colKey) {
      setEditingColLabel(null);
    }
  };

  // Handle add new row
  const handleAddRow = () => {
    if (!isEditMode) return;

    let index = rowLabels.length + 1;
    let newRowLabel = `New Row ${index}`;
    while (rowLabels.includes(newRowLabel)) {
      index += 1;
      newRowLabel = `New Row ${index}`;
    }

    const nextRows = [...rowLabels, newRowLabel];
    setRowLabels(nextRows);
    setFinancialData((prev) =>
      syncFinancialGrid(nextRows, columnLabels, {
        ...prev,
        [newRowLabel]: Object.fromEntries(columnLabels.map((col) => [col.key, ""])),
      }),
    );
  };

  // Handle add new column
  const handleAddColumn = () => {
    if (!isEditMode) return;

    const newColKey = `col-${Date.now()}`;
    const newColLabel = `Column ${columnLabels.length + 1}`;
    const nextCols = [...columnLabels, { key: newColKey, label: newColLabel }];
    setColumnLabels(nextCols);
    setFinancialData((prev) => syncFinancialGrid(rowLabels, nextCols, prev));
  };
  
  const { data: categories, isLoading, error: categoriesError } = useCategories({ nocache: true });
  const { data: brandQuestions, isLoading: questionsLoading, error: brandQuestionsError } = useBrandQuestions();
  const { data: statisticQuestions, isLoading: statisticQuestionsLoading, error: statisticQuestionsError } = useStatisticQuestions();
  const { data: productQuestions, isLoading: productQuestionsLoading, error: productQuestionsError } = useProductQuestions();
  const { data: managementQuestions, isLoading: managementQuestionsLoading, error: managementQuestionsError } = useManagementQuestions();
  const { data: adInformationQuestions, isLoading: adInformationQuestionsLoading, error: adInformationQuestionsError } = useAdInformationQuestions();
  const { data: handoverQuestions, isLoading: handoverQuestionsLoading, error: handoverQuestionsError } = useHandoverQuestions();
  const { data: tools, isLoading: toolsLoading, error: toolsError } = useTools();
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useAccounts();
  const { data: accountQuestions, isLoading: accountQuestionsLoading, error: accountQuestionsError } = useAccountQuestions();
  const { data: plans, isLoading: plansLoading, error: plansError } = usePlans();
  const location = useLocation();
  const navigate = useNavigate();

  // Debug logging
  useEffect(() => {
    console.log('Categories loaded:', {
      isLoading,
      categories,
      categoriesCount: categories?.length,
      categoriesError,
      isArray: Array.isArray(categories),
    });
  }, [categories, isLoading, categoriesError]);

  useEffect(() => {
    console.log('Tools loaded:', {
      isLoading: toolsLoading,
      tools,
      toolsCount: tools?.length,
      toolsError,
      isArray: Array.isArray(tools),
    });
  }, [tools, toolsLoading, toolsError]);

  // Extract current tab from URL
  const currentPath = location.pathname.split('/').pop() || 'category';
  const [activeTab, setActiveTab] = useState(currentPath);

  useEffect(() => {
    const path = location.pathname.split('/').pop() || 'category';
    console.log('📍 AdminContentManagement - Path changed:', {
      pathname: location.pathname,
      extractedPath: path,
      currentActiveTab: activeTab
    });
    if (location.pathname === '/admin/content' || location.pathname === '/admin/content/') {
      navigate('/admin/content/category', { replace: true });
    } else {
      setActiveTab(path);
    }
  }, [location.pathname, navigate]);
  
  // Debug: Log activeTab changes
  useEffect(() => {
    console.log('📍 ActiveTab changed:', activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      
      <main className="flex-1">
        <AdminHeader />

        <div className="p-8 space-y-6">
          <h1 className="text-2xl font-bold text-white mb-6">Content Management</h1>
            
            {/* Category Section */}
            {activeTab === 'category' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Category</h2>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 sm:pl-10 bg-background border-border text-sm sm:text-base h-9 sm:h-10"
                      />
                    </div>
                    <Button
                      onClick={() => setAddCategoryOpen(true)}
                      className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                    >
                      Add Category
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Categories</h3>
                  
                  {isLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading categories...</div>
                  ) : categoriesError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading categories: {categoriesError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : categories && Array.isArray(categories) && categories.length > 0 ? (
                    <>
                      <div className="text-xs sm:text-sm text-muted-foreground mb-4">
                        Found {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categories
                          .filter((category: any) => 
                            !searchQuery || category.name?.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((category: any) => (
                            <div
                              key={category.id}
                              className="relative bg-[#FAFAFA] rounded-2xl flex flex-col items-center gap-4 group transition-all hover:shadow-lg"
                              style={{ 
                                paddingTop: '22px',
                                paddingBottom: '22px',
                                paddingLeft: '25px',
                                paddingRight: '25px',
                                minHeight: '153.85px'
                              }}
                            >
                              <div className="absolute top-2 right-2 z-10">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 sm:h-8 sm:w-8 bg-white border border-border hover:bg-accent/20 rounded-full"
                                    >
                                      <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-background border-border text-xs sm:text-sm">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedCategory(category);
                                        setEditCategoryOpen(true);
                                      }}
                                      className="cursor-pointer text-foreground hover:bg-accent/20"
                                    >
                                      <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedCategory(category);
                                        setDeleteCategoryOpen(true);
                                      }}
                                      className="cursor-pointer text-destructive hover:bg-destructive/20"
                                    >
                                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              
                              <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 flex-1 w-full">
                                {category.image_path ? (
                                  <div 
                                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-105"
                                    style={{ 
                                      backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                      borderRadius: '16.78px'
                                    }}
                                  >
                                    <img 
                                      src={resolveImageUrl(category.image_path)} 
                                      alt={category.name}
                                      className="w-9 h-9 sm:w-10 sm:h-10 object-contain"
                                    />
                                  </div>
                                ) : (
                                  <div 
                                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center transition-transform group-hover:scale-105"
                                    style={{ borderRadius: '16.78px' }}
                                  >
                                    <span className="text-xl sm:text-2xl font-bold text-foreground">
                                      {category.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <span className="text-black font-semibold text-sm sm:text-base text-center leading-tight">{category.name}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                      {categoriesError ? (
                        <div>
                          <p className="text-destructive">Error: {categoriesError.message}</p>
                          <p className="text-xs mt-2">Check browser console for details.</p>
                        </div>
                      ) : categories === undefined ? (
                        <div>
                          <p>No categories found.</p>
                          <p className="text-xs mt-2">Check browser console for API response details.</p>
                        </div>
                      ) : (
                        "No categories added yet. Click \"Add Category\" to create one."
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Brand Information Section */}
            {activeTab === 'brand-info' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Brand Information</h2>
                  <Button
                    onClick={() => setAddQuestionOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                  >
                    Add New Question
                  </Button>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Brand Information Questions</h3>
                  
                  {questionsLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                  ) : brandQuestionsError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading questions: {brandQuestionsError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : brandQuestions && Array.isArray(brandQuestions) && brandQuestions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {brandQuestions.map((question: any) => {
                        return (
                        <div
                          key={question.id}
                          className="bg-[#FAFAFA] rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="text-black font-semibold text-base sm:text-lg mb-1 break-words">{question.question}</h4>
                            <p className="text-muted-foreground text-xs sm:text-sm">
                              Type: {getTypeLabel(question.answer_type)}
                            </p>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                              onClick={() => {
                                setSelectedQuestion(question);
                                setEditQuestionOpen(true);
                              }}
                              className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedQuestion(question);
                                setDeleteQuestionOpen(true);
                              }}
                              variant="destructive"
                              className="rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                      No questions added yet. Click "Add New Question" to create one.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tools Section */}
            {activeTab === 'tools' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Tools</h2>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 sm:pl-10 bg-background border-border text-sm sm:text-base h-9 sm:h-10"
                      />
                    </div>
                    <Button
                      onClick={() => setAddToolOpen(true)}
                      className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                    >
                      Add Tools
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Tools</h3>
                  
                  {toolsLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading tools...</div>
                  ) : toolsError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading tools: {toolsError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : tools && Array.isArray(tools) && tools.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tools
                        .filter((tool: any) => 
                          tool.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((tool: any) => (
                        <div
                          key={tool.id}
                          className="relative bg-[#FAFAFA] rounded-2xl flex flex-col items-center gap-4 group transition-all hover:shadow-lg"
                          style={{ 
                            paddingTop: '22px',
                            paddingBottom: '22px',
                            paddingLeft: '25px',
                            paddingRight: '25px',
                            minHeight: '153.85px'
                          }}
                        >
                          <div className="absolute top-2 right-2 z-10">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 sm:h-8 sm:w-8 bg-white border border-border hover:bg-accent/20 rounded-full"
                                >
                                  <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background border-border text-xs sm:text-sm">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTool(tool);
                                    setEditToolOpen(true);
                                  }}
                                  className="cursor-pointer text-foreground hover:bg-accent/20"
                                >
                                  <Pencil className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedTool(tool);
                                    setDeleteToolOpen(true);
                                  }}
                                  className="cursor-pointer text-destructive hover:bg-destructive/20"
                                >
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 flex-1 w-full">
                            {tool.image_path ? (
                              <div 
                                className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center transition-transform group-hover:scale-105"
                              >
                                <img 
                                  src={resolveImageUrl(tool.image_path)} 
                                  alt={tool.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div 
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-muted"
                              >
                                <span className="text-xl sm:text-2xl font-bold">{tool.name[0]}</span>
                              </div>
                            )}
                            
                            <span className="font-medium text-center text-sm sm:text-base text-foreground">
                              {tool.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                      {toolsError ? (
                        <div>
                          <p className="text-destructive">Error: {toolsError.message}</p>
                          <p className="text-xs mt-2">Check browser console for details.</p>
                        </div>
                      ) : (
                        "No tools found. Click \"Add Tools\" to create your first tool."
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Financials Section */}
            {activeTab === 'financials' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Financials</h2>
                  <Button
                    onClick={handleToggleEdit}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                  >
                    {isEditMode ? "Save Table" : "Edit Table"}
                  </Button>
                </div>
                {(() => {
                  const rows = rowLabels;
                  const columns = columnLabels;

              const handleCellChange = (row: string, col: string, value: string) => {
                setFinancialData((prev) => ({
                  ...prev,
                  [row]: {
                    ...(prev[row] ?? {}),
                    [col]: value,
                  },
                }));
              };

              const calculateNetProfit = (col: string) => {
                let total = 0;
                rows.forEach(row => {
                  const value = parseFloat(financialData[row]?.[col] || "0");
                  // Check if row is a revenue row (contains "Revenue" in name)
                  if (row.toLowerCase().includes("revenue")) {
                    total += value;
                  } else {
                    total -= value;
                  }
                });
                return total.toFixed(2);
              };

              const columnWidth = isMobile ? 130 : isTablet ? 150 : 180;

              return (
                <>
                  {/* Profit & Loss Table Container */}
                  <div 
                    className="relative overflow-x-auto w-full max-w-full"
                  >
                    {/* Black Header Section */}
                    <div 
                      className="flex items-center justify-center"
                      style={{
                        width: `${columnWidth * (columns.length + (isEditMode ? 1 : 0) + 1)}px`,
                        height: isMobile ? '50px' : isTablet ? '70px' : '108.62px',
                        backgroundColor: '#000000',
                        borderRadius: isMobile ? '12px' : '16.57px',
                        marginBottom: 0,
                      }}
                    >
                      <h3 
                        className="font-lufga text-white text-center px-2"
                        style={{
                          fontWeight: 600,
                          fontSize: isMobile ? '18px' : isTablet ? '22px' : '28px',
                          lineHeight: '100%',
                          letterSpacing: '0%',
                        }}
                      >
                        Profit & Loss
                      </h3>
                    </div>

                    {/* Green Header Row */}
                    <div 
                      className="flex"
                      style={{
                        width: `${columnWidth * (columns.length + (isEditMode ? 1 : 0) + 1)}px`,
                        height: isMobile ? '40px' : isTablet ? '55px' : '76.03px',
                        backgroundColor: '#C6FE1F',
                      }}
                    >
                      <div 
                        className="flex items-center px-2 sm:px-4"
                        style={{
                          width: `${columnWidth}px`,
                          height: '100%',
                          border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                        }}
                      >
                        <span 
                          className="font-lufga text-black"
                          style={{
                            fontWeight: 700,
                            fontSize: isMobile ? '12px' : isTablet ? '14px' : '16px',
                            lineHeight: '100%',
                            letterSpacing: '0%',
                          }}
                        >
                          Timeframe
                        </span>
                      </div>
                      {columns.map((col) => (
                        <div 
                          key={col.key}
                          className="flex items-center justify-center relative group"
                          style={{
                            width: `${columnWidth}px`,
                            height: '100%',
                            border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                          }}
                        >
                          {editingColLabel === col.key ? (
                            <Input
                              defaultValue={col.label}
                              onBlur={(e) => handleColLabelEdit(col.key, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleColLabelEdit(col.key, e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                  setEditingColLabel(null);
                                }
                              }}
                              autoFocus
                              className="w-full text-center font-lufga text-black bg-transparent border-2 border-black/30 px-1"
                              style={{
                                fontWeight: 700,
                                fontSize: isMobile ? '12px' : isTablet ? '14px' : '16px',
                              }}
                            />
                          ) : (
                            <>
                              <span 
                                className="font-lufga text-black cursor-pointer text-center px-1"
                                style={{
                                  fontWeight: 700,
                                  fontSize: isMobile ? '12px' : isTablet ? '14px' : '16px',
                                  lineHeight: '100%',
                                  letterSpacing: '0%',
                                }}
                                onDoubleClick={() => isEditMode && setEditingColLabel(col.key)}
                              >
                                {col.label}
                              </span>
                              {isEditMode && (
                                <div className="absolute top-1 right-1 flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingColLabel(col.key)}
                                    className="h-6 w-6 p-0 text-black hover:bg-black/20"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {!col.isToday && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleColDelete(col.key)}
                                      className="h-6 w-6 p-0 text-red-600 hover:bg-red-600/20"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                      {isEditMode && (
                        <div 
                          className="flex items-center justify-center"
                          style={{
                            width: `${columnWidth}px`,
                            height: '100%',
                            border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                          }}
                        >
                          <Button
                            onClick={handleAddColumn}
                            className="bg-accent hover:bg-accent/90 text-black font-semibold h-6 sm:h-8 px-2 sm:px-4 text-xs sm:text-sm"
                          >
                            + Add
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Data Rows */}
                    <div>
                          {rows.map((row, rowIndex) => {
                        const isGrossRevenue = row === REVENUE_ROW || row === GROSS_REVENUE_ROW;
                        const bgColor = isGrossRevenue ? '#424242' : '#F3F8E8';
                        const textColor = isGrossRevenue ? 'text-white' : 'text-black';
                            
                            return (
                          <div 
                                key={row}
                            className="flex"
                            style={{
                              width: `${columnWidth * (columns.length + (isEditMode ? 1 : 0) + 1)}px`,
                              height: isMobile ? '40px' : isTablet ? '55px' : '91.12px',
                              backgroundColor: bgColor,
                            }}
                          >
                            <div 
                              className={`flex items-center px-2 sm:px-4 relative group ${textColor}`}
                              style={{
                                width: `${columnWidth}px`,
                                height: '100%',
                                border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                              }}
                            >
                              {editingRowLabel === row ? (
                                <Input
                                  defaultValue={row}
                                  onBlur={(e) => handleRowLabelEdit(row, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRowLabelEdit(row, e.currentTarget.value);
                                    } else if (e.key === 'Escape') {
                                      setEditingRowLabel(null);
                                    }
                                  }}
                                  autoFocus
                                  className={`w-full font-lufga bg-transparent border-2 ${isGrossRevenue ? 'border-white/30 text-white' : 'border-black/30 text-black'} px-1 text-xs sm:text-base`}
                                  style={{
                                    fontWeight: 500,
                                    fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                  }}
                                />
                              ) : (
                                <>
                                  <span 
                                    className="font-lufga cursor-pointer break-words"
                                    style={{
                                      fontWeight: 500,
                                      fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                      lineHeight: '120%',
                                      letterSpacing: '0%',
                                    }}
                                    onDoubleClick={() => isEditMode && setEditingRowLabel(row)}
                                  >
                                    {displayRowLabel(row)}
                                  </span>
                                  {isEditMode && (
                                    <div className="absolute top-1 right-1 flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingRowLabel(row)}
                                        className={`h-6 w-6 p-0 ${isGrossRevenue ? 'text-white hover:bg-white/20' : 'text-black hover:bg-black/20'}`}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRowDelete(row)}
                                        className="h-6 w-6 p-0 text-red-600 hover:bg-red-600/20"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            {columns.map((col) => (
                              <div 
                                key={col.key}
                                className={`flex items-center justify-center ${textColor}`}
                                style={{
                                  width: `${columnWidth}px`,
                                  height: '100%',
                                  backgroundColor: bgColor,
                                  border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                                }}
                              >
                                    {isEditMode ? (
                                      <Input
                                        type="number"
                                        value={financialData[row]?.[col.key] ?? ""}
                                        onChange={(e) => handleCellChange(row, col.key, e.target.value)}
                                        className={`w-11/12 text-center border-2 px-1 text-xs sm:text-base ${isGrossRevenue ? 'border-white/30 bg-transparent text-white' : 'border-black/30 bg-transparent text-black'}`}
                                        style={{
                                          fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                          fontFamily: 'Lufga',
                                          fontWeight: 500,
                                        }}
                                      />
                                    ) : (
                                  <span 
                                    className="font-lufga px-1"
                                    style={{
                                      fontWeight: 500,
                                      fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                      lineHeight: '100%',
                                      letterSpacing: '0%',
                                    }}
                                  >
                                    {(financialData[row]?.[col.key] ?? "") !== "" ? financialData[row]?.[col.key] : "-"}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                            );
                          })}
                      
                      {/* Add+ Row (edit mode only) */}
                      {isEditMode && (
                        <div 
                          className="flex"
                          style={{
                            width: `${columnWidth * (columns.length + 1 + 1)}px`,
                            height: isMobile ? '40px' : isTablet ? '55px' : '91.12px',
                            backgroundColor: '#F3F8E8',
                          }}
                        >
                          <div 
                            className="flex items-center px-2 sm:px-4"
                            style={{
                              width: `${columnWidth}px`,
                              height: '100%',
                              border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                            }}
                          >
                            <button 
                              type="button"
                              onClick={handleAddRow}
                              className="font-lufga text-[#424242] hover:text-[#84cc16] font-medium"
                              style={{
                                fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                lineHeight: '100%',
                                letterSpacing: '0%',
                              }}
                            >
                              Add
                            </button>
                          </div>
                          {columns.map((col) => (
                            <div 
                              key={col.key}
                              className="flex items-center justify-center text-black"
                              style={{
                                width: `${columnWidth}px`,
                                height: '100%',
                                backgroundColor: '#F3F8E8',
                                border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                              }}
                            >
                              <span 
                                className="font-lufga"
                                style={{
                                  fontWeight: 500,
                                  fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                  lineHeight: '100%',
                                  letterSpacing: '0%',
                                }}
                              >
                                -
                              </span>
                            </div>
                          ))}
                          <div 
                            className="flex items-center justify-center text-black"
                            style={{
                              width: `${columnWidth}px`,
                              height: '100%',
                              backgroundColor: '#F3F8E8',
                              border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                            }}
                          >
                            <span className="text-muted-foreground text-xs">-</span>
                          </div>
                        </div>
                      )}

                      {/* Net Profit Row */}
                      <div 
                        className="flex"
                        style={{
                          width: `${columnWidth * (columns.length + (isEditMode ? 1 : 0) + 1)}px`,
                          height: isMobile ? '40px' : isTablet ? '55px' : '91.12px',
                          backgroundColor: '#C6FE1F',
                        }}
                      >
                        <div 
                          className="flex items-center px-2 sm:px-4"
                          style={{
                            width: `${columnWidth}px`,
                            height: '100%',
                            border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                          }}
                        >
                          <span 
                            className="font-lufga text-black break-words"
                            style={{
                              fontWeight: 700,
                                      fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                              lineHeight: '120%',
                              letterSpacing: '0%',
                            }}
                          >
                            Net Profit
                          </span>
                        </div>
                        {columns.map((col) => {
                          const profit = calculateNetProfit(col.key);
                          return (
                            <div 
                              key={col.key}
                              className="flex items-center justify-center"
                              style={{
                                width: `${columnWidth}px`,
                                height: '100%',
                                backgroundColor: '#C6FE1F',
                                border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                              }}
                            >
                              <span 
                                className="font-lufga text-black px-1"
                                style={{
                                  fontWeight: 700,
                                      fontSize: isMobile ? '11px' : isTablet ? '12px' : '14px',
                                  lineHeight: '100%',
                                  letterSpacing: '0%',
                                }}
                              >
                                {profit !== "0.00" ? profit : "-"}
                              </span>
                            </div>
                          );
                        })}
                        {isEditMode && (
                          <div 
                            className="flex items-center justify-center"
                            style={{
                              width: `${columnWidth}px`,
                              height: '100%',
                              backgroundColor: '#C6FE1F',
                              border: isMobile ? '1.5px solid rgba(255, 255, 255, 1)' : '2.66px solid rgba(255, 255, 255, 1)',
                            }}
                          >
                            <span className="text-muted-foreground text-xs">-</span>
                          </div>
                        )}
                      </div>
                </div>
                  </div>
                </>
              );
            })()}
              </div>
            )}

            {/* Additional Infos Section with Statistics Sub-tab */}
            {activeTab === 'additional-infos' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">Additional Infos</h2>
                
                <Tabs defaultValue="statistics" className="w-full">
                  <TabsList variant="admin" className="bg-[#1a1a1a] border-b border-[#2a2a2a] rounded-none w-full justify-start h-auto p-0 text-xs sm:text-sm">
                    <TabsTrigger variant="admin" value="statistics" className="rounded-none data-[state=active]:bg-[#2a2a2a] text-xs sm:text-sm px-3 sm:px-6 py-2">
                      Statistics
                    </TabsTrigger>
                    <TabsTrigger variant="admin" value="products" className="rounded-none data-[state=active]:bg-[#2a2a2a] text-xs sm:text-sm px-3 sm:px-6 py-2">
                      Products
                    </TabsTrigger>
                    <TabsTrigger variant="admin" value="management" className="rounded-none data-[state=active]:bg-[#2a2a2a] text-xs sm:text-sm px-3 sm:px-6 py-2">
                      Management
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="statistics" className="mt-4 sm:mt-6">
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex items-center justify-end">
                        <Button
                          onClick={() => setAddStatisticQuestionOpen(true)}
                          className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                        >
                          Add New Question
                        </Button>
                      </div>

                      <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Statistic Questions</h3>
                        
                        {statisticQuestionsLoading ? (
                          <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                        ) : statisticQuestions && Array.isArray(statisticQuestions) && statisticQuestions.length > 0 ? (
                          <div className="space-y-3 sm:space-y-4">
                            {statisticQuestions.map((question: any) => (
                              <div
                                key={question.id}
                                className="bg-[#FAFAFA] rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
                              >
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-black font-semibold text-base sm:text-lg mb-1 break-words">{question.question}</h4>
                                  <p className="text-muted-foreground text-xs sm:text-sm">
                                    Type: {getTypeLabel(question.answer_type)}
                                  </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <Button
                                    onClick={() => {
                                      setSelectedStatisticQuestion(question);
                                      setEditStatisticQuestionOpen(true);
                                    }}
                                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setSelectedStatisticQuestion(question);
                                      setDeleteStatisticQuestionOpen(true);
                                    }}
                                    variant="destructive"
                                    className="rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                            No questions added yet. Click "Add New Question" to create one.
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="products" className="mt-4 sm:mt-6">
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex items-center justify-end">
                        <Button
                          onClick={() => setAddProductQuestionOpen(true)}
                          className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                        >
                          Add New Question
                        </Button>
                      </div>

                      <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Product Questions</h3>
                        
                        {productQuestionsLoading ? (
                          <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                        ) : productQuestions && Array.isArray(productQuestions) && productQuestions.length > 0 ? (
                          <div className="space-y-3 sm:space-y-4">
                            {productQuestions.map((question: any) => (
                              <div
                                key={question.id}
                                className="bg-[#FAFAFA] rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
                              >
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-black font-semibold text-base sm:text-lg mb-1 break-words">{question.question}</h4>
                                  <p className="text-muted-foreground text-xs sm:text-sm">
                                    Type: {getTypeLabel(question.answer_type)}
                                  </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <Button
                                    onClick={() => {
                                      setSelectedProductQuestion(question);
                                      setEditProductQuestionOpen(true);
                                    }}
                                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setSelectedProductQuestion(question);
                                      setDeleteProductQuestionOpen(true);
                                    }}
                                    variant="destructive"
                                    className="rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                            No questions added yet. Click "Add New Question" to create one.
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="management" className="mt-4 sm:mt-6">
                    <div className="space-y-4 sm:space-y-6">
                      <div className="flex items-center justify-end">
                        <Button
                          onClick={() => setAddManagementQuestionOpen(true)}
                          className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                        >
                          Add New Question
                        </Button>
                      </div>

                      <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Management Questions</h3>
                        
                        {managementQuestionsLoading ? (
                          <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                        ) : managementQuestions && Array.isArray(managementQuestions) && managementQuestions.length > 0 ? (
                          <div className="space-y-3 sm:space-y-4">
                            {managementQuestions.map((question: any) => (
                              <div
                                key={question.id}
                                className="bg-[#FAFAFA] rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
                              >
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-black font-semibold text-base sm:text-lg mb-1 break-words">{question.question}</h4>
                                  <p className="text-muted-foreground text-xs sm:text-sm">
                                    Type: {getTypeLabel(question.answer_type)}
                                  </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <Button
                                    onClick={() => {
                                      setSelectedManagementQuestion(question);
                                      setEditManagementQuestionOpen(true);
                                    }}
                                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setSelectedManagementQuestion(question);
                                      setDeleteManagementQuestionOpen(true);
                                    }}
                                    variant="destructive"
                                    className="rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                            No questions added yet. Click "Add New Question" to create one.
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Accounts Section */}
            {activeTab === 'accounts' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Social Media Accounts</h2>
                  <Button
                    onClick={() => setAddAccountOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                  >
                    Add New Social Account
                  </Button>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Enabled Social Media Platforms</h3>
                  
                  {accountsLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading platforms...</div>
                  ) : accounts && Array.isArray(accounts) && accounts.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {accounts.map((account: any) => {
                        const getPlatformIcon = () => {
                          switch (account.platform.toLowerCase()) {
                            case "facebook": return <Facebook className="w-4 h-4 sm:w-5 sm:h-5" />;
                            case "instagram": return <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />;
                            case "twitter": return <Twitter className="w-4 h-4 sm:w-5 sm:h-5" />;
                            case "tiktok": return <Music className="w-4 h-4 sm:w-5 sm:h-5" />;
                            case "pinterest": return <Pin className="w-4 h-4 sm:w-5 sm:h-5" />;
                            case "linkedin": return <Linkedin className="w-4 h-4 sm:w-5 sm:h-5" />;
                            case "youtube": return <Youtube className="w-4 h-4 sm:w-5 sm:h-5" />;
                            default: return <span>🌐</span>;
                          }
                        };

                        return (
                          <div
                            key={account.id}
                            className="bg-[#FAFAFA] rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4"
                          >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                              {getPlatformIcon()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-black font-semibold text-base sm:text-lg mb-1 capitalize break-words">{account.platform}</h4>
                              <p className="text-muted-foreground text-xs sm:text-sm">Users will enter their account links for this platform</p>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                              <Button
                                onClick={() => {
                                  setSelectedAccount(account);
                                  setEditAccountOpen(true);
                                }}
                                className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedAccount(account);
                                  setDeleteAccountOpen(true);
                                }}
                                variant="destructive"
                                className="rounded-full px-4 sm:px-6 h-8 sm:h-10 text-xs sm:text-sm flex-1 sm:flex-initial"
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-center py-8 sm:py-12 text-sm sm:text-base">
                      No platforms enabled yet. Click "Add New Social Account" to enable a platform.
                    </div>
                  )}
                </div>

                {/* Account Questions Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6 mt-6 sm:mt-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Account Questions</h2>
                  <Button
                    onClick={() => setAddAccountQuestionOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                  >
                    Add New Question
                  </Button>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Account Questions</h3>
                  
                  {accountQuestionsLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                  ) : accountQuestionsError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading account questions: {accountQuestionsError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : accountQuestions && accountQuestions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {accountQuestions.map((question: any) => {
                        return (
                          <div
                            key={question.id}
                            className="bg-white rounded-xl p-4 sm:p-6 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:border-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm sm:text-base font-medium text-foreground break-words">
                                {question.question}
                              </h4>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedAccountQuestion(question);
                                  setEditAccountQuestionOpen(true);
                                }}
                                className="bg-accent hover:bg-accent/90 text-black font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedAccountQuestion(question);
                                  setDeleteAccountQuestionOpen(true);
                                }}
                                className="bg-destructive hover:bg-destructive/90 text-white font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm"
                              >
                                Delete
                              </Button>
                              <div className="text-xs sm:text-sm text-muted-foreground sm:min-w-[120px] sm:text-right">
                                Type: <span className="font-medium text-foreground">{getTypeLabel(question.answer_type)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">
                      No account questions added yet. Click "Add New Question" to get started.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ad Informations Section */}
            {activeTab === 'ad-informations' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Ad Informations</h2>
                  <Button
                    onClick={() => setAddAdInformationQuestionOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto"
                  >
                    Add New Question
                  </Button>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Ad Information Questions</h3>
                  
                  {adInformationQuestionsLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                  ) : adInformationQuestionsError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading ad information questions: {adInformationQuestionsError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : adInformationQuestions && adInformationQuestions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {adInformationQuestions.map((question: any) => {
                        return (
                          <div
                            key={question.id}
                            className="bg-white rounded-xl p-4 sm:p-6 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:border-accent/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm sm:text-base font-medium text-foreground break-words">
                                {question.question}
                              </h4>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedAdInformationQuestion(question);
                                  setEditAdInformationQuestionOpen(true);
                                }}
                                className="bg-accent hover:bg-accent/90 text-black font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm"
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedAdInformationQuestion(question);
                                  setDeleteAdInformationQuestionOpen(true);
                                }}
                                className="bg-destructive hover:bg-destructive/90 text-white font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm"
                              >
                                Delete
                              </Button>
                              <div className="text-xs sm:text-sm text-muted-foreground sm:min-w-[120px] sm:text-right">
                                Type: <span className="font-medium text-foreground">{getTypeLabel(question.answer_type)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">
                      No ad information questions added yet. Click "Add New Question" to get started.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Handover Section */}
            {activeTab === 'handover' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground">Handovers Questions</h2>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 sm:pl-10 bg-muted/50 border-border text-sm sm:text-base h-9 sm:h-10"
                      />
                    </div>
                    <Button
                      onClick={() => setAddHandoverQuestionOpen(true)}
                      className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                    >
                      Add New Question
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Handovers Questions</h3>
                  
                  {handoverQuestionsLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading questions...</div>
                  ) : handoverQuestionsError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading handover questions: {handoverQuestionsError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : handoverQuestions && handoverQuestions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {handoverQuestions
                        .filter((question: any) => 
                          question.question?.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((question: any) => {
                          return (
                            <div
                              key={question.id}
                              className="bg-white rounded-xl p-4 sm:p-6 border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 hover:border-accent/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0 w-full sm:w-auto">
                                <h4 className="text-sm sm:text-base font-medium text-foreground break-words mb-2">
                                  {question.question}
                                </h4>
                                <div className="mt-2">
                                  <span className="text-xs sm:text-sm text-muted-foreground">
                                    Type : <span className="font-medium text-foreground">{getTypeLabel(question.answer_type)}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedHandoverQuestion(question);
                                    setEditHandoverQuestionOpen(true);
                                  }}
                                  className="bg-accent hover:bg-accent/90 text-black font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-initial"
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedHandoverQuestion(question);
                                    setDeleteHandoverQuestionOpen(true);
                                  }}
                                  className="bg-destructive hover:bg-destructive/90 text-white font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-initial"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">
                      No handover questions added yet. Click "Add New Question" to get started.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Packages Section */}
            {activeTab === 'packages' && (
              <div className="space-y-4 sm:space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground">Plans</h2>
                    <h3 className="text-lg sm:text-xl font-semibold text-foreground mt-1 sm:mt-2">Packages</h3>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 sm:pl-10 bg-muted/50 border-border text-sm sm:text-base h-9 sm:h-10"
                      />
                    </div>
                    <Button
                      onClick={() => setAddPlanOpen(true)}
                      className="bg-accent hover:bg-accent/90 text-black font-semibold rounded-lg px-6 sm:px-8 h-9 sm:h-10 text-sm sm:text-base whitespace-nowrap"
                    >
                      Add New Package
                    </Button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl p-4 sm:p-6 lg:p-8 border border-border">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-6 sm:mb-8">Added Packages</h3>
                  
                  {plansLoading ? (
                    <div className="text-muted-foreground text-sm sm:text-base">Loading packages...</div>
                  ) : plansError ? (
                    <div className="text-destructive text-center py-8 sm:py-12 text-sm sm:text-base">
                      <p>Error loading packages: {plansError.message}</p>
                      <p className="text-xs mt-2 text-muted-foreground">Check browser console for details.</p>
                    </div>
                  ) : plans && plans.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {plans
                        .filter((plan: any) => 
                          plan.title?.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((plan: any) => (
                          <div
                            key={plan.id}
                            className="bg-white rounded-xl p-4 sm:p-6 border border-border hover:border-accent/50 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base sm:text-lg font-semibold text-foreground mb-2 break-words">
                                  {plan.title}
                                </h4>
                                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 break-words">
                                  {plan.description}
                                </p>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4">
                                  <span className="text-xs sm:text-sm text-muted-foreground">
                                    Duration: <span className="font-medium text-foreground">{plan.duration_type}</span>
                                  </span>
                                  <span className="text-xs sm:text-sm text-muted-foreground">
                                    Type: <span className="font-medium text-foreground">{plan.type}</span>
                                  </span>
                                  <span className="text-xs sm:text-sm text-muted-foreground">
                                    Price: <span className="font-medium text-foreground">{plan.price}</span>
                                  </span>
                                </div>
                                {plan.feature && plan.feature.length > 0 && (
                                  <div className="mt-3 sm:mt-4">
                                    <p className="text-xs sm:text-sm font-medium text-foreground mb-2">Features:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {plan.feature.map((feature: string, index: number) => (
                                        <li key={index} className="text-xs sm:text-sm text-muted-foreground break-words">
                                          {feature}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto sm:ml-4">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPlan(plan);
                                    setEditPlanOpen(true);
                                  }}
                                  className="bg-accent hover:bg-accent/90 text-black font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-initial"
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    setSelectedPlan(plan);
                                    setDeletePlanOpen(true);
                                  }}
                                  className="bg-destructive hover:bg-destructive/90 text-white font-medium rounded-lg h-8 sm:h-9 px-4 sm:px-6 text-xs sm:text-sm flex-1 sm:flex-initial"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12 text-muted-foreground text-sm sm:text-base">
                      No packages added yet. Click "Add New Package" to get started.
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </main>

      <Suspense fallback={null}>
        <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} />
        <EditCategoryDialog
          open={editCategoryOpen}
          onOpenChange={setEditCategoryOpen}
          category={selectedCategory}
        />
        <DeleteCategoryDialog
          open={deleteCategoryOpen}
          onOpenChange={setDeleteCategoryOpen}
          categoryId={selectedCategory?.id || null}
          categoryName={selectedCategory?.name || ""}
        />
        <AddBrandQuestionDialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen} />
        <EditBrandQuestionDialog
          open={editQuestionOpen}
          onOpenChange={setEditQuestionOpen}
          question={selectedQuestion}
        />
        <DeleteBrandQuestionDialog
          open={deleteQuestionOpen}
          onOpenChange={setDeleteQuestionOpen}
          questionId={selectedQuestion?.id || null}
          questionText={selectedQuestion?.question || ""}
        />
        <AddToolDialog open={addToolOpen} onOpenChange={setAddToolOpen} />
        <EditToolDialog
          open={editToolOpen}
          onOpenChange={setEditToolOpen}
          tool={selectedTool}
        />
        <DeleteToolDialog
          open={deleteToolOpen}
          onOpenChange={setDeleteToolOpen}
          toolId={selectedTool?.id || null}
          toolName={selectedTool?.name || ""}
        />
        <AddStatisticQuestionDialog open={addStatisticQuestionOpen} onOpenChange={setAddStatisticQuestionOpen} />
        <EditStatisticQuestionDialog
          open={editStatisticQuestionOpen}
          onOpenChange={setEditStatisticQuestionOpen}
          question={selectedStatisticQuestion}
        />
        <DeleteStatisticQuestionDialog
          open={deleteStatisticQuestionOpen}
          onOpenChange={setDeleteStatisticQuestionOpen}
          questionId={selectedStatisticQuestion?.id || null}
          questionText={selectedStatisticQuestion?.question || ""}
        />
        <AddProductQuestionDialog open={addProductQuestionOpen} onOpenChange={setAddProductQuestionOpen} />
        <EditProductQuestionDialog
          open={editProductQuestionOpen}
          onOpenChange={setEditProductQuestionOpen}
          question={selectedProductQuestion}
        />
        <DeleteProductQuestionDialog
          open={deleteProductQuestionOpen}
          onOpenChange={setDeleteProductQuestionOpen}
          questionId={selectedProductQuestion?.id || null}
          questionText={selectedProductQuestion?.question || ""}
        />
        <AddManagementQuestionDialog open={addManagementQuestionOpen} onOpenChange={setAddManagementQuestionOpen} />
        <EditManagementQuestionDialog
          open={editManagementQuestionOpen}
          onOpenChange={setEditManagementQuestionOpen}
          question={selectedManagementQuestion}
        />
        <DeleteManagementQuestionDialog
          open={deleteManagementQuestionOpen}
          onOpenChange={setDeleteManagementQuestionOpen}
          questionId={selectedManagementQuestion?.id || null}
          questionText={selectedManagementQuestion?.question || ""}
        />
        <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
        <EditAccountDialog
          open={editAccountOpen}
          onOpenChange={setEditAccountOpen}
          account={selectedAccount}
        />
        <DeleteAccountDialog
          open={deleteAccountOpen}
          onOpenChange={setDeleteAccountOpen}
          accountId={selectedAccount?.id || null}
          accountPlatform={selectedAccount?.platform || ""}
        />
        <AddAccountQuestionDialog open={addAccountQuestionOpen} onOpenChange={setAddAccountQuestionOpen} />
        <EditAccountQuestionDialog
          open={editAccountQuestionOpen}
          onOpenChange={setEditAccountQuestionOpen}
          question={selectedAccountQuestion}
        />
        <DeleteAccountQuestionDialog
          open={deleteAccountQuestionOpen}
          onOpenChange={setDeleteAccountQuestionOpen}
          questionId={selectedAccountQuestion?.id || null}
          questionText={selectedAccountQuestion?.question || ""}
        />
        <AddAdInformationQuestionDialog open={addAdInformationQuestionOpen} onOpenChange={setAddAdInformationQuestionOpen} />
        <EditAdInformationQuestionDialog
          open={editAdInformationQuestionOpen}
          onOpenChange={setEditAdInformationQuestionOpen}
          question={selectedAdInformationQuestion}
        />
        <DeleteAdInformationQuestionDialog
          open={deleteAdInformationQuestionOpen}
          onOpenChange={setDeleteAdInformationQuestionOpen}
          questionId={selectedAdInformationQuestion?.id || null}
          questionText={selectedAdInformationQuestion?.question || ""}
        />
        <AddHandoverQuestionDialog open={addHandoverQuestionOpen} onOpenChange={setAddHandoverQuestionOpen} />
        <EditHandoverQuestionDialog
          open={editHandoverQuestionOpen}
          onOpenChange={setEditHandoverQuestionOpen}
          question={selectedHandoverQuestion}
        />
        <DeleteHandoverQuestionDialog
          open={deleteHandoverQuestionOpen}
          onOpenChange={setDeleteHandoverQuestionOpen}
          questionId={selectedHandoverQuestion?.id || null}
          questionText={selectedHandoverQuestion?.question || ""}
        />
        <AddPlanDialog open={addPlanOpen} onOpenChange={setAddPlanOpen} />
        <EditPlanDialog
          open={editPlanOpen}
          onOpenChange={setEditPlanOpen}
          plan={selectedPlan}
        />
        <DeletePlanDialog
          open={deletePlanOpen}
          onOpenChange={setDeletePlanOpen}
          planId={selectedPlan?.id || null}
          planTitle={selectedPlan?.title || ""}
        />
      </Suspense>
    </div>
  );
};

export default AdminContentManagement;
