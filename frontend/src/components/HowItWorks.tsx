import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import step1 from "@/assets/step-1.png";
import step2 from "@/assets/step-2.png";
import step3 from "@/assets/step-3.png";
import buyerStep1 from "@/assets/1st img.png";
import buyerStep3 from "@/assets/3rd image.png";

const steps = [
  {
    number: "01",
    title: "List Your Business 4 free",
    description: "Create a compelling listing in minutes. No upfront fees, no hassle — just visibility to serious buyers.",
    image: step1,
  },
  {
    number: "02",
    title: "Interact with Buyers",
    description: "Communicate securely, answer questions, and showcase your business to qualified prospects.",
    image: step2,
  },
  {
    number: "03",
    title: "Seal the Deal with EX Pay",
    description: "Finalize your deal safely with secure payments through our escrow service >> EX Pay <<",
    image: step3,
  },
];

const buyerSteps = [
  {
    number: "01",
    title: "Browse All Listings",
    description: "Search, filter, and discover thousands of businesses that match your criteria and vision.",
    image: buyerStep1,
  },
  {
    number: "02",
    title: "Negotiate with Sellers",
    description: "Securely connect, negotiate, and review all key details to ensure the best possible deal.",
    image: step2,
  },
  {
    number: "03",
    title: "Seal the Deal with EX Pay",
    description: "Our integrated escrow service, EX Pay, ensures a smooth, secure, and fully protected transaction.",
    image: buyerStep3,
  },
];

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');

  return (
    <section id="how-it-works" className="py-12 sm:py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="font-sora font-semibold text-[56px] leading-[130%] text-center mb-3 sm:mb-4">How EX works</h2>
          <p className="font-sora font-normal text-base leading-[160%] text-center mb-2 sm:mb-3" style={{ color: 'rgba(0, 0, 0, 0.8)' }}>
            Buy & Sell Companies in 3 Easy Steps.
          </p>
          <p className="font-sora font-normal text-base leading-[160%] text-center mb-6 sm:mb-8" style={{ color: 'rgba(0, 0, 0, 0.8)' }}>
            Seamlessly connecting buyers and sellers for faster, smoother deals.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-4">
            <button
              onClick={() => setActiveTab('buyer')}
              className="font-sora font-semibold text-base leading-[160%] text-center flex items-center justify-center cursor-pointer transition-colors w-full sm:w-auto min-w-[140px] sm:w-[166px] h-12 sm:h-14 rounded-xl py-3 px-4"
              style={{
                backgroundColor: activeTab === 'buyer' ? 'rgba(196, 252, 30, 1)' : 'rgba(238, 238, 238, 1)',
                color: '#000000',
                border: 'none'
              }}
            >
              I'm A Buyer
            </button>
            <button
              onClick={() => setActiveTab('seller')}
              className="font-sora font-semibold text-base leading-[160%] text-center flex items-center justify-center cursor-pointer transition-colors w-full sm:w-auto min-w-[140px] sm:w-[166px] h-12 sm:h-14 rounded-xl py-3 px-4"
              style={{
                backgroundColor: activeTab === 'seller' ? 'rgba(196, 252, 30, 1)' : 'rgba(238, 238, 238, 1)',
                color: '#000000',
                border: 'none'
              }}
            >
              I'm A Seller
            </button>
          </div>

          {/* Tab Content Section */}
          <div className="mb-8 sm:mb-12">
              {activeTab === 'buyer' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto">
                  {buyerSteps.map((step, index) => (
                    <div
                      key={step.number}
                      className="text-left animate-fade-in"
                      style={{ animationDelay: `${index * 200}ms` }}
                    >
                      <div className="mb-4 sm:mb-6 flex justify-start items-center">
                        <div className={`w-full max-w-md aspect-[4/3] flex items-center justify-center rounded-xl sm:rounded-2xl overflow-hidden ${index === 1 ? 'bg-muted p-8 sm:p-12' : ''}`}>
                          <img 
                            src={step.image} 
                            alt={step.title}
                            className="w-full h-full object-contain"
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        </div>
                      </div>
                      <h3 
                        className="mb-2 sm:mb-3 font-sora font-semibold text-[20px] sm:text-[24px] md:text-[29px]"
                        style={{
                          lineHeight: '150%',
                          letterSpacing: '0%',
                          verticalAlign: 'middle'
                        }}
                      >
                        {step.title}
                      </h3>
                      <p 
                        className="leading-relaxed font-sora text-sm sm:text-base"
                        style={{
                          fontWeight: 400,
                          lineHeight: '160%',
                          letterSpacing: '0%',
                          verticalAlign: 'middle',
                          color: 'rgba(11, 43, 54, 0.7)'
                        }}
                      >
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'seller' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-7xl mx-auto">
                  {steps.map((step, index) => (
                    <div
                      key={step.number}
                      className="text-left animate-fade-in"
                      style={{ animationDelay: `${index * 200}ms` }}
                    >
                      <div className="mb-4 sm:mb-6 flex justify-start items-center">
                        <div className={`w-full max-w-md aspect-[4/3] flex items-center justify-center rounded-xl sm:rounded-2xl overflow-hidden ${index === 1 ? 'bg-muted p-8 sm:p-12' : ''}`}>
                          <img 
                            src={step.image} 
                            alt={step.title}
                            className="w-full h-full object-contain"
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        </div>
                      </div>
                      <h3 
                        className="mb-2 sm:mb-3 font-sora font-semibold text-[20px] sm:text-[24px] md:text-[29px]"
                        style={{
                          lineHeight: '150%',
                          letterSpacing: '0%',
                          verticalAlign: 'middle'
                        }}
                      >
                        {step.title}
                      </h3>
                      <p 
                        className="leading-relaxed font-sora text-sm sm:text-base"
                        style={{
                          fontWeight: 400,
                          lineHeight: '160%',
                          letterSpacing: '0%',
                          verticalAlign: 'middle',
                          color: 'rgba(11, 43, 54, 0.7)'
                        }}
                      >
                        {step.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
