// src/components/Leads.tsx
// Leads & Prospects management with Airtable backend

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Mail, Building, Trash2, RefreshCw } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  source: string;
  createdAt: string;
  notes: string;
}

const Leads = ({ user }: { user: User }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form state
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    company: ""
  });

  useEffect(() => {
    loadLeads();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadLeads, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadLeads = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);

      const response = await fetch(`/.netlify/functions/getLeads?userId=${user.uid}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const data = await response.json();
      setLeads(data.leads || []);

      if (showToast) {
        toast.success("Leads refreshed");
      }
    } catch (error) {
      console.error("Error loading leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLeads(true);
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newLead.name || !newLead.email) {
      toast.error("Name and email are required");
      return;
    }

    setAdding(true);

    try {
      const response = await fetch('/.netlify/functions/addLead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLead,
          userId: user.uid
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add lead');
      }

      const data = await response.json();
      
      toast.success("Lead added successfully");
      
      // Reset form
      setNewLead({ name: "", email: "", company: "" });
      
      // Reload leads
      loadLeads();

    } catch (error) {
      console.error("Error adding lead:", error);
      toast.error("Failed to add lead");
    } finally {
      setAdding(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return "bg-blue-500";
      case "contacted":
        return "bg-yellow-500";
      case "qualified":
        return "bg-purple-500";
      case "converted":
        return "bg-green-500";
      case "lost":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Users className="w-8 h-8 animate-pulse text-blue-500 mx-auto mb-2" />
          <p className="text-slate-600">Loading leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Leads & Prospects</h2>
          <p className="text-slate-600 mt-1">Manage your leads and prospects</p>
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

      {/* Add New Lead Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddLead} className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Name"
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                required
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Company (optional)"
                value={newLead.company}
                onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
              />
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? 'Adding...' : 'Add Lead'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Leads
          </CardTitle>
          <CardDescription>
            {leads.length} lead{leads.length !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No leads yet. Add your first lead above!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">NAME</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">EMAIL</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">COMPANY</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">STATUS</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-medium text-sm">{lead.name}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="text-sm">{lead.email}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-400" />
                          <span className="text-sm">{lead.company || '-'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={`${getStatusColor(lead.status)} text-white capitalize`}>
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toast.info("Delete functionality coming soon")}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leads;