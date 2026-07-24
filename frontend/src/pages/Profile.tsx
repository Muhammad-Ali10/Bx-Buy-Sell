import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Mail, MapPin, Phone, LogOut, ArrowLeft, CreditCard } from "lucide-react";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import { DashboardHeader } from "@/components/listings/DashboardHeader";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  user_type: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  state: string | null;
  zip_code: string | null;
  birthday: string | null;
  availability_status: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    id: "",
    first_name: "",
    last_name: "",
    company_name: "",
    user_type: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    state: "",
    zip_code: "",
    birthday: "",
    availability_status: "available",
  });
  const [paymentInfo, setPaymentInfo] = useState({
    cardType: "Visa",
    cardHolder: "",
    expire: "",
    cardNumber: "",
    cvv: "",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    } else if (isAuthenticated && user) {
      loadProfile(user.id);
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  const loadProfile = async (userId: string) => {
    try {
      const response = await apiClient.getUserById(userId);
      
      if (response.success && response.data) {
        const userData = response.data;
        setProfile({
          id: userData.id,
          first_name: userData.first_name || "",
          last_name: userData.last_name || "",
          company_name: userData.business_name || "",
          user_type: userData.role || "",
          phone: userData.phone || "",
          address: userData.address || "",
          city: userData.city || "",
          country: userData.country || "",
          state: userData.state || "",
          zip_code: userData.zip_code || "",
          birthday: "",
          availability_status: userData.is_online ? "available" : "offline",
        });
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        setPaymentInfo((prev) => ({
          ...prev,
          cardHolder: prev.cardHolder || fullName || "Card Holder",
        }));
      }
    } catch (error: any) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);

    try {
      const response = await apiClient.updateUser(user.id, {
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        business_name: profile.company_name || undefined,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        city: profile.city || undefined,
        country: profile.country || undefined,
        state: profile.state || undefined,
        zip_code: profile.zip_code || undefined,
        availability_status: profile.availability_status || undefined,
      });

      if (response.success) {
        toast.success("Profile updated successfully!");
      } else {
        toast.error(response.error || "Failed to update profile");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/");
    } catch (error: any) {
      toast.error("Failed to log out");
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const displayName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "User";
  const profileImage = user?.profile_pic || "/placeholder.svg";

  return (
    <div className="flex min-h-screen bg-background">
      <ListingsSidebar isMobile={false} />

      <div className="flex-1 w-full md:w-auto md:ml-56 lg:ml-[240px] xl:ml-[280px]">
        <DashboardHeader />

        <div className="p-4 sm:p-6 lg:p-8 bg-gray-100">
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>

          <div className="w-full rounded-[32px] border border-black/10 bg-white p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-black">Your Account Details</h1>

            <form onSubmit={handleSave} className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(260px,410px)_minmax(320px,1fr)_minmax(260px,410px)]">
                <div className="rounded-[20px] bg-[#FAFAFA] p-4 md:p-5">
                  <div className="overflow-hidden rounded-[20px]">
                    <img
                      src={profileImage}
                      alt={displayName}
                      className="h-[200px] w-full object-cover md:h-[238px]"
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <h2 className="text-[24px] md:text-[32px] font-bold leading-[140%] text-black">
                      {displayName}
                    </h2>
                    <Button
                      type="button"
                      className="h-[55px] w-full rounded-full border border-black/10 bg-[#0F62FF] text-white hover:bg-[#0F62FF]/90"
                    >
                      Balance: $5,000
                    </Button>
                  </div>

                  <div className="my-5 h-px w-full bg-black/10" />

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-black/50" />
                      <Input
                        value={profile.country || ""}
                        onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                        placeholder="United States"
                        className="h-auto border-transparent bg-transparent p-0 text-[18px] md:text-[20px] font-medium text-black/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-black/50" />
                      <Input
                        value={user?.email || ""}
                        disabled
                        className="h-auto border-transparent bg-transparent p-0 text-[18px] md:text-[20px] font-medium text-black/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-black/50" />
                      <Input
                        value={profile.phone || ""}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="(704) 555-0127"
                        className="h-auto border-transparent bg-transparent p-0 text-[18px] md:text-[20px] font-medium text-black/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[20px] bg-[#FAFAFA] p-4 md:p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-black">Personal Information</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">First Name</Label>
                        <Input
                          value={profile.first_name || ""}
                          onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Last Name</Label>
                        <Input
                          value={profile.last_name || ""}
                          onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Email</Label>
                        <Input
                          value={user?.email || ""}
                          disabled
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Phone Nr.</Label>
                        <Input
                          value={profile.phone || ""}
                          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Birthday</Label>
                        <Input
                          value={profile.birthday || ""}
                          onChange={(e) => setProfile({ ...profile, birthday: e.target.value })}
                          placeholder="28 Feb 1999"
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-[#FAFAFA] p-4 md:p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-base font-semibold text-black">Address Information</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Address</Label>
                        <Input
                          value={profile.address || ""}
                          onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                          placeholder="898 Brooklyn Simmons"
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">City</Label>
                        <Input
                          value={profile.city || ""}
                          onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                          placeholder="Boston"
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Country</Label>
                        <Input
                          value={profile.country || ""}
                          onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                          placeholder="United States"
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">State</Label>
                        <Input
                          value={profile.state || ""}
                          onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                          placeholder="Massachusetts"
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Zip Code</Label>
                        <Input
                          value={profile.zip_code || ""}
                          onChange={(e) => setProfile({ ...profile, zip_code: e.target.value })}
                          placeholder="02110"
                          className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] bg-[#FAFAFA] p-4 md:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-black">Payment Information</h3>
                  </div>
                  <div className="rounded-[20px] bg-[#0F62FF] p-4 text-white">
                    <div className="flex items-center justify-between">
                      <CreditCard className="h-6 w-6" />
                      <span className="text-sm font-semibold uppercase">{paymentInfo.cardType}</span>
                    </div>
                    <div className="mt-8 text-[19.55px] font-bold tracking-[0.07em]">
                      {paymentInfo.cardNumber || "**** **** **** 8174"}
                    </div>
                    <div className="mt-2 text-xs opacity-80">Exp {paymentInfo.expire || "3/28"}</div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Card Type</Label>
                      <Input
                        value={paymentInfo.cardType}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, cardType: e.target.value })}
                        className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Card Holder</Label>
                      <Input
                        value={paymentInfo.cardHolder}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, cardHolder: e.target.value })}
                        className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Expire</Label>
                      <Input
                        value={paymentInfo.expire}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, expire: e.target.value })}
                        placeholder="08/2026"
                        className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">Card Number</Label>
                      <Input
                        value={paymentInfo.cardNumber}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, cardNumber: e.target.value })}
                        placeholder="**** **** **** 8174"
                        className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <Label className="min-w-[120px] shrink-0 whitespace-nowrap text-[18px] font-normal text-black/50">CVV</Label>
                      <Input
                        value={paymentInfo.cvv}
                        onChange={(e) => setPaymentInfo({ ...paymentInfo, cvv: e.target.value })}
                        placeholder="235"
                        className="h-auto border-transparent bg-transparent p-0 text-right text-[18px] font-medium text-black focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
