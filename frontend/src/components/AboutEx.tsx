import group125 from "@/assets/Group 125.png";

const stats = [
  { value: "8+", label: "New Listings Daily" },
  { value: "10K", label: "Total User Base" },
  { value: "500M", label: "Requested Deal Volume" },
];

const formatLabel = (label: string) => {
  // Split label into words and format with line breaks
  const words = label.split(' ');
  if (words.length === 2) {
    return words[0] + '\n' + words[1];
  } else if (words.length === 3) {
    return words[0] + '\n' + words.slice(1).join(' ');
  }
  return label;
};

const AboutEx = () => {
  return (
    <section className="bg-black text-white py-12 sm:py-16 md:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 sm:gap-4 mb-6 sm:mb-8 md:mb-10">
            <button 
              className="font-lufga w-full sm:w-auto min-w-[200px] sm:min-w-[280px] lg:w-[324px] h-14 sm:h-[68px] rounded-[60px] py-3 px-6 sm:py-4 sm:px-10 flex items-center justify-center sm:justify-start"
              style={{
                borderWidth: '1px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'transparent',
                opacity: 1
              }}
            >
              <span
                className="font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  verticalAlign: 'middle',
                  color: '#FFFFFF'
                }}
              >
                EXIT OPPORTUNITIES
              </span>
            </button>
            <button 
              className="font-lufga w-full sm:w-auto min-w-[200px] sm:min-w-[280px] lg:w-[324px] h-14 sm:h-[68px] rounded-[60px] py-3 px-6 sm:py-4 sm:px-10 flex items-center justify-center sm:justify-start"
              style={{
                borderWidth: '1px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                backgroundColor: 'transparent',
                opacity: 1
              }}
            >
              <span
                className="font-lufga text-base sm:text-lg md:text-xl lg:text-2xl"
                style={{
                  fontWeight: 400,
                  lineHeight: '150%',
                  letterSpacing: '0%',
                  verticalAlign: 'middle',
                  color: '#FFFFFF'
                }}
              >
                Company Exchange
              </span>
            </button>
          </div>

          {/* Top Section - About EX Text & Customer Review */}
          <div className="mb-8 sm:mb-12 md:mb-16">
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-start">
              {/* Left - Platform Description */}
              <div className="pt-2">
                <p 
                  className="font-lufga text-[24px] sm:text-[30px] md:text-[36px] lg:text-[44px]"
                  style={{
                    fontWeight: 500,
                    lineHeight: '150%',
                    letterSpacing: '0%',
                    verticalAlign: 'middle',
                    color: 'rgba(255, 255, 255, 0.9)',
                    margin: 0,
                    maxWidth: '1060px',
                    width: '100%'
                  }}
                >
                  EX provides you an intuitive dashboard, realtime analytics, and a secure marketplace for BUYING & SELLING Companies.
                </p>
              </div>

              {/* Right - Customer Review Box */}
              <div className="flex justify-end md:justify-end items-start">
                <img 
                  src={group125} 
                  alt="Customer Reviews" 
                  className="w-auto h-auto max-w-[200px] sm:max-w-[240px] md:max-w-[260px]"
                />
              </div>
            </div>
          </div>

          {/* Bottom Section - Statistics */}
          <div className="border-t border-dashed border-white/10 pt-6 sm:pt-8 md:pt-12">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 md:gap-12">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="text-center"
                >
                  <div 
                    className="font-lufga mb-2 uppercase text-sm sm:text-base md:text-lg lg:text-[22px]"
                    style={{
                      fontWeight: 400,
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      verticalAlign: 'middle',
                      color: 'rgba(255, 255, 255, 0.5)',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {formatLabel(stat.label)}
                  </div>
                  <div 
                    className="font-lufga text-[48px] sm:text-[64px] md:text-[80px] lg:text-[102px]"
                    style={{
                      fontWeight: 400,
                      lineHeight: '150%',
                      letterSpacing: '0%',
                      verticalAlign: 'middle',
                      color: 'rgba(255, 255, 255, 1)'
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutEx;

