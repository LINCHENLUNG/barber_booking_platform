import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import HomePage from "@/pages/HomePage";
import LoginPage from "@/pages/LoginPage";
import BarbersPage from "@/pages/BarbersPage";
import NotFoundPage from "@/pages/NotFoundPage";

// M0 routes: only /, /login and /barbers (spec). /auth is kept as a redirect for old links.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route
        path="/barbers"
        element={
          <ProtectedRoute>
            <BarbersPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
