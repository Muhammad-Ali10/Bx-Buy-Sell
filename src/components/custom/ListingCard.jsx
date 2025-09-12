'use client'
import React from "react";
import { Share2, EllipsisVertical, Info } from "lucide-react";
import CalenderSVG from "@/svg/calender.svg";
import Link from "next/link";

const ListingCard = () => {
  return (
    <div className="max-w-[485px] w-full bg-[#FAFAFA]  h-[553px] rounded-[20px] px-[12px] py-[24px]">
      {/* Listing Image */}
      <div className='relative bg-[url("/cardListing.png")] bg-cover bg-no-repeat   h-[285px] w-full rounded-[20px]'>
        {/* Admin Tag */}
        <div className="absolute bottom-3 left-4 flex gap-[8px] px-[17px] py-[12px] rounded-[60px] bg-[#C5FD1F] items-center">
          <span className=' bg-[url("/logo.png")] bg-cover border-1 border-black rounded-full h-[20px] w-[20px]' />
          <h1 className="text-[16px] font-lufga color-[#000000] leading-[140%] font-[500] ">
            Managed by EX
          </h1>
        </div>

        {/* Service Tag */}
        <div className="absolute bottom-3 left-[207px] flex gap-[8px] px-[17px] py-[12px] rounded-[60px] bg-[#00000040] backdrop-blur-[44px] items-center">
          <h1 className="text-[16px]  text-white leading-[140%] font-[500] ">
            Ecommerce
          </h1>
        </div>

        {/* Share Button */}
        <div className="absolute top-3 right-4 gap-[8px] h-[48px] w-[48px] rounded-[60px] bg-[#F9FBFC] flex items-center justify-center">
          <EllipsisVertical
            height={20}
            width={20}
            strokeWidth={1.2}
            fill="black"
            className="cursor-pointer"
          />
        </div>

        {/* DropdownMenu Button */}
        <div className="absolute top-[69px] right-4 gap-[8px] h-[48px] w-[48px] rounded-[60px] bg-[#F9FBFC] flex items-center justify-center">
          <Share2
            height={20}
            width={20}
            strokeWidth={1.2}
            fill="black"
            className="cursor-pointer"
          />
        </div>
      </div>

      {/* Listing Details */}
      <div className=" flex justify-between items-center my-4">
        {/* title */}
        <h1 className="font-[600] text-[18px] text-[#000000] leading-[140%] font-lufga]">
          High Profitable! Pet Online Shop
        </h1>
        {/* Status */}
        <span className="bg-[#FF13131A] text-[#FF1313] rounded-full py-[7px] px-[17px] font-semibold">
          Draft
        </span>
      </div>

      <div className=" flex justify-between items-center my-4">
        {/* Price */}
        <h1 className="font-[600] text-[28px] font-lufga text-[#000000] leading-[140%] font-lufga]">
          $105,000
        </h1>

        {/* Status */}
        <div className="flex gap-[8px] items-center rounded-full py-[7px] px-[17px] font-semibold">
          <Info height={20} width={20} stroke={"#FF2424"} />
          <span className="font-lufga font-[400] text-[16px] text-[#00000080]">
            Edit or Publish your Listing
          </span>
        </div>
      </div>

      {/* Date & Request */}
      <div className="flex justify-between items-center my-4">
        <span className="flex items-center gap-[8px]">
          <CalenderSVG height={24} width={24} />
          <p className="font-lufga text-[16px] leading-[140%] font-[500] text-[#00000080]">
            {" "}
            Created at: <span className="text-[#000000]">2025-03-30</span>
          </p>
        </span>

        <span className="flex items-center gap-[8px]">
          <p className="font-lufga text-[16px] leading-[140%] font-[500] text-[#00000080]">
            {" "}
            Request: <span className="text-[#000000]">0</span>
          </p>
        </span>
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Link href={"/"} className={"px-[10px] py-[13px] max-w-[212px] h-[48px] w-full text-[16px] bg-[black] rounded-[60px] text-white font-semibold text-center"}>Edit</Link>
        <Link href={"/"} className={"px-[10px] py-[13px] max-w-[212px] h-[48px] w-full text-[16px] bg-[#C5FD1F] rounded-[60px] font-semibold text-black text-center"}>Publish</Link>
      </div>
    </div>
  );
};

export default ListingCard;
