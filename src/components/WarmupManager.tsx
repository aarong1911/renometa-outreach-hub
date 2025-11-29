// src/components/WarmupManager.tsx
import { useState, useEffect } from "react";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, limit } from "firebase/firestore";
import { User } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Radio, Mail, TrendingUp, AlertCircle, CheckCircle2, Calendar, Activity } from "lucide-react";

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  type: string;
  status: "active" | "paused";
  createdAt: any;
  // Calculated fields
  warmupEnabled?: boolean;
  currentDailyLimit?: number;
  warmupStage?: number;
}

interface EmailReply {
  id: string;
  fromAccount: string;
  toAccount: string;
  originalSubject: string;
  replySubject: string;
  status: string;
  timestamp: string;
  delayMinutes: number;
}

const WarmupManager = ({ user, appId }: { user: User; appId: string }) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("accounts");

  // New account form state
  const [newEmail, setNewEmail] = useState("");
  const [newProvider, setNewProvider] = useState<"gmail" | "zoho">("zoho");

  useEffect(() => {
    loadWarmupData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(loadWarmupData, 300000);
    return () => clearInterval(interval);
  }, []);

  const loadWarmupData = async () => {
    try {
      const db = getFirestore();

      // Load warmup accounts from root collection
      const accountsSnapshot = await getDocs(
        query(
          collection(db, 'warmup_accounts'),
          orderBy('createdAt', 'desc')
        )
      );
      
      const accountsData = accountsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        warmupEnabled: doc.data().status === 'active',
        currentDailyLimit: 10, // You can calculate this based on createdAt
        warmupStage: calculateWarmupStage(doc.data().createdAt)
      })) as EmailAccount[];
      
      setAccounts(accountsData);

      // Load email replies from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const repliesSnapshot = await getDocs(
        query(
          collection(db, 'email_replies'),
          orderBy('timestamp', 'desc'),
          limit(100)
        )
      );
      
      const repliesData = repliesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmailReply[];
      
      setReplies(repliesData);

    } catch (error) {
      console.error("Error loading warmup data:", error);
      toast.error("Failed to load warmup data");
    } finally {
      setLoading(false);
    }
  };

  const calculateWarmupStage = (createdAt: any): number => {
    if (!createdAt) return 1;
    
    const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const daysSinceCreation = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    
    // Stage calculation based on warmup progression
    if (daysSinceCreation < 10) return 1;
    if (daysSinceCreation < 20) return 2;
    if (daysSinceCreation < 30) return 3;
    if (daysSinceCreation < 40) return 4;
    return 5;
  };

  const addEmailAccount = async () => {
    if (!newEmail) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      const db = getFirestore();

      const newAccount = {
        email: newEmail,
        provider: newProvider === "gmail" ? "google" : "zoho",
        type: newProvider,
        status: "active",
        createdAt: new Date()
      };

      await addDoc(collection(db, 'warmup_accounts'), newAccount);
      
      setNewEmail("");
      
      toast.success("Email account added successfully. Make.com will start warming it up on the next run.");
      loadWarmupData();
    } catch (error) {
      console.error("Error adding account:", error);
      toast.error("Failed to add email account");
    }
  };

  const toggleWarmup = async (accountId: string, currentStatus: boolean) => {
    try {
      const db = getFirestore();
      
      await updateDoc(doc(db, 'warmup_accounts', accountId), {
        status: currentStatus ? "paused" : "active"
      });
      
      toast.success(`Warmup ${currentStatus ? "paused" : "enabled"}`);
      loadWarmupData();
    } catch (error) {
      console.error("Error toggling warmup:", error);
      toast.error("Failed to update warmup status");
    }
  };

  const getAccountMetrics = (accountEmail: string) => {
    const accountReplies = replies.filter(r => r.fromAccount === accountEmail);
    
    if (accountReplies.length === 0) return null;

    const totalSent = accountReplies.length;
    const successfulReplies = accountReplies.filter(r => r.status === 'replied').length;
    const avgReplyRate = (successfulReplies / totalSent) * 100;

    return {
      totalSent,
      totalReplied: successfulReplies,
      avgReplyRate: avgReplyRate.toFixed(1)
    };
  };

  const getWarmupProgress = (account: EmailAccount) => {
    const stage = account.warmupStage || 1;
    return (stage / 5) * 100;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getRecentActivity = () => {
    return replies.slice(0, 10);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Radio className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-slate-600">Loading warmup data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Email Warmup Network</h2>
          <p className="text-slate-600 mt-1">Gradually increase sending reputation and volume</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="text-lg">
            <Radio className="w-4 h-4 mr-2" />
            {accounts.filter(a => a.status === 'active').length} Active
          </Badge>
          <Badge variant="outline" className="text-lg">
            <Activity className="w-4 h-4 mr-2" />
            {replies.length} Total Replies
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="add">Add Account</TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No email accounts yet</h3>
                  <p className="text-slate-600 mb-4">Add your first email account to start warming up</p>
                  <Button onClick={() => setActiveTab("add")}>Add Email Account</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((account) => {
                const metrics = getAccountMetrics(account.email);
                const progress = getWarmupProgress(account);

                return (
                  <Card key={account.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{account.email}</CardTitle>
                          <CardDescription>
                            <Badge variant="secondary" className="capitalize">
                              {account.provider}
                            </Badge>
                          </CardDescription>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(account.status)}`} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Warmup Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Warmup Progress</span>
                          <span className="text-sm text-slate-600">
                            Stage {account.warmupStage || 1} of 5
                          </span>
                        </div>
                        <Progress value={progress} />
                        <p className="text-xs text-slate-500 mt-1">
                          {progress < 100 ? 'Warming up...' : 'Fully warmed up'}
                        </p>
                      </div>

                      {/* Metrics */}
                      {metrics && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                          <div>
                            <p className="text-xs text-slate-500">Total Sent</p>
                            <p className="text-lg font-bold">{metrics.totalSent}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Reply Rate</p>
                            <p className="text-lg font-bold">{metrics.avgReplyRate}%</p>
                          </div>
                        </div>
                      )}

                      {/* Controls */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <Label htmlFor={`warmup-${account.id}`} className="text-sm">
                          Warmup Enabled
                        </Label>
                        <Switch
                          id={`warmup-${account.id}`}
                          checked={account.status === 'active'}
                          onCheckedChange={() => toggleWarmup(account.id, account.status === 'active')}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Warmup Activity</CardTitle>
              <CardDescription>Last 10 automated replies sent</CardDescription>
            </CardHeader>
            <CardContent>
              {replies.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No activity yet. Waiting for Make.com automation to run...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getRecentActivity().map((reply) => (
                    <div key={reply.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <p className="font-medium text-sm">{reply.fromAccount}</p>
                          <span className="text-slate-400">→</span>
                          <p className="text-sm text-slate-600">{reply.toAccount}</p>
                        </div>
                        <p className="text-xs text-slate-500 ml-6">
                          {reply.replySubject}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <Badge variant={reply.status === 'replied' ? 'default' : 'secondary'}>
                          {reply.status}
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(reply.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics">
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>All-time warmup statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Mail className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{replies.length}</p>
                      <p className="text-sm text-slate-600">Total Replies Sent</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">
                        {replies.filter(r => r.status === 'replied').length}
                      </p>
                      <p className="text-sm text-slate-600">Successful</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{accounts.length}</p>
                      <p className="text-sm text-slate-600">Active Accounts</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Per-Account Breakdown */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-slate-700 mb-2">Account Performance</h3>
                {accounts.map(account => {
                  const metrics = getAccountMetrics(account.email);
                  if (!metrics) return null;

                  return (
                    <div key={account.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{account.email}</p>
                        <p className="text-xs text-slate-500 capitalize">{account.provider}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{metrics.totalSent} sent</p>
                        <p className="text-xs text-slate-500">{metrics.avgReplyRate}% reply rate</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Account Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add Email Account</CardTitle>
              <CardDescription>Add a new email to your warmup network</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="jason@domain.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="provider">Provider</Label>
                  <select
                    id="provider"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value as "gmail" | "zoho")}
                  >
                    <option value="gmail">Gmail</option>
                    <option value="zoho">Zoho</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Next Steps After Adding:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Configure IMAP/SMTP settings in Make.com automation</li>
                      <li>Ensure SPF and DKIM records are properly set up</li>
                      <li>Make.com will automatically start warmup on next scheduled run</li>
                      <li>Monitor the Recent Activity tab for first replies</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Button onClick={addEmailAccount} className="w-full" size="lg">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Add to Warmup Network
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WarmupManager;