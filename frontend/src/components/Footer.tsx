import { Building2, Mail, Phone, MapPin, Facebook, Instagram, Linkedin, Send } from "lucide-react";
import logo from "@/assets/_App Icon 1 (2).png";
import { Button } from "./ui/button";

const Footer = () => {
  return (
    <footer className="bg-black text-white py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 mb-6 sm:mb-8">
          {/* Left Section - Logo & Description */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img 
                src={logo} 
                alt="EX Logo" 
                className="h-10 w-10 object-contain"
              />
            </div>
            <p 
              className="font-lufga mb-4"
              style={{
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '160%',
                letterSpacing: '0%',
                color: 'rgba(255, 255, 255, 0.6)'
              }}
            >
              Buy, sell, and succeed effortlessly with EX — featuring secure transactions, fast processing, and exceptional customer support
            </p>
            {/* Payment Icons - placeholder for now */}
            <div className="flex gap-2 mt-4">
              {/* Payment icons would go here */}
            </div>
          </div>

          {/* Information Section */}
          <div className="lg:col-span-1">
            <h3 
              className="font-lufga mb-4 text-base sm:text-lg md:text-xl lg:text-[20px]"
              style={{
                fontWeight: 300,
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(255, 255, 255, 1)'
              }}
            >
              Information
            </h3>
            <ul className="space-y-2 text-white/70">
              <li><a href="#" className="hover:text-accent transition-colors">How EX PAY works</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">How to Stay Safe</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">How to Buy</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">How to Sell</a></li>
            </ul>
          </div>

          {/* Help & Support Section */}
          <div className="lg:col-span-1">
            <h3 
              className="font-lufga mb-4"
              style={{
                fontWeight: 300,
                fontSize: '20px',
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(255, 255, 255, 1)'
              }}
            >
              Help & Support
            </h3>
            <ul className="space-y-2 text-white/70">
              <li><a href="#" className="hover:text-accent transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Support</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Terms Conditions</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Privacy Policy</a></li>
            </ul>
          </div>

          {/* Newsletter Section */}
          <div className="lg:col-span-1">
            <h3 
              className="font-lufga mb-4"
              style={{
                fontWeight: 300,
                fontSize: '20px',
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(255, 255, 255, 1)'
              }}
            >
              Newsletter
            </h3>
            <p 
              className="mb-4"
              style={{
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            >
              Stay always in touch! Subscribe to our newsletter
            </p>
            <div className="flex flex-row gap-2 max-w-full">
              <input 
                type="email" 
                placeholder="Email Address" 
                className="flex-1 min-w-0 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:border-accent"
              />
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 flex items-center gap-2 rounded-lg px-4 py-2 whitespace-nowrap shrink-0">
                <span>Subscribe</span>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Get In Touch Section */}
          <div className="lg:col-span-1">
            <h3 
              className="font-lufga mb-4"
              style={{
                fontWeight: 300,
                fontSize: '20px',
                lineHeight: '140%',
                letterSpacing: '0%',
                color: 'rgba(255, 255, 255, 1)'
              }}
            >
              Get In Touch
            </h3>
            <p 
              className="mb-4"
              style={{
                color: 'rgba(255, 255, 255, 0.7)'
              }}
            >
              Stey up to Date with EX - market insights & more
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-accent transition-colors bg-transparent shrink-0">
                <Facebook className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-accent transition-colors bg-transparent shrink-0">
                <Instagram className="w-5 h-5 text-white" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-accent transition-colors bg-transparent shrink-0">
                <Linkedin className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8 text-center">
          <p 
            className="font-lufga"
            style={{
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: '150%',
              letterSpacing: '0%',
              color: 'rgba(255, 255, 255, 0.6)'
            }}
          >
            2026 Company Exchange™
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
