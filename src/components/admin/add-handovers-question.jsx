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
import { BrandInfoSchema } from "@/lib/validation"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { UploadSVG } from "@/svg"
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"




const AddHandOverQuestion = () => {


    const form = useForm({
        resolver: zodResolver(BrandInfoSchema),
        defaultValues: {
            question: "",
            answertype: "",
        },
    })

    function handleSubmit(data) {
        console.log(data)
    }


    return (
        <Form className="flex flex-col justify-between" {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
                <div className="flex flex-col gap-6">
                    <FormField
                        name="question"
                        control={form.control}

                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-sm font-outfit font-normal">Question</FormLabel>
                                <FormControl>
                                    <Input type="text" placeholder="Write question" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" {...field} />
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
                                                <SelectItem value="Checkbox Group">Checkbox Group</SelectItem>
                                                <SelectItem value="Yes / No">Yes / No</SelectItem>
                                                <SelectItem value="Number">Number</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
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
                        Add Category
                    </Button>
                </div>
            </form>
        </Form>
    )
}

export default AddHandOverQuestion
