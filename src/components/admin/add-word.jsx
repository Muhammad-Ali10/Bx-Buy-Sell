import React, { useEffect } from "react"
import { Form, FormControl, FormField, FormLabel, FormMessage, FormItem } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { WordDetectSchame } from "@/lib/validation"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { toast } from "sonner"
import { useAddWord,useUpdateWord } from "@/hooks/word"



const AddWords = ({ mode = "create", id, word }) => {
    const { mutate: addWord } = useAddWord()
    const { mutate: updateWord } = useUpdateWord()

    const form = useForm({
        resolver: zodResolver(WordDetectSchame),
        defaultValues: {
            word: word || "",
        },
    })

    useEffect(() => {
        if (mode === "edit") {
            form.reset({
                word: word || "",
            })
        }
    }, [mode, word, form])

    function handleSubmit(data) {
        const Words = {
            word: data.word,
        }

        if (mode === "create") {
            addWord(Words, {
                onSuccess: () => {
                    toast.success("Word Add successfully")
                    form.reset()
                },
                onError: (err) => {
                    toast.error(
                        `Creation failed: ${err.response?.data?.message || err.message}`
                    )
                },
            })
        } else if (mode === "edit" && id) {
            updateWord(
                { id, Words },
                {
                    onSuccess: () => {
                        toast.success("Word updat successfully")
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
                    name="word"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>question</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Write word" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" {...field} />
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

export default AddWords
