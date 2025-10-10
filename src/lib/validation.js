import { z } from "zod";

export const UserCredentialSchema = z.object({
    first_name: z.string().nonempty({ message: "First name is required" }).min(2, { message: "First name must be at least 2 characters" }),
    last_name: z.string().nonempty({ message: "Last name is required" }).min(2, { message: "Last name must be at least 2 characters" }),
    email: z.string().nonempty({ message: "Email is required" }).email({ message: "Invalid email address" }),
    password: z.string().nonempty({ message: "Password is required" }).min(8, { message: "Password must be at least 8 characters" }),
    confirm_password: z.string().nonempty({ message: "Confirm password is required" }).min(8, { message: "Confirm password must be at least 8 characters" }),

}).refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const MemberCredentialSchema = z.object({
    first_name: z.string().nonempty({ message: "First name is required" }).min(2, { message: "First Name must be at least 2 characters" }),
    last_name: z.string().nonempty({ message: "Last name is required" }).min(2, { message: "Last Name must be at least 2 characters" }),
    email: z.string().nonempty({ message: "Email is required" }).email({ message: "Invalid email address" }),
    password: z.string().nonempty({ message: "Password is required" }).min(8, { message: "Password must be at least 8 characters" }),
    confirm_password: z.string().nonempty({ message: "Confirm password is required" }).min(8, { message: "Confirm password must be at least 8 characters" }),
    active: z.boolean({ message: "Status is required" }),
    role: z.enum(["MONITER", "ADMIN", "USER"], { message: "Role is required" })
}).refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});


export const LoginSchema = z.object({
    email: z.string().nonempty({ message: "Email is required" }).email({ message: "Invalid email address" }),
    password: z.string().nonempty({ message: "Password is required" }).min(6, { message: "Password must be at least 8 characters" }),
})

export const OtpSendedSchema = z.object({
    email: z.string().nonempty({ message: "Email is required" }).email({ message: "Invalid email address" }),
})


const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];


export const CategorySchema = z.object({
    name: z.string().nonempty({ message: "Name is required" }),
    image: z
        .any()
        .refine((file) => file?.size <= MAX_FILE_SIZE, `Max image size is 5MB.`)
        .refine(
            (file) => ACCEPTED_IMAGE_TYPES.includes(file?.type),
            "Only .jpg, .jpeg, .png and .webp formats are supported."
        )
})

export const BrandInfoSchema = z.object({
    question: z.string().nonempty({ message: "Question is required" }),
    answer_type: z.string().nonempty({ message: "Answer type is required" })
})

export const StatisticQuestionSchema = z.object({
    question: z.string().nonempty({ message: "Question is required" }),
    // hinttext: z.string().nonempty({ message: "Question is required" }),
    answertype: z.string().nonempty({ message: "Answer type is required" })
})

// export const WordDetectSchame = z.object({
//     word: z.string().nonempty({ message: "Word is required" }),
// })

export const PlanSchema = z.object({
    name: z.string().nonempty({ message: "Title is required" }),
    description: z.string().nonempty({ message: "Description is required" }),
    price: z.string().nonempty({ message: "Price is required" }),
    benefits: z.string().nonempty({ message: "Benefits is required" })
})

export const AdminProfileSchema = z.object({

    first_name: z.string().nonempty({ message: "First name is required" }).min(2, { message: "First name must be at least 2 characters" }),
    last_name: z.string().nonempty({ message: "Last name is required" }).min(2, { message: "Last name must be at least 2 characters" }),
    email: z.string().nonempty({ message: "Email is required" }).email({ message: "Invalid email address" }),
    role: z.enum(["moderator", "admin", "user"], { message: "Role is required" })

})