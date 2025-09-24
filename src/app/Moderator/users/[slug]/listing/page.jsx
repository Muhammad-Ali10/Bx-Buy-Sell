"use client"
import {
    AlartSVG,
    ArrowRightSVG,
    CalenderSVG
} from "@/svg"
import { Userlistings } from "@/lib/dummy-data";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";


const UserListings = () => {



    const liststatus = (status) => {

        switch (status) {
            case "Draft":
                return <Button className="text-[#FF1313] text-xs font-medium font-lufga px-3 py-2 rounded-2xl bg-[#FF1313]/30 hover:bg-[#FF1313]/30 h-full">Draft</Button>;
            case "Published":
                return <Button className="text-[#0067FF] text-xs font-medium font-lufga px-3 py-2 rounded-full bg-[#0067FF]/30 hover:bg-[#0067FF]/30 h-full">Published</Button>;
            default:
                break;
        }
    }


    return (
        <div className="flex flex-col items-start gap-8 w-full">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>Team Members</Link>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {Userlistings.map((listing, index) => (
                    <div className="rounded-lg   bg-[#FAFAFA] overflow-hidden">
                        <div className="relative">
                            <Image
                                src={listing.image}
                                width={400}
                                height={285}
                                alt={listing.title}
                                className="w-full object-cover"
                            />
                            <button className="absolute top-3 right-3 bg-white p-3 w-[49px] h-[48px] height rounded-full">
                                <Image
                                    src={"/Vector.png"}
                                    width={20}
                                    height={20}
                                    className="m-auto"
                                    alt="like"
                                />
                            </button>
                            <button className="absolute top-[70px] right-3 bg-white p-3 w-[49px] h-[48px] height rounded-full">
                                <Image
                                    src={"/Frame.png"}
                                    width={20}
                                    height={20}
                                    alt="share"
                                    className="m-auto"
                                />
                            </button>
                            <div className="absolute bottom-3 left-3 flex space-x-2">
                                <div className="bg-black/25 text-xs  md:!text-base  font-medium font-lufga px-3 py-1 text-white rounded-full">
                                    {listing.niche}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col justify-between p-4  gap-2">
                            <div className="flex flex-row justify-between items-center">
                                <h3 className="text-xs font-semibold font-lufga mb-1 text-black">
                                    {listing.title}
                                </h3>
                                {liststatus(listing.status)}
                            </div>
                            <div className="flex flex-row justify-between items-center mb-4">
                                <p className="text-xs font-semibold font-lufga text-black">
                                    ${listing.price.toLocaleString()}
                                </p>
                                {listing.alart && <span className="font-abeezee text-xs text-black/50 font-normal flex items-center gap-1"><AlartSVG /> {listing.alart}</span>}
                            </div>

                            <div className="flex items-center justify-between mb-4">
                                <div className="text-xs font-medium text-black/50 font-lufga flex items-center gap-1">
                                    <CalenderSVG className="w-4" /> Created at: <span className="text-black">{listing.createdAt}</span>
                                </div>
                                <div className="text-xs font-medium text-black/50 font-lufga text-right">
                                    Requests: <span className="text-black">{listing.requests}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {listing.actions.map((action, index) => {
                                    const isPrimary = action === "publish" || "View Requests" || "View Old Requests";

                                    return (
                                        <Button
                                            key={index}
                                            className={`text-xs font-lufga font-medium rounded-full px-4 py-2.5 
                                              ${isPrimary
                                                    ? "text-black bg-[#C6FE1F] hover:bg-[#C6FE1F]"
                                                    : "text-white bg-black hover:bg-black"}`}
                                        >
                                            {action.label}
                                        </Button>
                                    )
                                })}
                            </div>


                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default UserListings