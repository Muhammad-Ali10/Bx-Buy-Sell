import group112Preview from "@/assets/Group_112-removebg-preview (1).png";
import group1597885285 from "@/assets/Group 1597885285.png";

const Features = () => {
  return (
    <section className="bg-black text-white py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 items-center max-w-6xl mx-auto" style={{ gap: '20px' }}>
          {/* Left Section - Reports & Insights Text with QR Code */}
          <div 
            className="text-left flex flex-col"
            style={{
              maxWidth: '100%',
              gap: '20px'
            }}
          >
            {/* First Content Container */}
            <div
              className="w-full rounded-[20px] sm:rounded-[40px] md:rounded-[60px] lg:rounded-[80px] p-6 sm:p-8 md:p-10 flex flex-col justify-center min-h-[300px] sm:min-h-[400px] md:min-h-[500px] lg:min-h-[582px]"
              style={{
                backgroundColor: 'rgba(24, 24, 26, 1)',
                opacity: 1
              }}
            >
              <h2 
                className="text-white mb-4 sm:mb-6 font-lufga text-[28px] sm:text-[36px] md:text-[44px] lg:text-[54px]"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  verticalAlign: 'middle'
                }}
              >
                Reports & Insights
              </h2>
              <p 
                className="text-white font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  verticalAlign: 'middle'
                }}
              >
                Our detailed dashboard insights clear up most questions early on — so you can focus on what really matters. With key metrics presented clearly, users spend less time searching and more time deciding.
              </p>
            </div>
            {/* QR Code Image below text */}
            <div 
              className="w-full rounded-[20px] sm:rounded-[40px] md:rounded-[60px] lg:rounded-[80px] overflow-hidden flex items-center justify-center min-h-[300px] sm:min-h-[400px] md:min-h-[500px] lg:min-h-[582px]"
              style={{
                backgroundColor: 'rgba(19, 100, 255, 1)',
                opacity: 1
              }}
            >
              <img 
                src={group1597885285} 
                alt="Download Mobile App" 
                loading="lazy"
                decoding="async"
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
          </div>

          {/* Right Section - Mobile App on Green Background */}
          <div 
            className="w-full rounded-[20px] sm:rounded-[40px] md:rounded-[60px] lg:rounded-[80px] overflow-hidden flex items-center justify-center min-h-[400px] sm:min-h-[600px] md:min-h-[800px] lg:min-h-[1000px] xl:min-h-[1190px]"
            style={{
              backgroundColor: 'rgba(198, 254, 30, 1)',
              opacity: 1
            }}
          >
            <img 
              src={group112Preview} 
              alt="Reports & Insights App" 
              className="w-auto h-auto max-h-[300px] sm:max-h-[500px] md:max-h-[700px] lg:max-h-[900px] object-contain"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
      </section>
  );
};

export default Features;