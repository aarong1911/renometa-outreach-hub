// src/pages/Dashboard.tsx
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, onSnapshot, addDoc, deleteDoc, doc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Mail, Users, Megaphone, Radio, Loader2, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import logo from '@/assets/logo.png';
import WarmupManager from '@/components/WarmupManager';

// Mock data for infrastructure
const MOCK_ACCOUNTS = [
  { id: 1, email: "outreach1@renometa.com", provider: "GSuite", spf: "OK", dkim: "OK", dailyUsage: 45, dailyLimit: 50 },
  { id: 2, email: "outreach2@renometa.com", provider: "Hostinger", spf: "OK", dkim: "OK", dailyUsage: 38, dailyLimit: 50 },
  { id: 3, email: "outreach3@renometa.com", provider: "GSuite", spf: "OK", dkim: "OK", dailyUsage: 42, dailyLimit: 50 },
  { id: 4, email: "outreach4@renometa.com", provider: "Hostinger", spf: "OK", dkim: "PENDING", dailyUsage: 12, dailyLimit: 50 },
];

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: 1, name: "Q4 Contractor Outreach", status: "Running", sent: 234, opened: 89, replied: 12 },
  { id: 2, name: "Homeowner Follow-ups", status: "Paused", sent: 156, opened: 67, replied: 8 },
  { id: 3, name: "Partnership Proposals", status: "Draft", sent: 0, opened: 0, replied: 0 },
];

type Tab = "dashboard" | "infrastructure" | "leads" | "campaigns" | "warmup";

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string;
  timestamp: any;
}

