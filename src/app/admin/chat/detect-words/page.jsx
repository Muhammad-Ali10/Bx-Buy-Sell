import { Input } from "@/components/ui/input"
import { Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Edit1SVG, CountSVG, DeleteSVG } from "@/svg"

const DetectWord = () => {
    return (
        <div className="w-full flex flex-col gap-10 relative">
            {/* Search Box */}
            <div className="flex gap-2 items-center justify-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
                <Search className="text-gray-500" />
                <Input
                    type="text"
                    placeholder="Search by name, phone, username or email ..."
                    className="w-full bg-transparent border-0 shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-black"
                />
            </div>
            <div className="flex flex-row items-center justify-between w-full max-w-[1095px]">
                <Input
                    type="text"
                    placeholder="Type a word here"
                    className="w-full max-w-[765px] bg-[#F8FAFC] rounded-lg py-5 px-14 border border-[#C6FE1F] shadow-none focus:ring-0 font-merriweather-sans text-black text-xs placeholder:!text-xs placeholder:font-merriweather-sans placeholder:text-[#6C6C6C] h-full"
                />
                <Button className="bg-[#C6FE1F] py-4 px-[26px] w-full max-w-[201px] h-14 rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60 transition-all duration-300 ease-in-out">
                    <Plus /> Add New Word
                </Button>
            </div>
            <div className="flex flex-row flex-wrap">
                <div className="flex flex-row items-center justify-center gap-2.5 bg-[#F8FAFC] p-4 rounded-[69px]">
                    <h3 className="font-lufga font-medium text-base text-black">WhatsApp</h3>
                    <Button className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 rounded-md hover:bg-[#F4F4F4]">
                        <Edit1SVG />
                    </Button>
                    <Button className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 rounded-md hover:bg-[#F4F4F4]">
                        <CountSVG />
                    </Button>
                    <Button className="bg-[#F4F4F4] border border-[#EBF0ED] size-8 rounded-md hover:bg-[#F4F4F4]">
                        <DeleteSVG />
                    </Button>


                </div>
            </div>
        </div>
    )
}

export default DetectWord