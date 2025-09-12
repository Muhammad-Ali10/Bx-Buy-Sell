"use client";
import React, { useState } from "react";
import {
  Search,
  ArrowUpRight,
  Layers,
  SlidersHorizontal,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, User } from "lucide-react";
import Image from "next/image";
import { Sheet, SheetTrigger, SheetContent } from "../ui/sheet";
import { DialogTitle } from "@radix-ui/react-dialog";
import { LISTING_NAV_PATH } from "@/config/navpath";


export default function HeroSection() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/listings", label: "All Listings" },
    { href: "/buy", label: "How To Buy" },
    { href: "/sell", label: "How To Sell" },
  ];

  return (
    <main className="bg-[url(/herobg.png)] pt-8">
      <header className="container hidden md:block mx-auto py-4 px-4 backdrop-blur-xs rounded-xl bg-[#1360F3]">
        <div className="sm:hidden md:flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className=" p-2 rounded-lg">
                {/* <span className="font-bold text-blue-600 text-xl">B 123X</span> */}
                <Image src={"/logo.png"} height={60} width={60} alt={"image"} />
              </div>
            </Link>
          </div>
          <nav className="hidden md:flex items-center gap-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-full bg-[#FFFFFF0D] font-medium transition-colors ${isActive
                      ? "bg-[var(--primary-button)] text-black"
                      : "text-white hover:bg-blue-500"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <Button
              variant="default"
              size="icon"
              className="relative hover:bg-blue-500 bg-[#FFFFFF0D] rounded-full text-white"
            >
              <Heart className="h-[52px] w-[52px]" />
              <span className="absolute -top-1 -right-1 bg-[var(--primary-button)] text-xs text-blue-900 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                3
              </span>
            </Button>
            <Button
              variant="default"
              size="icon"
              className="bg-[#FFFFFF0D] hover:bg-blue-500 rounded-full  text-white"
            >
              <Link href="/signin">
                <User className="h-[52px] w-[52px]" />
              </Link>

            </Button>
            <Button className="bg-white cursor-pointer  text-blue-600 hover:bg-gray-100">
              <span className="sm:hidden md:block text-[1.5rem] text-black">
                +
              </span>
              <span className="hidden sm:inline text-black">Add Listing</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Side Bar */}
      <header>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden absolute top-9 left-4">
            <Button variant="ghost" className={"hover:bg-blue-500 hover:text-black"} size="icon">
              <Menu className="h-7 w-7 text-white " />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[384px] p-0 bg-black border-gray-800"
          >
            <div className="hidden">
              <DialogTitle />
            </div>
            <nav className="flex flex-col items-center sm:gap-4 md:gap-2 p-4 border-b border-gray-800">
              {LISTING_NAV_PATH.map((nav) => (
                <Link
                  key={nav.path}
                  href={nav.path}
                  className={`px-7 py-3 rounded-[30px] transition-colors ${pathname === nav.path || pathname.includes(nav.path)
                      ? "bg-[#c1ff00] text-black"
                      : "bg-[#0d151b] text-white hover:bg-gray-900"
                    }`}
                >
                  {nav.label}
                </Link>
              ))}
            </nav>
            <div className="flex w-full mx-auto justify-center items-center gap-4">
              <Button
                variant="default"
                size="icon"
                className="relative hover:bg-blue-500 bg-[#FFFFFF0D] rounded-full text-white"
              >
                <Heart className="h-[52px] w-[52px]" />
                <span className="absolute -top-1 -right-1 bg-[var(--primary-button)] text-xs text-blue-900 rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  3
                </span>
              </Button>
              <Button
                variant="default"
                size="icon"
                className="bg-[#FFFFFF0D] hover:bg-blue-500 rounded-full  text-white"
              >
                <User className="h-[52px] w-[52px]" />
              </Button>
              <Button className="bg-white cursor-pointer  text-blue-600 hover:bg-gray-100">
                <span className="sm:hidden md:block text-[1.5rem] text-black">
                  +
                </span>
                <span className="hidden sm:inline text-black">Add Listing</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>
      <section className="mx-auto px-1 md:px-4 pt-16 text-center mt-12">
        <h1 className="text-[40px] md:!text-[85px] font-lufga font-medium text-white mb-4">
          Buy & Sell Companies
          <br />
          in 3 simple Steps
        </h1>
        <p className="text-white/90 text-sm md:text-xl font-lufga font-normal max-w-3xl mx-auto my-8">
          Join the #1 platform for buying & selling companies. Discover,
          connect, and exchange with ease—your journey starts here today!
        </p>

        <div className="flex flex-wrap justify-center text-sm  md:text-base font-lufga font-normal gap-4 md:gap-6 mb-12">
          <div className="flex items-center gap-2 text-white">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span>Secure Payments with EXPay</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span>Simple 3-step process</span>
          </div>
          <div className="flex items-center gap-2 text-white">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span>Start in 1 Minute</span>
          </div>
        </div>

        <div className="bg-blue-500/50 p-2 rounded-lg max-w-4xl mx-auto mb-12 px-6 md:px-12 py-6">
          <div className="flex flex-row items-center gap-2">
            <Select className="text-white md:!h-10 ">
              <SelectTrigger className="w-full  bg-blue-400/30 border-none text-white md:h-16 sm:h-10 ">
                <div className="flex items-center gap-2 text-white text-base font-lufga font-normal md:h-16">
                  <Layers className="text-white" />
                  <SelectValue
                    placeholder="What are you Looking For?"
                    className="text-sm font-lufga font-normal"
                  />
                </div>
              </SelectTrigger>
              <SelectContent className=" text-base font-lufga font-normal ">
                <SelectItem value="ecommerce">E-Commerce</SelectItem>
                <SelectItem value="saas">SaaS</SelectItem>
                <SelectItem value="content">Content</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-[#FAFAFA0D] hover:bg-[var(--primary-button)] border-[1px] border-[#FFFFFF1A] text-white hover:text-black w-10 sm:h-10  md:w-16 md:h-16">
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
            <Button className="bg-[var(--primary-button)] hover:bg-[var(--primary-button)]  text-black  w-10 h-10  md:w-16 md:h-16">
              <Search className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="hidden  lg:flex flex-wrap  justify-center items-center gap-4 font-lufga">
          <div className="text-white/80 mr-4 cursor-pointer">
            Trending Topics
          </div>
          <Badge
            variant="outline"
            className=" bg-[#FFFFFF1A] text-white cursor-pointer !text-base font-normal  border-none rounded-3xl hover:bg-blue-500/50 px-5 py-2"
          >
            Shopify <ArrowUpRight className="ml-1 h-3 w-3" />
          </Badge>
          <Badge
            variant="outline"
            className="bg-[#FFFFFF1A] cursor-pointer text-white !text-base font-normal border-none rounded-3xl hover:bg-blue-500/50 px-5 py-2"
          >
            E-Commerce <ArrowUpRight className="ml-1 h-3 w-3" />
          </Badge>
          <Badge
            variant="outline"
            className="bg-[#FFFFFF1A] cursor-pointer text-white !text-base font-normal border-none rounded-3xl hover:bg-blue-500/50 px-5 py-2"
          >
            YouTube Automation <ArrowUpRight className="ml-1 h-3 w-3" />
          </Badge>
          <Badge
            variant="outline"
            className="bg-[#FFFFFF1A] cursor-pointer text-white !text-base font-normal border-none rounded-3xl hover:bg-blue-500/50 px-5 py-2"
          >
            SaaS <ArrowUpRight className="ml-1 h-3 w-3" />
          </Badge>
        </div>
      </section>
      <section className="flex">
        <div className="max-w-[1920px] mx-auto">
          <Image src="/hero.png" width={1920} height={588} alt="Hero Image" />
        </div>
      </section>
    </main>
  );
}
