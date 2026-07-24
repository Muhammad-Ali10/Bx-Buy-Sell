import { useNavigate, useParams } from "react-router-dom";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminListingPageOptions } from "@/components/admin/AdminListingPageOptions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ListingDetail from "@/pages/ListingDetail";

export default function AdminListingDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AdminSidebar />
      <main className="flex-1">
        <AdminHeader title="Edit Listing" />
        <div className="p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-0 hover:bg-transparent"
              onClick={() => navigate("/admin/listings")}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#D3FC50]"
                aria-hidden
              >
                <ArrowLeft className="h-4 w-4 text-black" />
              </span>
              <span className="font-outfit text-[18px] font-bold leading-[100%] text-black">
                All Listing
              </span>
            </Button>
            {id ? <AdminListingPageOptions listingId={id} /> : null}
          </div>
          <ListingDetail embedded adminLayout />
        </div>
      </main>
    </div>
  );
}
