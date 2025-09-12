"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { CircleDollarSign } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Image from "next/image"

export default function SecurePayments() {

  const Details = [
    {
      imageSrc: "/norisk.png",
      title: "No Risk",
      description: "EX PAY removes the risk of the whole transaction. So you can focus on the deal."
    },
    {
      imageSrc: "/bag.png",
      title: "Trustworthy Escrow Service",
      description: "Get your money safe through EX PAY. We protect buyers & sellers!"
    },
    {
      imageSrc: "/wheal.png",
      title: "Fast and Safe",
      description: "Receive or send payments quickly. No unnecessary steps & low fees."
    },
    {
      imageSrc: "/walate.png",
      title: "Seamless Integration",
      description: "Complete your business transactions smoothly without leaving our platform."
    }
  ]

  return (
    <div className="bg-black text-white flex flex-col items-center justify-center p-4 md:p-8">
      <div className="max-w-[1472px] w-full mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-[32px] md:!text-4xl lg:!text-7xl leading-10 md:leading-[80px] font-noraml font-lufga mb-4">
            Secure Payments with
            <br />
            EX PAY
          </h1>
          <p className=" text-sm md:text-2xl max-w-5xl font-noraml font-lufga mx-auto">
            EX PAY is the trusted payment solution on our marketplace, ensuring every transaction is secure, fast, and
            reliable. Whether you are buying or selling a business, Ex Pay offers safe and seamless payments directly on
            our platform
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6 flex flex-col gap-4">
            {Details.map((item, index) =>
              <div className="flex flex-row gap-6 items-start" key={index}>
                <Image src={item.imageSrc} width={58} height={58}  alt={"image"}/>
                <div className="flex flex-col gap-3">
                  <span className="text-xl md:text-2xl font-normal font-lufga text-white">{item.title}</span>
                  <p className="text-sm md:text-[22px] font-normal font-lufga text-white/50 w-full max-w-[514px]">{item.description}</p>
                </div>

              </div>)}

            <div className="flex justify-center lg:justify-start mt-8">
              <Button
                className="rounded-full bg-white text-black border-white px-7 py-4 roundex-[70px] text-sm md:text-[22px] leading-7 font-noraml font-lufga">
                Read More
              </Button>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-[734px] bg-white/5 border-0 rounded-[40px] text-white overflow-hidden">
              <CardContent className="flex flex-col gap-5 ">
                <div className="md:p-3 bg-[#202020] max-w-[266.66px] p-2 md:max-w-[485.71px] flex flex-col gap-2 md:gap-5 justify-between items-center rounded-xl w-full">
                  <div className="flex flex-row w-full justify-between items-center">
                    <p className="text-[9.9px] md:text-lg text-white/50 font-normal font-lufga">Transfer money to</p>
                    <p className=" md:text-xl font-medium text-white font-lufga">-120,000</p>
                  </div>
                  <div className="flex flex-row w-full justify-between items-center">
                    <div className="flex flex-row w-full justify-start gap-0 md:gap-3 items-center">
                      <Avatar>
                        <img src="/avatarimg.png" alt="User avatar" className="w-[22px] h-[22px]"/>
                      </Avatar>
                      <p className="text-[11.32px] md:text-xl font-medium text-white font-lufga">Alessio Kinsey</p>
                    </div>
                    <p className="text-[9.9px] md:text-lg text-white/50 font-normal font-lufga max-w-[174px] w-full text-right">Aug 2023 9:30 am</p>
                  </div>
                </div>



                <div className="w-full flex justify-end">
                  <div className="p-4 pr-0 bg-[#1364FF] max-w-[266.66px] md:max-w-[485.71px] rounded-2xl w-full flex flex-col gap-4 justify-between items-center right-0">
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-lufga text-[11.88px] font-medium text-white md:text-[21.63px]">EX PAY - Process</span>
                      <Select>
                        <SelectTrigger className="w-[110px] !h-8 border-0 !text-white text-lg font-lufga font-medium capitalize !shadow-none	bg-transparent">
                          <SelectValue placeholder="Today" />
                        </SelectTrigger>
                        <SelectContent className="text-[9.9px] md:text-lg font-lufga font-medium capitalize" >
                          <SelectItem value="today">today</SelectItem>
                          <SelectItem value="month">month</SelectItem>
                          <SelectItem value="year">year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-6 flex flex-col w-full">
                      <div className="flex flex-col gap-4 w-full">
                        <div className="flex justify-start  items-end gap-3 mb-1">
                          <span className="text-[22.64px] md:text-[41.23px] font-medium font-lufga leading-5  md:leading-9 text-white">$120,000</span>
                          <span className="text-[9.9px] md:text-lg  font-lufga font-normal text-white/50">Deposited</span>
                        </div>
                        <div className="w-full h-[20px] flex flex-row">
                          <div className="bg-[#FAFE1E] max-h-[11.32px] md:max-w-[20.61px] max-w-[64.61px] md:max-w-[112px] w-full  h-full rounded-full" ></div>
                          <div className="bg-[#A9FE1E] max-h-[11.32px] md:max-w-[20.61px] max-w-[97.79px] md:max-w-[172.64px] w-full  h-full rounded-full" ></div>
                          <div className="bg-[#FFFFFF] max-h-[11.32px] md:max-w-[20.61px] max-w-[29px] md:max-w-[52.82px] w-full  h-full rounded-full" ></div>
                          <div className="bg-white/40  max-h-[11.32px] md:max-w-[20.61px] max-w-[18.39px] md:max-w-[33.5px] w-full  h-full rounded-full" ></div>
                          <div className="bg-white/5   max-h-[11.32px] md:max-w-[20.61px] max-w-[40.32px] md:max-w-[73.44px] w-full  h-full rounded-full" ></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 rounded-lg">
                        <Image src="/mony.png" width={66} height={66} alt={"image"} className="w-[36.78px] h-[36.78px] md:w-[66px] md:h-[66px]"/>
                        <div>
                          <p className="text-[12.73px] md:text-[23.19px] font-medium font-lufga text-white">Money arrived</p>
                          <p className="text-[9.9px] md:text-lg  font-medium font-lufga text-white/50">In review</p>
                        </div>
                        <span className="ml-auto text-[12.73px] md:text-[23.19px] font-medium font-lufga text-whites">+120,000$</span>
                      </div>
                    </div>
                  </div>
                </div>


              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ icon, title, description }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="bg-blue-500 bg-opacity-20 p-2 rounded-full">{icon}</div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  )
}
