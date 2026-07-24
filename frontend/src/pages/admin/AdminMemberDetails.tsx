import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, CheckCircle, Check, Star, MessageSquare, Ban, Trash2, Edit, Save, X, Eye, EyeOff } from "lucide-react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminListings } from "@/hooks/useAdminListings";

export default function AdminMemberDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: adminListings, isLoading: listingsLoading } = useAdminListings();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMember, setEditedMember] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState({
    managedChats: 0,
    activityLog: 0,
    loading: false,
  });
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const isSuperAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    if (id) {
      loadMemberData();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let isActive = true;
    const loadStats = async () => {
      try {
        setStats((prev) => ({ ...prev, loading: true }));
        const [chatCountRes, activityCountRes] = await Promise.all([
          apiClient.getChatCount(id),
          apiClient.getActivityLogCount(id),
        ]);

        const managedChats =
          chatCountRes?.success && chatCountRes?.data
            ? Number(
                (chatCountRes.data as { count?: number; data?: { count?: number } })?.count ??
                  (chatCountRes.data as { data?: { count?: number } })?.data?.count ??
                  0
              )
            : 0;

        const activityLog =
          activityCountRes?.success && activityCountRes?.data
            ? Number(
                (activityCountRes.data as { log_count?: number; data?: { log_count?: number } })?.log_count ??
                  (activityCountRes.data as { data?: { log_count?: number } })?.data?.log_count ??
                  0
              )
            : 0;

        if (isActive) {
          setStats({
            managedChats,
            activityLog,
            loading: false,
          });
        }
      } catch (error) {
        console.error("Failed to load member stats:", error);
        if (isActive) {
          setStats((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    loadStats();
    return () => {
      isActive = false;
    };
  }, [id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };

    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);

  const loadMemberData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserById(id!);
      if (response.success && response.data) {
        const userData = response.data as {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          role?: string;
          profile_pic?: string | null;
          created_at?: string;
          createdAt?: string;
        };
        const memberData = {
          id: userData.id,
          first_name: userData.first_name || "",
          last_name: userData.last_name || "",
          full_name: userData.first_name && userData.last_name
            ? `${userData.first_name} ${userData.last_name}`.trim()
            : userData.first_name || userData.last_name || "Unknown",
          email: userData.email || "",
          role: userData.role || "",
          avatar_url: userData.profile_pic || null,
          created_at: userData.created_at || userData.createdAt || new Date().toISOString(),
        };
        setMember(memberData);
        setEditedMember(memberData);
      } else {
        toast.error("Failed to load member details");
        navigate("/admin/team");
      }
    } catch (error) {
      console.error("Error loading member:", error);
      toast.error("Failed to load member details");
      navigate("/admin/team");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedMember || !id) return;
    
    try {
      if (newPassword && newPassword.trim().length > 0 && newPassword.trim().length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
      setSaving(true);
      const updateData: any = {};
      
      if (editedMember.first_name !== member.first_name || editedMember.last_name !== member.last_name) {
        updateData.first_name = editedMember.first_name;
        updateData.last_name = editedMember.last_name;
      }
      
      if (editedMember.email !== member.email) {
        updateData.email = editedMember.email;
      }
      
      if (editedMember.role !== member.role) {
        updateData.role = editedMember.role;
      }
      
      if (newPassword && newPassword.trim().length > 0) {
        updateData.password_hash = newPassword.trim();
      }

      const response = await apiClient.updateUserByAdmin(id, updateData);
      
      if (response.success) {
        toast.success("Member updated successfully");
        setIsEditing(false);
        setNewPassword("");
        await loadMemberData();
      } else {
        toast.error(response.error || "Failed to update member");
      }
    } catch (error) {
      console.error("Error updating member:", error);
      toast.error("Failed to update member");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedMember(member);
    setNewPassword("");
    setIsEditing(false);
  };

  const managedListingsCount = useMemo(() => {
    if (!member?.id || !adminListings) return 0;
    return adminListings.filter((listing: any) => listing.responsible_user_id === member.id).length;
  }, [adminListings, member?.id]);

  const handleChat = () => {
    setIsSettingsOpen(false);
    // Navigate to chat with this user
    navigate(`/admin/chat?userId=${id}`);
  };

  const handleBlock = async () => {
    if (!id || !currentUser?.id) return;
    if (!isSuperAdmin) {
      toast.error("You don't have permission to block team members.");
      return;
    }
    
    setIsSettingsOpen(false);
    
    if (!confirm("Are you sure you want to block this user?")) {
      return;
    }
    
    try {
      // Block user in chat system
      const blockResponse = await apiClient.blockUser(currentUser.id, id);
      
      // Update user's availability status to offline (blocked)
      const updateResponse = await apiClient.updateUserByAdmin(id, {
        availability_status: 'offline',
      });
      
      if (blockResponse.success && updateResponse.success) {
        toast.success("User blocked successfully");
        // Invalidate team members query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["team-members"] });
        await loadMemberData();
      } else {
        toast.error(blockResponse.error || updateResponse.error || "Failed to block user");
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      toast.error("Failed to block user");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!isSuperAdmin) {
      toast.error("You don't have permission to delete team members.");
      return;
    }
    
    setIsSettingsOpen(false);
    
    if (!confirm("Are you sure you want to delete this member? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await apiClient.deleteUser(id);
      if (response.success) {
        toast.success("Member deleted successfully");
        navigate("/admin/team");
      } else {
        toast.error(response.error || "Failed to delete member");
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      toast.error("Failed to delete member");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 w-full min-w-0 overflow-x-hidden">
          <AdminHeader title="Member Details" />
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </main>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1 w-full min-w-0 overflow-x-hidden">
        <AdminHeader title="Member Details" />

        <div className="p-4 sm:p-6 lg:p-8">
          {/* Heading */}
          <h1 
            className="font-lufga mb-6"
            style={{
              fontWeight: 600,
              fontSize: '28px',
              lineHeight: '100%',
              letterSpacing: '0%',
              color: '#000000',
            }}
          >
            Member Details
          </h1>

          {/* Back Arrow with Team Members */}
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/team")}
            className="mb-6 p-0 h-auto hover:bg-transparent"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-5 w-5" style={{ color: '#000000' }} />
              <span 
                className="font-outfit font-bold"
                style={{
                  fontSize: '18px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  color: '#000000',
                }}
              >
                Team Members
              </span>
            </div>
          </Button>

          {/* Content Card */}
          <div
            className="w-full relative"
            style={{
              minHeight: '468px',
              borderRadius: '24px',
              background: '#FFFFFF',
              boxShadow: '0px 3px 33px 0px #00000017',
              padding: '24px',
            }}
          >
            {/* Top Header Section with Avatar, Name, Rating, and Settings */}
            <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <Avatar className="h-20 w-20">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="text-xl bg-gray-200">
                    {member.full_name
                      ? member.full_name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "U"}
                  </AvatarFallback>
                </Avatar>

                {/* Name, Checkmark, and Rating */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 
                      className="font-lufga font-bold"
                      style={{
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {member.full_name}
                    </h2>
                    <div 
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#15CA32',
                      }}
                    >
                      <Check 
                        className="h-3 w-3" 
                        style={{ 
                          stroke: '#FFFFFF',
                          strokeWidth: 3,
                          color: '#FFFFFF',
                        }} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i}
                        className="h-4 w-4 flex-shrink-0" 
                        style={{ 
                          fill: '#FFD700', 
                          stroke: '#FFD700',
                          color: '#FFD700',
                        }} 
                      />
                    ))}
                    <span 
                      className="font-outfit ml-1"
                      style={{
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#6B7280',
                      }}
                    >
                      (4.8)
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings Button with Dropdown */}
              <div className="relative" ref={settingsRef}>
                <Button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  style={{
                    borderRadius: '60px',
                    background: '#C6FE1F',
                    fontFamily: 'Lufga',
                    fontWeight: 500,
                    fontSize: '16px',
                    lineHeight: '140%',
                    letterSpacing: '0%',
                    color: '#000000',
                    padding: '12px 24px',
                  }}
                >
                  Settings
                </Button>

                {/* Dropdown Menu */}
                {isSettingsOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 z-50"
                    style={{
                      borderRadius: '12px',
                      background: '#FFFFFF',
                      border: '1px solid #C6FE1F',
                      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
                      padding: '8px',
                      minWidth: '120px',
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Chat Button */}
                      <button
                        onClick={handleChat}
                        className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                        style={{
                          background: '#F3F4F6',
                          borderRadius: '8px',
                        }}
                      >
                        <MessageSquare className="h-5 w-5 flex-shrink-0" style={{ color: '#000000' }} />
                        <span 
                          className="font-outfit"
                          style={{
                            fontSize: '14px',
                            color: '#000000',
                          }}
                        >
                          Chat
                        </span>
                      </button>

                      {isSuperAdmin && (
                        <button
                          onClick={handleBlock}
                          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                          style={{
                            background: '#F3F4F6',
                            borderRadius: '8px',
                          }}
                        >
                          <Ban className="h-5 w-5 flex-shrink-0" style={{ color: '#000000' }} />
                          <span 
                            className="font-outfit"
                            style={{
                              fontSize: '14px',
                              color: '#000000',
                            }}
                          >
                            Block
                          </span>
                        </button>
                      )}

                      {isSuperAdmin && (
                        <button
                          onClick={handleDelete}
                          className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                          style={{
                            background: '#F3F4F6',
                            borderRadius: '8px',
                          }}
                        >
                          <Trash2 className="h-5 w-5 flex-shrink-0" style={{ color: '#000000' }} />
                          <span 
                            className="font-outfit"
                            style={{
                              fontSize: '14px',
                              color: '#000000',
                            }}
                          >
                            Delete
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div>
              {/* Member Information Section */}
              <div
                style={{
                  width: '468px',
                  height: '179px',
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 
                    className="font-outfit font-semibold"
                    style={{
                      fontSize: '18px',
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      color: '#000000',
                    }}
                  >
                    Member Information
                  </h3>
                  {isSuperAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        if (isEditing) {
                          handleSave();
                        } else {
                          setIsEditing(true);
                        }
                      }}
                    >
                      {isEditing ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Edit className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Information Fields - Each Row with Specific Layout */}
                <div className="space-y-4">
                  {/* Username Row */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '468px',
                      height: '25px',
                      justifyContent: 'space-between',
                      opacity: 1,
                    }}
                  >
                    <label 
                      className="font-abeezee"
                      style={{
                        fontWeight: 400,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Username
                    </label>
                    {isEditing && isSuperAdmin ? (
                      <div className="flex gap-2 items-center justify-end">
                        <Input
                          value={editedMember?.first_name || ""}
                          onChange={(e) => setEditedMember({ ...editedMember, first_name: e.target.value })}
                          className="w-32 text-right"
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '18px',
                            lineHeight: '140%',
                            letterSpacing: '0%',
                            color: '#000000',
                            height: '25px',
                          }}
                        />
                        <Input
                          value={editedMember?.last_name || ""}
                          onChange={(e) => setEditedMember({ ...editedMember, last_name: e.target.value })}
                          className="w-32 text-right"
                          style={{
                            fontFamily: 'Lufga',
                            fontWeight: 500,
                            fontSize: '18px',
                            lineHeight: '140%',
                            letterSpacing: '0%',
                            color: '#000000',
                            height: '25px',
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleCancel}
                          className="h-6 w-6"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span 
                        className="font-lufga"
                        style={{
                          fontWeight: 500,
                          fontSize: '18px',
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: '#000000',
                          textAlign: 'right',
                        }}
                      >
                        {member.full_name || "N/A"}
                      </span>
                    )}
                  </div>

                  {/* Email Row */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '468px',
                      height: '25px',
                      justifyContent: 'space-between',
                      opacity: 1,
                    }}
                  >
                    <label 
                      className="font-abeezee"
                      style={{
                        fontWeight: 400,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Email
                    </label>
                    {isEditing && isSuperAdmin ? (
                      <Input
                        value={editedMember?.email || ""}
                        onChange={(e) => setEditedMember({ ...editedMember, email: e.target.value })}
                        className="w-64 text-right"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '18px',
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: '#000000',
                          height: '25px',
                        }}
                      />
                    ) : (
                      <span 
                        className="font-lufga"
                        style={{
                          fontWeight: 500,
                          fontSize: '18px',
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: '#000000',
                          textAlign: 'right',
                        }}
                      >
                        {member.email || "N/A"}
                      </span>
                    )}
                  </div>

                  {/* Password Row */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '468px',
                      height: '25px',
                      justifyContent: 'space-between',
                      opacity: 1,
                    }}
                  >
                    <label 
                      className="font-abeezee"
                      style={{
                        fontWeight: 400,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Password
                    </label>
                  {isEditing && isSuperAdmin ? (
                    <div className="relative w-64">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New password"
                        className="w-64 pr-10 text-right"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '18px',
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: '#000000',
                          height: '25px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <span 
                      className="font-lufga"
                      style={{
                        fontWeight: 500,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#000000',
                        textAlign: 'right',
                      }}
                    >
                      ••••••••••
                    </span>
                  )}
                  </div>

                  {/* User ID Row */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '468px',
                      height: '25px',
                      justifyContent: 'space-between',
                      opacity: 1,
                    }}
                  >
                    <label 
                      className="font-abeezee"
                      style={{
                        fontWeight: 400,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      User ID
                    </label>
                    <span 
                      className="font-lufga"
                      style={{
                        fontWeight: 500,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#000000',
                        textAlign: 'right',
                      }}
                    >
                      {member.id || "N/A"}
                    </span>
                  </div>

                  {/* Role Row */}
                  <div 
                    className="flex items-center"
                    style={{
                      width: '468px',
                      height: '25px',
                      justifyContent: 'space-between',
                      opacity: 1,
                    }}
                  >
                    <label 
                      className="font-abeezee"
                      style={{
                        fontWeight: 400,
                        fontSize: '18px',
                        lineHeight: '140%',
                        letterSpacing: '0%',
                        color: '#00000080',
                      }}
                    >
                      Role
                    </label>
                    {isEditing && isSuperAdmin ? (
                      <select
                        value={editedMember?.role || ""}
                        onChange={(e) => setEditedMember({ ...editedMember, role: e.target.value })}
                        className="px-3 border border-gray-300 rounded-md text-right"
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 500,
                          fontSize: '18px',
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: '#000000',
                          height: '25px',
                          textAlign: 'right',
                        }}
                      >
                        <option value="USER">USER</option>
                        <option value="MONITER">MONITER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    ) : (
                      <span 
                        className="font-lufga capitalize"
                        style={{
                          fontWeight: 500,
                          fontSize: '18px',
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: '#000000',
                          textAlign: 'right',
                        }}
                      >
                        {member.role || "N/A"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Section */}
          <div className="mt-10">
            <h3
              className="font-lufga mb-5"
              style={{
                fontWeight: 700,
                fontSize: '18px',
                lineHeight: '100%',
                letterSpacing: '0%',
                color: '#000000',
              }}
            >
              Statistics
            </h3>

            <div className="flex flex-wrap gap-6">
              {[
                {
                  label: "Actually managed Listings",
                  value: listingsLoading ? "-" : String(managedListingsCount),
                },
                {
                  label: "Actually managed Chats",
                  value: stats.loading ? "-" : String(stats.managedChats),
                },
                {
                  label: "Activity Log",
                  value: stats.loading ? "-" : String(stats.activityLog),
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col justify-between"
                  style={{
                    width: '316px',
                    height: '148px',
                    borderRadius: '24px',
                    background: '#FFFFFF',
                    boxShadow: '0px 3px 33px 0px #00000012',
                    padding: '20px',
                  }}
                >
                  <div>
                    <p
                      className="font-abeezee"
                      style={{
                        fontWeight: 400,
                        fontSize: '14px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#4D4D4D',
                      }}
                    >
                      {stat.label}
                    </p>
                    <p
                      className="font-lufga mt-4"
                      style={{
                        fontWeight: 700,
                        fontSize: '24px',
                        lineHeight: '100%',
                        letterSpacing: '0%',
                        color: '#000000',
                      }}
                    >
                      {stat.value}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      className="font-lufga font-medium"
                      style={{
                        width: '87px',
                        height: '34px',
                        borderRadius: '56px',
                        background: '#C6FE1F',
                        color: '#000000',
                        fontSize: '14px',
                        lineHeight: '150%',
                        letterSpacing: '0%',
                        padding: '0',
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
