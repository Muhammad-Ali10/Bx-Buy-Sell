import { ReactNode, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import authBackground from "@/assets/auth-background.png";
import logo from "@/assets/_App Icon 1 (2).png";

interface AuthLayoutProps {
  children: ReactNode;
  currentStep?: number;
  totalSteps?: number;
  variant?: "admin" | "user";
}

const testimonials = [
  {
    quote: "Find the perfect deal securely and effortlessly. Connect with the right buyers and sellers today—fast, safe, and seamless!",
    title: "Verified by Industry Experts",
    subtitle: "Trusted by users worldwide",
  },
  {
    quote: "The most trusted platform for business transactions. Our secure process ensures peace of mind at every step.",
    title: "Verified by Industry Experts",
    subtitle: "Trusted by users worldwide",
  },
  {
    quote: "Join thousands of successful buyers and sellers. Experience the future of business acquisitions today.",
    title: "Verified by Industry Experts",
    subtitle: "Trusted by users worldwide",
  },
];

export const AuthLayout = ({ children, currentStep = 1, totalSteps = 4, variant = "user" }: AuthLayoutProps) => {
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    if (variant === "user") {
      const timer = setInterval(() => {
        setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [variant]);

  const nextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setActiveTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  // Admin Layout: Static image on left, login form on right
  if (variant === "admin") {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row bg-[#19181F]">
        {/* Left Panel - Background Image (50% width) */}
        <div 
          className="hidden lg:flex w-1/2 relative overflow-hidden"
          style={{
            minHeight: '100vh',
          }}
        >
          {/* Background Image */}
          <div
            style={{
              position: 'absolute',
              top: '-7px',
              left: '0px',
              width: '100%',
              height: 'calc(100% + 14px)',
              borderTopLeftRadius: '70px',
              borderBottomLeftRadius: '70px',
              transform: 'rotate(180deg)',
              opacity: 1,
              overflow: 'hidden',
            }}
          >
            <img
              src="https://res.cloudinary.com/dtfwkgpcc/image/upload/v1767775635/8bfafd13cb6e8075ef2f3316b0dcea740276cc5f_1_1_1_1_1_1_cgpzyx.webp"
              alt="Background"
              decoding="async"
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'rotate(180deg)',
              }}
            />
          </div>
        </div>

        {/* Right Panel - Login Form (50% width) */}
        <div 
          className="flex-1 lg:w-1/2 flex flex-col p-8 lg:p-16 bg-white"
          style={{
            minHeight: '100vh',
          }}
        >
          <Link to="/" className="mb-8">
            <img 
              src={logo} 
              alt="EX Logo" 
              className="h-16 w-16 object-contain"
              decoding="async"
              sizes="64px"
            />
          </Link>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-[528px]">
              {children}
            </div>
          </div>

          {/* Progress Dots */}
          {totalSteps > 1 && (
            <div className="flex gap-2 justify-center mt-8">
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx + 1 === currentStep
                      ? "w-12 bg-primary"
                      : "w-2 bg-border"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // User Layout: Login form on left, carousel on right
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex flex-col p-8 lg:p-16 bg-background">
        <Link to="/" className="mb-8">
          <img 
            src={logo} 
            alt="EX Logo" 
            className="h-16 w-16 object-contain"
            decoding="async"
            sizes="64px"
          />
        </Link>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[460px]">
            {children}
          </div>
        </div>

        {/* Progress Dots */}
        {totalSteps > 1 && (
          <div className="flex gap-2 justify-center mt-8">
            {Array.from({ length: totalSteps }).map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx + 1 === currentStep
                    ? "w-12 bg-primary"
                    : "w-2 bg-border"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Panel - Background & Testimonial */}
      <div 
        className="hidden lg:flex flex-1 relative items-end p-16 bg-cover bg-center"
        style={{ backgroundImage: `url(${authBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        <div className="relative z-10 max-w-2xl">
          <div className="backdrop-blur-xl bg-background/10 rounded-3xl p-8 border border-white/20">
            <blockquote className="text-white text-2xl font-medium mb-8 leading-relaxed">
              "{testimonials[activeTestimonial].quote}"
            </blockquote>
            
            <div className="space-y-2">
              <h3 className="text-white text-xl font-semibold">
                {testimonials[activeTestimonial].title}
              </h3>
              <p className="text-white/80">
                {testimonials[activeTestimonial].subtitle}
              </p>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 fill-accent"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="flex gap-3 mt-6 justify-end">
            <button
              onClick={prevTestimonial}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={nextTestimonial}
              className="w-12 h-12 rounded-full bg-white backdrop-blur-sm flex items-center justify-center hover:bg-white/90 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
