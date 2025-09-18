"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import {
    AmazonSVG,
    ShopifySVG,
    WooCommerceSVG,
    EbaySVG,
    EtsySVG,
    Big_EcommerceSVG,
    MagentoSVG,
    PrestaShopSVG,
} from "@/svg"
import {
    ShoppingBag,
    Code,
    Handshake,
    Grid3X3,
} from "lucide-react"

const categories = [
    {
        id: "ecommerce",
        title: "E-Commerce",
        icon: ShoppingBag,
        bgColor: "bg-blue-100",
        iconColor: "text-blue-600",
    },
    {
        id: "software",
        title: "Software",
        icon: Code,
        bgColor: "bg-green-100",
        iconColor: "text-green-600",
    },
    {
        id: "service",
        title: "Service Business",
        icon: Handshake,
        bgColor: "bg-orange-100",
        iconColor: "text-orange-600",
    },
    {
        id: "other",
        title: "Other",
        icon: Grid3X3,
        bgColor: "bg-purple-100",
        iconColor: "text-purple-600",
    },
]


const Tools = [
    {
        id: "amazon-seller-central",
        title: "Amazon Seller Central",
        icon: <AmazonSVG />,
    },
    {
        id: "shopify",
        title: "Shopify",
        icon: <ShopifySVG />,
    },
    {
        id: "woocommerce",
        title: "WooCommerce",
        icon: <WooCommerceSVG />,
    },
    {
        id: "ebay",
        title: "Ebay ",
        icon: <EbaySVG />,
    },
    {
        id: "etsy",
        title: "Etsy",
        icon: <EtsySVG />,
    },
    {
        id: "bigcommerce",
        title: "BigCommerce",
        icon: <Big_EcommerceSVG />,
    },
    {
        id: "magento",
        title: "Magento",
        icon: <MagentoSVG />,
    },
    {
        id: "prestashop",
        title: "PrestaShop",
        icon: <PrestaShopSVG />,
    },
]

const steps = [
    { id: "category", title: "Category" },
    { id: "brand_information", title: "Brand Information" },
    { id: "tools", title: "Tools you use" },
    { id: "financials", title: "Financials" },
    { id: "statistics", title: "Statistics" },
    { id: "products", title: "Products" },
    { id: "management", title: "Management" },
    { id: "accounts", title: "Accounts" },
    { id: "ad_informations", title: "Ad Informations" },
    { id: "handover", title: "Handover" },
    { id: "packages", title: "Packages" },
]

