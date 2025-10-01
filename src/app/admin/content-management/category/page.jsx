"use client"
import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import AddCategory from "@/components/admin/add-category"
import { Skeleton } from "@/components/ui/skeleton"
import { getCategories } from "@/services/categoryService"

const Category = () => {
  const { data, isPending, error } = getCategories()
  const [allCategories, setAllCategories] = useState([])
  const [categories, setCategories] = useState([])

  useEffect(() => {
    if (data) {
      setAllCategories(data)
      setCategories(data)
    }
  }, [data])

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase()
    if (value) {
      const filtered = allCategories.filter((cat) =>
        cat.name.toLowerCase().includes(value)
      )
      setCategories(filtered)
    } else {
      setCategories(allCategories)
    }
  }

  if (error) return <p className="text-red-500">Failed to load categories</p>

  return (
    <div className="w-full flex flex-col gap-10 relative">
      {/* Header with Search */}
      <div className="flex flex-row items-center justify-between">
        <div className="flex gap-2 items-center">
          <h3 className="font-lufga font-medium text-2xl text-black">Category</h3>
          <div className="flex gap-2 items-center max-w-[326px] w-full bg-[#F8FAFC] rounded-2xl py-2.5 pl-6">
            <Search className="text-gray-500" />
            <Input
              type="text"
              placeholder="Search by name..."
              className="w-full bg-transparent border-0 shadow-none focus:ring-0 text-xs"
              onChange={handleSearch}
            />
          </div>
        </div>

        {/* Add Category Button */}
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#C6FE1F] py-4 px-[26px] rounded-[60px] text-base font-medium font-lufga text-black hover:bg-[#C6FE1F]/60">
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="p-0 border-0 rounded-2xl shadow-2xl !max-w-[720px]">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="text-2xl font-medium font-lufga text-black">
                Add New Category
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <AddCategory />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Categories Grid */}
      <div className="flex flex-col gap-6 w-full border border-black/10 rounded-4xl px-4 py-10">
        <h3 className="font-lufga font-medium text-2xl text-black">Added Categories</h3>
        <div className="flex flex-row flex-wrap gap-4 w-full">
          {isPending
            ? Array(4).fill().map((_, index) => (
                <div
                  key={index}
                  className="bg-[#FAFAFA] rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px] items-center justify-center"
                >
                  <Skeleton className="h-14 w-14 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))
            : categories.map((category, index) => (
                <div
                  key={index}
                  className="bg-[#FAFAFA] rounded-[16px] px-6 py-[22px] flex flex-col gap-5 w-full max-w-[240px] h-[153px] items-center justify-center"
                >
                  <img
                    className="rounded-full"
                    src={category?.image_path}
                    alt={category?.name}
                    width={56}
                    height={56}
                  />
                  <h3 className="font-lufga font-medium text-base text-center text-black">
                    {category?.name}
                  </h3>
                </div>
              ))}
        </div>
      </div>
    </div>
  )
}

export default Category
