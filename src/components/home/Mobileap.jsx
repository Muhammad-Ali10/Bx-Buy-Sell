import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"


export default function Mobileapp() {

    const listingDetalis = [
        {
            name: "EX provides you a simple userface to"
        },
        {
            imgSrc: "/check.png",
            name: "Browse thousands of listings"
        },
        {
            imgSrc: "/check.png",
            name: "Use advanced Filter Options"
        },
        {
            imgSrc: "/check.png",
            name: "Contact the best sellers"
        },
    ]

    return (
        <div className="flex flex-col items-center justify-center bg-black text-white md:gap-12 p-1 md:p-12">
            <div className="flex max-w-[1557px] flex-col-reverse items-center justify-center bg-black text-white md:flex-row gap-12 md:gap-24 p-3 md:p-12">
                <div className="relative w-full shadow-2xl bg-[#0d0d0d] max-w-[658px] py-20 px-24 rounded-4xl mb-10 md:mb-0">
                    <Image
                        src="/mobile.png"
                        alt="Phone Mockup"
                        width={658}
                        height={931}
                        className="object-cover rounded-[32px]"
                        priority
                    />
                </div>

                {/* Marketing Content */}
                <div className="w-full max-w-3xl text-left">
                    <h1 className="mb-8 text-[34px] font-bold lg:text-5xl 2xl:text-7xl  font-lufga">Discover All Listings</h1>
                    <div className="space-y-6">
                        {listingDetalis?.map((itemName, index) =>
                            <div className="flex items-center gap-3" key={index}>
                                {itemName.imgSrc && <Image src={itemName?.imgSrc} alt={`listDetails-{${index}}`} width={31} height={20} />}
                                <p className="text-base md:text-2xl font-normal font-lufga text-white/70">{itemName.name}</p>
                            </div>)}
                    </div>
                    <div className="mt-10">
                        <Button
                            variant="outline"
                            className="rounded-[70px] bg-white px-7 py-5 text-sm md:text-[22px] font-normal font-lufga text-black hover:bg-gray-100"
                        >
                            See All Listings
                        </Button>
                    </div>
                </div>
            </div>

            <div className="bg-black p-3 2xl:p-8 flex flex-col md:flex-row gap-4 md:gap-8 max-w-[1920px] w-full">
                {/* Left Column */}
                <div className="flex flex-col gap-4 md:gap-8  max-w-[930px] w-full ">
                    {/* Reports & Insights Card */}
                    <Card className="bg-[#18181A] text-white gap-2 md:gap-6 p-6 md:p-16 2xl:p-24 border-0 rounded-[26px] md:rounded-[80px]  h-[215px] md:h-[582px]">
                        <h2 className="text-2xl md:text-[48px] 2xl:text-[54px]  font-normal font-lufga mb-2 md:mb-4">Reports & Insights</h2>
                        <p className="text-white/50 md:text-2xl text-sm pb-12 font-normal font-lufga max-w-[668px]">
                            Our detailed dashboard insights clear up most questions early on — so you can focus on what really matters.
                            With key metrics presented clearly, users spend less time searching and more time deciding.
                        </p>
                    </Card>

                    {/* QR Code Card */}
                    <Card className="bg-blue-600 p-6 md:p-16 2xl:p-24 rounded-[26px] md:rounded-[80px]  border-0 flex flex-col items-center justify-center h-[215px] md:h-[582px]">
                        <div className=" relative">
                            <Image
                                src="/QRCode.png"
                                alt="QR Code"
                                width={370}
                                height={411}
                                className="object-contain m-auto w-[192px] h-[192px] md:w-[370px] md:h-[411px]" 
                            />
                        </div>
                    </Card>
                </div>


                <Card className="bg-[#d0ff00] p-6 md:p-8 rounded-3xl flex items-center justify-center max-w-[860px] w-full">
                    <div className="relative w-full  aspect-[250/400]  2xl:aspect-[400/500] rounded-[32px] overflow-hidden">
                        <Image
                            src="/mobileapp.png"
                            alt="Phone Mockup"
                            fill
                            className="object-cover  rounded-[32px]"
                            priority
                        />
                    </div>
                </Card>
            </div>
        </div>
    )
}
