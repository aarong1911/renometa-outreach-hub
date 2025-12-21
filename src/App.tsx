// src/App.tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Domains from "./components/Domains";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          {/* Public landing */}
          <Route path="/" element={<Index />} />

          {/* Protected standalone pages */}
          <Route
            path="/domains"
            element={
              <ProtectedRoute>
                {(user) => <Domains user={user} />}
              </ProtectedRoute>
            }
          />

          {/* Protected app routes (Dashboard owns nested routes like /leads/lists) */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {() => <Dashboard />}
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
