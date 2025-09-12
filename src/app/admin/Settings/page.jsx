"use client"
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Image from "next/image";
import { EditSVG } from "@/svg";
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AdminProfileSchema  } from "@/lib/validation"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select"


const Settings = () => {

    const form = useForm({
        resolver: zodResolver(AdminProfileSchema),
        defaultValues: {
            first_name: "",
            last_name: "",
            email: "",
            role: "",
        },
    })

    function handleSubmit(data) {
        console.log(data)
    }



    return (
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 h-full">
            <div className="flex flex-col items-center justify-center bg-white border border-black/10 max-w-[301px] w-full h-full py-8 rounded-2xl">
                <div className="relative">
                    <Image src={"/Alexander.png"} width={158} height={158} alt={"Alexander"} className="size-40 object-cover rounded-full border-2 border-[#C6FE1F]" />
                    <span className="bg-[#C6FE1F] size-11 absolute rounded-full flex items-center justify-center top-30 left-24"><EditSVG /></span>
                </div>
                <h3 className="font-lufga font-medium text-2xl text-black mt-4">Alexander</h3>
                <span className="font-lufga text-xl font-medium text-[#6C6C6C] mt-2">Admin</span>
                <Button className="bg-[#C6FE1F] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">My Profile</Button>
                <Button className="bg-[#FBFBFB] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">My Profile</Button>
                <Button className="bg-[#FBFBFB] font-lufga font-medium text-xl text-black mt-4 px-[35px] py-2.5 rounded-full hover:bg-[C6FE1F]">My Profile</Button>
            </div>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col justify-between h-full w-full bg-white border border-black/10 p-8 rounded-2xl">
                    {/* Username & Email */}
                    <div className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="first_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>First Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Alexander" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="last_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Last Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Johan" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>


                        {/* Status & Role */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Example@gmail.com" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Roles:</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="w-full h-14 bg-[#F4F4F4]">
                                                    <SelectValue placeholder="Admin" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Role</SelectLabel>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    {/* Buttons */}
                    <div className="flex flex-row gap-3 w-full">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full py-5 border border-black text-black text-base font-medium font-lufga rounded-full shrink"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="w-full py-5 bg-[#C5FD1F] text-black text-base font-medium font-lufga rounded-full shrink"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}

export default Settings;