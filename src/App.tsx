import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import BarbersPage from "@/pages/BarbersPage";
import BarberDetailPage from "@/pages/BarberDetailPage";
import MyBookingsPage from "@/pages/MyBookingsPage";
import BookingSuccessPage from "@/pages/BookingSuccessPage";
import ShopPage from "@/pages/ShopPage";
import ShopBookingsPage from "@/pages/ShopBookingsPage";
import ShopOrdersPage from "@/pages/ShopOrdersPage";
import NotFoundPage from "@/pages/NotFoundPage";

const signedIn = (page: ReactNode) => <ProtectedRoute>{page}</ProtectedRoute>;

// Public: /, /login, /barbers (browse), /barbers/:id (detail + Book dialog).
// Signed in: /bookings (customer's own), /bookings/success (post-Stripe poll), /shop (onboarding),
// /shop/bookings (services & schedule), /shop/orders (incoming bookings for the shop's barbers).
// Role (profiles.role) decides where a user lands; /auth is kept as a redirect for old links.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/barbers" element={<BarbersPage />} />
      <Route path="/barbers/:id" element={<BarberDetailPage />} />
      <Route path="/bookings" element={signedIn(<MyBookingsPage />)} />
      <Route path="/bookings/success" element={signedIn(<BookingSuccessPage />)} />
      <Route path="/shop" element={signedIn(<ShopPage />)} />
      <Route path="/shop/bookings" element={signedIn(<ShopBookingsPage />)} />
      <Route path="/shop/orders" element={signedIn(<ShopOrdersPage />)} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
