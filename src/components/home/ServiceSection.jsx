"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Heart, Share2 } from "lucide-react"
import { useState } from "react"

// Business listings data with diverse categories
const businessListings = [
  {
    id: 1,
    title: "Beauty Store",
    description:
      "Easily manage your listings with images, pricing, details, and features to optimize your selling experience.",
    price: 12000,
    location: "India",
    businessAge: 4,
    netProfit: "21,764,982/Y",
    revenue: "150,764,982/Y",
    category: "E-Commerce",
    managedByEX: true,
    isFavorite: true,
  },
  {
    id: 2,
    title: "Fashion Boutique",
    description: "Premium Shopify store specializing in trendy fashion items with automated inventory management.",
    price: 25000,
    location: "USA",
    businessAge: 2,
    netProfit: "45,000,000/Y",
    revenue: "180,000,000/Y",
    category: "Shopify",
    managedByEX: false,
    isFavorite: false,
  },
  {
    id: 3,
    title: "Tech Review Channel",
    description: "Automated YouTube channel with consistent content creation and monetization strategies.",
    price: 8000,
    location: "Canada",
    businessAge: 1,
    netProfit: "12,500,000/Y",
    revenue: "25,000,000/Y",
    category: "YouTube Automation",
    managedByEX: true,
    isFavorite: false,
  },
  {
    id: 4,
    title: "Project Management SaaS",
    description: "Cloud-based project management tool with subscription model and enterprise clients.",
    price: 150000,
    location: "UK",
    businessAge: 6,
    netProfit: "85,000,000/Y",
    revenue: "200,000,000/Y",
    category: "SaaS",
    managedByEX: true,
    isFavorite: true,
  },
  {
    id: 5,
    title: "Electronics Store",
    description: "Multi-platform e-commerce business selling consumer electronics with dropshipping model.",
    price: 18000,
    location: "Germany",
    businessAge: 3,
    netProfit: "32,000,000/Y",
    revenue: "120,000,000/Y",
    category: "E-Commerce",
    managedByEX: false,
    isFavorite: false,
  },
  {
    id: 6,
    title: "Fitness Supplements Shop",
    description: "Shopify-powered supplement store with subscription boxes and affiliate marketing.",
    price: 35000,
    location: "Australia",
    businessAge: 5,
    netProfit: "55,000,000/Y",
    revenue: "165,000,000/Y",
    category: "Shopify",
    managedByEX: true,
    isFavorite: true,
  },
  {
    id: 7,
    title: "Gaming Content Channel",
    description: "Automated gaming YouTube channel with live streaming and merchandise integration.",
    price: 15000,
    location: "Brazil",
    businessAge: 2,
    netProfit: "28,000,000/Y",
    revenue: "65,000,000/Y",
    category: "YouTube Automation",
    managedByEX: false,
    isFavorite: false,
  },
  {
    id: 8,
    title: "CRM Software Platform",
    description: "Customer relationship management SaaS with AI features and multi-tenant architecture.",
    price: 200000,
    location: "Singapore",
    businessAge: 8,
    netProfit: "120,000,000/Y",
    revenue: "300,000,000/Y",
    category: "SaaS",
    managedByEX: true,
    isFavorite: false,
  },
  {
    id: 9,
    title: "Home Decor Marketplace",
    description: "Curated home decor e-commerce platform with vendor management and custom designs.",
    price: 22000,
    location: "France",
    businessAge: 3,
    netProfit: "38,000,000/Y",
    revenue: "140,000,000/Y",
    category: "E-Commerce",
    managedByEX: false,
    isFavorite: true,
  },
]

// Filter categories
const filterCategories = ["All", "Shopify", "E-Commerce", "YouTube Automation", "SaaS"]

