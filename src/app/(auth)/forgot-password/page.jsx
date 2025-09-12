import React from "react";
import { Star, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const page = () => {
  return (
    <div className="flex flex-col md:flex-row w-full max-w-1920 mx-auto">
      <div className="w-full max-w-md">
        {/* Form */}
        <form className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="email"
              placeholder="Enter you email"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-3xl  !text-base font-normal !font-sora "
            />
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            className="w-full py-3 bg-[#C5FD1F] text-black !text-base  font-normal !font-sora rounded-full"
          >
            Reset Password
          </button>
        </form>
      </div>

      {/* Right Section - Image and Text */}
      <div className="w-full md:w-1/2 relative hidden md:flex bg-[url('/Registerimage.png')] bg-cover p-10  justify-center items-end">
        <div className="flex flex-col justify-center z-20 px-12 py-16 bg-white/30 backdrop-invert backdrop-opacity-10">
          <div className="max-w-md">
            <p className="text-2xl font-medium text-white mb-6">
              {`Find the perfect deal securely and effortlessly. Connect with the right buyers and sellers today—fast,
              safe, and seamless!`}
            </p>
            <h3 className="text-xl font-medium text-white mb-1">
              Verified by Industry Experts
            </h3>
            <p className="text-white mb-3">Trusted by users worldwide</p>
            <div className="flex mb-8">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-6 w-6 text-white fill-white" />
              ))}
            </div>
            <div className="flex">
              <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mr-2">
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default page;
