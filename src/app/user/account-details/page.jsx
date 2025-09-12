"use client"
import { EditSVG, MoneySVG, UserLocationSVG, UserPhoneSVG, UserEmailSVG } from "@/svg"
import { Button } from "@/components/ui/button"
import Image from "next/image"


const AccountDetail = () => {
    return (
        <div className="border border-black/10 bg-white px-4 py-8 rounded-4xl flex flex-col gap-4">
            <h1 className="font-lufga text-[32px] font-medium text-black">Your Account Details</h1>
            <div className="flex flex-col md:flex-row items-start gap-6 w-full ">
                <div className="max-w-[410px] w-full flex flex-col gap-4 bg-[#FAFAFA] p-4 rounded-[20px]">
                    <div className="relative w-full max-w-[362px] h-56 ">
                        <Image
                            src="/userimage.png"
                            alt="dd"
                            fill
                            sizes="100%"
                            className="object-cover object-[75%_50%] rounded-lg "
                        />
                    </div>
                    <span className="font-lufga text-[32px] font-medium text-black">Manuel Aigner</span>
                    <Button className={"bg-[#0F62FF] py-4 px-8 rounded-[80px] flex items-center gap-2 text-lg font-medium text-white font-lufga"}><MoneySVG />Balance: $5,000</Button>
                    <hr class="w-full h-px my-8 bg-gray-300 border-0"></hr>
                    <div className="flex flex-col items-center justify-between gap-2">
                        <span className="font-lufga text-xl font-medium text-black/50 flex items-center gap-2.5"><UserLocationSVG /> United States</span>
                        <span className="font-lufga text-xl font-medium text-black/50 flex items-center gap-2.5"><UserEmailSVG /> willie.jennings@example.com</span>
                        <span className="font-lufga text-xl font-medium text-black/50 flex items-center gap-2.5"><UserPhoneSVG /> (704) 555-0127</span>
                    </div>
                </div>
                <div className="flex flex-col max-w-[468px] items-start gap-8 w-full">
                    <div className="w-full flex flex-col gap-4 bg-[#FAFAFA] p-4 rounded-[20px]">
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
                    <div className="w-full flex flex-col gap-4 bg-[#FAFAFA] p-4 rounded-[20px]">
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
                </div>
                <div className="max-w-[468px] w-full flex flex-col gap-4 bg-[#FAFAFA] p-4 rounded-[20px]">
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
                </div>
            </div>
            <div className="flex flex-col items-start justify-center gap-5 p-4 rounded-[20px] bg-[#FAFAFA]">
                <h3 className="font-lufga text-[28px] font-medium text-black">Buying Profile & Alerts</h3>
                <p className="font-lufga text-xl font-normal text-black/50 ">EX will notify you when new listings match your criteria.</p>
                <Button className={"bg-[#C5FD1F] py-4 px-8 rounded-[80px] text-lg font-medium text-white font-lufga"}>Update Preferences</Button>
            </div>
        </div>
    )
}

export default AccountDetail 