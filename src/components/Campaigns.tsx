// src/components/Campaigns.tsx
// Campaign management with Airtable backend

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Plus, TrendingUp, Eye, MessageSquare, RefreshCw, Play, Pause } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  replied: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const Campaigns = ({ user }: { user: User }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form state
  const [newCampaignName, setNewCampaignName] = useState("");

  useEffect(() => {
    loadCampaigns();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadCampaigns, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadCampaigns = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);

      const response = await fetch('/.netlify/functions/getCampaigns');
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }

      const data = await response.json();
      setCampaigns(data.campaigns || []);

      if (showToast) {
        toast.success("Campaigns refreshed");
      }
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCampaigns(true);
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCampaignName.trim()) {
      toast.error("Campaign name is required");
      return;
    }

    setAdding(true);

    try {
      const response = await fetch('/.netlify/functions/addCampaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCampaignName })
      });

      if (!response.ok) {
        throw new Error('Failed to create campaign');
      }

      const data = await response.json();
      
      toast.success("Campaign created successfully");
      
      // Reset form
      setNewCampaignName("");
      
      // Reload campaigns
      loadCampaigns();

    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Failed to create campaign");
    } finally {
      setAdding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "running":
        return <Badge className="bg-green-500 text-white">Running</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500 text-white">Paused</Badge>;
      case "completed":
        return <Badge className="bg-blue-500 text-white">Completed</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOpenRate = (sent: number, opened: number) => {
    if (sent === 0) return "0";
    return ((opened / sent) * 100).toFixed(1);
  };

  const getReplyRate = (sent: number, replied: number) => {
    if (sent === 0) return "0";
    return ((replied / sent) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Mail className="w-8 h-8 animate-pulse text-blue-500 mx-auto mb-2" />
          <p className="text-slate-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Campaigns</h2>
          <p className="text-slate-600 mt-1">Manage your email campaigns</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Create New Campaign Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Create New Campaign
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCampaign} className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                placeholder="Campaign Name"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? 'Creating...' : 'Create Campaign'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            All Campaigns
          </CardTitle>
          <CardDescription>
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No campaigns yet. Create your first campaign above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">NAME</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">SENT</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">OPENED</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">REPLIED</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-medium text-sm">{campaign.name}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold">{campaign.sent}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-green-500" />
                          <span className="font-semibold">{campaign.opened}</span>
                          <span className="text-xs text-slate-500">
                            ({getOpenRate(campaign.sent, campaign.opened)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-500" />
                          <span className="font-semibold">{campaign.replied}</span>
                          <span className="text-xs text-slate-500">
                            ({getReplyRate(campaign.sent, campaign.replied)}%)
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(campaign.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Stats Summary */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Mail className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.sent, 0)}
                </p>
                <p className="text-xs text-slate-600">Total Sent</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Eye className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.opened, 0)}
                </p>
                <p className="text-xs text-slate-600">Total Opened</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <MessageSquare className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">
                  {campaigns.reduce((sum, c) => sum + c.replied, 0)}
                </p>
                <p className="text-xs text-slate-600">Total Replied</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">
                  {campaigns.filter(c => c.status === 'running').length}
                </p>
                <p className="text-xs text-slate-600">Active Campaigns</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Campaigns;