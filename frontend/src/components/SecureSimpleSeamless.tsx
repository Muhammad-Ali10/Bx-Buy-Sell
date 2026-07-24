import group1597885298 from "@/assets/Group 1597885298.png";
import listIcon from "@/assets/Group 85.svg";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

const SecureSimpleSeamless = () => {
  return (
    <>
    <section className="text-white" style={{ backgroundColor: 'rgba(13, 13, 13, 1)' }}>
      {/* Top Section - EX -Secure, Simple, Seamless */}
      <div className="py-12 sm:py-16 md:py-20 border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto w-full">
            <h2 
              className="text-white mb-6 sm:mb-8 font-lufga text-[32px] sm:text-[44px] md:text-[56px] lg:text-[74px]"
              style={{
                fontWeight: 400,
                lineHeight: '150%',
                letterSpacing: '0%',
                verticalAlign: 'middle'
              }}
            >
              EX -Secure, Simple, Seamless
            </h2>
            <p 
              className="text-white font-lufga text-left md:ml-auto text-base sm:text-lg md:text-xl lg:text-2xl max-w-full md:max-w-[747px]"
              style={{
                fontWeight: 300,
                lineHeight: '150%',
                letterSpacing: '0%',
                verticalAlign: 'middle',
                opacity: 1
              }}
            >
              EX is where serious buyers meet real sellers. Whether you're looking to acquire your next cash-flowing asset or exit your business with confidence — EX gives you the place to do it right. We combine clean design with powerful analytics, secure infrastructure, and a smooth user experience.
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* Bottom Section - Discover All Listings */}
    <section className="text-white" style={{ backgroundColor: '#000000' }}>
      <div className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center max-w-6xl mx-auto">
            {/* Left Side - Mobile App Image */}
            <div className="flex justify-center md:justify-start order-2 md:order-1">
              <img 
                src={group1597885298} 
                alt="EX Mobile App" 
                className="w-full max-w-[280px] sm:max-w-sm md:max-w-md h-auto object-contain"
              />
            </div>

            {/* Right Side - Text Content */}
            <div className="order-1 md:order-2">
              <h2 
                className="text-white mb-4 sm:mb-6 font-lufga text-[32px] sm:text-[44px] md:text-[56px] lg:text-[72px]"
                style={{
                  fontWeight: 400,
                  lineHeight: '118%',
                  letterSpacing: '0%',
                  opacity: 1
                }}
              >
                Discover All Listings
              </h2>
              <p 
                className="mb-6 sm:mb-8 font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}
              >
                EX provides you a simple userface to
              </p>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-10">
                <li className="flex items-center gap-3">
                  <img src={listIcon} alt="" className="flex-shrink-0 w-6 h-4 sm:w-8 sm:h-5" />
                  <span 
                    className="font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                    style={{
                      fontWeight: 400,
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}
                  >
                    Browse thousands of listings
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <img src={listIcon} alt="" className="flex-shrink-0 w-6 h-4 sm:w-8 sm:h-5" />
                  <span 
                    className="font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                    style={{
                      fontWeight: 400,
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}
                  >
                    Use advanced Filter Options
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <img src={listIcon} alt="" className="flex-shrink-0 w-6 h-4 sm:w-8 sm:h-5" />
                  <span 
                    className="font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                    style={{
                      fontWeight: 400,
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}
                  >
                    Contact the best sellers
                  </span>
                </li>
              </ul>
              <Button 
                className="font-lufga hover:opacity-100 w-full sm:w-auto h-12 sm:h-[63px] rounded-[70px] py-3 px-6 sm:py-4 sm:px-8"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 1)',
                  opacity: 1,
                  border: 'none'
                }}
                asChild
              >
                <Link 
                  to="/all-listings"
                  className="font-lufga text-base sm:text-lg md:text-xl lg:text-[22px]"
                  style={{
                    fontWeight: 400,
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    color: 'rgba(0, 0, 0, 1)'
                  }}
                >
                  See All Listings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
};

export default SecureSimpleSeamless;