const Addlisting = () => {
    const [currentStep, setCurrentStep] = useState(0)
    const [selectedCategory, setSelectedCategory] = useState("")
    const [selectedTools, setSelectedTools] = useState([])

    const { register, handleSubmit, setValue } = useForm()

    const onSubmit = (data) => {
        console.log("Form data:", data)

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            console.log("✅ All steps completed", data)
        }
    }

    const handleCategorySelect = (categoryId) => {
        setSelectedCategory(categoryId)
        setValue("category", categoryId) // set RHF value
    }
    const handleToolSelect = (toolId) => {
        let updatedTools = [...selectedTools]
        if (updatedTools.includes(toolId)) {
            updatedTools = updatedTools.filter((id) => id !== toolId)
        } else {
            updatedTools.push(toolId)
        }
        setSelectedTools(updatedTools)
        setValue("tools", updatedTools)
    }


    const stepId = steps[currentStep].id

    return (
        <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
            <form onSubmit={handleSubmit(onSubmit)}>
                {/* Step 1: Category */}
                {stepId === "category" && (
                    <div className="max-w-7xl">
                        <h1 className="text-[32px] font-lufga font-medium text-black mb-8">
                            Added Tools
                        </h1>
                        <div className="flex flex-row flex-wrap gap-6">
                            {categories.map((category) => {
                                const Icon = category.icon
                                const isSelected = selectedCategory === category.id
                                return (
                                    <Card
                                        key={category.id}
                                        className={`p-6 cursor-pointer transition-all hover:shadow-lg border-2 w-full max-w-[240px] h-[150px] bg-[#FAFAFA]
                                        ${isSelected ? "border-lime-400" : "border-[#FAFAFA]"}`}
                                        onClick={() => handleCategorySelect(category.id)}
                                    >
                                        <div className="flex flex-col items-center text-center space-y-4">
                                            <div
                                                className={`w-16 h-16 rounded-full ${category.bgColor} flex items-center justify-center`}
                                            >
                                                <Icon size={32} className={category.iconColor} />
                                            </div>
                                            <h3 className="text-[22px] font-lufga font-medium text-black">
                                                {category.title}
                                            </h3>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Brand Information */}
                {stepId === "brand_information" && (
                    <div className="max-w-7xl flex flex-col gap-4">
                        <h1 className="text-[32px] font-lufga font-medium text-black">
                            Brand Information
                        </h1>
                        <div className="flex flex-col gap-4">
                            <label htmlFor="brandName" className="font-lufga font-medium text-black text-base">Brand Name</label>
                            <input {...register("brand.0.brandName", { required: true })}
                                type="text" id="brandName" placeholder="Type Your Brand Name" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal p-4 rounded-xl" />
                        </div>
                        <div className="flex flex-col gap-4">
                            <label htmlFor="domain" className="font-lufga font-medium text-black text-base">Domain</label>
                            <input {...register("brand.0.domain", { required: true })} type="text" id="domain" placeholder="Your Domain" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal p-4 rounded-xl" />
                        </div>
                        <div className="flex flex-col gap-4">
                            <label htmlFor="startingDate" className="font-lufga font-medium text-black text-base">Starting Date</label>
                            <input {...register("brand.0.startingDate", { required: true })} type="date" id="startingDate" placeholder="Starting Date" className="bg-[#F4F4F4] h-14 border border-[#EBF0ED] placeholder:text-black placeholder:font-abeezee placeholder:font-normal p-4 rounded-xl" />
                        </div>
                        <div className="flex flex-col gap-4">
                            <label htmlFor="location" className="font-lufga font-medium text-black text-base">Business Location</label>
                            <div className="flex gap-2 items-center justify-start w-full bg-[#F4F4F4] border border-[#EBF0ED]  rounded-xl  pl-6">
                                <Search />
                                <input {...register("brand.0.location", { required: true })} type="text" id="location" placeholder="Search Loaction" className="bg-[#F4F4F4] h-14 placeholder:text-black placeholder:font-abeezee placeholder:font-normal" />
                            </div>

                        </div>
                    </div>
                )}

                {/* Step 3: Tools */}
                {stepId === "tools" && (
                    <div className="max-w-7xl">
                        <h1 className="text-[32px] font-lufga font-medium text-black mb-8">
                            Select Tools
                        </h1>
                        <div className="flex flex-row flex-wrap gap-6">
                            {Tools.map((tool) => {
                                const isSelected = selectedTools.includes(tool.id)

                                return (
                                    <Card
                                        key={tool.id}
                                        className={`p-6 cursor-pointer transition-all hover:shadow-lg border-2 w-full max-w-[240px] h-[150px] bg-[#FAFAFA]
                                    ${isSelected ? "border-lime-400" : "border-[#FAFAFA]"}`}
                                        onClick={() => handleToolSelect(tool.id)}
                                    >
                                        <div className="flex flex-col items-center text-center space-y-4">
                                            {tool.icon}
                                            <h3 className="text-[15px] font-lufga font-medium text-black">
                                                {tool.title}
                                            </h3>
                                        </div>
                                    </Card>
                                )
                            })}
                            <input type="checkbox" {...register("tools")} />
                        </div>
                    </div>
                )}

                {/* Navigation Buttons */}
                <div className="mt-8 flex justify-between">
                    {currentStep > 0 && (
                        <Button
                            type="button"
                            onClick={() => setCurrentStep(currentStep - 1)}
                            className="bg-gray-200 text-black px-6"
                        >
                            Back
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={stepId === "category" && !selectedCategory}
                        className="bg-lime-400 hover:bg-lime-500 text-black font-medium px-8"
                    >
                        {currentStep === steps.length - 1 ? "Finish" : "Continue"}
                    </Button>
                </div>
            </form>
        </div>
    )
}

export default Addlisting
