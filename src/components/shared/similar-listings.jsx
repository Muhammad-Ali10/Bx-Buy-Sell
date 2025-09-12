import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Heart, Share2 } from "lucide-react"

const similarListings = [
  {
    id: 1,
    title: "E-commerce Store",
    price: 12000,
    location: "United States",
    businessAge: 3,
    netProfit: 3600,
    revenue: 12000,
  },
  {
    id: 2,
    title: "E-commerce Store",
    price: 12000,
    location: "United States",
    businessAge: 3,
    netProfit: 3600,
    revenue: 12000,
  },
  {
    id: 3,
    title: "E-commerce Store",
    price: 12000,
    location: "United States",
    businessAge: 3,
    netProfit: 3600,
    revenue: 12000,
  },
]

export default function SimilarListings() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {similarListings.map((listing) => (
        <div key={listing.id} className="bg-white rounded-lg overflow-hidden shadow-sm">
          {/* Image */}
          <div className="relative">
            <Image
              src="/placeholder.svg?height=200&width=400"
              alt={listing.title}
              width={400}
              height={200}
              className="w-full h-48 object-cover"
            />

            {/* Action buttons */}
            <div className="absolute top-2 right-2 flex flex-col gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-white">
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-white">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>

            <Badge className="absolute bottom-2 left-2 bg-gray-200 text-gray-700 hover:bg-gray-300">
              {listing.title}
            </Badge>
          </div>

          {/* Content */}
          <div className="p-3">
            <p className="text-xs text-gray-600 mb-1">
              Easily manage your store with images, pricing, status, and requests to optimize your selling experience.
            </p>

            <div className="flex justify-between items-center mb-2">
              <div className="font-bold">${listing.price.toLocaleString()}</div>
              <div className="flex gap-1">
                <Badge variant="outline" className="text-xs">
                  Multiple 3.3x Profit
                </Badge>
                <Badge variant="outline" className="text-xs">
                  1.0x Revenue
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-1 text-xs">
              <span>🇺🇸</span>
              <span className="font-medium">Location: {listing.location}</span>
              <span className="ml-auto">Business Age: {listing.businessAge} Years</span>
            </div>

            <div className="flex items-center gap-1 text-xs">
              <span className="font-medium">Net Profit: ${listing.netProfit.toLocaleString()}/y</span>
              <span className="ml-auto">Revenue: ${listing.revenue.toLocaleString()}/y</span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 gap-2 p-3 pt-0">
            <Button variant="default" className="bg-[#c1ff00] text-black hover:bg-[#b8e600] w-full">
              View Listing
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
