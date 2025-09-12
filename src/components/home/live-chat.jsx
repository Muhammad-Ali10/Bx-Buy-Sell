"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Image from "next/image"

export default function LiveChatAndVideo() {
  return (
    <div className="bg-black text-white flex items-center justify-center p-4 md:p-8">
      <Card className="w-full max-w-[1880px] flex flex-col lg:flex-row justify-center	items-start bg-zinc-900 rounded-3xl overflow-hidden border-0 p-6 md:p-12 ">

        <div className="flex flex-col max-w-[805px] w-full justify-start items-start gap-8 md:gap-16" >
          <Button

            className="text-sm md:text-2xl font-normal font-lufga text-white bg-transparent	border rounded-full px-6 py-3 md:px-8 md:py-8">
            Start Now
          </Button>
          <div className="relative mb-6 rounded-xl overflow-hidden">
            <Image
              src="/livechat.png"
              width={805}
              height={605}
              alt="Video conference"
              className="w-full rounded-xl w-full max-w-[600px] 2xl:max-w-[805px]"
            />
          </div>
          <h2 className="text-[28px] md:text-[54px] font-normal font-lufga max-w-[475px] text-white">Live Chat & Video Meetings</h2>
          <p className="text-white/50 text-sm md:text-2xl font-normal font-lufga max-w-[668px]">
            Chat with sellers and buyers on our internal chat system that offers payment system, fraud protection
            and many more helpful functions.
          </p>
        </div>
        <div className="flex max-w-[805px] w-full h-full">
          <div className="flex justify-center w-full h-full">
            {/* Blue background behind the phone */}
            <div className="relative w-full h-full">
              <div className="absolute bg-blue-600 max-h-[351px] md:max-h-[740px] h-full	max-w-[805px]	 w-full rounded-[40px]"></div>

              {/* Phone mockup */}

              <Image
                src="/mobileapp2.png"
                width={555}
                height={1158}
                alt="Mobile chat application"
                className="relative z-10 rounded-[40px] w-full max-w-[263px] md:max-w-[555px] m-auto mt-10 2xl:mt-40"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
