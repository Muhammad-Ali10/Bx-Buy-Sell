import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
    Loading...
  </div>
);

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BuyerSignup = lazy(() => import("./pages/BuyerSignup"));
const SellerSignup = lazy(() => import("./pages/SellerSignup"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyListings = lazy(() => import("./pages/MyListings"));
const Favourites = lazy(() => import("./pages/Favourites"));
const Chat = lazy(() => import("./pages/Chat"));
const VerifyAccount = lazy(() => import("./pages/VerifyAccount"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const PhoneVerification = lazy(() => import("./pages/PhoneVerification"));
const VerifyOTP = lazy(() => import("./pages/VerifyOTP"));
const Register = lazy(() => import("./pages/Register"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Pricing = lazy(() => import("./pages/Pricing"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CheckoutCancel = lazy(() => import("./pages/CheckoutCancel"));
const ManualSync = lazy(() => import("./pages/ManualSync"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminForgotPassword = lazy(() => import("./pages/admin/AdminForgotPassword"));
const AdminVerifyOTP = lazy(() => import("./pages/admin/AdminVerifyOTP"));
const AdminResetPassword = lazy(() => import("./pages/admin/AdminResetPassword"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminTeamMembers = lazy(() => import("./pages/admin/AdminTeamMembers"));
const AdminMemberDetails = lazy(() => import("./pages/admin/AdminMemberDetails"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminUserDetails = lazy(() => import("./pages/admin/AdminUserDetails"));
const AdminUserListings = lazy(() => import("./pages/admin/AdminUserListings"));
const AdminUserFavorites = lazy(() => import("./pages/admin/AdminUserFavorites"));
const AdminUserChats = lazy(() => import("./pages/admin/AdminUserChats"));
const AdminListings = lazy(() => import("./pages/admin/AdminListings"));
const AdminListingDetails = lazy(() => import("./pages/admin/AdminListingDetails"));
const AdminChats = lazy(() => import("./pages/admin/AdminChats"));
const AdminMonitoringAlerts = lazy(() => import("./pages/admin/AdminMonitoringAlerts"));
const AdminDetectWords = lazy(() => import("./pages/admin/AdminDetectWords"));
const AdminChatList = lazy(() => import("./pages/admin/AdminChatList"));
const AdminChatAnalytics = lazy(() => import("./pages/admin/AdminChatAnalytics"));
const AdminContentManagement = lazy(() => import("./pages/admin/AdminContentManagement"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AllListings = lazy(() => import("./pages/AllListings"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const HowToBuy = lazy(() => import("./pages/HowToBuy"));
const HowToSell = lazy(() => import("./pages/HowToSell"));
const router = createBrowserRouter(
  [
    { path: "/", element: <Index /> },
    { path: "/all-listings", element: <AllListings /> },
    { path: "/listing/:id", element: <ListingDetail /> },
    { path: "/listing/:id/edit", element: <Dashboard /> },
    { path: "/how-to-buy", element: <HowToBuy /> },
    { path: "/how-to-sell", element: <HowToSell /> },
    { path: "/buyer-signup", element: <BuyerSignup /> },
    { path: "/seller-signup", element: <SellerSignup /> },
    { path: "/login", element: <Login /> },
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/dashboard/edit/:id", element: <Dashboard /> },
    { path: "/my-listings", element: <MyListings /> },
    { path: "/favourites", element: <Favourites /> },
    { path: "/chat", element: <Chat /> },
    { path: "/verify-account", element: <VerifyAccount /> },
    { path: "/profile", element: <Profile /> },
    { path: "/settings", element: <Settings /> },
    { path: "/pricing", element: <Pricing /> },
    { path: "/checkout/success", element: <CheckoutSuccess /> },
    { path: "/checkout/cancel", element: <CheckoutCancel /> },
    { path: "/manual-sync", element: <ManualSync /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/phone-verification", element: <PhoneVerification /> },
    { path: "/verify-otp", element: <VerifyOTP /> },
    { path: "/register", element: <Register /> },
    { path: "/admin/login", element: <AdminLogin /> },
    { path: "/admin/forgot-password", element: <AdminForgotPassword /> },
    { path: "/admin/verify-otp", element: <AdminVerifyOTP /> },
    { path: "/admin/reset-password", element: <AdminResetPassword /> },
    {
      path: "/admin/dashboard",
      element: (
        <AdminProtectedRoute allowedRoles={["ADMIN"]}>
          <AdminDashboard />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/team",
      element: (
        <AdminProtectedRoute>
          <AdminTeamMembers />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/team/:id",
      element: (
        <AdminProtectedRoute>
          <AdminMemberDetails />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/users",
      element: (
        <AdminProtectedRoute>
          <AdminUsers />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/users/:id",
      element: (
        <AdminProtectedRoute>
          <AdminUserDetails />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/users/:id/listings",
      element: (
        <AdminProtectedRoute>
          <AdminUserListings />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/users/:id/favorites",
      element: (
        <AdminProtectedRoute>
          <AdminUserFavorites />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/users/:id/chats",
      element: (
        <AdminProtectedRoute>
          <AdminUserChats />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/listings",
      element: (
        <AdminProtectedRoute>
          <AdminListings />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/listings/:id",
      element: (
        <AdminProtectedRoute>
          <AdminListingDetails />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/chats",
      element: (
        <AdminProtectedRoute>
          <AdminChats />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/chat-list",
      element: (
        <AdminProtectedRoute>
          <AdminChatList />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/chat-analytics",
      element: (
        <AdminProtectedRoute>
          <AdminChatAnalytics />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/monitoring-alerts",
      element: (
        <AdminProtectedRoute>
          <AdminMonitoringAlerts />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/detect-words",
      element: (
        <AdminProtectedRoute>
          <AdminDetectWords />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/content/*",
      element: (
        <AdminProtectedRoute>
          <AdminContentManagement />
        </AdminProtectedRoute>
      ),
    },
    {
      path: "/admin/settings",
      element: (
        <AdminProtectedRoute>
          <AdminSettings />
        </AdminProtectedRoute>
      ),
    },
    { path: "*", element: <NotFound /> },
  ],
  {
    future: { v7_startTransition: true, v7_relativeSplatPath: true },
  },
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <Suspense fallback={<PageLoader />}>
      <RouterProvider
        router={router}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      />
    </Suspense>
  </QueryClientProvider>
);

export default App;
