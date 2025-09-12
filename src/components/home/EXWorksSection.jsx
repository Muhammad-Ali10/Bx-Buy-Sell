

import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import Image from "next/image"

export default function EXWorksSection() {

  const businessName = ["Shopify", "Saas (Software as a Service)", "E-Commerce", "YouTube Automation", "Service Business"]

  const features = ["Buyer & Seller Protection", "Fast & Secure Payments", "Verified Transactions"]

  return (
    <main className="flex flex-col items-center">
      {/* How EX Works Section */}
      <section className="w-full py-16 px-4 flex flex-col items-center text-center">
        <h1 className="text-[32px] md:!text-[56px] font-sora font-bold mb-4">How EX works</h1>
        <p className="text-sm md:text-base font-sora font-normal text-black mb-1">Buy & Sell Companies in 3 Easy Steps.</p>
        <p className="text-sm md:text-base font-sora font-normal text-black mb-8">
          Seamlessly connecting buyers and sellers for faster, smoother deals.
        </p>


        <div className="flex w-full flex-col m-auto gap-6">
          <Tabs defaultValue="account">
            <TabsList className="flex gap-5 bg-transparent m-auto
">
              <TabsTrigger value="account"
                className="rounded-xl px-4 py-3 text-sm md:text-base  font-sora font-semibold bg-[#EEEEEE] data-[state=active]:bg-[#c4fc1e] border-0 min-w-[166px] min-h-[56px]">
                I'm A Buyer</TabsTrigger>
              <TabsTrigger value="password"
                className="rounded-xl px-4 py-3 text-sm md:text-base  font-sora font-semibold text-black bg-[#EEEEEE] data-[state=active]:bg-[#c4fc1e] min-w-[166px] min-h-[56px]">
                I'm A Seller

              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full  max-w-[1620px] m-auto">
                {/* List Your Business Card */}
                <div className="flex flex-col max-w-[533px] md:h-[539.6px] gap-8 w-full">
                  <div className="bg-[#F5F5F5] max-w-[524px] h-[395.6px] w-full  rounded-2xl flex items-center justify-center">
                    <div className="bg-white/65 rounded-2xl max-w-[352.68px] max-h-[326px] p-6 w-full m-auto flex flex-col gap-2 ">
                      <div className="relative w-full h-full">
                        <div className="absolute left-2.5 top-3">
                          <Image src="/Search.png"
                            width={15.62}
                            height={15.62}
                            alt="Search"
                            className="w-[9.38px] h-[9.38px] md:w-[15.62px] md:h-[15.62px]" />
                            
                        </div>
                        <Input id="search" type="search" placeholder="What are you looking for!" className="w-full  rounded-lg bg-background font-sora font-normal text-[8.34px] md:text-[10.41px] text-black pl-8 py-2.5 h-8 md:h-10" />
                      </div>
                      {businessName.map((itemName, index) =>
                        <div className="flex items-center gap-3 h-8 md:h-10 bg-white p-3 rounded-[6.26px]" key={index}>
                          <Image src="/box.png"
                            width={26.03}
                            height={26.03}
                            alt="box"
                            className="w-[20.85px] h-[20.85px] md:w-[26.03px] md:h-[26.03px]"
                          />
                          <span className="font-sora text-[8.34px] md:text-[10.41px] font-normal text-black">{itemName}</span>
                        </div>
                      )}

                    </div>

                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-semibold font-sora text-[#0B2B36] text-left">Browse All Listings</h2>
                    <p className="text-gray-600 text-sm text-left">
                      Search, filter, and discover thousands of businesses that match your criteria and vision.
                    </p>
                  </div>
                </div>

                {/* Interact with Buyers Card */}
                <div className="flex flex-col w-full h-full max-w-[524px] max-h-[436px] md:max-h-[553px]  bg-white  justify-center items-center rounded-xl shadow-2xl p-3 gap-6">
                  <div className="bg-[#F5F5F5] rounded-2xl w-full h-full	max-w-[492px] flex justify-center items-center  max-h-[305px] md:max-h-[387px]">
                    <div className="bg-white rounded-md w-full h-full max-w-[314px]  flex flex-col justify-center max-h-[230px] md:max-h-[292px] gap-5 px-8">
                      {Array(4).fill(null).map((_, index) =>
                        <div className="flex flex-row items-center gap-3 h-10" key={index}>
                          <Image src="/personbox.png"
                            width={52.58}
                            height={52.58}
                            alt="box"
                          />
                          <div className="flex flex-col w-full h-full justify-center gap-2">
                            <div className="max-w-32 w-full max-h-3 h-full rounded-[2px]	bg-[#F5F5F5]"></div>
                            <div className="max-w-28 w-full max-h-3 h-full rounded-[2px]	bg-[#F5F5F5]"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-semibold font-sora text-[#0B2B36] text-left">Negotiate with Sellers</h2>
                    <p className="text-gray-600 text-sm text-left">
                      Securely connect, negotiate, and review all key details to ensure the best possible deal.
                    </p>
                  </div>
                </div>

                {/* Seal the Deal Card */}
                <div className="flex flex-col gap-8 w-full  max-w-[524px] h-[539.6px]">
                  <div className="bg-[#F5F5F5] rounded-2xl w-full max-w-[524px] h-[395px] flex flex-col gap-4 justify-center items-center p-5">
                    <div className="flex flex-row items-center w-[309px]">
                      <div className="w-7 h-7 rounded-full border-2 bg-white border-[#C9C9C9]"></div>
                      <div className="w-[120px] h-1 bg-[#C9C9C9]"></div>
                      <div className="w-7 h-7 rounded-full border-2 bg-white border-[#C9C9C9]"></div>
                      <div className="w-[120px] h-1 bg-white"></div>
                      <div className="w-7 h-7 rounded-full border-2 bg-white border-white"></div>
                    </div>
                    <div className="bg-white rounded-md w-full h-full max-w-[391px]  flex flex-col justify-center max-h-[297px] gap-5 px-8">

                      <div className="flex flex-col items-center gap-3">
                        <Image src="/greenshield.png"
                          width={52.58}
                          height={52.58}
                          alt="box"
                        />
                        <div className="flex flex-col w-full max-w-40 h-full justify-center items-center gap-2">
                          <div className="max-w-40 w-full h-3 rounded-[2px]	bg-[#F5F5F5]"></div>
                          <div className="max-w-32 w-full h-3  rounded-[2px]	bg-[#F5F5F5]"></div>
                        </div>
                      </div>
                      {features.map((itemName, index) =>
                        <div className="flex flex-row items-center max-w-[343px] bg-[rgba(174,243,31,0.3)] gap-3 h-10 rounded-[7px] p-3" key={index}>
                          <Image src="/greencheckbox.png"
                            width={18}
                            height={18}
                            alt="checkbox" />
                          <span className="font-sora font-normal text-black">{itemName}</span>
                        </div>

                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-semibold font-sora text-[#0B2B36] text-left">Seal the Deal with EX Pay</h2>
                    <p className="text-gray-600 text-sm text-left">
                      Our integrated escrow service, EX Pay, ensures a smooth, secure, and fully protected transaction.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="password" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full  max-w-[1620px] m-auto">
                {/* List Your Business Card */}
                <div className="flex flex-col max-w-[533px] h-[539.6px]  gap-8 w-full">
                  <div className="bg-[#F5F5F5] max-w-[533px] h-[395.6px] w-full  rounded-2xl flex items-center justify-center">
                    <div className="bg-[#fcfcfc] rounded-2xl max-w-[352.68px] max-h-[326px] p-6 w-full m-auto flex flex-col gap-4">
                      <div className="relative w-full h-full">
                        <div className="absolute left-2.5 top-3">
                          <Image src="/Search.png"
                            width={15.62}
                            height={15.62}
                            alt="Search" />
                        </div>
                        <Input id="search" type="search" placeholder="What are you looking for!" className="w-full  rounded-lg bg-background font-sora font-normal  text-black pl-8 py-2.5 h-10" />
                      </div>
                      {businessName.map((itemName, index) =>
                        <div key={`business-${index}` } className="flex items-center gap-3 h-10">
                          <Image src="/box.png"
                            width={26.03}
                            height={26.03}
                            alt="box"
                          />
                          <span className="font-sora  font-normal text-black">{itemName}</span>
                        </div>
                      )}

                    </div>

                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-semibold font-sora text-[#0B2B36] text-left">List Your Business 4 free</h2>
                    <p className="text-gray-600 text-sm text-left">
                      Create a compelling listing in minutes. No upfront fees, no hassle—just visibility to serious buyers.
                    </p>
                  </div>
                </div>

                {/* Interact with Buyers Card */}
                <div className=" flex-col w-full   max-w-[524px] h-[553px]  bg-white flex justify-center items-center rounded-xl shadow-2xl p-3 gap-6">
                  <div className="bg-[#F5F5F5] rounded-2xl w-full h-full	max-w-[492px] flex justify-center items-center  max-h-[387px]">
                    <div className="bg-white rounded-md w-full h-full max-w-[314px]  flex flex-col justify-center max-h-[292px] gap-5 px-8">
                      {Array(4).fill(null).map((index) =>
                        <div className="flex flex-row items-center gap-3 h-10">
                          <Image src="/personbox.png"
                            width={52.58}
                            height={52.58}
                            alt="box"
                          />
                          <div className="flex flex-col w-full h-full justify-center gap-2">
                            <div className="max-w-32 w-full max-h-3 h-full rounded-[2px]	bg-[#F5F5F5]"></div>
                            <div className="max-w-28 w-full max-h-3 h-full rounded-[2px]	bg-[#F5F5F5]"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-semibold font-sora text-[#0B2B36] text-left">Interact with Buyers</h2>
                    <p className="text-gray-600 text-sm text-left">
                      Communicate securely, answer questions, and showcase your business to qualified prospects.
                    </p>
                  </div>
                </div>

                {/* Seal the Deal Card */}
                <div className="flex flex-col gap-8 w-full  max-w-[524px] h-[539.6px]">
                  <div className="bg-[#F5F5F5] rounded-2xl w-full max-w-[524px] h-[395px] flex flex-col gap-4 justify-center items-center">
                    <div className="flex flex-row items-center w-[309px]">
                      <div className="w-7 h-7 rounded-full border-2 bg-white border-[#C9C9C9]"></div>
                      <div className="w-[120px] h-1 bg-[#C9C9C9]"></div>
                      <div className="w-7 h-7 rounded-full border-2 bg-white border-[#C9C9C9]"></div>
                      <div className="w-[120px] h-1 bg-white"></div>
                      <div className="w-7 h-7 rounded-full border-2 bg-white border-white"></div>
                    </div>
                    <div className="bg-white rounded-md w-full h-full max-w-[391px]  flex flex-col justify-center max-h-[297px] gap-5 px-8">

                      <div className="flex flex-col items-center gap-3">
                        <Image src="/sheild.png"
                          width={52.58}
                          height={52.58}
                          alt="box"
                        />
                        <div className="flex flex-col w-full max-w-40 h-full justify-center items-center gap-2">
                          <div className="max-w-40 w-full h-3 rounded-[2px]	bg-[#F5F5F5]"></div>
                          <div className="max-w-32 w-full h-3  rounded-[2px]	bg-[#F5F5F5]"></div>
                        </div>
                      </div>
                      {features.map((itemName, index) =>
                        <div className="flex flex-row items-center max-w-[343px] bg-[#F5F5F5] gap-3 h-10 rounded-[7px] p-3">
                          <Image src="/checkbox.png"
                            width={14.62}
                            height={14.62}
                            alt="checkbox" />
                          <span className="font-sora  font-normal text-black">{itemName}</span>
                        </div>

                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h2 className="text-3xl font-semibold font-sora text-[#0B2B36] text-left">Seal the Deal with EX Pay</h2>
                    <p className="text-gray-600 text-sm text-left">
                      Finalize your deal safely with secure payments through our escrow service  EX Pay
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>


      </section>

      {/* Dark Section */}
      <section className=" w-full md:max-h-[1142px] h-full bg-[#0D0D0D] text-white py-24 ">
        

        <div className="max-w-[1939px] md:h-[1142px] p-9 w-full rounded-xl  mx-auto">
          <div className="flex flex-col w-full gap-12 md:gap-24">
            <div>
              <h2 className="text-[28px] md:text-7xl font-normal font-lufga mb-4 md:mb-8 text-white/70">EX -Secure, Simple, Seamless</h2>
            </div>
            <div className="flex items-center justify-end">
              <p className="max-w-[336px] md:max-w-3xl  font-normal font-lufga text-xs  md:text-2xl text-white/60 leading-relaxed">
                EX is where serious buyers meet real sellers. Whether you're looking to acquire your next cash-flowing
                asset or exit your business with confidence — EX gives you the place to do it right. We combine clean
                design with powerful analytics, secure infrastructure, and a smooth user experience.
              </p>
            </div>
          </div>
        </div>
       
      </section>
    </main>
  )
}
