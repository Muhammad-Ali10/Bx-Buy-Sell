import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Settings, MessageSquare, Trash2, Star, CheckCircle, Edit2, ChevronRight, Loader2, Ban } from "lucide-react";
import proIcon from "@/assets/fi_5076417.svg";
import simIcon from "@/assets/sim icon.svg";
import verifiedTick from "@/assets/Tick.svg";
import { useUserDetails } from "@/hooks/useUserDetails";
import { useUserFavorites } from "@/hooks/useUserFavorites";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { getAdminUserNote, setAdminUserNote } from "@/lib/adminUserNotes";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminUserDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const { data, isLoading, refetch } = useUserDetails(id);
  const { data: userFavorites } = useUserFavorites(id);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    state: "",
    zip_code: "",
  });
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [prefsForm, setPrefsForm] = useState({
    background: "",
    businessCategories: "",
    niches: "",
    listingPriceMin: "",
    listingPriceMax: "",
    sellerLocation: "",
    targetLocation: "",
    businessAgeMin: "",
    businessAgeMax: "",
    yearlyProfitMin: "",
    yearlyProfitMax: "",
    profitMultipleMin: "",
    profitMultipleMax: "",
  });
  const [adminNote, setAdminNote] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    setAdminNote(getAdminUserNote(id));
  }, [id]);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!id) return;
      try {
        const response = await (apiClient as any).request(`/subscription/user/${id}`);
        if (response.success && response.data) {
          const data = response.data as any;
          setIsPro(data.plan?.slug === 'pro' && data.status === 'ACTIVE');
          
          // Fetch payment method if user has active subscription
          if (data.stripeCustomerId && data.status === 'ACTIVE') {
            const pmResponse = await (apiClient as any).request(`/subscription/payment-method/${id}`);
            if (pmResponse.success && pmResponse.data) {
              setPaymentMethod(pmResponse.data);
            }
          }
        }
      } catch (error) {
        console.error('Error checking user subscription:', error);
      }
    };
    checkSubscription();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">User not found</p>
        </main>
      </div>
    );
  }

  const { profile, listingsCount, favoritesCount, chatsCount } = data;
  const resolvedFavoritesCount = userFavorites?.length ?? favoritesCount;
  const preferences = (profile as any)?.preferences || null;
  const currentRole = currentUser?.role?.toUpperCase();
  const isModerator = currentRole === "MONITER" || currentRole === "MODERATOR";
  const targetRole = (profile as any)?.role?.toUpperCase() || "";
  const canModerateTarget = !isModerator || targetRole === "USER";

  const formatRange = (range?: { min?: string | null; max?: string | null }, suffix = "") => {
    if (!range) return "-";
    const min = range.min ?? "";
    const max = range.max ?? "";
    if (!min && !max) return "-";
    const minText = min ? `${min}${suffix}` : "";
    const maxText = max ? `${max}${suffix}` : "";
    return `${minText}${minText && maxText ? " - " : ""}${maxText}`.trim() || "-";
  };

  const backgroundValue = profile.background || "None of the Above";
  const businessCategoriesValue = preferences?.businessCategory?.map((c: any) => c.name).join(", ") || "None";
  const nichesValue = preferences?.niche?.map((n: any) => n.name).join(", ") || "None";
  const sellerLocationValue = preferences?.financial?.seller_location || profile.country || "Not set";
  const targetLocationValue = preferences?.financial?.revenue_multiple_range?.country || profile.country || "Not set";
  const listingPriceValue = formatRange(preferences?.financial?.revenue_multiple_range);
  const businessAgeValue = formatRange(preferences?.financial?.age_range);
  const yearlyProfitValue = formatRange(preferences?.financial?.yearly_profit_range);
  const profitMultipleValue = formatRange(preferences?.financial?.profit_multiple_range, "x");

  const openPreferencesEditor = () => {
    setPrefsForm({
      background: profile.background || "",
      businessCategories: preferences?.businessCategory?.map((c: any) => c.name).join(", ") || "",
      niches: preferences?.niche?.map((n: any) => n.name).join(", ") || "",
      listingPriceMin: preferences?.financial?.revenue_multiple_range?.min || "",
      listingPriceMax: preferences?.financial?.revenue_multiple_range?.max || "",
      sellerLocation: preferences?.financial?.seller_location || "",
      targetLocation: preferences?.financial?.revenue_multiple_range?.country || "",
      businessAgeMin: preferences?.financial?.age_range?.min || "",
      businessAgeMax: preferences?.financial?.age_range?.max || "",
      yearlyProfitMin: preferences?.financial?.yearly_profit_range?.min || "",
      yearlyProfitMax: preferences?.financial?.yearly_profit_range?.max || "",
      profitMultipleMin: preferences?.financial?.profit_multiple_range?.min || "",
      profitMultipleMax: preferences?.financial?.profit_multiple_range?.max || "",
    });
    setIsPrefsOpen(true);
  };

  const savePreferences = async () => {
    if (!id) return;
    await apiClient.updateUserPreferences(id, {
      background: prefsForm.background || null,
      businessCategories: prefsForm.businessCategories
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      niches: prefsForm.niches
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      sellerLocation: prefsForm.sellerLocation || null,
      targetLocation: prefsForm.targetLocation || null,
      listingPriceRange: {
        min: prefsForm.listingPriceMin || null,
        max: prefsForm.listingPriceMax || null,
      },
      businessAgeRange: {
        min: prefsForm.businessAgeMin || null,
        max: prefsForm.businessAgeMax || null,
      },
      yearlyProfitRange: {
        min: prefsForm.yearlyProfitMin || null,
        max: prefsForm.yearlyProfitMax || null,
      },
      profitMultipleRange: {
        min: prefsForm.profitMultipleMin || null,
        max: prefsForm.profitMultipleMax || null,
      },
    });
    await refetch();
    setIsPrefsOpen(false);
  };

  const openInfoEditor = () => {
    setInfoForm({
      first_name: profile.first_name || "",
      last_name: profile.last_name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      address: profile.address || "",
      city: profile.city || "",
      country: profile.country || "",
      state: profile.state || "",
      zip_code: profile.zip || profile.zip_code || "",
    });
    setIsEditingInfo(true);
  };

  const saveInfo = async () => {
    if (!id) return;
    setIsSavingInfo(true);
    try {
      const response = await apiClient.updateUserByAdmin(id, {
        first_name: infoForm.first_name || "",
        last_name: infoForm.last_name || "",
        email: infoForm.email || "",
        phone: infoForm.phone || "",
        address: infoForm.address || "",
        city: infoForm.city || "",
        country: infoForm.country || "",
        state: infoForm.state || "",
        zip_code: infoForm.zip_code || "",
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to update user");
      }
      toast.success("User information updated");
      await refetch();
      setIsEditingInfo(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    } finally {
      setIsSavingInfo(false);
    }
  };
  const handleMessageUser = () => {
    if (!id) return;
    navigate(`/admin/users/${id}/chats`);
  };

  const handleBlockUser = async () => {
    if (!id) return;
    if (!canModerateTarget) {
      toast.error("You can only block normal users.");
      return;
    }
    const confirmed = window.confirm("Block this user?");
    if (!confirmed) return;
    try {
      const response = await apiClient.updateUser(id, { verified: false });
      if (!response.success) {
        throw new Error(response.error || "Failed to block user");
      }
      toast.success("User blocked");
      await refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to block user");
    }
  };

  const handleDeleteUser = async () => {
    if (!id) return;
    if (!canModerateTarget) {
      toast.error("You can only delete normal users.");
      return;
    }
    const confirmed = window.confirm("Delete this user? This action cannot be undone.");
    if (!confirmed) return;
    try {
      const response = await apiClient.deleteUser(id);
      if (!response.success) {
        throw new Error(response.error || "Failed to delete user");
      }
      toast.success("User deleted");
      navigate("/admin/users");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
    }
  };
  const isOnline = Boolean((profile as any)?.is_online);
  const rating = (profile as any)?.rating ?? 4.8;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1">
        <AdminHeader title="User Details" />

        <div className="p-8 space-y-6">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 p-0 hover:bg-transparent"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="h-4 w-4 text-black" />
            <span
              className="font-outfit font-bold text-[18px] leading-[100%] text-black"
            >
              All Users
            </span>
          </Button>

          {/* User Profile Header */}
          <Card
            className="p-6 bg-card border-border"
            style={{
              borderRadius: '24px',
              background: '#FFFFFF',
              boxShadow: '0px 3px 33px 0px #00000017',
              height: 'auto',
            }}
          >
            <div className="flex items-start justify-between gap-6 w-full">
              <div className="flex items-start gap-[20px]">
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="h-20 w-20"
                    style={{ width: '72px', height: '72px', borderRadius: '80px' }}
                  >
                    {profile.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                    <AvatarFallback className="text-xl">
                      {profile.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isPro && (
                    <div
                      className="absolute"
                      style={{
                        width: '48px',
                        height: '21px',
                        borderRadius: '13.04px',
                        paddingTop: '1.96px',
                        paddingBottom: '1.96px',
                        background: '#C6FE1F',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2.61px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bottom: '-10px',
                      }}
                    >
                      <img src={proIcon} alt="Pro" style={{ width: '12px', height: '12px' }} />
                      <span
                        className="font-lufga"
                        style={{
                          fontWeight: 500,
                          fontSize: '11px',
                          lineHeight: '120%',
                          letterSpacing: '0%',
                          color: '#000000',
                        }}
                      >
                        Pro
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2
                      className="truncate font-lufga"
                      style={{
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {profile.full_name || "Unknown User"}
                    </h2>
                    <img src={verifiedTick} alt="Verified" style={{ width: '18px', height: '18px' }} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-0.5 text-yellow-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-yellow-500 stroke-yellow-500" />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">({rating})</span>
                  </div>
                  <Badge
                    variant="accent"
                    className={`mt-3 rounded-full px-3 py-0.5 text-xs ${isOnline ? "bg-accent/20 text-accent border-accent/30" : "bg-yellow-500/20 text-yellow-700 border-yellow-500/30"}`}
                  >
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>

              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4 min-w-[150px]">
                  <span style={{ fontFamily: 'ABeeZee', fontSize: '14px', lineHeight: '100%', color: '#000000' }}>Email Verified</span>
                  {(profile as any)?.email_verified ? (
                    <img src={verifiedTick} alt="Verified" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    <span className="inline-flex h-[18px] w-[18px] rounded-full border border-[#D9D9D9] bg-[#F5F5F5]" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 min-w-[150px]">
                  <span style={{ fontFamily: 'ABeeZee', fontSize: '14px', lineHeight: '100%', color: '#000000' }}>Funds Verified</span>
                  {(profile as any)?.funds_verified ? (
                    <img src={verifiedTick} alt="Verified" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    <span className="inline-flex h-[18px] w-[18px] rounded-full border border-[#D9D9D9] bg-[#F5F5F5]" />
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4 min-w-[150px]">
                  <span style={{ fontFamily: 'ABeeZee', fontSize: '14px', lineHeight: '100%', color: '#000000' }}>Phone Verified</span>
                  {(profile as any)?.phone_verified ? (
                    <img src={verifiedTick} alt="Verified" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    <span className="inline-flex h-[18px] w-[18px] rounded-full border border-[#D9D9D9] bg-[#F5F5F5]" />
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 min-w-[150px]">
                  <span style={{ fontFamily: 'ABeeZee', fontSize: '14px', lineHeight: '100%', color: '#000000' }}>ID Verified</span>
                  {(profile as any)?.id_verified ? (
                    <img src={verifiedTick} alt="Verified" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    <span className="inline-flex h-[18px] w-[18px] rounded-full border border-[#D9D9D9] bg-[#F5F5F5]" />
                  )}
                </div>
              </div>

              <div className="min-w-[220px]">
                <p
                  className="mb-2"
                  style={{
                    fontFamily: 'Outfit',
                    fontWeight: 400,
                    fontSize: '14px',
                    lineHeight: '100%',
                    letterSpacing: '0px',
                    color: '#000000',
                  }}
                >
                  Notes (Text Field)
                </p>
                <Textarea
                  placeholder="Type important notes about this user..."
                  className="min-h-[44px] resize-none bg-muted/30 border-border"
                  value={adminNote}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setAdminNote(nextValue);
                    if (id) {
                      setAdminUserNote(id, nextValue);
                    }
                  }}
                />
              </div>

              {!isModerator && (
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="bg-accent text-black hover:bg-accent/90 rounded-full px-6">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-2xl border-border p-2">
                      <DropdownMenuItem className="rounded-xl" onClick={handleMessageUser}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </DropdownMenuItem>
                      {canModerateTarget && (
                        <DropdownMenuItem className="rounded-xl" onClick={handleBlockUser}>
                          <Ban className="h-4 w-4 mr-2" />
                          Block
                        </DropdownMenuItem>
                      )}
                      {canModerateTarget && (
                        <DropdownMenuItem className="rounded-xl text-destructive" onClick={handleDeleteUser}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <div className="my-6 w-full border-t" style={{ borderColor: '#00000040' }} />

            {/* Personal + Address */}
            <div className="grid grid-cols-2 items-center mb-4">
              <h3
                className="font-lufga"
                style={{
                  fontWeight: 500,
                  fontSize: '20px',
                  lineHeight: '140%',
                  letterSpacing: '0%',
                  color: '#000000',
                }}
              >
                Personal Information
              </h3>
              <div className="flex items-center justify-between">
                <h3
                  className="font-lufga"
                  style={{
                    fontWeight: 500,
                    fontSize: '20px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: '#000000',
                  }}
                >
                  Address Information
                </h3>
                {isEditingInfo ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingInfo(false)}
                      disabled={isSavingInfo}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveInfo}
                      disabled={isSavingInfo}
                      className="bg-accent text-black hover:bg-accent/90"
                    >
                      {isSavingInfo ? "Saving..." : "Save"}
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" onClick={openInfoEditor}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>First Name</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.first_name}
                      onChange={(e) => setInfoForm({ ...infoForm, first_name: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.first_name || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Last Name</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.last_name}
                      onChange={(e) => setInfoForm({ ...infoForm, last_name: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.last_name || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Email</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.email}
                      onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                      className="h-8 max-w-[260px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.email || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Phone Nr.</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.phone}
                      onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.phone || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Birthday</span>
                  <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>{profile.birthday || "-"}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Address</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.address}
                      onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
                      className="h-8 max-w-[260px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.address || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>City</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.city}
                      onChange={(e) => setInfoForm({ ...infoForm, city: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.city || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Country</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.country}
                      onChange={(e) => setInfoForm({ ...infoForm, country: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.country || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>State</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.state}
                      onChange={(e) => setInfoForm({ ...infoForm, state: e.target.value })}
                      className="h-8 max-w-[220px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.state || "-"}</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Zip Code</span>
                  {isEditingInfo ? (
                    <Input
                      value={infoForm.zip_code}
                      onChange={(e) => setInfoForm({ ...infoForm, zip_code: e.target.value })}
                      className="h-8 max-w-[160px]"
                    />
                  ) : (
                    <span style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', textAlign: 'left' }}>{profile.zip || "-"}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Information */}
          <Card
            className="p-5 bg-card border-border"
            style={{
              borderRadius: '20px',
              background: '#FFFFFF',
              boxShadow: '0px 3px 33px 0px #00000017',
            }}
          >
            <h3
              className="font-lufga mb-4"
              style={{
                fontWeight: 500,
                fontSize: '20px',
                lineHeight: '140%',
                letterSpacing: '0%',
                color: '#000000',
              }}
            >
              Payment Information
            </h3>
            <div className="flex items-start" style={{ columnGap: '50px' }}>
              <div
                className="p-5"
                style={{
                  width: '389px',
                  height: '218px',
                  borderRadius: '19.55px',
                  background: '#C6FE1F',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div className="flex items-start justify-between">
                  <img src={simIcon} alt="SIM" style={{ width: '50px', height: '35px' }} />
                  <span style={{ fontFamily: 'Helvetica Now Display', fontWeight: 700, fontSize: '16px', color: '#000000' }}>
                    {paymentMethod?.brand?.toUpperCase() || 'VISA'}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'Helvetica Now Display',
                    fontWeight: 700,
                    fontSize: '19.55px',
                    lineHeight: '100%',
                    letterSpacing: '7%',
                    color: '#000000',
                  }}
                >
                  **** **** **** {paymentMethod?.last4 || '****'}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div
                      style={{
                        fontFamily: 'Helvetica Now Display',
                        fontWeight: 400,
                        fontSize: '11.73px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000099',
                      }}
                    >
                      Exp {paymentMethod ? `${paymentMethod.expMonth}/${paymentMethod.expYear?.toString().slice(-2)}` : '-/-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      style={{
                        fontFamily: 'Helvetica Neue',
                        fontWeight: 700,
                        fontSize: '12px',
                        lineHeight: '100%',
                        letterSpacing: '7%',
                        color: '#000000',
                      }}
                    >
                      CVV
                    </div>
                    <div
                      style={{
                        fontFamily: 'Helvetica Neue',
                        fontWeight: 400,
                        fontSize: '12px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000099',
                      }}
                    >
                      ***
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: 'auto auto',
                  columnGap: '40px',
                  rowGap: '14px',
                  marginRight: '40px',
                }}
              >
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Card Type</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  {paymentMethod ? (paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)) : '-'}
                </div>
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Card Holder</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  {paymentMethod?.holderName || profile.full_name || "-"}
                </div>
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Expire</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  {paymentMethod ? `${String(paymentMethod.expMonth).padStart(2, '0')}/${paymentMethod.expYear}` : '-'}
                </div>
                <div style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#00000080' }}>Card Number</div>
                <div style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '18px', lineHeight: '140%', letterSpacing: '0%', color: '#000000' }}>
                  **** **** **** {paymentMethod?.last4 || '****'}
                </div>
              </div>
            </div>
          </Card>

          {/* User Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-4">User Stats</h3>
            <div className="grid grid-cols-3 gap-[24px]">
              <Card 
                className="p-5 bg-card border-border cursor-pointer"
                style={{
                  width: '316px',
                  height: '148px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  boxShadow: '0px 3px 33px 0px #00000012',
                }}
                onClick={() => navigate(`/admin/users/${id}/listings`)}
              >
                <div className="flex h-full justify-between">
                  <div className="flex flex-col" style={{ gap: '32px' }}>
                    <p
                      style={{
                        fontFamily: 'ABeeZee',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Users Listings
                    </p>
                    <p
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {listingsCount}
                    </p>
                  </div>
                  <ChevronRight
                    className="self-center"
                    style={{
                      width: '23.000001907348633px',
                      height: '23.00000000000002px',
                      color: '#000000',
                      marginRight: '4px',
                    }}
                  />
                </div>
              </Card>
              <Card 
                className="p-5 bg-card border-border cursor-pointer"
                style={{
                  width: '316px',
                  height: '148px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  boxShadow: '0px 3px 33px 0px #00000012',
                }}
                onClick={() => navigate(`/admin/users/${id}/favorites`)}
              >
                <div className="flex h-full justify-between">
                  <div className="flex flex-col" style={{ gap: '32px' }}>
                    <p
                      style={{
                        fontFamily: 'ABeeZee',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Users Favorite's
                    </p>
                    <p
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {resolvedFavoritesCount}
                    </p>
                  </div>
                  <ChevronRight
                    className="self-center"
                    style={{
                      width: '23.000001907348633px',
                      height: '23.00000000000002px',
                      color: '#000000',
                      marginRight: '4px',
                    }}
                  />
                </div>
              </Card>
              <Card 
                className="p-5 bg-card border-border cursor-pointer"
                style={{
                  width: '316px',
                  height: '148px',
                  borderRadius: '24px',
                  background: '#FFFFFF',
                  boxShadow: '0px 3px 33px 0px #00000012',
                }}
                onClick={() => navigate(`/admin/users/${id}/chats`)}
              >
                <div className="flex h-full justify-between">
                  <div className="flex flex-col" style={{ gap: '32px' }}>
                    <p
                      style={{
                        fontFamily: 'ABeeZee',
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Users Chats
                    </p>
                    <p
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {chatsCount}
                    </p>
                  </div>
                  <ChevronRight
                    className="self-center"
                    style={{
                      width: '23.000001907348633px',
                      height: '23.00000000000002px',
                      color: '#000000',
                      marginRight: '4px',
                    }}
                  />
                </div>
              </Card>
            </div>
          </div>

          {/* Buying Profiles */}
          <Card
            className="p-6 bg-card border-border"
            style={{
              borderRadius: '20px',
              background: '#FFFFFF',
              boxShadow: '0px 3px 33px 0px #00000017',
              height: 'auto',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="font-lufga"
                style={{
                  fontWeight: 500,
                  fontSize: '20px',
                  lineHeight: '140%',
                  letterSpacing: '0%',
                  color: '#000000',
                }}
              >
                Buying Profiles & Alerts of this User
              </h3>
              <Button variant="ghost" size="icon" onClick={openPreferencesEditor}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-[50px]">
              <div className="space-y-[50px]">
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>What Is Your Background ?</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{backgroundValue}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>Select Business Categories</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{businessCategoriesValue}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>What Is Your Niches ?</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{nichesValue}</p>
                </div>
              </div>
              <div className="space-y-[50px]">
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>Finance Data</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{listingPriceValue}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>Seller Location</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{sellerLocationValue}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>Target Location</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{targetLocationValue}</p>
                </div>
              </div>
              <div className="space-y-[50px]">
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>Business Age</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{businessAgeValue}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>Yearly Profit</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{yearlyProfitValue}</p>
                </div>
                <div>
                  <p style={{ fontFamily: 'Lufga', fontWeight: 500, fontSize: '14px', lineHeight: '140%', letterSpacing: '0%', color: '#000000', marginBottom: '30px' }}>X Profit Multiple</p>
                  <p style={{ fontFamily: 'ABeeZee', fontWeight: 400, fontSize: '14px', lineHeight: '100%', letterSpacing: '0px', color: '#000000' }}>{profitMultipleValue}</p>
                </div>
              </div>
            </div>
          </Card>

          <Dialog open={isPrefsOpen} onOpenChange={setIsPrefsOpen}>
            <DialogContent className="max-w-3xl [&>button]:hidden" showClose={false}>
              <DialogHeader>
                <DialogTitle>Editing Buying Profile</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Background</label>
                  <Input
                    value={prefsForm.background}
                    onChange={(e) => setPrefsForm({ ...prefsForm, background: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Business Categories (comma separated)</label>
                  <Input
                    value={prefsForm.businessCategories}
                    onChange={(e) => setPrefsForm({ ...prefsForm, businessCategories: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Niches (comma separated)</label>
                  <Input
                    value={prefsForm.niches}
                    onChange={(e) => setPrefsForm({ ...prefsForm, niches: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Listing Price Min</label>
                  <Input
                    value={prefsForm.listingPriceMin}
                    onChange={(e) => setPrefsForm({ ...prefsForm, listingPriceMin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Listing Price Max</label>
                  <Input
                    value={prefsForm.listingPriceMax}
                    onChange={(e) => setPrefsForm({ ...prefsForm, listingPriceMax: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Seller Location</label>
                  <Input
                    value={prefsForm.sellerLocation}
                    onChange={(e) => setPrefsForm({ ...prefsForm, sellerLocation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Target Location</label>
                  <Input
                    value={prefsForm.targetLocation}
                    onChange={(e) => setPrefsForm({ ...prefsForm, targetLocation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Business Age Min</label>
                  <Input
                    value={prefsForm.businessAgeMin}
                    onChange={(e) => setPrefsForm({ ...prefsForm, businessAgeMin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Business Age Max</label>
                  <Input
                    value={prefsForm.businessAgeMax}
                    onChange={(e) => setPrefsForm({ ...prefsForm, businessAgeMax: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Yearly Profit Min</label>
                  <Input
                    value={prefsForm.yearlyProfitMin}
                    onChange={(e) => setPrefsForm({ ...prefsForm, yearlyProfitMin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Yearly Profit Max</label>
                  <Input
                    value={prefsForm.yearlyProfitMax}
                    onChange={(e) => setPrefsForm({ ...prefsForm, yearlyProfitMax: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Profit Multiple Min</label>
                  <Input
                    value={prefsForm.profitMultipleMin}
                    onChange={(e) => setPrefsForm({ ...prefsForm, profitMultipleMin: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Profit Multiple Max</label>
                  <Input
                    value={prefsForm.profitMultipleMax}
                    onChange={(e) => setPrefsForm({ ...prefsForm, profitMultipleMax: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsPrefsOpen(false)}>
                  Cancel
                </Button>
                <Button className="bg-accent text-black hover:bg-accent/90" onClick={savePreferences}>
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
