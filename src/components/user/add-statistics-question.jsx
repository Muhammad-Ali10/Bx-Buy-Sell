

import { Form, FormControl, FormField, FormLabel, FormMessage, FormItem } from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { StatisticQuestionSchema } from "@/lib/validation"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { UploadSVG } from "@/svg"
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"




const AddStatisticQuestion= () => {


    const form = useForm({
        resolver: zodResolver(StatisticQuestionSchema),
        defaultValues: {
            question: "",
            hinttext: "",
            answertype: "",
        },
    })

    function handleSubmit(data) {
        console.log(data)
    }


    return (
        <Form className="flex flex-col justify-between h-full" {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
                <FormField
                    name="question"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>question</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Write question" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal"/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="hinttext"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Hint Text Field</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Enter the percentage of visitors who make a purchase out of the total number of visitors." {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal"/>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="answertype"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Opitions</FormLabel>
                            <FormControl>
                                <Select className="w-full" onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Answer Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="text">Text</SelectItem>
                                            <SelectItem value="link">Link</SelectItem>
                                            <SelectItem value="date">Date</SelectItem>
                                            <SelectItem value="text">Text</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex flex-row gap-3 w-full">
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
            </form>
        </Form>
    )
}

export default AddStatisticQuestion