export default function ServiceSection() {
  const [activeFilter, setActiveFilter] = useState("All")


  // Filter listings based on active filter
  const filteredListings = businessListings.filter(
    (listing) => activeFilter === "All" || listing.category === activeFilter,
  )



  return (
    <div className=" mx-auto px-4 py-12 max-w-[1520px]">
      {/* Header Section */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:!text-[56px] font-sora font-semibold mb-2">Explore the Newest</h1>
        <h1 className="text-3xl md:!text-[56px] font-sora font-semibold mb-4">Business Listings</h1>
        <p className="text-black text-base font-normal max-w-xl mx-auto">
          Discover the latest business opportunities with our newest listings.
          <br />
          Find your perfect match and grow today!
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-row overflow-x-scroll justify-start  md:justify-center gap-2 mb-8">
        {filterCategories.map((category, index) => (
          <Button
            key={index}
            variant="ghost"
            onClick={() => setActiveFilter(category)}
            className={`!font-sora text-sm md:text-lg rounded-full px-5 py-4 md:px-8    ${activeFilter === category
              ? "bg-[#C4FC1E] hover:bg-[#b1ef62]"
              : "bg-[#f2f2f2]"
              } px-6 font-normal text-black`}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredListings.map((listing, index) => (
          <div key={listing.id} className="rounded-lg max-w-[490px] overflow-hidden">
            <div className="relative">
              <Image
                src="/service.png"
                width={400}
                height={285}
                alt={listing.title}
                className="w-full object-cover"
              />
              <button className="absolute top-3 right-3 bg-white p-3 w-[49px] h-[48px] height rounded-full">
                <Image src={"/Vector.png"}
                  width={20}
                  height={20} className="m-auto"
                  alt="like" />
              </button>
              <button className="absolute top-3 right-20 bg-white p-3 w-[49px] h-[48px] height rounded-full">
                <Image src={"/Frame.png"}
                  width={20}
                  height={20}
                  alt="share" className="m-auto" />
              </button>
              <div className="absolute bottom-3 left-3 flex space-x-2">
                <div className="bg-[#C5FD1F] text-black text-xs  md:!text-base font-medium font-lufga  pl-[10px] pr-[17px] backdrop-blur-[44px] py-2 rounded-full flex items-center gap-2">
                  <Image src={"/buttonicon.png"}
                    width={20}
                    height={20}
                    alt="Button-Icon"
                  /> Managed by EX
                </div>
                <div className="bg-gradient-to-r  from-gray-500/50 via-[#000000]/60 to-gray-500/50 text-xs backdrop-blur-[44px] md:!text-base  font-medium font-lufga px-4 py-2 text-white rounded-full">{listing.category}</div>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-lg md:!text-xl font-semibold font-lufga mb-1">{listing.title}</h3>
              <p className="text-sm text-black/50 mb-3 font-lufga">{listing.description}</p>
              <div className="flex flex-row justify-between items-center mb-4">
                   <div className="text-[24px] md:!text-[28px] font-semibold font-lufga ">${listing.price.toLocaleString()}</div>
                   <div className="flex flex-row justify-center items-center border-[2px] border-[#808080] px-3  rounded-[60px]">
                    <p className=" text-[10px] md:text-xs font-medium font-lufga pr-2.5 py-1">Multiple 1.1x Profit</p>
                    <hr className="inline-block h-full min-h-[1.9em] w-0.5 self-stretch bg-[#808080] "/>
                    <p className="text-[10px] md:text-xs font-medium font-lufga pl-2.5 py-1">0.3x Revenue</p>
                   </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-4 flex items-center justify-center">
                    <Image src={"/flage.png"}
                    width={32}
                    height={23}
                    alt="Button-Icon"
                  />
                  </div>
                  <span className="text-sm md:text-base font-medium text-black/50 font-lufga">Location: <span className="text-black">{listing.location}</span></span>
                </div>
                <div className="text-sm md:text-base font-medium text-black/50 font-lufga text-right">Business Age: <span className="text-black">{listing?.businessAge}</span></div>

                <div className="text-sm md:text-base font-medium text-black/50 font-lufga">Net Profit: <span className="text-black">{listing.netProfit}</span></div>
                <div className="text-sm md:text-base font-medium text-black/50 font-lufga text-right">Revenue: <span className="text-black">{listing.revenue}</span></div>
              </div>

              <div className="flex gap-2">
                <Button

                  className="w-1/2 bg-black hover:bg-gray-800 text-sm md:text-base font-medium font-lufga text-white rounded-[60px]"
                >
                  Contact Seller
                </Button>
                <Button

                  className="w-1/2 bg-[#AEF31F] hover:bg-[#AEF31F] text-sm md:text-base font-medium font-lufga text-black rounded-[60px]"
                >
                  View Listing
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show message when no listings match filter */}
      {filteredListings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No listings found for "{activeFilter}" category.</p>
        </div>
      )}
    </div>
  )
}
