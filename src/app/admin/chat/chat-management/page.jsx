import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";


const ChatManagement = () => {
    return (
        <div className="flex flex-col items-start gap-8 w-full">
            <Link href={"/admin/team-members"} className="text-lg font-outfit font-medium text-black flex items-center gap-2 "><span className="bg-[#C6FE1F] p-1 rounded-sm size-8"><ArrowRightSVG /></span>View Chat</Link>

            <div className="flex flex-col items-start gap-8 w-full">
                <div className="flex  flex-col md:flex-row items-center justify-between w-full">
                    <div className="flex flex-row items-center gap-2">
                        <Avatar>
                            <AvatarImage src="/avatar1.png" alt="avatar" />
                        </Avatar>
                        <div className="flex flex-col items-start gap-2 w-full">
                            <h3 className="font-lufga font-medium text-2xl text-black">“How long is the warranty?”</h3>
                            <p className="font-abeezee font-normal text-base text-black/50">3 Members, 1 online</p>
                        </div>
                    </div>
                    <div className="flex flex-row gap-9 items-center">
                        <Button className="font-lufga text-base text-black font-medium border border-[#AEF31F] rounded-xl ">Assignd To Member</Button>
                        <Button className="font-lufga text-base text-black font-medium bg-[#E5C74D]/8 border border-[#FF0004] rounded-full ">In Progress</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChatManagement;
