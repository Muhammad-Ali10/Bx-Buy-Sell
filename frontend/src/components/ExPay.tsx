import group75 from "@/assets/Group 75.png";
import { Button } from "./ui/button";
import item1Icon from "@/assets/item 1.svg";
import item2Icon from "@/assets/item 2.svg";
import item3Icon from "@/assets/item 3.svg";
import item4Icon from "@/assets/item 4.svg";

const ExPay = () => { 
  const features = [
    {
      icon: item1Icon,
      title: "Secure Process",
      description: "Every transaction is coordinated securely from start to finish with trusted partners."
    },
    {
      icon: item2Icon,
      title: "Trusted Escrow Partners",
      description: "Escrow services are provided through licensed partners to help protect buyers and sellers."
    },
    {
      icon: item3Icon,
      title: "Fast and Safe",
      description: "Complete your transaction quickly through a streamlined process."
    },
    {
      icon: item4Icon,
      title: "Guided Process",
      description: "Follow every step with a clear and structured transaction process."
    }
  ];

  return (
    <section className="bg-black text-white py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="text-center mb-8 sm:mb-12 max-w-3xl  mx-auto ">
          <h2 
            className="mb-4 sm:mb-6 font-lufga text-[32px] sm:text-[44px] md:text-[56px] lg:text-[72px]"
            style={{
              fontWeight: 400,
              lineHeight: '118%',
              letterSpacing: '0%',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 1)'
            }}
          >
            Secure Transactions with EX PAY
          </h2>
          <p 
            className="px-4 font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
            style={{
              fontWeight: 400,
              lineHeight: '150%',
              letterSpacing: '0%',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.7)'
            }}
          >
           EX PAY helps buyers and sellers complete transactions securely by coordinating the process with trusted payment and escrow partners. Payments are handled through licensed third-party providers, ensuring a smooth, secure, and reliable transaction.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center max-w-6xl mx-auto">
          {/* Left Side - Features List */}
          <div className="order-2 md:order-1">
            <div className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
              {features.map((feature, index) => {
                return (
                  <div key={index} className="flex gap-3 sm:gap-4">
                    <div className="flex-shrink-0">
                      <img 
                        src={feature.icon} 
                        alt={feature.title}
                        className="w-[58px] h-[58px]"
                      />
                    </div>
                    <div>
                      <h3 
                        className="mb-1 sm:mb-2 font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                        style={{
                          fontWeight: 400,
                          lineHeight: '150%',
                          letterSpacing: '0%',
                          color: 'rgba(255, 255, 255, 1)'
                        }}
                      >
                        {feature.title}
                      </h3>
                      <p 
                        className="font-lufga text-sm sm:text-base md:text-lg lg:text-[22px]"
                        style={{
                          fontWeight: 400,
                          lineHeight: '140%',
                          letterSpacing: '0%',
                          color: 'rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button 
              className="font-lufga hover:opacity-100"
              style={{
                width: '175px',
                height: '63px',
                borderRadius: '70px',
                paddingTop: '15px',
                paddingRight: '30px',
                paddingBottom: '15px',
                paddingLeft: '30px',
                backgroundColor: '#C6FE1F',
                opacity: 1,
                border: 'none'
              }}
            >
              <span
                className="font-lufga text-base sm:text-lg md:text-xl lg:text-[22px]"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  color: 'rgba(0, 0, 0, 1)'
                }}
              >
                Read More
              </span>
            </Button>
          </div>

          {/* Right Side - Payment UI Cards Image */}
          <div className="flex items-center justify-center order-1 md:order-2">
            <img 
              src={group75} 
              alt="EX PAY Payment Process" 
              className="w-full h-auto max-w-[280px] sm:max-w-[350px] md:max-w-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExPay;


