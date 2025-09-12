"use client"

import { useState } from "react"
import { ArrowLeft, Check, Search, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StepRightSVG } from "@/svg"

const steps = [
    { id: 1, title: "Step 1" },
    { id: 2, title: "Step 2" },
    { id: 3, title: "Step 3" },
    { id: 4, title: "Step 4" },
]

const backgroundOptions = [
    "I represent a fund / investment company and we are buying regularly",
    "I'm looking for a side hustle / my first business",
    "I'm looking for my next entrepreneurial venture, a full-time business",
    "I want to invest as a Investor into business instead of buying it completely",
    "None of the above",
]

const businessCategories = [
    "E-Commerce",
    "SaaS / Software Business",
    "Service Business",
    "Content & Media / Blogs",
    "Affiliate",
    "Mobile Apps",
    "Marketplace",
    "Subscription & Membership",
    "Ai & Automation",
    "Local / offline Business",
]

const niches = ["Pet", "Beauty", "Electronic", "Sport / nutrition", "Beauty", "Beauty", "Beauty"]

export default function StepForm() {
    const [currentStep, setCurrentStep] = useState(1)
    const [validationErrors, setValidationErrors] = useState({})
    const [formData, setFormData] = useState({
        background: "",
        businessCategories: [],
        selectedNiches: [],
        listingPrice: [500],
        businessAge: [6],
        yearlyProfit: [500],
        profitMultiple: [5],
        revenueMultiple: [5],
        sellerLocation: "United States",
        targetCountry: [50],
    })

    const validateStep = (step) => {
        const errors = {}

        switch (step) {
            case 1:
                if (!formData.background) {
                    errors.background = "Please select your background"
                }
                break
            case 2:
                if (formData.businessCategories.length === 0) {
                    errors.businessCategories = "Please select at least one business category"
                }
                break
            case 3:
                if (formData.selectedNiches.length === 0) {
                    errors.selectedNiches = "Please select at least one niche"
                }
                break
            case 4:
                // Step 4 has default values, so no validation needed
                break
        }

        return errors
    }

    const handleNext = () => {
        const errors = validateStep(currentStep)
        setValidationErrors(errors)

        if (Object.keys(errors).length === 0) {
            if (currentStep < 4) {
                setCurrentStep(currentStep + 1)
                setValidationErrors({}) // Clear errors when moving to next step
            } else {
                // Form completed
                console.log("Form completed:", formData)
                alert("Form submitted successfully!")
            }
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
            setValidationErrors({}) // Clear errors when going back
        }
    }

    const handleBusinessCategoryChange = (category) => {
        setFormData((prev) => ({
            ...prev,
            businessCategories: prev.businessCategories.includes(category)
                ? prev.businessCategories.filter((c) => c !== category)
                : [...prev.businessCategories, category],
        }))
    }

    const handleNicheChange = (niche) => {
        setFormData((prev) => ({
            ...prev,
            selectedNiches: prev.selectedNiches.includes(niche)
                ? prev.selectedNiches.filter((n) => n !== niche)
                : [...prev.selectedNiches, niche],
        }))
    }

    const StepIndicator = () => (
        <div className="flex items-center justify-center mb-12">
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${step.id < currentStep
                                ? "bg-[#AEF31F] border-2 border-black text-black"
                                : step.id === currentStep
                                    ? "bg-[#AEF31F] text-black border-2 border-black"
                                    : "bg-[#E5E5E5] text-black border-2 border-black/10"
                                }`}
                        >
                            {step.id < currentStep ? <StepRightSVG /> : <p className="text-black font-lufga font-semibold text-xl">{step.id}</p>}
                        </div>
                        <span className={`mt-2 text-xl font-lufga font-semibold ${step.id === currentStep ? "text-black" : "text-black/50"}`}>
                            {step.title}
                        </span>
                    </div>
                    {index < steps.length - 1 && (
                        <div className={`w-32 h-0.5 -mt-6 ${step.id < currentStep ? "bg-lime-400" : "bg-gray-200"}`} />
                    )}
                </div>
            ))}
        </div>
    )

    const Step1 = () => (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-8">What's Your Background?</h2>
            <RadioGroup
                value={formData.background}
                onValueChange={(value) => {
                    setFormData((prev) => ({ ...prev, background: value }))
                    if (validationErrors.background) {
                        setValidationErrors((prev) => ({ ...prev, background: undefined }))
                    }
                }}
                className="space-y-4"
            >
                {backgroundOptions.map((option, index) => (
                    <div
                        key={index}
                        className={`flex items-center space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${formData.background === option ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                            }`}
                    >
                        <RadioGroupItem value={option} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-gray-700">
                            {option}
                        </Label>
                    </div>
                ))}
            </RadioGroup>
            {validationErrors.background && <p className="text-red-500 text-sm mt-4">{validationErrors.background}</p>}
        </div>
    )

    const Step2 = () => (
        <div className="max-w-5xl mx-auto bg-[#FAFAFA] p-8 rounded-lg">
            <h2 className="text-2xl font-semibold mb-8">Select Business Categories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {businessCategories.map((category) => (
                    <div
                        key={category}
                        className={`flex items-center space-x-3 p-4 rounded-lg border-0 bg-white cursor-pointer transition-colors ${formData.businessCategories.includes(category)
                            ? "border-lime-400 border-2 bg-[#AEF31F1A]/10"
                            : ""
                            }`}
                        onClick={() => {
                            handleBusinessCategoryChange(category)
                            if (validationErrors.businessCategories) {
                                setValidationErrors((prev) => ({ ...prev, businessCategories: undefined }))
                            }
                        }}
                    >
                        <Checkbox
                            checked={formData.businessCategories.includes(category)}
                            onChange={() => handleBusinessCategoryChange(category)}
                        />
                        <span className="font-normal font-lufga text-black/50 text-lg">{category}</span>
                    </div>
                ))}
            </div>
            {validationErrors.businessCategories && (
                <p className="text-red-500 text-sm mt-4">{validationErrors.businessCategories}</p>
            )}
        </div>
    )

    const Step3 = () => (
        <div className="max-w-5xl mx-auto bg-[#FAFAFA] p-8 rounded-lg">
            <h2 className="text-2xl font-semibold mb-8">Select Niches</h2>
            <div className="relative mb-6 max-w-[378px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input placeholder="Search" className="pl-10 bg-gray-100 border-0 h-14" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {niches.map((niche, index) => (
                    <div
                        key={`${niche}-${index}`}
                        className={`flex items-center space-x-3 p-4 rounded-lg bg-white cursor-pointer transition-colors ${formData.selectedNiches.includes(niche)
                            ? "border-lime-400 border-2 bg-[#AEF31F1A]/10"
                            : ""
                            }`}
                        onClick={() => {
                            handleNicheChange(niche)
                            if (validationErrors.selectedNiches) {
                                setValidationErrors((prev) => ({ ...prev, selectedNiches: undefined }))
                            }
                        }}
                    >
                        <Checkbox checked={formData.selectedNiches.includes(niche)} onChange={() => handleNicheChange(niche)} />
                        <span className="text-gray-700">{niche}</span>
                    </div>
                ))}
            </div>
            <Button variant="outline" className="w-full bg-lime-400 hover:bg-lime-500 text-black border-0">
                Show More <ChevronDown className="ml-2 w-4 h-4" />
            </Button>
            {validationErrors.selectedNiches && (
                <p className="text-red-500 text-sm mt-4">{validationErrors.selectedNiches}</p>
            )}
        </div>
    )

    const Step4 = () => (
        <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold mb-8">Financial Data</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    {/* Listing Price */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">Listing Price</label>
                            <span className="text-sm text-gray-500">6y-15y</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 mb-2">
                            <span>500$</span>
                            <span>5,000$</span>
                        </div>
                        <Slider
                            value={formData.listingPrice}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, listingPrice: value }))}
                            max={5000}
                            min={500}
                            step={100}
                            className="w-full"
                        />
                    </div>

                    {/* Seller Location */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-4 block">Seller Location</label>
                        <Select
                            value={formData.sellerLocation}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, sellerLocation: value }))}
                        >
                            <SelectTrigger className="w-full">
                                <div className="flex items-center">
                                    <span className="mr-2">🇺🇸</span>
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="United States">🇺🇸 United States</SelectItem>
                                <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                                <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Target Country */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">Target Country</label>
                            <span className="text-sm text-gray-500">min. 50%</span>
                        </div>
                        <Slider
                            value={formData.targetCountry}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, targetCountry: value }))}
                            max={100}
                            min={0}
                            step={5}
                            className="w-full mb-4"
                        />
                        <Select
                            value={formData.sellerLocation}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, sellerLocation: value }))}
                        >
                            <SelectTrigger className="w-full">
                                <div className="flex items-center">
                                    <span className="mr-2">🇺🇸</span>
                                    <SelectValue />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="United States">🇺🇸 United States</SelectItem>
                                <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                                <SelectItem value="United Kingdom">🇬🇧 United Kingdom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Business Age */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">Business Age</label>
                            <span className="text-sm text-gray-500">6y-15y</span>
                        </div>
                        <Slider
                            value={formData.businessAge}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, businessAge: value }))}
                            max={15}
                            min={1}
                            step={1}
                            className="w-full"
                        />
                    </div>

                    {/* Yearly Profit */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">Yearly Profit $</label>
                            <span className="text-sm text-gray-500">500$-5000$</span>
                        </div>
                        <Slider
                            value={formData.yearlyProfit}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, yearlyProfit: value }))}
                            max={5000}
                            min={500}
                            step={100}
                            className="w-full"
                        />
                    </div>

                    {/* Profit Multiple */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">✕ Profit Multiple</label>
                            <span className="text-sm text-gray-500">5x-20x</span>
                        </div>
                        <Slider
                            value={formData.profitMultiple}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, profitMultiple: value }))}
                            max={20}
                            min={5}
                            step={1}
                            className="w-full"
                        />
                    </div>

                    {/* Revenue Multiple */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-medium text-gray-700">✕ Revenue Multiple</label>
                            <span className="text-sm text-gray-500">5x-20x</span>
                        </div>
                        <Slider
                            value={formData.revenueMultiple}
                            onValueChange={(value) => setFormData((prev) => ({ ...prev, revenueMultiple: value }))}
                            max={20}
                            min={5}
                            step={1}
                            className="w-full"
                        />
                    </div>
                </div>
            </div>
        </div>
    )

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <Step1 />
            case 2:
                return <Step2 />
            case 3:
                return <Step3 />
            case 4:
                return <Step4 />
            default:
                return <Step1 />
        }
    }

    return (
        <div className=" bg-white">
            {/* Header */}

            <button
                onClick={handleBack}
                className="flex items-center gap-2 font-lufga font-medium text-xl text-black"
                disabled={currentStep === 1}
            >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Go Back
            </button>

            {/* Main Content */}
            <div className="px-6 py-12">
                <div className="max-w-7xl mx-auto">
                    <StepIndicator />
                    {renderStep()}

                    {/* Next Button */}
                    <div className="flex justify-end mt-12">
                        <Button
                            onClick={handleNext}
                            className="bg-lime-400 hover:bg-lime-500 text-black px-8 py-3 rounded-full font-medium"
                        >
                            {currentStep === 4 ? "Submit" : "Next"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
