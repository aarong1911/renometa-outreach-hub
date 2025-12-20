// src/components/Campaigns.tsx
// Campaign management with integrated Campaign Builder

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  TrendingUp,
  Eye,
  MessageSquare,
  RefreshCw,
  Play,
  Pause,
  List,
  Settings,
} from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import CampaignBuilder from "./CampaignBuilder";

type CampaignStatus = "draft" | "running" | "paused" | "completed";

interface Campaign {
  id: string;
  name: string;
  userId: string;
  status: CampaignStatus | string;
  sent: number;
  opened: number;
  replied: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lists?: Array<{
    id: string;
    name: string;
    source: string;
  }>;
}

interface LeadList {
  id: string;
  name: string;
  source: string;
  leadCount: number;
  createdAt: string;
}

const normalizeStatus = (s: string): CampaignStatus => {
  const v = (s || "").toLowerCase();
  if (v === "running") return "running";
  if (v === "paused") return "paused";
  if (v === "completed") return "completed";
  return "draft";
};

const Campaigns = ({ user }: { user: User }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [newCampaignName, setNewCampaignName] = useState("");

  // For the "Add List to Campaign" dialog
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedListId, setSelectedListId] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);

  // Campaign Builder view
  const [builderCampaign, setBuilderCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    loadCampaigns();
    loadLeadLists();
    const interval = setInterval(() => loadCampaigns(false), 120000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const loadCampaigns = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);

      const res = await authedFetch(user, "/.netlify/functions/getCampaigns");
      if (!res.ok) throw new Error("Failed to fetch campaigns");

      const data = await res.json();
      const list: Campaign[] = (data.campaigns || []).map((c: Campaign) => ({
        ...c,
        status: normalizeStatus(c.status as string),
        sent: Number(c.sent || 0),
        opened: Number(c.opened || 0),
        replied: Number(c.replied || 0),
      }));

      // Load lists for each campaign
      for (const campaign of list) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const listsRes = await authedFetch(
            user,
            `/.netlify/functions/getCampaignLeadLists?campaignId=${campaign.id}`
          );
          if (listsRes.ok) {
            // eslint-disable-next-line no-await-in-loop
            const listsData = await listsRes.json();
            campaign.lists = listsData.lists || [];
          }
        } catch (err) {
          console.error(`Error loading lists for campaign ${campaign.id}:`, err);
        }
      }

      setCampaigns(list);
      if (showToast) toast.success("Campaigns refreshed");
    } catch (err) {
      console.error("Error loading campaigns:", err);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadLeadLists = async () => {
    try {
      const res = await authedFetch(user, "/.netlify/functions/getLeadLists");
      if (!res.ok) throw new Error("Failed to fetch lead lists");

      const data = await res.json();
      setLeadLists(data.lists || []);
    } catch (err) {
      console.error("Error loading lead lists:", err);
    }
  };

  const handleRefresh = () => loadCampaigns(true);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = newCampaignName.trim();
    if (!name) {
      toast.error("Campaign name is required");
      return;
    }

    setAdding(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/addCampaign", {
        method: "POST",
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to create campaign");
      }

      toast.success("Campaign created");
      setNewCampaignName("");
      await loadCampaigns(false);
    } catch (err) {
      console.error("Error creating campaign:", err);
      toast.error("Failed to create campaign");
    } finally {
      setAdding(false);
    }
  };

  const addListToCampaign = async () => {
    if (!selectedCampaign || !selectedListId) {
      toast.error("Please select a list");
      return;
    }

    setAddingList(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/addListToCampaign", {
        method: "POST",
        body: JSON.stringify({
          campaignId: selectedCampaign.id,
          listId: selectedListId,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      if (data.alreadyLinked) {
        toast.info("This list is already attached to this campaign");
      } else {
        toast.success("Lead list added to campaign");
      }

      setListDialogOpen(false);
      setSelectedListId("");
      await loadCampaigns(false);
    } catch (error) {
      console.error("Error adding list:", error);
      toast.error("Failed to add list to campaign");
    } finally {
      setAddingList(false);
    }
  };

  const updateCampaignStatus = async (campaign: Campaign, next: CampaignStatus) => {
    setUpdatingId(campaign.id);

    // Optimistic UI
    setCampaigns((prev) =>
      prev.map((c) => (c.id === campaign.id ? { ...c, status: next } : c))
    );

    try {
      const res = await authedFetch(user, "/.netlify/functions/updateCampaignStatus", {
        method: "POST",
        body: JSON.stringify({
          campaignId: campaign.id,
          status: next,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to update campaign status");
      }

      const data = await res.json();
      const updated: Campaign = {
        ...data.campaign,
        status: normalizeStatus(data.campaign.status),
        sent: Number(data.campaign.sent || 0),
        opened: Number(data.campaign.opened || 0),
        replied: Number(data.campaign.replied || 0),
      };

      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`Campaign ${next}`);
    } catch (err) {
      console.error("Update status error:", err);
      toast.error("Failed to update status");

      // Revert on error
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaign.id
            ? { ...c, status: normalizeStatus(campaign.status as string) }
            : c
        )
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (statusRaw: string) => {
    const status = normalizeStatus(statusRaw);
    switch (status) {
      case "running":
        return <Badge className="bg-green-500 text-white">Running</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500 text-white">Paused</Badge>;
      case "completed":
        return <Badge className="bg-blue-500 text-white">Completed</Badge>;
      case "draft":
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  const openRate = (sent: number, opened: number) =>
    sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0.0";

  const replyRate = (sent: number, replied: number) =>
    sent > 0 ? ((replied / sent) * 100).toFixed(1) : "0.0";

  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
    const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened || 0), 0);
    const totalReplied = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);
    const active = campaigns.filter((c) => normalizeStatus(c.status as string) === "running").length;
    return { totalSent, totalOpened, totalReplied, active };
  }, [campaigns]);

  // If viewing campaign builder, show that instead
  if (builderCampaign) {
    return (
      <CampaignBuilder
        user={user}
        campaignId={builderCampaign.id}
        campaignName={builderCampaign.name}
        onBack={() => {
          setBuilderCampaign(null);
          loadCampaigns(false);
        }}
      />
    );
  }

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
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Create */}
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
              {adding ? "Creating..." : "Create Campaign"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            All Campaigns
          </CardTitle>
          <CardDescription>
            {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total
          </CardDescription>
        </CardHeader>

        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">
                No campaigns yet. Create your first campaign above!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">
                      NAME
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">
                      SENT
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">
                      OPENED
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">
                      REPLIED
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">
                      STATUS
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {campaigns.map((campaign) => {
                    const status = normalizeStatus(campaign.status as string);
                    const isBusy = updatingId === campaign.id;

                    return (
                      <tr
                        key={campaign.id}
                        className="border-b hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <p className="font-medium text-sm">{campaign.name}</p>
                          <p className="text-xs text-slate-500">
                            {campaign.createdAt
                              ? new Date(campaign.createdAt).toLocaleDateString()
                              : "-"}
                          </p>
                          {campaign.lists && campaign.lists.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {campaign.lists.map((list) => (
                                <Badge
                                  key={list.id}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  📋 {list.name}
                                </Badge>
                              ))}
                            </div>
                          )}
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
                              ({openRate(campaign.sent, campaign.opened)}%)
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-purple-500" />
                            <span className="font-semibold">{campaign.replied}</span>
                            <span className="text-xs text-slate-500">
                              ({replyRate(campaign.sent, campaign.replied)}%)
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          {getStatusBadge(campaign.status as string)}
                        </td>

                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            {/* Build/Edit Campaign Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBuilderCampaign(campaign)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Build
                            </Button>

                            {/* Add List Dialog */}
                            <Dialog
                              open={listDialogOpen && selectedCampaign?.id === campaign.id}
                              onOpenChange={(open) => {
                                setListDialogOpen(open);
                                if (open) {
                                  setSelectedCampaign(campaign);
                                  setSelectedListId("");
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <List className="w-4 h-4 mr-1" />
                                  Add List
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Add Lead List to Campaign</DialogTitle>
                                  <DialogDescription>
                                    Select a lead list to add to "{campaign.name}"
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <Label>Select Lead List</Label>
                                    <Select
                                      value={selectedListId}
                                      onValueChange={setSelectedListId}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Choose a list..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {leadLists.map((list) => (
                                          <SelectItem key={list.id} value={list.id}>
                                            {list.name} ({list.leadCount} leads)
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      onClick={() => setListDialogOpen(false)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={addListToCampaign}
                                      disabled={!selectedListId || addingList}
                                      className="bg-[#d9ab57] hover:bg-[#c99a47]"
                                    >
                                      {addingList ? "Adding..." : "Add List"}
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Start/Pause Button */}
                            {status !== "running" ? (
                              <Button
                                size="sm"
                                disabled={isBusy}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                                onClick={() => updateCampaignStatus(campaign, "running")}
                              >
                                <Play className="w-4 h-4" />
                                Start
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                disabled={isBusy}
                                className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700"
                                onClick={() => updateCampaignStatus(campaign, "paused")}
                              >
                                <Pause className="w-4 h-4" />
                                Pause
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Mail className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalSent}</p>
                <p className="text-xs text-slate-600">Total Sent</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Eye className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalOpened}</p>
                <p className="text-xs text-slate-600">Total Opened</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <MessageSquare className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalReplied}</p>
                <p className="text-xs text-slate-600">Total Replied</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.active}</p>
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