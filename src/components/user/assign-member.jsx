import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"


const AssignMember = () => {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row items-center justify-between w-full mb-6">
                <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                    <Search className="text-gray-500" />
                    <Input
                        type="text"
                        placeholder="Search by name, phone, username or email ..."
                        className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                    />
                </div>
                <Button className="bg-[#C6FE1F] py-4 px-[26px] w-full max-w-[150px] h-14 rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                    Assign
                </Button>
            </div>



            <div className=" w-full">
                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-1 border-[#AEF31F] rounded-xl text-xs font-normal text-black font-abeezee shadow-md opacity-70">
                    <div className="col-span-1">S no</div>
                    <div className="col-span-4">Profile</div>
                    <div className="col-span-3 text-center">Email</div>
                    <div className="col-span-3">Manage List</div>
                    <div className="col-span-1"></div>
                </div>
            </div>
            {
                Array(5).fill(0).map((_, index) => (
                    <div className="w-full mt-3">
                        <div className="grid grid-cols-12 gap-4 px-6 py-1 border-0 rounded-xl bg-white items-center shadow-sm  text-sm font-normal font-outfit text-black">
                            <div className="col-span-1 ">1</div>
                            <div className="col-span-4 flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src="/bot.png" alt="Bot Avatar" />
                                </Avatar>
                                <span>James Carter</span>
                            </div>
                            <div className="col-span-3 ">Example@gmail,com</div>
                            <div className="col-span-3 flex items-center justify-between">
                                <span >03 Assign</span>
                            </div>
                            <div className="col-span-1 flex items-center justify-between">
                                <Checkbox />
                            </div>
                        </div>
                    </div>
                ))
            }

        </div >
    )
}
export default AssignMember