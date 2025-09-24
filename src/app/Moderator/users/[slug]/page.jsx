"use client"
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card"
import { VerifiedSVG, StarSVG, Chat1SVG, DeleteSVG, BlockSVG, EditSVG, ArrowRightSVG, ProSVG } from "@/svg"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { dummyUserDetail, businessData } from "@/lib/dummy-data"
import Stats from "@/components/admin/stats"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"


const UserDetail = () => {
    return (
        <div className="flex flex-col items-start gap-8 w-full">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>Team Members</Link>
            <Card className="w-full border-0">
                <CardHeader className="text-black flex justify-between items-start w-full">
                    <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                            <img src="/avatar1.png" className="size-[72px] rounded-[80px] object-cover" alt="user" />
                            <Badge className="text-[9px] font-lufga text-black bg-[#C6FE1F] -mt-2 flex items-center p-0 gap-1 w-10 h-3.5"><ProSVG className="size-2.5 mt-1" /> <span>Pro</span></Badge>
                        </div>
                        <div className="flex flex-col items-start gap-2 mt-2">
                            <h3 className="flex items-center gap-1 font-lufga text-2xl font-bold">John Doe <VerifiedSVG /></h3>
                            <div className="flex items-center gap-1">
                                {Array(5).fill().map((_, index) => (
                                    <StarSVG key={index} />
                                ))}
                            </div>
                            <Button className="bg-[#15CA32]/8 border border-[#15CA32] rounded-[80px] px-5 py-2.5 font-outfit font-bold text-[10px] text-[#15CA32] hover:bg-transparent">Online</Button>
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
                </CardHeader>
                <Separator />
                <CardContent className="flex items-center justify-between w-full flex-wrap">
                    <div className="max-w-[468px] w-full flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-lufga text-xl font-medium text-black">Personal Information</span>
                            <EditSVG />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Username</span>
                            <span className="font-lufga text-lg font-medium text-black">Johnny</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Email</span>
                            <span className="font-lufga text-lg font-medium text-black">JennyWilson62@gmail.com</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Password</span>
                            <span className="font-lufga text-lg font-medium text-black">**********</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">User ID</span>
                            <span className="font-lufga text-lg font-medium text-black">343fdft5</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Role</span>
                            <span className="font-lufga text-lg font-medium text-black">Chat Agent</span>
                        </div>
                    </div>
                    <div className="max-w-[468px] w-full flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-lufga text-xl font-medium text-black">Address Information</span>
                            <EditSVG />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Address</span>
                            <span className="font-lufga text-lg font-medium text-black">898 Brooklyn Simmons</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">City</span>
                            <span className="font-lufga text-lg font-medium text-black">Boston</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Country</span>
                            <span className="font-lufga text-lg font-medium text-black">United States</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">State</span>
                            <span className="font-lufga text-lg font-medium text-black">Massachusetts</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Zip Code</span>
                            <span className="font-lufga text-lg font-medium text-black">02110</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="w-full border-0">
                <CardContent className="flex items-center justify-between w-full flex-wrap">
                    <div className="max-w-[468px] w-full flex flex-col gap-4">
                        <span className="font-lufga text-xl font-medium text-black">Payment Information</span>
                        <div className="relative w-full aspect-[16/9]">
                            <Image
                                src="/card.png"
                                alt="dd"
                                fill
                                sizes="100%"
                                className="object-cover rounded-lg"
                            />
                        </div>

                    </div>
                    <div className="max-w-[468px] w-full flex flex-col gap-8">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Card Type</span>
                            <span className="font-lufga text-lg font-medium text-black">Visa</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Card Holder</span>
                            <span className="font-lufga text-lg font-medium text-black">Jenny Wilson</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Expire</span>
                            <span className="font-lufga text-lg font-medium text-black">08/2026</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Card Number</span>
                            <span className="font-lufga text-lg font-medium text-black">**** **** **** 8174</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col justify-items-start w-full">
                <h2 className="text-lg font-lufga font-bold text-black mb-8">Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Actually managed Listings */}
                    {dummyUserDetail.map((member, index) => (
                        <Stats
                            title={member.title}
                            number={member.number}
                            url={member.url}
                            key={index} />
                    ))}
                </div>
            </div>

            <div className="w-full flex flex-col rounded-2xl border shadow p-8 gap-4 bg-white">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-lufga text-xl font-medium text-black">Buying Profiles & Alerts of this User</span>
                    <EditSVG />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {businessData.map((section, idx) => (
                        <div key={idx} className="flex flex-col items-start justify-between">
                            {section.title && (
                                <h3 className="font-lufga text-[15px] font-medium text-black">
                                    {section.title}
                                </h3>
                            )}
                            {section.fields.map((field, i) => (
                                <div>
                                    <div key={i} className="flex flex-col gap-3">
                                    <span className="font-lufga text-sm font-medium text-black">
                                        {field.label}
                                    </span>
                                    <span className="font-abeezee text-sm  font-normal text-black">
                                        {field.value || "—"}
                                    </span>
                                </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default UserDetail