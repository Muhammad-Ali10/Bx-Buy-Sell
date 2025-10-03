import React, { useEffect } from "react"
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
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { useUploadAdminQuestion, useUpdateAdminQuestion } from "@/hooks/adminQuestions"
import { toast } from "sonner"




const AdsQuestion = ({ mode = "create", id, question, answer_type }) => {
    const { mutate: uploadAdsQuestion } = useUploadAdminQuestion()
    const { mutate: updateAdsQuestion } = useUpdateAdminQuestion()

    const form = useForm({
        resolver: zodResolver(BrandInfoSchema),
        defaultValues: {
            question: question || "",
            answer_type: answer_type || "",
        },
    })

    useEffect(() => {
        if (mode === "edit") {
            form.reset({
                question: question || "",
                answer_type: answer_type || "",
            })
        }
    }, [mode, question, answer_type, form])

    function handleSubmit(data) {
        const adsData = {
            question: data.question,
            answer_type: data.answer_type,
            answer_for: "ADVERTISMENT",
        }

        if (mode === "create") {
            uploadAdsQuestion(adsData, {
                onSuccess: () => {
                    toast.success("Adds Qusetion created successfully")
                    form.reset()
                },
                onError: (err) => {
                    toast.error(
                        `Creation failed: ${err.response?.data?.message || err.message}`
                    )
                },
            })
        } else if (mode === "edit" && id) {
            updateAdsQuestion(
                { id, adsData },
                {
                    onSuccess: () => {
                        toast.success("Ads Qusetion updated successfully")
                    },
                    onError: (err) => {
                        toast.error(
                            `Update failed: ${err.response?.data?.message || err.message}`
                        )
                    },
                }
            )
        }
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
                                <Input type="text" placeholder="Write question" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="answer_type"
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
                                            <SelectItem value="TEXT">Text</SelectItem>
                                            <SelectItem value="DATE">Date</SelectItem>
                                            <SelectItem value="NUMBER">Number</SelectItem>
                                            <SelectItem value="BOOLEAN">Boolean</SelectItem>
                                            <SelectItem value="SELECT">Dropdown</SelectItem>
                                            <SelectItem value="FILE">File</SelectItem>
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
                        {mode === "create" ? "Save" : "Update"}

                    </Button>
                </div>
            </form>
        </Form>
    )
}

export default AdsQuestion
