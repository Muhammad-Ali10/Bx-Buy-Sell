"use client"
import {
    ArrowRightSVG,
} from "@/svg"
import { dummyListings } from "@/lib/dummy-data";
import Link from "next/link";
import ListingCard from "../../../../../components/shared/listing-card";
import { Input } from "@/components/ui/input";
import { SearchSVG, LocationSVG } from "@/svg"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"


const UserFavorites = () => {

    return (
        <div className="flex flex-col items-start gap-8 w-full">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>User Details</Link>
            <div className="flex flex-row  items-center justify-between gap-2 w-full max-w-[750px]">

                <div className="flex flex-row items-center border border-black/10 w-full py-1 px-[13.68px] rounded-4xl ">
                    <SearchSVG />
                    <Input type="text" placeholder="Search" className="border-0 shadow-none outline-none w-full focus-visible:outline-none focus-visible:ring-0 text-[10px]" />
                </div>
                <Select>
                    <SelectTrigger className=" border shadow-none outline-none focus-visible:outline-none focus-visible:ring-0 py-3 px-[13.68px] rounded-4xl w-[180px] !h-full">
                        <SelectValue placeholder="Price Range" className="text-[10px]" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Fruits</SelectLabel>
                            <SelectItem value="apple">Apple</SelectItem>
                            <SelectItem value="banana">Banana</SelectItem>
                            <SelectItem value="blueberry">Blueberry</SelectItem>
                            <SelectItem value="grapes">Grapes</SelectItem>
                            <SelectItem value="pineapple">Pineapple</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <div className="flex flex-row items-center border border-black/10 w-full py-1 px-[13.68px] rounded-4xl">
                    <LocationSVG />
                    <Input type="text" placeholder="⁠Location" className="border-0 shadow-none outline-none w-full focus-visible:outline-none focus-visible:ring-0 text-[10px]" />
                </div>
                <Select>
                    <SelectTrigger className="w-28 border shadow-none outline-none focus-visible:outline-none focus-visible:ring-0 py-3 px-[13.68px] rounded-4xl !h-full ">
                        <SelectValue placeholder="Age" className="text-[10px]" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Fruits</SelectLabel>
                            <SelectItem value="apple">Apple</SelectItem>
                            <SelectItem value="banana">Banana</SelectItem>
                            <SelectItem value="blueberry">Blueberry</SelectItem>
                            <SelectItem value="grapes">Grapes</SelectItem>
                            <SelectItem value="pineapple">Pineapple</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
                <Select>
                    <SelectTrigger className="w-28 border shadow-none outline-none focus-visible:outline-none focus-visible:ring-0 py-3 px-[13.68px] rounded-4xl !h-full">
                        <SelectValue placeholder="Niche" className="text-[10px]" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel>Fruits</SelectLabel>
                            <SelectItem value="apple">Apple</SelectItem>
                            <SelectItem value="banana">Banana</SelectItem>
                            <SelectItem value="blueberry">Blueberry</SelectItem>
                            <SelectItem value="grapes">Grapes</SelectItem>
                            <SelectItem value="pineapple">Pineapple</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {dummyListings.map((listing, index) => (
                    <ListingCard key={index} listing={listing} />
                ))}
            </div>
        </div>
    )
}

export default UserFavorites