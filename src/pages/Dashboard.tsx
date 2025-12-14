// src/pages/Dashboard.tsx
import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Mail, Users, Megaphone, Radio, Loader2, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from '@/assets/logo.png';

// Import new components
import WarmupManager from '@/components/WarmupManager';
import Infrastructure from '@/components/Infrastructure';
import Leads from '@/components/Leads';
import Campaigns from '@/components/Campaigns';

type Tab = "dashboard" | "infrastructure" | "leads" | "campaigns" | "warmup";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  
  // Stats for dashboard overview
  const [dashboardStats, setDashboardStats] = useState({
    totalAccounts: 0,
    totalLeads: 0,
    activeCampaigns: 0,
    warmupAccounts: 0
  });

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        console.log('User UID:', currentUser.uid); // Log UID for debugging
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
        const [accountsRes, leadsRes, campaignsRes] = await Promise.all([
          fetch(`/.netlify/functions/getAccounts?userId=${user.uid}`),
          fetch(`/.netlify/functions/getLeads?userId=${user.uid}`),
          fetch(`/.netlify/functions/getCampaigns?userId=${user.uid}`)
        ]);

        const accountsData = await accountsRes.json();
        const leadsData = await leadsRes.json();
        const campaignsData = await campaignsRes.json();

        setDashboardStats({
          totalAccounts: accountsData.accounts?.length || 0,
          totalLeads: leadsData.leads?.length || 0,
          activeCampaigns: campaignsData.campaigns?.filter((c: any) => c.status === 'running').length || 0,
          warmupAccounts: accountsData.accounts?.filter((a: any) => a.warmupEnabled).length || 0
        });
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      }
    };

    loadDashboardStats();
    const interval = setInterval(loadDashboardStats, 300000); // Refresh every 5 minutes
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
    const menuItems = [
      { id: 'dashboard' as Tab, label: 'Dashboard', icon: LayoutDashboard },
      { id: 'infrastructure' as Tab, label: 'Infrastructure', icon: Mail },
      { id: 'leads' as Tab, label: 'Leads & Prospects', icon: Users },
      { id: 'campaigns' as Tab, label: 'Campaigns', icon: Megaphone },
      { id: 'warmup' as Tab, label: 'Warmup Network', icon: Radio },
    ];

    return (
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-slate-950 text-white flex flex-col h-screen transition-all duration-300`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="RenoMeta" className="w-8 h-8" />
              <div>
                <h1 className="text-xl font-bold text-[#d9ab57]">RenoMeta</h1>
                <p className="text-xs text-slate-400">Outreach Manager</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <img src={logo} alt="RenoMeta" className="w-8 h-8 mx-auto" />
          )}
        </div>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2 mx-2 mt-2 rounded-md hover:bg-slate-800 transition-colors flex items-center justify-center"
        >
          <ChevronRight className={`w-5 h-5 transition-transform ${!sidebarCollapsed ? 'rotate-180' : ''}`} />
        </button>
        <nav className="flex-1 p-2 mt-2">
          {menuItems.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-2 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#d9ab57] text-white'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
                title={sidebarCollapsed ? tab.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sm font-medium">{tab.label}</span>}
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
            {!sidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
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
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-500" />
                Email Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">{dashboardStats.totalAccounts}</div>
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
              <div className="text-4xl font-bold text-[#d9ab57]">{dashboardStats.totalLeads}</div>
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
              <div className="text-4xl font-bold text-[#d9ab57]">{dashboardStats.activeCampaigns}</div>
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
              <div className="text-4xl font-bold text-[#d9ab57]">{dashboardStats.warmupAccounts}</div>
              <p className="text-sm text-slate-600 mt-2">Accounts warming</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={() => setActiveTab('leads')} 
                variant="outline" 
                className="justify-start"
              >
                <Users className="w-4 h-4 mr-2" />
                Add New Lead
              </Button>
              <Button 
                onClick={() => setActiveTab('campaigns')} 
                variant="outline"
                className="justify-start"
              >
                <Megaphone className="w-4 h-4 mr-2" />
                Create Campaign
              </Button>
              <Button 
                onClick={() => setActiveTab('infrastructure')} 
                variant="outline"
                className="justify-start"
              >
                <Mail className="w-4 h-4 mr-2" />
                View Infrastructure
              </Button>
              <Button 
                onClick={() => setActiveTab('warmup')} 
                variant="outline"
                className="justify-start"
              >
                <Radio className="w-4 h-4 mr-2" />
                Check Warmup Status
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
        {activeTab === "dashboard" && <DashboardView />}
        {activeTab === "infrastructure" && user && <Infrastructure user={user} />}
        {activeTab === "leads" && user && <Leads user={user} />}
        {activeTab === "campaigns" && user && <Campaigns user={user} />}
        {activeTab === "warmup" && user && <WarmupManager user={user} />}
      </main>
    </div>
  );
};

export default Dashboard;