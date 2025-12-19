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
import { Users, Plus, Mail, Building, Trash2, RefreshCw, Upload } from "lucide-react";
import LeadsImport from "./LeadsImport";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  rating: number;
  reviews: number;
  status: string;
  source: string;
  listId: string;
  createdAt: string;
  notes: string;
}

const Leads = ({ user }: { user: User }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Form state
  const [newLead, setNewLead] = useState({
    firstName: "",
    lastName: "",
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

    if (!newLead.firstName || !newLead.email) {
      toast.error("First name and email are required");
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
      setNewLead({ firstName: "", lastName: "", email: "", company: "" });
      
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

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "manual":
        return "Manual";
      case "csv-import":
        return "CSV";
      case "excel-import":
        return "Excel";
      case "gsheet-import":
        return "Google Sheets";
      case "api":
        return "API";
      default:
        return source;
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
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowImportWizard(true)}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </Button>
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
      </div>

      {/* Import Wizard Modal */}
      {showImportWizard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Import Leads</h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowImportWizard(false)}
              >
                ×
              </Button>
            </div>
            <div className="p-6">
              <LeadsImport 
                user={user}
                onComplete={() => {
                  setShowImportWizard(false);
                  loadLeads();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add New Lead Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add New Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddLead} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="First Name"
                value={newLead.firstName}
                onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Last Name"
                value={newLead.lastName}
                onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })}
              />
            </div>
            <div>
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
            <div>
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
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">PHONE</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">TYPE</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">STATUS</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-medium text-sm">
                          {lead.firstName} {lead.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {lead.rating > 0 && (
                            <span className="text-xs text-slate-500">
                              ⭐ {lead.rating} ({lead.reviews} reviews)
                            </span>
                          )}
                          <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                            {getSourceLabel(lead.source)}
                          </span>
                        </div>
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
                        <span className="text-sm">{lead.phone || '-'}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-slate-600 capitalize">{lead.type || '-'}</span>
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