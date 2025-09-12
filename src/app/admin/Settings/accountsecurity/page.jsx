import { Button } from "@/components/ui/button";
import { EditSVG } from "@/svg";

const AccountSecurity = () => {
    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 h-full border border-black/10 rounded-2xl p-6 bg-white">
            <div className="flex flex-col items-center justify-center bg-white border border-black/10 max-w-[301px] w-full h-full py-8 rounded-2xl">
                <h3 className="font-lufga font-medium text-2xl text-black mt-4">Alexander</h3>
                <span className="font-lufga text-xl font-medium text-[#6C6C6C] mt-2">Admin</span>
                <Button className="bg-[#FBFBFB] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">My Profile</Button>
                <Button className="bg-[#C6FE1F] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">Account Security</Button>
                <Button className="bg-[#FBFBFB] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">Activity Logs</Button>
            </div>
            <div className="flex flex-col items-center justify-between w-full gap-6">
                <div className="flex flex-row justify-between items-center w-full border border-black/10 p-8 h-[122px] rounded-2xl">
                    <h3 className="font-lufga font-medium text-2xl text-[#6C6C6C]">Account Security</h3>
                    <Button className="bg-black/3 font-lufga font-medium text-xl text-black px-6 py-3.5 rounded-full hover:bg-black/3 flex items-center gap-2.5"><EditSVG /> Edit</Button>
                </div>
                <div className="flex flex-col justify-between items-start gap-4 w-full border border-black/10 p-8 rounded-2xl">
                    <h3 className="font-lufga font-medium text-2xl text-[#6C6C6C]">Security</h3>
                    <div className="flex flex-col md:flex-row items-center justify-between w-full rounded-2xl bg-[#F7F7F7] p-4">
                        <div className="flex flex-col justify-between items-start gap-2.5">
                            <h3 className="font-lufga font-medium text-base text-[#6C6C6C]">Email address</h3>
                            <p className="font-lufga font-normal text-xs text-[#6C6C6C]">The Email Address Ossociated Your Account</p>
                        </div>

                        <div className="flex flex-row justify-center items-start gap-10">
                            <div className="flex flex-col justify-between items-start gap-2.5">
                                <h3 className="font-lufga font-medium text-xs text-[#6C6C6C]">exmaple@gmail.com</h3>
                                <p className="font-lufga font-normal text-xs text-[#FF0000]">Unverified</p>
                            </div>
                            <Button className="bg-black/3 font-lufga font-medium text-xs text-black px-6 py-3.5 rounded-full hover:bg-black/3 flex items-center gap-2.5"><EditSVG /> Edit</Button>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between w-full rounded-2xl bg-[#F7F7F7] p-4">
                        <div className="flex flex-col justify-between items-start gap-2.5">
                            <h3 className="font-lufga font-medium text-base text-[#6C6C6C]">Password</h3>
                            <p className="font-lufga font-normal text-xs text-[#6C6C6C]">Set a Unique Password to protect your account</p>
                        </div>
                        <Button className="bg-black/3 font-lufga font-medium text-xs text-black px-6 py-3.5 rounded-full hover:bg-black/3 flex items-center gap-2.5 border border-[#C6FE1F]">Change Password</Button>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between w-full rounded-2xl bg-[#F7F7F7] p-4">
                        <div className="flex flex-col justify-between items-start gap-2.5">
                            <h3 className="font-lufga font-medium text-base text-[#6C6C6C]">Delete Account</h3>
                            <p className="font-lufga font-normal text-xs text-[#6C6C6C]">This will delete your account. your account will be permanently Deleted from prodeel.</p>
                        </div>
                        <Button className="bg-black/3 font-lufga font-medium text-xs text-black px-6 py-3.5 rounded-full hover:bg-black/3 flex items-center gap-2.5 border border-[#F30004]">Delete</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AccountSecurity;