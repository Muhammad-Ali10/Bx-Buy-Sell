import * as SVG from "@/svg";

export const LISTING_NAV_PATH = [
  { path: "/", label: "Home" },
  { path: "/listings", label: "Listings" },
  { path: "/how-to-buy", label: "How to Buy" },
  { path: "/how-to-sell", label: "How to Sell" },
];

export const USER_SIDEBAR_NAV = [
  { icon: SVG.MenuSVG, path: "listings", label: "My Listings" },
  { icon: SVG.HeartSVG, path: "favourites", label: "Favourites" },
  { icon: SVG.ChatSVG, path: "chats", label: "Chats" },
  { icon: SVG.GearSVG, path: "account-details", label: "Account Details" },
  { icon: SVG.VerifyUserSVG, path: "verify-account", label: "Verify Your Account" },
];
