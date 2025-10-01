import { Form, FormControl, FormField, FormLabel, FormMessage, FormItem } from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { CategorySchema } from "@/lib/validation"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { UploadSVG } from "@/svg"
import { Button } from "@/components/ui/button"
import { DialogClose } from "@/components/ui/dialog"
import { toast } from "sonner"
import { useUploadTools } from "@/hooks/tools"
import { uploadToCloudinary } from "@/utils/cloudinary"


const AddTools = () => {

    const { mutate: uploadTools, isPending: uploadToolsPending, isSuccess: uploadToolsSuccess, isError: uploadToolsError, error: uploadToolsErrorObj } = useUploadTools();


    const form = useForm({
        resolver: zodResolver(CategorySchema),
        defaultValues: {
            name: "",
            image: "",
        },
    })

  async function handleSubmit(data) {
        console.log("Form Data:", data);

        try {

            const imageUrl = await uploadToCloudinary(data.image);

            const toolData = {
                name: data.name,
                image_path: imageUrl,
            }
            uploadTools(toolData, {
                onSuccess: () => {
                    toast.success("Tool created successfully");
                    form.reset();
                },
                onError: (err) => {
                    toast.error(
                        `Tool creation failed: ${err.response?.data?.message || err.message}`
                    );
                }
            })

        } catch (error) {
            console.error("Cloudinary upload error:", err);
            toast.error("Image upload failed");
        }
    }


    return (
        <Form className="flex flex-col justify-between h-full" {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-6">
                <FormField
                    name="name"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input type="text" placeholder="Hero section title" {...field} className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    name="image"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Image</FormLabel>
                            <FormControl>
                                <div className="flex flex-col items-center justify-center gap-2 relative bg-[#F4F4F4] h-44 border border-[#EBF0ED] rounded-2xl">
                                    <div className="flex flex-col items-center">
                                        <UploadSVG />
                                    </div>

                                    <h4 className="text-sm font-abeezee font-normal text-black/70">
                                        Drag and drop Or{" "}
                                        <label
                                            htmlFor="file-upload"
                                            className="text-[#C6FE1F] font-bold underline cursor-pointer font-lufga"
                                        >
                                            Upload File
                                        </label>
                                    </h4>
                                    <Input
                                        id="file-upload"
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => field.onChange(e.target.files?.[0])}
                                        
                                    />
                                </div>
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

export default AddTools
