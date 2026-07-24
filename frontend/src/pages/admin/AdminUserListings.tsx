import { useNavigate, useParams } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useUserListings } from "@/hooks/useUserListings";
import { ListingCardDashboard } from "@/components/listings/ListingCardDashboard";

export default function AdminUserListings() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: listings, isLoading, refetch } = useUserListings(id);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      
      <main className="flex-1">
        <AdminHeader title="User Details" />

        <div className="p-8">
          <Button
            variant="ghost"
            className="mb-6 flex items-center gap-2 p-0 hover:bg-transparent"
            onClick={() => navigate(`/admin/users/${id}`)}
          >
            <ArrowLeft className="h-4 w-4 text-black" />
            <span className="font-outfit font-bold text-[18px] leading-[100%] text-black">
              User Details
            </span>
          </Button>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          ) : !listings || listings.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No listings found for this user</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6 justify-items-center">
              {listings.map((listing) => (
                <ListingCardDashboard
                  key={listing.id}
                  id={listing.id}
                  title={listing.title}
                  price={listing.price}
                  image_url={listing.image_url || "/placeholder.svg"}
                  status={listing.status}
                  managed_by_ex={Boolean(listing.managed_by_ex)}
                  category={listing.category}
                  created_at={listing.created_at}
                  requests_count={listing.requests_count}
                  unread_messages_count={listing.unread_messages_count}
                  onUpdate={refetch}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
