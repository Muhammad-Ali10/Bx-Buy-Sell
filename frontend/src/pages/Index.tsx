import Header from "@/components/Header";
import Hero from "@/components/Hero";
import BrandCarousel from "@/components/BrandCarousel";
import Listings from "@/components/Listings";
import HowItWorks from "@/components/HowItWorks";
import SecureSimpleSeamless from "@/components/SecureSimpleSeamless";
import Features from "@/components/Features";
import ExPay from "@/components/ExPay";
import LiveChatVideo from "@/components/LiveChatVideo";
import PlatformStats from "@/components/PlatformStats";
import Stats from "@/components/Stats";
import AboutEx from "@/components/AboutEx";
import Download from "@/components/Download";
import Footer from "@/components/Footer";
import { WelcomeDialog } from "@/components/WelcomeDialog";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api";
const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [userType, setUserType] = useState<string>("");
  const { user, isAuthenticated } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated && user) {
      checkIfNewUser(user.id);
    }
  }, [isAuthenticated, user]);
  
  const checkIfNewUser = async (userId: string) => {
    try {
      const response = await apiClient.getUserById(userId);
      if (response.success && response.data) {
        const userData = response.data;
        // Check if account was created recently (less than 1 minute ago)
        // Note: Backend might not have created_at, so we'll check if user just signed up
        // For now, we'll use a simpler check - if user has no profile_pic or other details
        const accountAge = userData.created_at 
          ? Date.now() - new Date(userData.created_at).getTime()
          : 0;
        const isNew = accountAge < 60000; // Less than 1 minute old
        setIsNewUser(isNew);
        setUserType(userData.role || "");
      }
    } catch (error) {
      console.error('Error checking if new user:', error);
    }
  };
  return <div className="min-h-screen">
      <Header />
      <Hero searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <BrandCarousel />
      <Listings searchQuery={searchQuery} />
      <HowItWorks />
      <SecureSimpleSeamless />
      <Features />
      <ExPay />
      <LiveChatVideo />
      <AboutEx />
      <PlatformStats />
      
      <Footer />
      <WelcomeDialog isNewUser={isNewUser} userType={userType} />
    </div>;
};
export default Index;