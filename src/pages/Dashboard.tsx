// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useNavigate, Routes, Route, Navigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Mail,
  Users,
  Megaphone,
  Radio,
  Globe,
  Loader2,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { authedFetch } from "@/lib/authedFetch";

// App sections
import WarmupManager from "@/components/WarmupManager";
import Infrastructure from "@/components/Infrastructure";
import Leads from "@/components/Leads";
import Campaigns from "@/components/Campaigns";
import Domains from "@/components/Domains";
import LeadListsPage from "@/pages/leads/LeadListsPage";

type Tab =
  | "dashboard"
  | "infrastructure"
  | "domains"
  | "leads"
  | "campaigns"
  | "warmup";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Stats for dashboard overview
  const [dashboardStats, setDashboardStats] = useState({
    totalAccounts: 0,
    totalLeads: 0,
    activeCampaigns: 0,
    warmupAccounts: 0,
  });

  // infer active tab from route
  const activeTab: Tab = useMemo(() => {
    const p = location.pathname;

    if (p.startsWith("/campaigns")) return "campaigns";
    if (p.startsWith("/warmup")) return "warmup";
    if (p.startsWith("/domains")) return "domains";
    if (p.startsWith("/infrastructure")) return "infrastructure";
    if (p.startsWith("/leads")) return "leads";
    return "dashboard";
  }, [location.pathname]);

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Load dashboard stats
  useEffect(() => {
    if (!user) return;

    const loadDashboardStats = async () => {
      try {
        const [accountsRes, listsRes, campaignsRes] = await Promise.all([
          authedFetch(user, "/.netlify/functions/getAccounts"),
          authedFetch(user, "/.netlify/functions/getLeadLists"),
          authedFetch(user, "/.netlify/functions/getCampaigns"),
        ]);

        if (!accountsRes.ok || !listsRes.ok || !campaignsRes.ok) {
          throw new Error("Failed to fetch dashboard stats");
        }

        const accountsData = await accountsRes.json();
        const listsData = await listsRes.json();
        const campaignsData = await campaignsRes.json();

        const accounts = accountsData.accounts || [];
        const lists = listsData.lists || [];
        const campaigns = campaignsData.campaigns || [];

        const totalLeads = lists.reduce(
          (sum: number, l: any) => sum + (Number(l.leadCount) || 0),
          0
        );

        setDashboardStats({
          totalAccounts: accounts.length || 0,
          totalLeads,
          activeCampaigns:
            campaigns.filter(
              (c: any) => (c.status || "").toLowerCase() === "running"
            ).length || 0,
          warmupAccounts:
            accounts.filter((a: any) => !!a.warmupEnabled).length || 0,
        });
      } catch (error) {
        console.error("Error loading dashboard stats:", error);
      }
    };

    loadDashboardStats();
    const interval = setInterval(loadDashboardStats, 300000); // every 5 minutes
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast.success("Signed out successfully");
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  };

  const Sidebar = () => {
    const menuItems: Array<{ id: Tab; label: string; icon: any; path: string }> =
      [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { id: "infrastructure", label: "Infrastructure", icon: Mail, path: "/infrastructure" },
        { id: "domains", label: "Domains", icon: Globe, path: "/domains" },
        { id: "leads", label: "Leads & Prospects", icon: Users, path: "/leads/lists" }, // default to lists
        { id: "campaigns", label: "Campaigns", icon: Megaphone, path: "/campaigns" },
        { id: "warmup", label: "Warmup Network", icon: Radio, path: "/warmup" },
      ];

    return (
      <div
        className={`${
          sidebarCollapsed ? "w-16" : "w-64"
        } bg-slate-950 text-white flex flex-col h-screen transition-all duration-300`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <img src={logo} alt="RenoMeta" className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold text-[#d9ab57]">RenoMeta</h1>
                <p className="text-xs text-slate-400">Outreach Manager</p>
              </div>
            </div>
          ) : (
            <img src={logo} alt="RenoMeta" className="w-8 h-8 mx-auto" />
          )}
        </div>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 mx-2 mt-2 rounded-md hover:bg-slate-800 transition-colors flex items-center justify-center"
        >
          <ChevronRight
            className={`w-5 h-5 transition-transform ${
              !sidebarCollapsed ? "rotate-180" : ""
            }`}
          />
        </button>

        <nav className="flex-1 p-2 mt-2">
          {menuItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? "bg-[#d9ab57] text-white"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{tab.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-slate-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
            title={sidebarCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-sm font-medium">Sign Out</span>
            )}
          </button>

          {!sidebarCollapsed && user && (
            <div className="px-3 py-2 text-xs text-slate-400 truncate">
              {user.email}
            </div>
          )}
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    return (
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-6">
          Dashboard Overview
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Email Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">
                {dashboardStats.totalAccounts}
              </div>
              <p className="text-sm text-slate-600 mt-2">Total configured</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-500" />
                Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">
                {dashboardStats.totalLeads}
              </div>
              <p className="text-sm text-slate-600 mt-2">In pipeline</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-purple-500" />
                Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">
                {dashboardStats.activeCampaigns}
              </div>
              <p className="text-sm text-slate-600 mt-2">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-orange-500" />
                Warmup Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">
                {dashboardStats.warmupAccounts}
              </div>
              <p className="text-sm text-slate-600 mt-2">Accounts warming</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => navigate("/leads/lists")}
                variant="outline"
                className="justify-start"
              >
                <Users className="w-4 h-4 mr-2" />
                Add New Lead
              </Button>

              <Button
                onClick={() => navigate("/campaigns")}
                variant="outline"
                className="justify-start"
              >
                <Megaphone className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>

              <Button
                onClick={() => navigate("/infrastructure")}
                variant="outline"
                className="justify-start"
              >
                <Mail className="w-4 h-4 mr-2" />
                View Infrastructure
              </Button>

              <Button
                onClick={() => navigate("/warmup")}
                variant="outline"
                className="justify-start"
              >
                <Radio className="w-4 h-4 mr-2" />
                Check Warmup Status
              </Button>

              <Button
                onClick={() => navigate("/domains")}
                variant="outline"
                className="justify-start"
              >
                <Globe className="w-4 h-4 mr-2" />
                Manage Domains
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#d9ab57]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          {/* Default: go to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />


          <Route path="/dashboard" element={<DashboardView />} />

          <Route
            path="/infrastructure"
            element={user ? <Infrastructure user={user} /> : null}
          />

          <Route
            path="/domains"
            element={user ? <Domains user={user} /> : null}
          />

          {/* Leads pages */}
          <Route path="/leads" element={user ? <Leads user={user} /> : null} />
          <Route
            path="/leads/lists"
            element={user ? <LeadListsPage user={user} /> : null}
          />

          {/* Campaigns / warmup */}
          <Route
            path="/campaigns"
            element={user ? <Campaigns user={user} /> : null}
          />
          <Route
            path="/warmup"
            element={user ? <WarmupManager user={user} /> : null}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/leads/lists" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default Dashboard;
