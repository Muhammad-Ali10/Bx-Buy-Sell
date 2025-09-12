import HeroSection from "@/components/home/HeroSection";
import ServiceSection from "@/components/home/ServiceSection";
import EXWorksSection from "@/components/home/EXWorksSection";
import Mobileapp from "@/components/home/Mobileap";
import SecurePayments from "@/components/home/secure-payments";
import LiveChatAndVideo from "@/components/home/live-chat";
import EXDashboard from "@/components/home/ex-dashboard";
import EXMobileApp from "@/components/home/ex-mobile-app";
import { ImageSlider } from "@/components/custom/ImageSlider";
import EXFooter from "@/components/shared/footer";
// import from ""
import React from "react";

const Page  = () => {
  return (
    <>
      <HeroSection />
      <ImageSlider />
      <ServiceSection />
      <EXWorksSection />
      <Mobileapp />
      <SecurePayments />
      <LiveChatAndVideo />
      <EXDashboard />
      <EXMobileApp />
      <EXFooter />
    </>
  );
};

export default Page;
