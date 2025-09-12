"use client";

import { Sora, Outfit, ABeeZee, Merriweather_Sans } from "next/font/google";
import "./globals.css";
import "swiper/css";
import { Toaster } from "@/components/ui/sonner";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const abeezee = ABeeZee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-abeezee",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["100","200","300","400","500","600","700","800","900"],
  variable: "--font-outfit",
  display: "swap",
});

const merriweatherSans = Merriweather_Sans({
  subsets: ["latin"],
  weight: ["300","400","500","600","700","800"],
  variable: "--font-merriweather-sans",
  display: "swap",
});

export default function RootLayout({ children }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html
      lang="en"
      className={`${sora.variable} ${outfit.variable} ${abeezee.variable} ${merriweatherSans.variable}`}
    >
      <body>
        <Toaster richColors position="top-right" />
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
