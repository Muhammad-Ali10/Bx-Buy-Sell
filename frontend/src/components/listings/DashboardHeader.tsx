import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import searchIcon from "@/assets/seach icon.svg";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ListingsSidebar } from "@/components/listings/ListingsSidebar";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface DashboardHeaderProps {
  onSearchClick?: () => void;
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
}

export const DashboardHeader = ({ onSearchClick, sidebarOpen, onSidebarOpenChange }: DashboardHeaderProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [allListings, setAllListings] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    const response = await apiClient.getUserById(user.id);
    if (response.success && response.data) {
      const firstName = response.data.first_name || '';
      const lastName = response.data.last_name || '';
      setFullName(`${firstName} ${lastName}`.trim() || user.email);
    } else {
      setFullName(user.email);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Load all listings for search modal
  const loadAllListingsForSearch = async () => {
    if (!user) return;
    
    setModalLoading(true);
    try {
      const response = await apiClient.getListings(); // Cached public feed (TTL ~10s, purged on create/update/delete)

      if (response.success && response.data) {
        const allListingsData = Array.isArray(response.data) ? response.data : [];
        
        // Map listings with title extraction
        const mappedListings = allListingsData.map((listing: any) => {
          let title = 'Untitled Listing';
          if (listing.brand && Array.isArray(listing.brand) && listing.brand.length > 0) {
            const brandNameQuestion = listing.brand.find((b: any) => 
              b.question?.toLowerCase().includes('brand name') ||
              b.question?.toLowerCase().includes('business name') ||
              b.question?.toLowerCase().includes('name') ||
              b.question?.toLowerCase().includes('company')
            );
            if (brandNameQuestion?.answer) {
              title = brandNameQuestion.answer;
            } else if (listing.brand[0]?.answer) {
              title = listing.brand[0].answer;
            }
          }
          
          if (listing.advertisement && Array.isArray(listing.advertisement) && listing.advertisement.length > 0) {
            const titleQuestion = listing.advertisement.find((a: any) => 
              a.question?.toLowerCase().includes('title')
            );
            if (titleQuestion?.answer && titleQuestion.answer.trim()) {
              title = titleQuestion.answer;
            }
          }

          return {
            id: listing.id,
            title: title,
            ...listing,
          };
        });

        setAllListings(mappedListings);
      }
    } catch (error: any) {
      console.error("Error loading listings for search:", error);
    } finally {
      setModalLoading(false);
    }
  };

  // Open search modal and load listings
  const handleSearchIconClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      setIsSearchModalOpen(true);
      loadAllListingsForSearch();
    }
  };

  // Filter listings for modal search
  const modalFilteredListings = allListings.filter((listing) =>
    listing.title.toLowerCase().includes(modalSearchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <>
      <header 
        className="bg-background sticky top-0 z-40 w-full border-b border-[rgba(233,235,242,1)] bg-white flex items-center justify-between 2xl:justify-end px-3 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-16 md:h-20"
      >
        {/* Menu Button - Always visible when sidebarOpen/onSidebarOpenChange are provided (for Chat tab) */}
        {sidebarOpen !== undefined && onSidebarOpenChange ? (
          <div className="absolute left-3 sm:left-4">
            <ListingsSidebar isMobile={true} open={sidebarOpen} onOpenChange={onSidebarOpenChange} />
          </div>
        ) : (
          /* Mobile/Tablet Menu Button (hidden on desktop/laptop lg+) - for other tabs */
          <div className="lg:hidden absolute left-3 sm:left-4">
            <ListingsSidebar isMobile={true} />
          </div>
        )}

        {/* Right Side - Icons and Profile */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 md:gap-4">
          {/* Search Icon */}
          <div
            onClick={handleSearchIconClick}
            className="flex items-center justify-center cursor-pointer rounded-full bg-[rgba(250,250,250,1)] p-2 sm:p-2.5"
            style={{
              width: '36px',
              height: '36px',
            }}
          >
            <img src={searchIcon} alt="Search" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </div>

          {/* Notification Icon */}
          <NotificationDropdown userId={user.id} variant="dark" customStyle={true} />

          {/* User Profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity"
                style={{
                  cursor: 'pointer',
                }}
              >
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs sm:text-sm">
                    {getInitials(fullName || "User")}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-xs sm:text-sm md:text-base hidden sm:inline">{fullName || "User"}</span>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground hidden sm:inline" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Search Modal */}
      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent
          style={{
            maxWidth: '800px',
            width: '90%',
            height: '80vh',
            maxHeight: '80vh',
            padding: '0',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          className="[&>button]:hidden"
        >
          {/* Search Input Header */}
          <div
            style={{
              padding: '24px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                flex: 1,
                height: '58px',
                paddingTop: '17px',
                paddingRight: '20px',
                paddingBottom: '17px',
                paddingLeft: '20px',
                borderRadius: '50px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                backgroundColor: 'rgba(250, 250, 250, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <img src={searchIcon} alt="Search" style={{ width: '24px', height: '24px', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search listings..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'Lufga',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: '100%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>
            <button
              onClick={() => setIsSearchModalOpen(false)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(250, 250, 250, 1)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X className="w-5 h-5" style={{ color: 'rgba(0, 0, 0, 0.5)' }} />
            </button>
          </div>

          {/* Search Results */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
            }}
          >
            {modalLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p style={{ fontFamily: 'Lufga', color: 'rgba(0, 0, 0, 0.5)' }}>Loading listings...</p>
              </div>
            ) : modalFilteredListings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ 
                  fontFamily: 'Lufga', 
                  fontSize: '16px',
                  color: 'rgba(0, 0, 0, 0.5)',
                  marginBottom: '8px',
                }}>
                  {modalSearchQuery ? 'No listings found' : 'Start typing to search...'}
                </p>
                {modalSearchQuery && (
                  <p style={{ 
                    fontFamily: 'Lufga', 
                    fontSize: '14px',
                    color: 'rgba(0, 0, 0, 0.4)',
                  }}>
                    Try adjusting your search query
                  </p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {modalFilteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    onClick={() => {
                      setIsSearchModalOpen(false);
                      navigate(`/listing/${listing.id}`);
                    }}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: 'rgba(255, 255, 255, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(250, 250, 250, 1)';
                      e.currentTarget.style.borderColor = 'rgba(174, 243, 31, 1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Lufga',
                        fontWeight: 500,
                        fontSize: '16px',
                        lineHeight: '150%',
                        color: 'rgba(0, 0, 0, 1)',
                        marginBottom: '4px',
                      }}
                    >
                      {listing.title}
                    </h3>
                    {listing.price && (
                      <p
                        style={{
                          fontFamily: 'Lufga',
                          fontWeight: 400,
                          fontSize: '14px',
                          lineHeight: '150%',
                          color: 'rgba(0, 0, 0, 0.6)',
                        }}
                      >
                        ${listing.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