interface Campaign {
  id: number;
  name: string;
  status: "Running" | "Paused" | "Draft";
  sent: number;
  opened: number;
  replied: number;
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appId] = useState("renometa-outreach");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  
  // Firestore leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  
  // Mock state for other features
  const [accounts] = useState(MOCK_ACCOUNTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [newCampaignName, setNewCampaignName] = useState("");

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

  // Fetch Firestore leads in real-time
  useEffect(() => {
    if (!user || !appId) return;

    const leadsPath = `artifacts/${appId}/users/${user.uid}/leads`;
    const leadsCollection = collection(db, leadsPath);

    const unsubscribe = onSnapshot(
      leadsCollection,
      (snapshot) => {
        const fetchedLeads: Lead[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Lead[];
        setLeads(fetchedLeads);
      },
      (error) => {
        console.error("Error fetching leads:", error);
        toast.error("Failed to load leads");
      }
    );

    return () => unsubscribe();
  }, [user, appId]);

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

  const addLead = async () => {
    if (!user || !appId) {
      toast.error("Authentication required");
      return;
    }
    if (!newLeadName.trim() || !newLeadEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }

    try {
      const leadsPath = `artifacts/${appId}/users/${user.uid}/leads`;
      const leadsCollection = collection(db, leadsPath);
      
      await addDoc(leadsCollection, {
        name: newLeadName,
        email: newLeadEmail,
        company: newLeadCompany,
        timestamp: new Date(),
      });
      
      setNewLeadName("");
      setNewLeadEmail("");
      setNewLeadCompany("");
      toast.success("Lead added successfully");
    } catch (error) {
      console.error("Error adding lead:", error);
      toast.error("Failed to add lead");
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!user || !appId) return;

    try {
      const leadsPath = `artifacts/${appId}/users/${user.uid}/leads`;
      const leadDoc = doc(db, leadsPath, leadId);
      await deleteDoc(leadDoc);
      toast.success("Lead deleted");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  };

  const addCampaign = () => {
    if (!newCampaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    const newCampaign: Campaign = {
      id: campaigns.length + 1,
      name: newCampaignName,
      status: "Draft",
      sent: 0,
      opened: 0,
      replied: 0,
    };
    setCampaigns([...campaigns, newCampaign]);
    setNewCampaignName("");
    toast.success("Campaign created");
  };

  const toggleCampaignStatus = (id: number) => {
    setCampaigns(
      campaigns.map((c) =>
        c.id === id
          ? {
              ...c,
              status:
                c.status === "Running"
                  ? "Paused"
                  : c.status === "Paused"
                  ? "Draft"
                  : "Running",
            }
          : c
      )
    );
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
    const [warmupStats, setWarmupStats] = useState({
      activeAccounts: 0,
      totalReplies: 0,
      lastRunTime: null as Date | null
    });

    useEffect(() => {
      const loadWarmupStats = async () => {
        try {
          const accountsQuery = query(
            collection(db, 'warmup_accounts'),
            where('status', '==', 'active')
          );
          const accountsSnapshot = await getDocs(accountsQuery);
          
          const repliesSnapshot = await getDocs(collection(db, 'email_replies'));
          
          const lastReplyQuery = query(
            collection(db, 'email_replies'),
            orderBy('timestamp', 'desc'),
            limit(1)
          );
          const lastReplySnapshot = await getDocs(lastReplyQuery);
          const lastReply = lastReplySnapshot.docs[0]?.data();

          setWarmupStats({
            activeAccounts: accountsSnapshot.size,
            totalReplies: repliesSnapshot.size,
            lastRunTime: lastReply?.timestamp ? new Date(lastReply.timestamp) : null
          });
        } catch (error) {
          console.error('Error loading warmup stats:', error);
        }
      };

      loadWarmupStats();
      const interval = setInterval(loadWarmupStats, 300000);
      return () => clearInterval(interval);
    }, []);

    const fleetUtilization = Math.round(
      (accounts.reduce((sum, acc) => sum + acc.dailyUsage, 0) /
        accounts.reduce((sum, acc) => sum + acc.dailyLimit, 0)) *
        100
    );
    const runningCampaigns = campaigns.filter((c) => c.status === "Running").length;

    return (
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-6">Dashboard Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Fleet Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">{fleetUtilization}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Warmup Accounts</CardTitle>
              <CardDescription>Active email warmup</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">{warmupStats.activeAccounts}</div>
              {warmupStats.totalReplies > 0 && (
                <p className="text-sm text-slate-600 mt-2">
                  {warmupStats.totalReplies} total replies sent
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Running Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-[#d9ab57]">{runningCampaigns}</div>
            </CardContent>
          </Card>
        </div>
        
        {warmupStats.lastRunTime && (
          <Card className="mt-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-slate-700">
                    Warmup system active
                  </span>
                </div>
                <span className="text-sm text-slate-600">
                  Last run: {warmupStats.lastRunTime.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const InfrastructureView = () => (
    <div>
      <h2 className="text-3xl font-bold text-slate-800 mb-6">Email Infrastructure</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">DNS Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Daily Usage</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{account.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="secondary">{account.provider}</Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex gap-2">
                    <Badge variant={account.spf === "OK" ? "default" : "destructive"}>SPF: {account.spf}</Badge>
                    <Badge variant={account.dkim === "OK" ? "default" : "destructive"}>DKIM: {account.dkim}</Badge>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Progress value={(account.dailyUsage / account.dailyLimit) * 100} className="w-24" />
                    <span className="text-sm text-slate-600">
                      {account.dailyUsage}/{account.dailyLimit}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const LeadsView = () => (
    <div>
      <h2 className="text-3xl font-bold text-slate-800 mb-6">Leads & Prospects</h2>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add New Lead</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="lead-name" className="mb-1 block">Name</Label>
              <Input
                id="lead-name"
                placeholder="Name"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lead-email" className="mb-1 block">Email</Label>
              <Input
                id="lead-email"
                type="email"
                placeholder="Email"
                value={newLeadEmail}
                onChange={(e) => setNewLeadEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lead-company" className="mb-1 block">Company</Label>
              <Input
                id="lead-company"
                placeholder="Company (optional)"
                value={newLeadCompany}
                onChange={(e) => setNewLeadCompany(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addLead} className="w-full bg-blue-600 hover:bg-blue-700">
                Add Lead
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No leads yet. Add your first lead above!
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{lead.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{lead.company || "—"}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Button
                      onClick={() => deleteLead(lead.id)}
                      variant="destructive"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const CampaignsView = () => (
    <div>
      <h2 className="text-3xl font-bold text-slate-800 mb-6">Campaigns</h2>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="campaign-name" className="mb-1 block">Campaign Name</Label>
              <Input
                id="campaign-name"
                placeholder="Campaign Name"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={addCampaign} className="bg-blue-600 hover:bg-blue-700">
                Create Campaign
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Opened</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Replied</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{campaign.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{campaign.sent}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{campaign.opened}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{campaign.replied}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Button
                    onClick={() => toggleCampaignStatus(campaign.id)}
                    size="sm"
                    className={`${
                      campaign.status === "Running"
                        ? "bg-green-600 hover:bg-green-700"
                        : campaign.status === "Paused"
                        ? "bg-yellow-600 hover:bg-yellow-700"
                        : "bg-slate-600 hover:bg-slate-700"
                    }`}
                  >
                    {campaign.status}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

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
        {activeTab === "infrastructure" && <InfrastructureView />}
        {activeTab === "leads" && <LeadsView />}
        {activeTab === "campaigns" && <CampaignsView />}
        {activeTab === "warmup" && user && <WarmupManager user={user} appId={appId} />}
      </main>
    </div>
  );
};

export default Dashboard;