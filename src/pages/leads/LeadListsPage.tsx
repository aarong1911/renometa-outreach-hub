// src/pages/leads/LeadListsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { authedFetch } from "@/lib/api";
import { ListChecks, ArrowLeft, RefreshCw, Pencil, Copy, Trash2, Plus, Send } from "lucide-react";

type LeadList = {
  id: string;
  name: string;
  source?: string;
  createdAt?: string | null;
  leadCount: number;
};

type Campaign = {
  id: string;
  name: string;
  status?: string;
};

function sourceLabel(source?: string) {
  switch (source) {
    case "manual":
      return "Manual";
    case "csv-import":
      return "CSV";
    case "excel-import":
      return "Excel";
    case "gsheet-import":
      return "Google Sheets";
    default:
      return source || "-";
  }
}

export default function LeadListsPage({ user }: { user: User }) {
  const navigate = useNavigate();

  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  // rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string>("");
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // duplicate
  const [dupOpen, setDupOpen] = useState(false);
  const [dupId, setDupId] = useState<string>("");
  const [dupName, setDupName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  // delete
  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  // add to campaign
  const [addToCampaignOpen, setAddToCampaignOpen] = useState(false);
  const [addListId, setAddListId] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const loadLists = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const res = await authedFetch(user, "/.netlify/functions/getLeadLists");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLists(data.lists || []);
      if (showToast) toast.success("Lists refreshed");
    } catch (err) {
      console.error(err);
      if (showToast) toast.error("Failed to refresh lists");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRename = (l: LeadList) => {
    setRenameId(l.id);
    setRenameName(l.name);
    setRenameOpen(true);
  };

  const submitRename = async () => {
    const name = renameName.trim();
    if (!renameId) return;
    if (!name) return toast.error("Name is required");

    setRenaming(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/updateLeadList", {
        method: "POST",
        body: JSON.stringify({ listId: renameId, name }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("List renamed");
      setRenameOpen(false);
      await loadLists(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to rename list");
    } finally {
      setRenaming(false);
    }
  };

  const openDuplicate = (l: LeadList) => {
    setDupId(l.id);
    setDupName(`${l.name} (Copy)`);
    setDupOpen(true);
  };

  const submitDuplicate = async () => {
    const name = dupName.trim();
    if (!dupId) return;
    if (!name) return toast.error("Name is required");

    setDuplicating(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/duplicateLeadList", {
        method: "POST",
        body: JSON.stringify({ listId: dupId, newName: name }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("List duplicated");
      setDupOpen(false);
      await loadLists(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to duplicate list");
    } finally {
      setDuplicating(false);
    }
  };

  const openDelete = (l: LeadList) => {
    setDelId(l.id);
    setDelOpen(true);
  };

  const submitDelete = async () => {
    if (!delId) return;

    setDeleting(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/deleteLeadList", {
        method: "POST",
        body: JSON.stringify({ listId: delId, deleteLeads: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("List deleted");
      setDelOpen(false);
      await loadLists(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete list");
    } finally {
      setDeleting(false);
    }
  };

  const openAddToCampaign = async (l: LeadList) => {
    setAddListId(l.id);
    setCampaignId("");
    setAddToCampaignOpen(true);

    // Load campaigns once modal opens
    try {
      const res = await authedFetch(user, "/.netlify/functions/getCampaigns");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Expecting { campaigns: [...] }
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load campaigns");
    }
  };

  const submitAddToCampaign = async () => {
    if (!addListId) return;
    if (!campaignId) return toast.error("Select a campaign");

    setLinking(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/addListToCampaign", {
        method: "POST",
        body: JSON.stringify({ campaignId, listId: addListId }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data?.alreadyLinked) toast.info("This list is already connected to that campaign");
      else toast.success("List added to campaign");
      setAddToCampaignOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add list to campaign");
    } finally {
      setLinking(false);
    }
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) return toast.error("List name is required");

    setCreating(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/createLeadList", {
        method: "POST",
        body: JSON.stringify({ name, source: "manual" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("List created");
      setCreateOpen(false);
      setCreateName("");
      await loadLists(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to create list");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate("/leads")} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <ListChecks className="w-7 h-7" />
              Lead Lists
            </h2>
            <p className="text-slate-600 mt-1">Organize and reuse lists across campaigns</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New List
          </Button>

          <Button variant="outline" onClick={() => loadLists(true)} disabled={refreshing} className="flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Lists</CardTitle>
          <CardDescription>{lists.length} list{lists.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-slate-600">Loading lists...</div>
          ) : lists.length === 0 ? (
            <div className="py-12 text-center">
              <ListChecks className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-700 font-medium">No lists yet</p>
              <p className="text-slate-500 text-sm mt-1">Import leads or create a list to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">LIST</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">SOURCE</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">LEADS</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-800">{l.name}</div>
                        <div className="text-xs text-slate-500 mt-1">{l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}</div>
                      </td>

                      <td className="py-4 px-4">
                        <Badge variant="secondary" className="capitalize">
                          {sourceLabel(l.source)}
                        </Badge>
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-sm font-semibold text-slate-800">{l.leadCount ?? 0}</span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/leads?listId=${encodeURIComponent(l.id)}`)}
                          >
                            View Leads
                          </Button>

                          <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => openAddToCampaign(l)}>
                            <Send className="w-4 h-4" />
                            Add to Campaign
                          </Button>

                          <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => openRename(l)}>
                            <Pencil className="w-4 h-4" />
                            Rename
                          </Button>

                          <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => openDuplicate(l)}>
                            <Copy className="w-4 h-4" />
                            Duplicate
                          </Button>

                          <Button variant="destructive" size="sm" className="flex items-center gap-2" onClick={() => openDelete(l)}>
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription>Create an empty Lead List. You can add leads later or import leads into a new list.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>List Name</Label>
            <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Miami Roofers" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={submitCreate} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
            <DialogDescription>Update the list name. Campaign connections will remain intact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New Name</Label>
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={submitRename} disabled={renaming}>{renaming ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate List</DialogTitle>
            <DialogDescription>This will create a new list and copy all leads into it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New List Name</Label>
            <Input value={dupName} onChange={(e) => setDupName(e.target.value)} />
            <p className="text-xs text-slate-500">
              Copying from: <span className="font-medium">{listById.get(dupId)?.name || "List"}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupOpen(false)}>Cancel</Button>
            <Button onClick={submitDuplicate} disabled={duplicating}>{duplicating ? "Duplicating..." : "Duplicate"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete List</DialogTitle>
            <DialogDescription>
              This will delete the list and remove its leads (current behavior). You can change this later to “detach leads”.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-slate-700">
            Deleting: <span className="font-semibold">{listById.get(delId)?.name || "List"}</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={submitDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Campaign */}
      <Dialog open={addToCampaignOpen} onOpenChange={setAddToCampaignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add List to Campaign</DialogTitle>
            <DialogDescription>
              Connect this list to a campaign using the CampaignLeads join table.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Campaign</Label>
            <Select value={campaignId} onValueChange={(v) => setCampaignId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              List: <span className="font-medium">{listById.get(addListId)?.name || "List"}</span>
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToCampaignOpen(false)}>Cancel</Button>
            <Button onClick={submitAddToCampaign} disabled={linking || !campaignId}>
              {linking ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
