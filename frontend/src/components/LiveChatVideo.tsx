import group1597885301 from "@/assets/Group 1597885301.png";
import rectangle4237 from "@/assets/Rectangle 4237.png";
import { Button } from "./ui/button";

const LiveChatVideo = () => {
  return (
    <section className="bg-black text-white py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <div
          className="w-full rounded-[20px] sm:rounded-[40px] md:rounded-[60px] lg:rounded-[80px] p-5 sm:p-8 md:p-10 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(24, 24, 26, 1)',
            opacity: 1
          }}
        >
          <div className="grid md:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center max-w-6xl w-full">
          {/* Left Side - Video Call Image & Text */}
          <div className="order-2 md:order-1">
            <div className="mb-4 sm:mb-6">
              <Button 
                className="font-lufga w-full sm:w-auto h-14 sm:h-[68px] rounded-[60px] py-3 px-6 sm:py-4 sm:px-10 flex items-center justify-center sm:justify-start"
                style={{
                  borderWidth: '1px',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  backgroundColor: 'transparent',
                  opacity: 1
                }}
              >
                <span
                  className="font-lufga text-lg sm:text-xl md:text-2xl"
                  style={{
                    fontWeight: 400,
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    verticalAlign: 'middle',
                    color: '#FFFFFF'
                  }}
                >
                  Start Now
                </span>
              </Button>
            </div>
            <div className="mb-6 sm:mb-8">
              <img 
                src={rectangle4237} 
                alt="Video Meeting" 
                className="w-full h-auto rounded-[20px] sm:rounded-[30px] md:rounded-[40px] lg:rounded-[50px] object-cover max-h-[400px] sm:max-h-[500px] md:max-h-[605px]"
                style={{
                  opacity: 1
                }}
              />
            </div>
            <div>
              <h2 
                className="mb-4 sm:mb-6 font-lufga text-[28px] sm:text-[36px] md:text-[44px] lg:text-[54px]"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  verticalAlign: 'middle',
                  color: 'rgba(255, 255, 255, 1)'
                }}
              >
                Live Chat & Video Meetings
              </h2>
              <p 
                className="font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  verticalAlign: 'middle',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}
              >
                Chat with sellers and buyers on our internal chat system that offers payment system, fraud protection and many more helpful functions.
              </p>
            </div>
          </div>

          {/* Right Side - Mobile App Interface */}
          <div className="flex items-center justify-center order-1 md:order-2">
            <img 
              src={group1597885301} 
              alt="Chat Interface" 
              className="w-full h-auto max-w-[300px] sm:max-w-[400px] md:max-w-[500px] lg:max-w-[650px] xl:max-w-[805px] object-contain"
              style={{
                opacity: 1
              }}
            />
          </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveChatVideo;


