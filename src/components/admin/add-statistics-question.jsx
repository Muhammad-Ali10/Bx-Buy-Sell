"use client"

import { Form, FormControl, FormField, FormLabel, FormMessage, FormItem } from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { zodResolver } from "@hookform/resolvers/zod"
import { StatisticQuestionSchema } from "@/lib/validation"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { toast } from "sonner"
import { useUploadAdminQuestion } from "@/hooks/adminQuestions"

const AddStatisticQuestion = (mode, question, id) => {
    const {
        mutate: uploadStatisticQuestion,
        isPending: uploadStatisticQuestionPending,
    } = useUploadAdminQuestion()

    const form = useForm({
        resolver: zodResolver(StatisticQuestionSchema),
        defaultValues: {
            question: "",
            answertype: "",
        },
    })

    function handleSubmit(data) {
        const statisticData = {
            question: data.question,
            answer_type: data.answertype,
            answer_for: "STATISTIC",
        }

    

        uploadStatisticQuestion(statisticData, {
            onSuccess: () => {
                toast.success("Statistic Question created successfully")
                form.reset()
            },
            onError: (err) => {
                toast.error(
                    `Statistic Question creation failed: ${err.response?.data?.message || err.message}`
                )
            },
        })
    }

    return (
        <Form className="flex flex-col justify-between h-full" {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
                {/* Question Input */}
                <FormField
                    name="question"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Question</FormLabel>
                            <FormControl>
                                <Input
                                    type="text"
                                    placeholder="Write question"
                                    {...field}
                                    className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal"
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Answer Type Select */}
                <FormField
                    name="answertype"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Options</FormLabel>
                            <FormControl>
                                <Select
                                    className="w-full"
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Answer Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectItem value="TEXT">Text</SelectItem>
                                            <SelectItem value="LINK">Link</SelectItem>
                                            <SelectItem value="DATE">Date</SelectItem>
                                            <SelectItem value="NUMBER">Number</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Buttons */}
                <div className="flex flex-row gap-3 w-full">
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full py-5 border border-black text-black text-base font-medium font-lufga rounded-full shrink"
                            disabled={uploadStatisticQuestionPending}
                        >
                            Cancel
                        </Button>
                    </DialogClose>

                    <Button
                        type="submit"
                        className="w-full py-5 bg-[#C5FD1F] text-black text-base font-medium font-lufga rounded-full shrink"
                        disabled={uploadStatisticQuestionPending}
                    >
                        {uploadStatisticQuestionPending ? "Saving..." : "Save"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}

export default AddStatisticQuestion
