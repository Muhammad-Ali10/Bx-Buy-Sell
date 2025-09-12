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
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { PlanSchema } from "@/lib/validation"
import { zodResolver } from "@hookform/resolvers/zod"
import {Button } from "@/components/ui/button"
import {DialogClose} from "@/components/ui/dialog"


const AddPackages = () => {

    const form = useForm({
        resolver: zodResolver(PlanSchema),
        defaultValues: {
            name: "",
            description: "",
            price: "",
            benefits: ""
        }
    })

    function handleSubmit(data)
    {
        console.log(data)
    }


    return (
        <Form {...form} className="flex flex-col justify-between gap-10 h-full">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col justify-between gap-6">
                <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name of Plan</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Write Name" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                <FormField
                    name="description"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Short description</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Text Here" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal"{...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                <FormField
                    name="price"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Price</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="45$" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                <FormField
                    name="Benefits"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Benefits</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Answers ..." className="bg-[#F4F4F4] border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                            </FormControl>
                        </FormItem>
                    )} />
            </form>
            <div className="flex flex-row gap-3 w-full mt-10">
                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full py-5 border border-black text-black text-base font-medium font-lufga rounded-full shrink"
                    >
                        Cancel
                    </Button>
                </DialogClose>

                <Button
                    type="submit"
                    className="w-full py-5 bg-[#C5FD1F] text-black text-base font-medium font-lufga rounded-full shrink"
                >
                    Save
                </Button>
            </div>
        </Form>
    )
}


export default AddPackages