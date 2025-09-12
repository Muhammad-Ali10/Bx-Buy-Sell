"use client"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { ArrowRight } from "lucide-react"

export default function EXMobileApp() {
  return (
    <div className="bg-black flex items-center justify-center p-4">
      <div className=" bg-[url('/bg1.png')] bg-cover	bg-center	bg-no-repeat	rounded-3xl md:rounded-[40px] overflow-hidden max-w-[1520px] md:max-h-[679px] max-h-[292px] h-full w-full mx-auto">

        <div className="relative z-10 flex flex-col-reverse md:flex-row items-center">
          {/* Left side - Mobile phone image */}
          <div className="flex justify-end md:justify-start -mb-32 md:mb-0 -mr-48 md:mr-0">
            <Image
              src="/handphone.png"
              width={600}
              height={500}
              alt="Hand holding EX mobile app"
              className="h-auto max-w-[331px] max-h-[331px] md:max-w-[600px] md:max-h-[500px]"
              priority
            />
          </div>

          {/* Right side - Text and button */}
          <div className="text-white flex flex-col justify-start items-start gap-8 absolute md:relative">
            <h1 className="text-[28px] md:text-4xl lg:text-7xl font-normal text-white font-lufga max-w-[362px] md:max-w-[700px]">
              Download the EX
              Mobile App NOW
            </h1>
            <p className="text-sm md:text-2xl font-normal font-lufga text-white/70">Have everything on the go. Speed is crucial in business.</p>
            <Button className="bg-white text-xs text-black hover:bg-gray-100 rounded-full px-6 py-3 h-auto flex items-center gap-2 font-medium">
              Download Now
              <span className="flex items-center justify-center bg-[#c1ff00] rounded-full w-6 h-6">
                <ArrowRight className="w-3 h-3" />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
