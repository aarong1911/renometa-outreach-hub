import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from "firebase/firestore";
import { LayoutDashboard, Mail, Users, Megaphone, Network, Loader2, Plus, Trash2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

// Firebase global variables (normally injected by backend)
declare global {
  interface Window {
    __app_id?: string;
    __firebase_config?: any;
    __initial_auth_token?: string;
  }
}

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

interface WarmupAccount {
  id: number;
  email: string;
  provider: string;
  warmupEnabled: boolean;
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appId, setAppId] = useState<string>("");
  
  // Firestore leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadEmail, setNewLeadEmail] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  
  // Mock state for other features
  const [accounts] = useState(MOCK_ACCOUNTS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [warmupAccounts, setWarmupAccounts] = useState<WarmupAccount[]>(
    MOCK_ACCOUNTS.map(acc => ({ ...acc, warmupEnabled: true }))
  );

  // Initialize Firebase and authenticate
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const config = window.__firebase_config || {
          apiKey: "demo-key",
          authDomain: "demo.firebaseapp.com",
          projectId: "demo-project",
        };
        
        const app = initializeApp(config);
        const auth = getAuth(app);
        const currentAppId = window.__app_id || "demo-app";
        setAppId(currentAppId);

        // Try custom token first, fallback to anonymous
        const token = window.__initial_auth_token;
        if (token) {
          await signInWithCustomToken(auth, token);
        } else {
          await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      } catch (error) {
        console.error("Firebase initialization error:", error);
        setLoading(false);
        toast.error("Authentication failed - using demo mode");
      }
    };

    initFirebase();
  }, []);

  // Listen to Firestore leads in real-time
  useEffect(() => {
    if (!user) return;

    try {
      const db = getFirestore();
      const leadsPath = `artifacts/${appId}/users/${user.uid}/leads`;
      const leadsRef = collection(db, leadsPath);

      const unsubscribe = onSnapshot(leadsRef, (snapshot) => {
        const fetchedLeads: Lead[] = [];
        snapshot.forEach((doc) => {
          fetchedLeads.push({ id: doc.id, ...doc.data() } as Lead);
        });
        setLeads(fetchedLeads);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up Firestore listener:", error);
    }
  }, [user, appId]);

  // Add lead to Firestore
  const handleAddLead = async () => {
    if (!user || !newLeadName || !newLeadEmail) {
      toast.error("Please fill in name and email");
      return;
    }

    try {
      const db = getFirestore();
      const leadsPath = `artifacts/${appId}/users/${user.uid}/leads`;
      const leadsRef = collection(db, leadsPath);
      
      await addDoc(leadsRef, {
        name: newLeadName,
        email: newLeadEmail,
        company: newLeadCompany || "",
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

  // Delete lead from Firestore
  const handleDeleteLead = async (leadId: string) => {
    if (!user) return;

    try {
      const db = getFirestore();
      const leadsPath = `artifacts/${appId}/users/${user.uid}/leads`;
      const leadRef = doc(db, leadsPath, leadId);
      
      await deleteDoc(leadRef);
      toast.success("Lead deleted");
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  };

  // Add campaign (simulated)
  const handleAddCampaign = () => {
    if (!newCampaignName) {
      toast.error("Please enter campaign name");
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

  // Toggle campaign status
  const toggleCampaignStatus = (id: number) => {
    setCampaigns(campaigns.map(c => {
      if (c.id === id) {
        const newStatus = c.status === "Running" ? "Paused" : "Running";
        return { ...c, status: newStatus };
      }
      return c;
    }));
  };

  // Toggle warmup
  const toggleWarmup = (id: number) => {
    setWarmupAccounts(warmupAccounts.map(acc => {
      if (acc.id === id) {
        return { ...acc, warmupEnabled: !acc.warmupEnabled };
      }
      return acc;
    }));
    toast.success("Warmup status updated");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-dark text-sidebar-foreground flex flex-col">
        <div className="p-6 border-b border-sidebar-hover">
          <h1 className="text-xl font-bold">RenoMeta</h1>
          <p className="text-sm text-muted-foreground">Outreach Control</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "dashboard" ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-hover"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => setActiveTab("infrastructure")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "infrastructure" ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-hover"
            }`}
          >
            <Mail className="h-5 w-5" />
            <span>Infrastructure</span>
          </button>
          
          <button
            onClick={() => setActiveTab("leads")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "leads" ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-hover"
            }`}
          >
            <Users className="h-5 w-5" />
            <span>Leads & Prospects</span>
          </button>
          
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "campaigns" ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-hover"
            }`}
          >
            <Megaphone className="h-5 w-5" />
            <span>Campaigns</span>
          </button>
          
          <button
            onClick={() => setActiveTab("warmup")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === "warmup" ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-hover"
            }`}
          >
            <Network className="h-5 w-5" />
            <span>Warmup Network</span>
          </button>
        </nav>

        <div className="p-4 border-t border-sidebar-hover text-xs text-muted-foreground">
          <p>User: {user?.uid?.substring(0, 8)}...</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        {activeTab === "dashboard" && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Dashboard Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Fleet Utilization</CardTitle>
                  <CardDescription>Average daily usage across accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {Math.round((accounts.reduce((sum, acc) => sum + acc.dailyUsage, 0) / accounts.reduce((sum, acc) => sum + acc.dailyLimit, 0)) * 100)}%
                  </div>
                  <Progress value={Math.round((accounts.reduce((sum, acc) => sum + acc.dailyUsage, 0) / accounts.reduce((sum, acc) => sum + acc.dailyLimit, 0)) * 100)} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Warmup Accounts</CardTitle>
                  <CardDescription>Active warmup sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary">
                    {warmupAccounts.filter(a => a.warmupEnabled).length}/{warmupAccounts.length}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Accounts warming up</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Running Campaigns</CardTitle>
                  <CardDescription>Active outreach campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary">
                    {campaigns.filter(c => c.status === "Running").length}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Campaigns in progress</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.map(campaign => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Sent: {campaign.sent}</span>
                          <span>Opened: {campaign.opened}</span>
                          <span>Replied: {campaign.replied}</span>
                        </div>
                      </div>
                      <Badge variant={campaign.status === "Running" ? "default" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "infrastructure" && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Email Infrastructure</h2>
            
            <div className="space-y-4">
              {accounts.map(account => (
                <Card key={account.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Mail className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">{account.email}</h3>
                          <Badge variant="outline">{account.provider}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-muted-foreground">DNS Status</p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant={account.spf === "OK" ? "default" : "destructive"}>
                                SPF: {account.spf}
                              </Badge>
                              <Badge variant={account.dkim === "OK" ? "default" : "destructive"}>
                                DKIM: {account.dkim}
                              </Badge>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm text-muted-foreground">Daily Usage</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={(account.dailyUsage / account.dailyLimit) * 100} className="flex-1" />
                              <span className="text-sm font-medium">{account.dailyUsage}/{account.dailyLimit}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 p-4 bg-card rounded-lg border">
              <p className="text-sm text-muted-foreground">Debug Info:</p>
              <p className="text-xs font-mono">User ID: {user?.uid}</p>
              <p className="text-xs font-mono">App ID: {appId}</p>
            </div>
          </div>
        )}

        {activeTab === "leads" && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Leads & Prospects</h2>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Add New Lead</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Name"
                    value={newLeadName}
                    onChange={(e) => setNewLeadName(e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newLeadEmail}
                    onChange={(e) => setNewLeadEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Company (optional)"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                  />
                  <Button onClick={handleAddLead}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All Leads ({leads.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Name</th>
                        <th className="text-left p-3">Email</th>
                        <th className="text-left p-3">Company</th>
                        <th className="text-left p-3">Added</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center p-8 text-muted-foreground">
                            No leads yet. Add your first lead above.
                          </td>
                        </tr>
                      ) : (
                        leads.map(lead => (
                          <tr key={lead.id} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-medium">{lead.name}</td>
                            <td className="p-3">{lead.email}</td>
                            <td className="p-3">{lead.company || "-"}</td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {lead.timestamp?.toDate?.()?.toLocaleDateString() || "Recently"}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteLead(lead.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "campaigns" && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Campaign Management</h2>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Create New Campaign</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Campaign name"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                  />
                  <Button onClick={handleAddCampaign}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Campaign</th>
                        <th className="text-left p-3">Status</th>
                        <th className="text-left p-3">Sent</th>
                        <th className="text-left p-3">Opened</th>
                        <th className="text-left p-3">Replied</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map(campaign => (
                        <tr key={campaign.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{campaign.name}</td>
                          <td className="p-3">
                            <Badge variant={campaign.status === "Running" ? "default" : "secondary"}>
                              {campaign.status}
                            </Badge>
                          </td>
                          <td className="p-3">{campaign.sent}</td>
                          <td className="p-3">{campaign.opened}</td>
                          <td className="p-3">{campaign.replied}</td>
                          <td className="p-3">
                            <Button
                              variant={campaign.status === "Running" ? "outline" : "default"}
                              size="sm"
                              onClick={() => toggleCampaignStatus(campaign.id)}
                            >
                              {campaign.status === "Running" ? (
                                <><Pause className="h-4 w-4 mr-2" /> Pause</>
                              ) : (
                                <><Play className="h-4 w-4 mr-2" /> Start</>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "warmup" && (
          <div>
            <h2 className="text-3xl font-bold mb-6">Warmup Network</h2>
            
            <Card>
              <CardHeader>
                <CardTitle>Email Warmup Status</CardTitle>
                <CardDescription>
                  Gradually increase sending volume to build sender reputation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {warmupAccounts.map(account => (
                    <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{account.email}</p>
                          <p className="text-sm text-muted-foreground">{account.provider}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={account.warmupEnabled ? "default" : "secondary"}>
                          {account.warmupEnabled ? "Active" : "Inactive"}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleWarmup(account.id)}
                        >
                          {account.warmupEnabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
