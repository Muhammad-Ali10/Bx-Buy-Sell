import { Button } from "@/components/ui/button";
import { EditSVG } from "@/svg";

const ActivityLogs = () => {
    return (
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 h-full border border-black/10 rounded-2xl p-6 bg-white">
            <div className="flex flex-col items-center justify-normal bg-white border border-black/10 max-w-[301px] w-full h-full py-8 rounded-2xl">
                <Button className="bg-[#FBFBFB] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">My Profile</Button>
                <Button className="bg-[#FBFBFB] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">Account Security</Button>
                <Button className="bg-[#C6FE1F] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">Activity Logs</Button>
            </div>
            <div className="flex flex-col items-center justify-between w-full gap-6">
                <div className="flex flex-row justify-between items-center w-full border border-black/10 p-8 h-[122px] rounded-2xl">
                    <h3 className="font-lufga font-medium text-2xl text-[#6C6C6C]">Account Security</h3>
                    <Button className="bg-black/3 font-lufga font-medium text-xl text-black px-6 py-3.5 rounded-full hover:bg-black/3 flex items-center gap-2.5"><EditSVG /> Edit</Button>
                </div>
                <div className="flex flex-col justify-between items-start gap-4 w-full border border-black/10 p-8 rounded-2xl">
                    <h3 className="font-lufga font-medium text-2xl text-[#6C6C6C]">Log: 1</h3>
                    <div className="flex flex-col items-start justify-between w-full rounded-2xl bg-[#FBFBFB] p-6">
                        <div className="flex flex-col justify-between items-start gap-6">
                            <h3 className="font-lufga font-medium text-base text-[#6C6C6C]">🕓 Date & Time: July 21, 2025 – 10:45 AM</h3>
                            <p className="font-lufga font-medium text-base text-[#6C6C6C] flex items-center gap-2.5">Admin User: <span className="text-black">Alexander </span> </p>
                            <p className="font-lufga font-medium text-base text-[#6C6C6C] flex items-center gap-2.5">⚙️ Action:<span className="text-black">Updated Product Information</span> </p>
                            <div className="flex flex-col md:flex-row items-start gap-20 w-full">
                                <div className="flex flex-col justify-between items-start gap-2.5">
                                    <h3 className="font-lufga font-medium text-base text-[#6C6C6C]">Detail:</h3>
                                    <ul className="font-lufga font-medium text-xs text-[#6C6C6C]">
                                        <li>Product ID: #10234</li>
                                        <li>Changed Price from $39.99 to $34.99</li>
                                        <li>Stock updated: 55 → 40</li>
                                    </ul>
                                </div>
                                <div className="flex flex-col justify-between items-start gap-2.5">
                                    <h3 className="font-lufga font-medium text-base text-[#6C6C6C]">IP Address:</h3>
                                    <span className="font-lufga font-medium text-base text-black">192.168.0.45</span>
                                </div>
                            </div>
                              <p className="font-lufga font-medium text-base text-[#6C6C6C] flex items-center gap-2.5"> Status: <span className="text-black">Success</span> </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ActivityLogs;