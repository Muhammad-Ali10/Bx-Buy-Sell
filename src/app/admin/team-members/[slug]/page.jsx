"use client"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card"
import { VerifiedSVG, StarSVG, Chat1SVG, DeleteSVG, BlockSVG, EditSVG, ArrowRightSVG } from "@/svg"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { dummyTeamMembers } from "@/lib/dummy-data"
import Stats from "@/components/admin/stats"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useGetUser } from "@/hooks/user"
import { useParams } from "next/navigation"


const MemberDetail = () => {

    const {slug} = useParams()
   

    const { data, isLoading, error} = useGetUser(slug)

    console.log(data)


    return (
        <div className="flex flex-col items-start gap-8 w-full">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>Team Members</Link>
            <Card className="w-full border-0">
                <CardHeader className="text-black flex justify-between items-center w-full">
                    <div className="flex items-center gap-4">
                        <Avatar>
                            <AvatarImage src={data?.profile_pic ? data?.profile_pic : "/avatar1.png"} alt="Avatar" />
                        </Avatar>
                        <div className="flex flex-col gap-2">
                            <h3 className="flex items-center gap-1 font-lufga text-2xl font-bold">{data?.first_name + " " + data?.last_name} {data?.verified && <VerifiedSVG />}</h3>
                            <div className="flex items-center gap-1">
                                {Array(5).fill().map((_, index) => (
                                    <StarSVG key={index} />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DropdownMenu >
                        <DropdownMenuTrigger className="font-lufga font-medium text-lg text-black bg-[#C6FE1F] hover:bg-lime-500 rounded-[65px] p-2.5 ">Settings</DropdownMenuTrigger>
                        <DropdownMenuContent className="border border-[#C6FE1F] rounded-lg min-w-14 items-center gap-2 flex flex-col">
                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><Chat1SVG /></DropdownMenuItem>
                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><BlockSVG /></DropdownMenuItem>
                            <DropdownMenuItem className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 "><DeleteSVG /></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardHeader>
                <Separator />
                <CardContent className="max-w-[500px] w-full flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-lufga text-xl font-medium text-black">Personal Information</span>
                            <EditSVG />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Username</span>
                            <span className="font-lufga text-lg font-medium text-black">{data?.business_name}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Email</span>
                            <span className="font-lufga text-lg font-medium text-black">{data?.email}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Password</span>
                            <span className="font-lufga text-lg font-medium text-black">**********</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">User ID</span>
                            <span className="font-lufga text-lg font-medium text-black">{data?.id}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-abeezee text-lg font-normal text-black/50">Role</span>
                            <span className="font-lufga text-lg font-medium text-black">{data?.role}</span>
                        </div>
      
                </CardContent>
            </Card>

            <div className="flex flex-col justify-items-start w-full">
                <h2 className="text-lg font-lufga font-bold text-black mb-8">Statistics</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Actually managed Listings */}
                    {dummyTeamMembers.map((member, index) => (
                        <Stats
                            title={member.title}
                            number={member.number}
                            url={member.url}
                            key={index} />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default MemberDetail