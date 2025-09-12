"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function EXDashboard() {
  return (
    <div className="bg-black text-white p-4 md:p-12">
      <div className="max-w-1630 mx-auto flex flex-col">

        <div className="flex flex-col lg:flex-row justify-center items-center">
          <div className="flex flex-col w-full max-w-6xl mb-5">
            {/* Header buttons */}
            <div className="flex flex-wrap gap-3 mb-4 md:mb-16">
              <button className="px-7 py-3.5 md:px-10 md:py-4 rounded-full border border-zinc-700 text-sm md:text-2xl font-normal font-lufga text-white hover:bg-zinc-800 transition-colors">
                EXIT OPPORTUNITIES
              </button>
              <button className="px-7 py-3.5 md:px-10 md:py-4 rounded-full border border-zinc-700 text-sm md:text-2xl font-normal font-lufga text-white hover:bg-zinc-800 transition-colors">
                Company Exchange
              </button>
            </div>
            {/* Main content */}
            <h1 className="text-xl md:text-[44px] font-medium font-lufga">
              EX provides you an intuitive dashboard, realtime analytics, and a secure marketplace for BUYING & SELLING
              Companies.
            </h1>

          </div>

          {/* Right side - Rating card */}
          <div className="flex justify-end  w-full">
            <Card className="bg-zinc-900 border-0 rounded-xl  w-full max-w-[242px] md:max-w-[450px] ">
              <CardContent className="p-3 md:p-6">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-[40px] md:text-[74px] font-normal font-lufga text-white/90">4,8</div>
                  <Badge className="bg-[#c6fe1e] text-xs md:text-2xl text-black font-normal font-lufga rounded-[40px] px-[10.77px] py-[5.38px] md:px-5 md:py-3">
                    Our Rating
                  </Badge>
                </div>

                <div className="flex mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="#FFC81D"
                      className="text-[#FFC81D] w-3.5 h-3.5 md:w-5 md:h-5"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>

                <div className="flex items-center gap-1 my-6">
                  <Avatar className="w-10 h-10 md:w-20 md:h-20">
                    <AvatarImage src="/person1.png" alt="User" />
                    <AvatarFallback>U1</AvatarFallback>
                  </Avatar>
                  <Avatar className="w-10 h-10 md:w-20 md:h-20 -ml-5">
                    <AvatarImage src="/person2.png" alt="User" />
                    <AvatarFallback>U2</AvatarFallback>
                  </Avatar>
                  <Avatar className="w-10 h-10 md:w-20 md:h-20 -ml-5">
                    <AvatarImage src="/person3.png" alt="User" />
                    <AvatarFallback>U2</AvatarFallback>
                  </Avatar>
                </div>

                <p className="text-xs md:text-2xl font-lufga font-normal text-white">
                  Explore Our Customer
                  <br />
                  reviews on the WEB
                </p>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Stats section */}
        <div className="grid grid-cols-3 gap-4 md:gap-8 place-items-center mt-22">
          {/* New Listings */}
          <div>
            <div className="text-sm md:text-[22px] font-normal font-lufga text-white/50 mb-1">New</div>
            <div className="text-sm md:text-[22px] font-normal font-lufga text-white/50  mb-5 md:mb-10">Listings Daily</div>
            <div className="text-[40px] md:text-5xl md:text-[102px] font-normal font-lufga text-white">8+</div>
          </div>

          {/* Total User Base */}
          <div>
            <div className="text-sm md:text-[22px] font-normal font-lufga text-white/50 mb-1">Total</div>
            <div className="text-sm md:text-[22px] font-normal font-lufga text-white/50  mb-5 md:mb-10">User Base</div>
            <div className="text-[40px] md:text-5xl md:text-[102px] font-normal font-lufga text-white">10K</div>
          </div>

          {/* Requested Deal Volume */}
          <div>
            <div className="text-sm md:text-[22px] font-normal font-lufga text-white/50 mb-1">Requested</div>
            <div className="text-sm md:text-[22px] font-normal font-lufga text-white/50  mb-5 md:mb-10">Deal Volume</div>
            <div className="text-[40px] md:text-5xl md:text-[102px] font-normal font-lufga text-white">500M</div>
          </div>
        </div>
      </div>
    </div>
  )
}
