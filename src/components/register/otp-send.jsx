"use client";
import React, { useDeferredValue, useState } from "react";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronsUpDown } from "lucide-react";
import parsePhoneNumberFromString, {
  getCountryCallingCode,
  isSupportedCountry,
  isValidNumber,
} from "libphonenumber-js";
import { countries, getCountryCode } from "countries-list";
import Flag from "react-world-flags";
export const countryCodes = Object.keys(countries);
export const countryValues = Object.values(countries);

const OTPSend = () => {
  const [phone, setPhone] = useState("");
  const [formatedPhone, setFormattedPhone] = useState("");
  const [code, setCode] = useState("PK");

  return (
    <div className="w-full md:w-full flex flex-col p-6 md:p-10 lg:p-20">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        {/* Logo */}
        <div className="mb-16">
          <div className="bg-[#d0ff00] w-12 h-12 flex items-center justify-center rounded-md">
            <Image src={"/logo.png"} height={60} width={60} alt={"logo.png"} />
          </div>
        </div>

        {/* Form Content */}
        <div className="mb-16">
          <h1 className="text-3xl font-semibold mb-2 text-center font-sora">
            Enter Your Phone Nr.
          </h1>
          <p className="text-gray-600 text-lg  font-normal mb-2 text-center font-sora md:mb-8">
            Type in your number and verify
          </p>

          {/* Country Selector and Phone Input */}
          <div className="flex mb-6 border-1  rounded-[60px] ">
            <span className="  flex border-r-[1px]">
              <Select
                onValueChange={(value) => setCode(value)}
                value={code}
                defaultValue={"92"}
              >
                <SelectTrigger className=" outline-0 ring-0 border-0">
                  <SelectValue placeholder="Select Code" />
                </SelectTrigger>
                <SelectContent
                  className={"ring-0 outline-0 border-0 focus:border-0"}
                >
                  {countryValues.map((country, index) => (
                    <div key={`${country.name}`}>
                      {isSupportedCountry(
                        getCountryCode(country.name)
                      ) && (
                        <SelectItem
                          className={"flex items-center flex-wrap"}
                          value={getCountryCode(country.name)}
                        >
                          <span className="flex items-center gap-2 text-sm rounded-[22px]">
                            <Flag
                              code={getCountryCode(country.name)}
                              className="rounded-full h-[26px] w-[26px] object-cover"
                            />
                            {getCountryCode(country.name)}
                            <span>
                              {`+${getCountryCallingCode(
                                getCountryCode(country.name)
                              )}`}
                            </span>
                          </span>
                        </SelectItem>
                      )}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </span>

            <input
              type="text"
              onChange={(e) => {
                try {
                  const regex = /[a-zA-Z]/;
                  if (regex.test(e.target.value)) {
                    return;
                  }
                  const phoneNumber = parsePhoneNumberFromString(
                    `+${getCountryCallingCode(code)}${e.target.value}`,
                    code
                  );

                  if (phoneNumber?.isValid()) {
                    setFormattedPhone(phoneNumber?.formatNational());
                    setPhone(phoneNumber.number);
                  } else setFormattedPhone(e.target.value);
                } catch {
                  setFormattedPhone(e.target.value);
                }
              }}
              value={formatedPhone}
              placeholder="Phone number"
              className="flex-1 ml-2 border-gray-300 outline-0 ring-0 border-0 rounded-r-md focus:outline-none "
            />
          </div>

          {/* Continue Button */}
          <button className="w-full py-3 bg-[#d0ff00] text-black font-sora font-medium rounded-full !mb-8">
            Continue
          </button>

          {/* Resend Code */}
          <p className="text-center text-sm text-gray-600">
            Didnt get a code?{" "}
            <button className="text-black font-semibold">
              Click to resend
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export { OTPSend };
