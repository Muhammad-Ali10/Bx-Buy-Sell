import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Bell, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function AdminSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "activity">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    roles: "",
    profilePic: "",
  });

  // Fetch user data
  const { data: userData, isLoading: loadingUser } = useQuery({
    queryKey: ["admin-user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User ID is required");
      const response = await apiClient.getUserById(user.id);
      if (!response.success) throw new Error(response.error || "Failed to fetch user data");
      return response.data;
    },
    enabled: !!user?.id && isAuthenticated,
  });

  // Update form data when user data is loaded
  // Only update if we don't have a local profilePic that's different from the server
  useEffect(() => {
    if (userData) {
      console.log('📝 Loading user data into form:', {
        first_name: userData.first_name,
        last_name: userData.last_name,
        email: userData.email,
        role: userData.role,
        profile_pic: userData.profile_pic,
        current_formData_profilePic: formData.profilePic,
      });
      
      setFormData(prev => {
        // Preserve profilePic if it exists and is different from server (user just uploaded)
        // Only update if server has a valid profile_pic or if our local one is empty
        const serverProfilePic = userData.profile_pic || "";
        const shouldPreserveLocalPic = prev.profilePic && 
                                       prev.profilePic.trim() !== "" && 
                                       prev.profilePic !== serverProfilePic &&
                                       serverProfilePic === "";
        
        return {
          firstName: userData.first_name || "",
          lastName: userData.last_name || "",
          email: userData.email || "",
          roles: userData.role || "Admin",
          profilePic: shouldPreserveLocalPic ? prev.profilePic : (serverProfilePic || prev.profilePic || ""),
        };
      });
    }
  }, [userData]);

  // Debug: Log formData changes
  useEffect(() => {
    console.log('📸 Current formData.profilePic:', formData.profilePic);
  }, [formData.profilePic]);

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: {
      first_name?: string;
      last_name?: string;
      profile_pic?: string;
    }) => {
      if (!user?.id) throw new Error("User ID is required");
      const response = await apiClient.updateUser(user.id, data);
      if (!response.success) throw new Error(response.error || "Failed to update user");
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-user-profile", user?.id] });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update profile");
    },
  });
  
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !user) {
        navigate("/admin/login");
        return;
      }
    }
  }, [authLoading, isAuthenticated, user, navigate]);
  
  if (authLoading || loadingUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-black text-xl">Loading...</div>
      </div>
    );
  }
  
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-black text-xl">Redirecting to login...</div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!user?.id) return;
    
    updateUserMutation.mutate({
      first_name: formData.firstName,
      last_name: formData.lastName,
      profile_pic: formData.profilePic,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original user data
    if (userData) {
      setFormData({
        firstName: userData.first_name || "",
        lastName: userData.last_name || "",
        email: userData.email || "",
        roles: userData.role || "Admin",
        profilePic: userData.profile_pic || "",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      console.log('📸 Starting image upload...', { file: file.name, size: file.size });
      const result = await uploadToCloudinary(file);
      console.log('📸 Upload result:', result);
      
      if (!result.success || !result.url) {
        throw new Error(result.error || "No image URL returned from upload");
      }
      
      const imageUrl = result.url;
      console.log('📸 Image URL received:', imageUrl);
      
      // Update form data with new image URL
      setFormData(prev => {
        console.log('📸 Updating formData with image URL:', imageUrl);
        return { ...prev, profilePic: imageUrl };
      });
      
      // Immediately save to backend
      if (user?.id) {
        console.log('📸 Saving image URL to backend...', { userId: user.id, imageUrl });
        const response = await apiClient.updateUser(user.id, { profile_pic: imageUrl });
        console.log('📸 Backend response:', response);
        if (response.success) {
          // Optimistically update the query cache instead of invalidating immediately
          // This prevents the image from disappearing
          queryClient.setQueryData(["admin-user-profile", user.id], (oldData: any) => {
            if (oldData) {
              return { ...oldData, profile_pic: imageUrl };
            }
            return oldData;
          });
          
          // Refetch after a short delay to ensure backend saved it
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["admin-user-profile", user.id] });
          }, 500);
          
          toast.success("Profile picture updated successfully");
        } else {
          toast.error(response.error || "Failed to save image");
        }
      }
    } catch (error: any) {
      console.error('📸 Image upload error:', error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <AdminSidebar />
      
      <main className="flex-1 bg-gray-100 w-full min-w-0">
        <AdminHeader title="Settings" />
        
        <div className="p-4 sm:p-6 lg:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-black mb-6 sm:mb-8">Setting</h1>
          
          {/* Main Container */}
          <div 
            className="bg-white w-full max-w-full"
            style={{
              borderRadius: '24px',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '20px',
              minHeight: 'auto',
            }}
          >
            {/* Container for side-by-side layout on larger screens */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 w-full">
            {/* Left Column - Profile Section */}
            <div 
              className="flex flex-col items-center w-full lg:w-[247px] lg:flex-shrink-0"
              style={{
                borderRadius: '24px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                padding: '20px',
              }}
            >
              {/* Profile Image */}
              <div className="relative mb-6">
                {formData.profilePic && formData.profilePic.trim() !== '' ? (
                  <div 
                    className="rounded-full overflow-hidden"
                    style={{
                      width: '158px',
                      height: '158px',
                      border: '2px solid rgba(198, 254, 31, 1)',
                    }}
                  >
                    <img 
                      src={formData.profilePic} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Image load error:', formData.profilePic);
                        // Fallback to initials if image fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div 
                    className="rounded-full bg-gray-200 flex items-center justify-center"
                    style={{
                      width: '158px',
                      height: '158px',
                      border: '2px solid rgba(198, 254, 31, 1)',
                    }}
                  >
                    <span 
                      className="font-lufga font-bold"
                      style={{
                        fontSize: '48px',
                        color: 'rgba(0, 0, 0, 1)',
                      }}
                    >
                      {formData.firstName[0] || 'U'}{formData.lastName[0] || ''}
                    </span>
                  </div>
                )}
                <label
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#C6FE1F] flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#AEF31F] transition-colors"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 text-black animate-spin" />
                  ) : (
                    <Pencil className="w-4 h-4 text-black" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              {/* Name */}
              <h2 
                className="font-lufga mb-2 text-center"
                style={{
                  fontWeight: 500,
                  fontSize: '24px',
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)',
                }}
              >
                {formData.firstName}
              </h2>

              {/* Role */}
              <p 
                className="font-lufga text-center mb-6"
                style={{
                  fontWeight: 500,
                  fontSize: '20px',
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  color: 'rgba(108, 108, 108, 1)',
                }}
              >
                {formData.roles}
              </p>

              {/* Sub-navigation Buttons */}
              <div className="w-full space-y-3">
                <Button
                  onClick={() => setActiveTab("profile")}
                  className={`w-full justify-center h-14 rounded-xl font-lufga ${
                    activeTab === "profile"
                      ? "bg-[#AEF31F] text-black hover:bg-[#AEF31F]/90"
                      : "bg-white text-black border border-gray-200 hover:bg-gray-50"
                  }`}
                  style={{
                    fontSize: '18px',
                    fontWeight: 500,
                  }}
                >
                  My Profile
                </Button>
                
                <Button
                  onClick={() => setActiveTab("security")}
                  className={`w-full justify-center h-14 rounded-xl font-lufga ${
                    activeTab === "security"
                      ? "bg-[#AEF31F] text-black hover:bg-[#AEF31F]/90"
                      : "bg-white text-black border border-gray-200 hover:bg-gray-50"
                  }`}
                  style={{
                    fontSize: '18px',
                    fontWeight: 500,
                  }}
                >
                  Account Security
                </Button>
                
                <Button
                  onClick={() => setActiveTab("activity")}
                  className={`w-full justify-center h-14 rounded-xl font-lufga ${
                    activeTab === "activity"
                      ? "bg-[#AEF31F] text-black hover:bg-[#AEF31F]/90"
                      : "bg-white text-black border border-gray-200 hover:bg-gray-50"
                  }`}
                  style={{
                    fontSize: '18px',
                    fontWeight: 500,
                  }}
                >
                  Activity Logs
                </Button>
              </div>
            </div>

            {/* Right Column - Content Panel */}
            <div 
              className="flex-1 w-full lg:w-auto"
              style={{
                borderRadius: '24px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                padding: '20px',
                minHeight: '500px',
              }}
            >
              {/* Content Area */}
              <div className="overflow-y-auto w-full">
                {activeTab === "profile" && (
                  <div className="space-y-8">
                    {/* Personal Information Form */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-2xl font-bold text-black font-lufga">Personal Information</h3>
                        {!isEditing && (
                          <Button
                            onClick={() => setIsEditing(true)}
                            className="bg-[#AEF31F] text-black hover:bg-[#AEF31F]/90 rounded-lg px-4 h-10 font-lufga"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="firstName" className="text-black font-lufga">First Name:</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            disabled={!isEditing}
                            className="bg-gray-50 border-gray-200 text-black font-lufga"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="lastName" className="text-black font-lufga">Last Name:</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            disabled={!isEditing}
                            className="bg-gray-50 border-gray-200 text-black font-lufga"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-black font-lufga">Email:</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            disabled={!isEditing}
                            className="bg-gray-50 border-gray-200 text-black font-lufga"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="roles" className="text-black font-lufga">Roles:</Label>
                          <Input
                            id="roles"
                            value={formData.roles}
                            onChange={(e) => setFormData({ ...formData, roles: e.target.value })}
                            disabled={!isEditing}
                            className="bg-gray-50 border-gray-200 text-black font-lufga"
                          />
                        </div>
                      </div>

                      {isEditing && (
                        <div className="flex gap-4 mt-6">
                          <Button
                            onClick={handleCancel}
                            variant="outline"
                            className="border-2 border-black text-black hover:bg-gray-50 rounded-lg px-8 h-12 font-lufga"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSave}
                            disabled={updateUserMutation.isPending}
                            className="bg-[#AEF31F] text-black hover:bg-[#AEF31F]/90 rounded-lg px-8 h-12 font-lufga"
                          >
                            {updateUserMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "security" && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-bold text-black font-lufga">Account Security</h3>
                      <Button
                        className="bg-[#AEF31F] text-black hover:bg-[#AEF31F]/90 rounded-lg px-4 h-10 font-lufga"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {/* Security Section */}
                      <div>
                        <h4 className="text-xl font-bold text-black font-lufga mb-6">Security</h4>
                        
                        {/* Email Address */}
                        <div className="mb-6 p-6 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Label className="text-black font-semibold font-lufga mb-2 block">Email address</Label>
                              <p className="text-gray-600 text-sm font-lufga mb-2">The Email Address Associated Your Account</p>
                              <p className="text-black font-lufga">{formData.email}</p>
                              <p className="text-red-600 text-sm font-lufga mt-1">Unverified</p>
                            </div>
                            <Button
                              variant="outline"
                              className="border-2 border-[#AEF31F] text-black hover:bg-[#AEF31F]/10 rounded-lg px-4 h-10 font-lufga"
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          </div>
                        </div>

                        {/* Password */}
                        <div className="mb-6 p-6 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Label className="text-black font-semibold font-lufga mb-2 block">Password</Label>
                              <p className="text-gray-600 text-sm font-lufga mb-2">Set a Unique Password to protect your account</p>
                            </div>
                            <Button
                              variant="outline"
                              className="border-2 border-[#AEF31F] text-black hover:bg-[#AEF31F]/10 rounded-lg px-4 h-10 font-lufga"
                            >
                              Change Password
                            </Button>
                          </div>
                        </div>

                        {/* Delete Account */}
                        <div className="mb-6 p-6 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Label className="text-black font-semibold font-lufga mb-2 block">Delete Account</Label>
                              <p className="text-gray-600 text-sm font-lufga mb-2">This will delete your account. your account will be permanently Deleted from prodeel.</p>
                            </div>
                            <Button
                              variant="outline"
                              className="border-2 border-red-500 text-red-600 hover:bg-red-50 rounded-lg px-4 h-10 font-lufga"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "activity" && (
                  <div className="space-y-8">
                    <h3 className="text-2xl font-bold text-black font-lufga mb-6">Activity Logs</h3>
                    <div className="text-center py-12 text-gray-500 font-lufga">
                      <p>No activity logs available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

