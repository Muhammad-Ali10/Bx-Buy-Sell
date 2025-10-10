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
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { MemberCredentialSchema } from "@/lib/validation"
import { useCreateUser } from "@/hooks/user"
import { toast } from "sonner"

const AddMembers = () => {

    const { mutate: createUser, isLoading: createUserLoading, isSuccess: createUserSuccess, isError: createUserError, error: createUserErrorObj } = useCreateUser();


    const form = useForm({
        resolver: zodResolver(MemberCredentialSchema),
        defaultValues: {
            first_name: "",
            last_name: "",
            email: "",
            password: "",
            confirm_password: "",
            active: false,
            role: "",
        },
    })

    function handleSubmit(data) {
        console.log(data)
        createUser(data, {
            onSuccess: () => {
                toast.success("User created successfully");
                form.reset();
            },
            onError: (err) => {
                toast.error(
                    `User creation failed: ${err.response?.data?.message || err.message}`
                );
                console.log("Error creating user:", err);
            }
        })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col justify-between h-full">
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
                                        <Input placeholder="Enter First Name" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
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
                                        <Input placeholder="Enter Last Name" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                    </div>

                    {/* Passwords */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter Email" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="Enter Password" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
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
                            name="confirm_password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="Confirm Password" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="active"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(val === "true")}
                                        value={String(field.value)} defaultValue={field.value} className="h-14 w-full">
                                        <FormControl>
                                            <SelectTrigger className="w-full !h-14 bg-[#F4F4F4]">
                                                <SelectValue placeholder="Select User Status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Status</SelectLabel>
                                                <SelectItem value="true">Active</SelectItem>
                                                <SelectItem value="false">Inactive</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-full !h-14 bg-[#F4F4F4]">
                                                <SelectValue placeholder="Select User Role" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Role</SelectLabel>
                                                <SelectItem value="ADMIN">Admin</SelectItem>
                                                <SelectItem value="USER">User</SelectItem>
                                                <SelectItem value="MONITER">Moderator</SelectItem>
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
    )
}

export default AddMembers
