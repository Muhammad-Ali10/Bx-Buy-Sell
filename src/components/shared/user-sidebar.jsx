"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { USER_SIDEBAR_NAV } from "@/config/navpath";
import { usePathname } from "next/navigation";
import clsx from "clsx";
// import { GearSVG } from "@/svg";
import { GearSVG } from "@/svg/index";
const UserSidebar = () => {
  const currentPath = usePathname();

  return (
    <div className="p-4 bg-[black] min-h-screen  hidden md:flex flex-col sm:min-w-[384px] md:max-w-[23.3125em] gap-[12px] w-full">
      <div className="flex md:block items-center mb-4">
        {/* <div className="bg-[#c1ff00] text-black font-bold p-1.5 rounded text-xl">BX</div> */}
        <Image src={"/logo.png"} height={60} width={60} alt="filter-logo" />
      </div>

      {/* User Dynamic Sidebar */}
      <div className="  flex flex-col  p-[24px] gap-[10px]   ">
        {USER_SIDEBAR_NAV.map((item, index) => (
          <Link
            key={item.path}
            href={item.path}
            className={clsx(
              "flex group group  px-[20px] py-[16px]  w-full max-w-[298px]  rounded-[56px] gap-4",
              currentPath.includes(item.path) && "bg-[#AEF31F] text-black"
            )}
          >
            <item.icon
              className={clsx(
                "w-[28px] stroke-1  h-[28px] text-[#FFFFFF99]    ",
                currentPath.includes(item.path) && "text-black"
              )}
            />
            <span
              className={clsx(
                "text-[20px] font-lufga  leading-[150%] text-[#FFFFFF99]",
                currentPath.includes(item.path) && " text-black"
              )}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Upgrade banner */}
      <div className=" pt-6">
        <div className="bg-[#c1ff00] w-full h-full max-w-[341px] max-h-[293px]  flex flex-col justify-center items-center item-center gap-[32px] text-black p-4 rounded-[32px]">
          <div className="h-[70px] w-[68.6px] rounded-[42px] bg-[#0000001A] flex justify-center items-center">
            <Image
              src={"/rocket.png"}
              height={35}
              width={35}
              alt="rocket.png"
            />
          </div>
          <h3 className="font-bold text-center text-[25px] mb-2">
            Upgrade Your Account To Premium
          </h3>
          <Button className="w-full bg-black text-white flex items-center text-[16px] p-[17px] rounded-[50px] justify-center gap-2">
            Lets Go{" "}
            <Image
              src={"/arrow-right.png"}
              height={20}
              width={20}
              alt="arrow-right"
            />
          </Button>
        </div>
      </div>
      <div className="flex flex-col  p-[24px] ">
        <Link
          href={"settings"}
          className={clsx(
            "flex group group  px-[20px] py-[16px]  w-full max-w-[298px]  rounded-[56px] gap-4",
            currentPath.includes("/settings") && "bg-[#AEF31F] text-black"
          )}
        >
          <GearSVG
            className={clsx(
              "w-[28px] stroke-1  h-[28px] text-[#FFFFFF99]    ",
              currentPath.includes("/settings") && "text-black"
            )}
          />
          <span
            className={clsx(
              "text-[20px] font-lufga  leading-[150%] text-[#FFFFFF99]",
              currentPath.includes("settings") && " text-black"
            )}
          >
            Settings
          </span>
        </Link>
        <Link
          href={"#"}
          className="flex group px-[20px] py-[16px]  w-full max-w-[298px] rounded-[32px] gap-4"
        >
          <Image
            src={"/signout.png"}
            height={28}
            width={28}
            alt="signout.png"
          />
          <span className="text-[20px] font-lufga  leading-[150%] text-[#FFFFFF99]">
            Logout
          </span>
        </Link>
      </div>
    </div>
  );
};

export default UserSidebar;
