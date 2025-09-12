"use client"
import React from 'react';
import Link from "next/link"
import { AlartSVG, RequestSVG, CalenderSVG, FaceScanSVG, ArrowRightSVG, Chat1SVG, BlockSVG, DeleteSVG, ProSVG, UrlSVG } from "@/svg"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";


const listingDetail = () => {
    return (
        <div className="flex flex-col w-full gap-2">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>User Details</Link>
            <div className="flex flex-row items-center justify-between w-full">
                <div className="flex flex-col justify-between items-start gap-5">
                    <div className="flex flex-row flex-wrap items-center gap-2.5">
                        <span className="flex items-center gap-2"><AlartSVG /> unanswered messages <strong>12</strong></span>
                        <span className="flex items-center gap-2"><RequestSVG /> Request <strong>5</strong></span>
                        <span className="flex items-center gap-2"><CalenderSVG /> Created at Date <strong>2025-07-15</strong></span>
                    </div>
                </div>
                <DropdownMenu >
                    <DropdownMenuTrigger className="font-lufga font-medium text-lg text-black bg-[#C6FE1F] hover:bg-lime-500 rounded-[65px] py-2.5 px-5">Settings</DropdownMenuTrigger>
                    <DropdownMenuContent className="border border-[#C6FE1F] rounded-lg min-w-14 items-center gap-2 flex flex-col">
                        <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><Chat1SVG /></DropdownMenuItem>
                        <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><BlockSVG /></DropdownMenuItem>
                        <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><DeleteSVG /></DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex flex-col items-start gap-10">
                <h1 className="font-lufga text-2xl font-medium text-black">Fashion / Beauty E-commerce Store</h1>
                <p className="font-abeezee font-normal text-xs text-black/50 max-w-[524px] w-full">Easily manage your listings with images, pricing, status, and requests to optimize your selling experience...</p>
                <div className="flex flex-row items-center gap-2.5">
                    <h2 className="font-lufga font-medium text-2xl md:text-4xl text-black">1500$</h2>
                    <div className="flex flex-row justify-center items-center border-[2px] border-[#808080] px-3  rounded-[60px]">
                        <p className=" text-[7px] font-medium font-lufga pr-2 py-1 text-black/70">
                            Multiple 1.1x Profit
                        </p>
                        <hr className="inline-block h-full min-h-[1.2em] w-0.5 self-stretch bg-[#808080] " />
                        <p className="text-[7px] font-medium font-lufga pl-2 py-1 text-black/70">
                            0.3x Revenue
                        </p>
                    </div>
                    <p className="font-lufga font-medium text-base text-black/70">Pay in 150$ monthly</p>
                    <p className="font-lufga font-medium text-base text-black/70">10 installments</p>
                </div>
                <Link href={"#"} className="font-lufga font-medium text-base underline text-[#0067FF] hover:text-[#0067FF]" >Financing</Link>
                <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center ">
                        <img src="/avatar1.png" className="size-[72px] rounded-[80px] object-cover" alt="user" />
                        <Badge className="text-[9px] font-lufga text-black bg-[#C6FE1F] -mt-2 flex items-center p-0 gap-1 w-10 h-3.5"><ProSVG className="size-2.5 mt-1" /> <span>Pro</span></Badge>
                    </div>
                    <div className="flex flex-col items-start gap-2 mt-2">
                        <h3 className="flex items-center gap-1 font-lufga text-2xl font-bold">Jerome Bell</h3>
                        <span className="flex items-center gap-2"><FaceScanSVG />ID Verified</span>
                    </div>
                </div>
                <div className="w-full max-w-5xl">
                    <Swiper
                        modules={[Navigation, Autoplay]}
                        spaceBetween={30}
                        slidesPerView={1}
                        navigation
                        autoplay={{ delay: 3000 }}
                        loop={true}
                        className="rounded-2xl shadow-lg"
                    >
                        <SwiperSlide>
                            <img src="/slide1.png" alt="Slide 1" className="w-full h-full object-top object-cover rounded-2xl" />
                        </SwiperSlide>
                        <SwiperSlide>
                            <img src="/slide1.png" alt="Slide 2" className="w-full h-full object-top object-cover rounded-2xl" />
                        </SwiperSlide>
                        <SwiperSlide>
                            <img src="/slide1.png" alt="Slide 3" className="w-full h-full object-top object-cover rounded-2xl" />
                        </SwiperSlide>
                    </Swiper>
                </div>
                <h3 className="font-lufga font-medium text-[32px] text-black">Fashion / Beauty E-commerce Store</h3>
                <span className="font-lufga text-[20px] font-medium text-black flex items-center gap-2">
                    <UrlSVG /> www.beauty.de
                </span>
                <p className="font-abeezee text-xl font-normal text-black/50 w-full max-w-5xl"><span className="font-lufga font-medium">Intro:</span> Easily manage your listings with images, pricing, status, and requests to optimize your selling experience. An e-commerce store is an online platform where businesses sell products or services digitally. It allows customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer convenience, global reach, and 24/7 availability, making shopping easier while helping businesses .</p>
                <p className="font-abeezee text-xl font-normal text-black/50 w-full max-w-5xl"><span className="font-lufga font-medium">USPs: </span> An e-commerce store is an online platform where businesses sell products or services digitally. It allows customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer convenience, global reach, and 24/7 availability, making shopping easier while helping businesses .</p>
                <p className="font-abeezee text-xl font-normal text-black/50 w-full max-w-5xl"><span className="font-lufga font-medium">Description:</span> An e-commerce store is an online platform where businesses sell products or services digitally. It allows customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer convenience, global reach, and 24/7 availability, making shopping easier while helping businesses . An e-commerce store is an online platform where businesses sell products or services digitally. It allows customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer convenience, global reach, and 24/7 availability, making shopping easier while helping businesses .
                <br></br>
                An e-commerce store is an online platform where businesses sell products or services digitally. It allows customers to browse, compare, and purchase items with secure payment options. E-commerce stores offer convenience, global reach, and 24/7 availability, making shopping easier while helping businesses .</p>
            </div>
        </div >
    )
}

export default listingDetail;