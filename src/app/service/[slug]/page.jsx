"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, Heart, Share2, Info, ArrowRight, Check, ExternalLink } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import RevenueChart from "@/components/shared/revenue-chart"
import SalesChannelsChart from "@/components/shared/sales-channels-chart"
import SimilarListings from "@/components/shared/similar-listings"

export default function ListingPage() {
  const [isFavorite, setIsFavorite] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black text-white px-4 py-3 ! flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <div className="bg-[#c1ff00] text-black font-bold p-1.5 rounded text-xl">BX</div>
          </Link>

          <nav className="hidden md:flex items-center gap-4">
            <Link href="/" className="bg-[#c1ff00] text-black px-3 py-1 rounded-full text-sm font-medium">
              Home
            </Link>
            <Link href="/listings" className="text-sm hover:text-[#c1ff00]">
              All Listings
            </Link>
            <Link href="/how-to-buy" className="text-sm hover:text-[#c1ff00]">
              How To Buy
            </Link>
            <Link href="/how-to-sell" className="text-sm hover:text-[#c1ff00]">
              How To Sell
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Button variant="ghost" size="icon" className="rounded-full">
              <span className="absolute -top-1 -right-1 bg-[#c1ff00] text-black text-xs w-4 h-4 flex items-center justify-center rounded-full">
                2
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
              </svg>
            </Button>
          </div>
          <Avatar className="h-8 w-8 border border-gray-700">
            <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <Button size="sm" className="bg-white text-black hover:bg-gray-200 rounded-full text-sm">
            Add Listing
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Back button */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-black">
            <ChevronLeft className="h-4 w-4 mr-1" /> Go Back
          </Button>
        </div>

        {/* Main listing section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Image slider */}
          <div className="md:col-span-2 relative bg-white rounded-lg overflow-hidden shadow-sm">
            <div className="relative h-[400px] w-full">
              <Image
                src="/service.png"
                alt="Fashion / Beauty E-commerce Store"
                fill
                className="object-cover"
              />

              {/* Action buttons */}
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-8 w-8 rounded-full bg-white ${isFavorite ? "text-red-500" : "text-gray-700"}`}
                  onClick={() => setIsFavorite(!isFavorite)}
                >
                  <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-white text-gray-700">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Navigation arrows */}
              <Button
                variant="outline"
                size="icon"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white text-gray-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white text-gray-700"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>

              {/* Sponsored badge */}
              <Badge className="absolute bottom-3 left-3 bg-[#c1ff00] text-black hover:bg-[#b8e600]">
                Sponsored Ad #5
              </Badge>
            </div>
          </div>

          {/* Listing info */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="mb-4">
              <h1 className="text-xl font-bold mb-1">Fashion / Beauty E-commerce Store</h1>
              <p className="text-sm text-gray-500 mb-4">www.beauty.de</p>
              <div className="text-2xl font-bold mb-2">1500$</div>
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <span>Price to Sales multiple:</span>
                <span className="ml-1 font-medium">1.2x</span>
                <span className="mx-2">•</span>
                <span>All requirements</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 ml-1 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">All buyer requirements have been met</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="mb-4">
                <Badge variant="outline" className="text-[#c1ff00] border-[#c1ff00]">
                  Profitable
                </Badge>
              </div>
            </div>

            {/* Seller info */}
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center mb-4">
                <Avatar className="h-10 w-10 mr-3">
                  <AvatarImage src="/placeholder.svg?height=40&width=40" alt="Jerome Bell" />
                  <AvatarFallback>JB</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">Jerome Bell</div>
                  <div className="text-sm text-gray-500">4.8 (16 reviews)</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 mb-2">
                <Button className="bg-[#c1ff00] text-black hover:bg-[#b8e600] w-full">Contact Seller</Button>
                <Button variant="outline" className="w-full">
                  View Offer
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Fashion / Beauty E-commerce Store</h2>
          <p className="text-sm text-gray-600 mb-4">
            We sell beauty products online with images, pricing, status, and requests to optimize your selling
            experience. As a marketplace, we provide a platform where businesses sell products or services digitally. It
            allows customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer
            convenience, global reach, and 24/7 availability, making shopping easier while helping businesses.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            WPN is a e-commerce store's online platform where businesses sell products or services digitally. It allows
            customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer
            convenience, global reach, and 24/7 availability, making shopping easier while helping businesses.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            As a marketplace, we provide a platform where businesses sell products or services digitally. It allows
            customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer
            convenience, global reach, and 24/7 availability, making shopping easier while helping businesses. As a
            marketplace, we provide a platform where businesses sell products or services digitally. It allows customers
            to browse, compare, and purchase items with secure payment options. E-commerce stores offer convenience,
            global reach, and 24/7 availability, making shopping easier while helping businesses.
          </p>
          <Button variant="link" className="text-[#c1ff00] p-0 h-auto">
            Read More
          </Button>
        </div>

        {/* Business metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Location */}
          <div className="bg-white rounded-lg p-5 shadow-sm ">
            <div className="flex flex-row justify-between items-start">
              <div className="lex items-center">
                <div className="mr-3">
                  <span className="text-lg">Location</span>
                </div>
                <div>
                  <div className="font-medium">USA</div>
                </div>
              </div>
              <div className="mt-3">
                <Image
                  src="/map.png"
                  alt="World map"
                  width={100}
                  height={80}
                  className="opacity-70"
                />
              </div>
            </div>
          </div>

          {/* Business age */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-medium">Business Age</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">How long the business has been operating</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="font-medium text-xl">5 years</div>
          </div>

          {/* Monthly traffic */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-medium">Monthly Traffic</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Average monthly visitors</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="font-medium text-xl">4,360/m</div>
          </div>

          {/* Profit margin */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-medium">Profit Margin</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Percentage of revenue that is profit</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="font-medium text-xl">30%</div>
          </div>

          {/* Revenue */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-medium">Revenue</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Monthly revenue</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="font-medium text-xl">1266$/m</div>
          </div>

          {/* Profit multiple */}
          <div className="bg-white rounded-lg p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm font-medium">Profit Multiple</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Price to profit ratio</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="font-medium text-xl">1.5x</div>
          </div>
        </div>

        {/* Revenue & Expenses */}
        <div className="bg-[#AEF31F] rounded-lg p-5 mb-8 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Revenue & Expenses</h2>
            <div className="flex items-center">
              <Badge className="bg-[#c1ff00] text-black mr-2">Monthly</Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Monthly revenue and expenses</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="flex items-center mb-4">
            <div className="text-2xl font-bold text-black">+4.7%</div>
            <div className="ml-auto flex gap-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-600 rounded-full mr-2"></div>
                <span className="text-sm">Revenue</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm">Profit</span>
              </div>
            </div>
          </div>

          <div className="h-64">
            <RevenueChart />
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Statistics</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Conversion Rate */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Conversion Rate</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Percentage of visitors who make a purchase</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={25} className="h-2 mb-1" />
              <div className="text-xs text-gray-500">2.5%</div>
            </div>

            {/* Refund Rate */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Refund Rate</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Percentage of orders that are refunded</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={5} className="h-2 mb-1" />
              <div className="text-xs text-gray-500">0.5%</div>
            </div>

            {/* Recurring customers */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Recurring customers</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Percentage of customers who make repeat purchases</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Progress value={35} className="h-2 mb-1" />
              <div className="text-xs text-gray-500">35%</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* E-Mail Subscribers */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">E-Mail Subscribers</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Number of email subscribers</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
                <div className="font-medium">7493</div>
              </div>
            </div>

            {/* Average order value */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Average order value</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Average amount spent per order</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">$ 344</div>
            </div>

            {/* Customer base */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Customer base</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Total number of customers</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <div className="font-medium">8099</div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Charts</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Sales Channels */}
            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                    <path d="M2 12h20"></path>
                  </svg>
                  <div className="text-sm font-medium">Sales Channels</div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Distribution of sales by channel</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-gray-500 mb-4">Click to view details</div>

              <div className="flex justify-center">
                <div className="w-40 h-40">
                  <SalesChannelsChart />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-[#c1ff00] rounded-full mr-2"></div>
                  <span className="text-sm">Shopify Store: 45%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
                  <span className="text-sm">Etsy: 35%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm">Amazon: 20%</span>
                </div>
              </div>
            </div>

            {/* Sales Country Split */}
            <div className="border border-gray-100 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path>
                  </svg>
                  <div className="text-sm font-medium">Sales Country Split</div>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Distribution of sales by country</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-xs text-gray-500 mb-4">Click to view details</div>

              <div className="flex justify-center">
                <div className="w-40 h-40">
                  <SalesChannelsChart />
                </div>
              </div>
            </div>
          </div>

          {/* Advertising Channels */}
          <div className="border border-gray-100 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <div className="text-sm font-medium">Advertising Channels</div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Distribution of advertising spend by channel</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-xs text-gray-500 mb-4">Click to view details</div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Products</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Number of products */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Number of products</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Total number of products</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">12</div>
            </div>

            {/* Selling Model */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Selling Model</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Business model for selling products</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">Dropshipping</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Own inventory */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Own free inventory?</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Whether the business owns inventory</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">Yes</div>
            </div>

            {/* Inventory value */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">How much?</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Value of owned inventory</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">$ 233</div>
            </div>

            {/* Included in the price */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Is it included in the price?</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Whether inventory is included in the sale price</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">Yes</div>
            </div>
          </div>
        </div>

        {/* Management */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Management</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Departments */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Departments</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Number of departments</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                  <path d="M3 9h18"></path>
                  <path d="M9 21V9"></path>
                </svg>
                <div className="font-medium">2</div>
              </div>
            </div>

            {/* Employees */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Employees</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Number of employees</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <div className="font-medium">5</div>
              </div>
            </div>

            {/* CEO hours per week */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">CEO hours per week</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Hours spent by the CEO per week</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">$ 40 hours</div>
            </div>
          </div>
        </div>

        {/* Handover */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Handover</h2>

          <div className="mb-6">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-medium">Assets included in the deal</div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Assets that are included in the sale</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <Check className="h-4 w-4 text-[#c1ff00] mr-2" />
                <span className="text-sm">Online Shop</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-[#c1ff00] mr-2" />
                <span className="text-sm">Social Media Accounts</span>
              </div>
              <div className="flex items-center">
                <Check className="h-4 w-4 text-[#c1ff00] mr-2" />
                <span className="text-sm">Supplier contacts</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Post-sale support */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">Does the seller offer post-sale support?</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Whether the seller offers support after the sale</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">Yes</div>
            </div>

            {/* Support duration */}
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium">How long is the support?</div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Duration of post-sale support</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="font-medium">12 months</div>
            </div>
          </div>
        </div>

        {/* Social Media */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Social Media</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Instagram */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-gradient-to-tr from-yellow-500 via-pink-600 to-purple-600 p-2 rounded-lg mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
                  </svg>
                </div>
                <div className="font-medium">Instagram</div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>

            {/* X (Twitter) */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-black p-2 rounded-lg mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                  </svg>
                </div>
                <div className="font-medium">X</div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>

            {/* TikTok */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-black p-2 rounded-lg mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
                    <path d="M15 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
                    <path d="M15 8v8a4 4 0 0 1-4 4"></path>
                    <path d="M9 12V4a4 4 0 0 1 4-4"></path>
                  </svg>
                </div>
                <div className="font-medium">TikTok</div>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-lg p-5 mb-8 shadow-sm">
          <h2 className="text-lg font-bold mb-4">Attachments</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PDF 1 */}
            <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div className="flex items-center">
                <div className="bg-red-100 p-2 rounded-lg mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="red"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-sm">03-04-05_06-07-08</div>
                  <div className="text-xs text-gray-500">PDF Document</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" x2="12" y1="15" y2="3"></line>
                </svg>
              </Button>
            </div>

            {/* PDF 2 */}
            <div className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
              <div className="flex items-center">
                <div className="bg-green-100 p-2 rounded-lg mr-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="green"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-sm">03-04-05_06-07-08</div>
                  <div className="text-xs text-gray-500">PDF Document</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" x2="12" y1="15" y2="3"></line>
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Similar Listings */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">Similar Listings</h2>
          <SimilarListings />
        </div>
      </main>
    </div>
  )
}
