// src/components/Domains.tsx
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Globe,
  Plus,
  Mail,
  Server,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  Trash2,
  Settings,
} from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";

interface Domain {
  id: string;
  domain: string;
  subdomain?: string;
  fullDomain: string;
  type: "gmail" | "smtp" | "purchased";
  provider?: string;
  status: "active" | "pending" | "failed" | "verifying";
  dns: {
    spf: string;
    dkim: string;
    dmarc: string;
    mx: string;
  };
  accountsUsing: number;
  purchaseDate?: string;
  renewalDate?: string;
  monthlyPrice?: number;
  createdAt: string;
}

const Domains = ({ user }: { user: User }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  
  // Add Domain Form
  const [domainType, setDomainType] = useState<"gmail" | "smtp">("gmail");
  const [newDomain, setNewDomain] = useState("");
  const [useSubdomain, setUseSubdomain] = useState(true);
  const [customSubdomain, setCustomSubdomain] = useState("mail");
  
  // SMTP Configuration
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  
  // Purchase Form
  const [searchDomain, setSearchDomain] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadDomains();
    const interval = setInterval(() => loadDomains(false), 120000);
    return () => clearInterval(interval);
  }, []);

  const loadDomains = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);

      const res = await authedFetch(user, "/.netlify/functions/getDomains");
      if (!res.ok) throw new Error("Failed to fetch domains");

      const data = await res.json();
      setDomains(data.domains || []);

      if (showToast) toast.success("Domains refreshed");
    } catch (error) {
      console.error("Error loading domains:", error);
      toast.error("Failed to load domains");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => loadDomains(true);

  const addDomain = async () => {
    if (!newDomain.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    try {
      const fullDomain = useSubdomain 
        ? `${customSubdomain}.${newDomain}` 
        : newDomain;

      const res = await authedFetch(user, "/.netlify/functions/addDomain", {
        method: "POST",
        body: JSON.stringify({
          domain: newDomain,
          subdomain: useSubdomain ? customSubdomain : null,
          type: domainType,
          smtp: domainType === "smtp" ? {
            host: smtpHost,
            port: parseInt(smtpPort),
            username: smtpUsername,
            password: smtpPassword,
          } : null,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Domain added successfully");
      setAddDialogOpen(false);
      resetAddForm();
      await loadDomains(false);
    } catch (error) {
      console.error("Error adding domain:", error);
      toast.error("Failed to add domain");
    }
  };

  const resetAddForm = () => {
    setNewDomain("");
    setUseSubdomain(true);
    setCustomSubdomain("mail");
    setSmtpHost("");
    setSmtpPort("587");
    setSmtpUsername("");
    setSmtpPassword("");
  };

  const searchAvailableDomains = async () => {
    if (!searchDomain.trim()) {
      toast.error("Please enter a domain to search");
      return;
    }

    setSearching(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/searchDomains", {
        method: "POST",
        body: JSON.stringify({ query: searchDomain }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Error searching domains:", error);
      toast.error("Failed to search domains");
    } finally {
      setSearching(false);
    }
  };

  const purchaseDomain = (domain: string) => {
    // Redirect to Stripe checkout or payment page
    toast.info("Redirecting to checkout...");
    // TODO: Implement Stripe integration
    window.location.href = `/checkout?domain=${domain}`;
  };

  const deleteDomain = async (domainId: string, domainName: string) => {
    if (!confirm(`Delete domain "${domainName}"? This will affect any email accounts using this domain.`)) {
      return;
    }

    try {
      const res = await authedFetch(user, "/.netlify/functions/deleteDomain", {
        method: "POST",
        body: JSON.stringify({ domainId }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Domain deleted");
      await loadDomains(false);
    } catch (error) {
      console.error("Error deleting domain:", error);
      toast.error("Failed to delete domain");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getDNSStatusColor = (status: string) => {
    if (status === "verified" || status === "OK") return "text-green-600";
    if (status === "pending") return "text-yellow-600";
    return "text-red-600";
  };

  const getDNSStatusIcon = (status: string) => {
    if (status === "verified" || status === "OK") return <CheckCircle2 className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Globe className="w-8 h-8 animate-pulse text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Domains</h2>
          <p className="text-slate-600 mt-1">Manage your email sending domains</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Add Domain */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold mb-1">Add Domain</h3>
                  <p className="text-sm text-slate-600">Connect Gmail or SMTP domain</p>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Domain</DialogTitle>
              <DialogDescription>
                Connect your own domain for email sending
              </DialogDescription>
            </DialogHeader>

            <Tabs value={domainType} onValueChange={(v) => setDomainType(v as "gmail" | "smtp")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gmail">
                  <Mail className="w-4 h-4 mr-2" />
                  Gmail Workspace
                </TabsTrigger>
                <TabsTrigger value="smtp">
                  <Server className="w-4 h-4 mr-2" />
                  Custom SMTP
                </TabsTrigger>
              </TabsList>

              {/* Gmail Tab */}
              <TabsContent value="gmail" className="space-y-4">
                <div>
                  <Label>Domain Name</Label>
                  <Input
                    placeholder="yourdomain.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Your Google Workspace domain
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useSubdomain"
                    checked={useSubdomain}
                    onChange={(e) => setUseSubdomain(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useSubdomain">Use subdomain (recommended)</Label>
                </div>

                {useSubdomain && (
                  <div>
                    <Label>Subdomain</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="mail"
                        value={customSubdomain}
                        onChange={(e) => setCustomSubdomain(e.target.value)}
                        className="flex-1"
                      />
                      <span className="flex items-center text-slate-500">.{newDomain || "yourdomain.com"}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Full domain: {customSubdomain}.{newDomain || "yourdomain.com"}
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded">
                  <p className="text-sm text-blue-900">
                    <strong>Why use a subdomain?</strong><br />
                    Using a subdomain (like mail.yourdomain.com) protects your main domain's reputation. 
                    If there are any deliverability issues, only the subdomain is affected.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addDomain}>
                    Add Domain
                  </Button>
                </div>
              </TabsContent>

              {/* SMTP Tab */}
              <TabsContent value="smtp" className="space-y-4">
                <div>
                  <Label>Domain Name</Label>
                  <Input
                    placeholder="yourdomain.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="smtpSubdomain"
                    checked={useSubdomain}
                    onChange={(e) => setUseSubdomain(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="smtpSubdomain">Use subdomain (recommended)</Label>
                </div>

                {useSubdomain && (
                  <div>
                    <Label>Subdomain</Label>
                    <Input
                      placeholder="mail"
                      value={customSubdomain}
                      onChange={(e) => setCustomSubdomain(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>SMTP Host</Label>
                    <Input
                      placeholder="smtp.yourdomain.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Port</Label>
                    <Select value={smtpPort} onValueChange={setSmtpPort}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 (Unencrypted)</SelectItem>
                        <SelectItem value="587">587 (TLS)</SelectItem>
                        <SelectItem value="465">465 (SSL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Username</Label>
                  <Input
                    placeholder="your-email@yourdomain.com"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addDomain}>
                    Add SMTP Domain
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Purchase Domain */}
        <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-1">Purchase Domain</h3>
                  <p className="text-sm text-slate-600">Buy a new domain for email</p>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Purchase Domain</DialogTitle>
              <DialogDescription>
                Search and purchase a new domain for email sending
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search for a domain..."
                  value={searchDomain}
                  onChange={(e) => setSearchDomain(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && searchAvailableDomains()}
                />
                <Button onClick={searchAvailableDomains} disabled={searching}>
                  {searching ? "Searching..." : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.domain}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <p className="font-medium">{result.domain}</p>
                        <p className="text-sm text-slate-600">
                          ${result.price}/year
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.available ? (
                          <>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              Available
                            </Badge>
                            <Button
                              size="sm"
                              onClick={() => purchaseDomain(result.domain)}
                            >
                              Purchase
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            Taken
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded">
                <p className="text-sm text-slate-700">
                  <strong>💡 Tip:</strong> We'll automatically set up a subdomain (mail.yourdomain.com) 
                  to protect your main domain reputation.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Domain Stats */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Globe className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{domains.length}</p>
              <p className="text-sm text-slate-600">Total Domains</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Domains</CardTitle>
          <CardDescription>
            {domains.length} domain{domains.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No domains configured</p>
              <p className="text-sm text-slate-500">Add a domain to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{domain.fullDomain}</h3>
                        <Badge variant="outline" className="capitalize">
                          {domain.type}
                        </Badge>
                        <Badge
                          variant={domain.status === "active" ? "default" : "outline"}
                          className={
                            domain.status === "active"
                              ? "bg-green-500"
                              : domain.status === "pending"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }
                        >
                          {domain.status}
                        </Badge>
                      </div>

                      {/* DNS Status */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          {getDNSStatusIcon(domain.dns.spf)}
                          <span className={`text-sm ${getDNSStatusColor(domain.dns.spf)}`}>
                            SPF: {domain.dns.spf}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getDNSStatusIcon(domain.dns.dkim)}
                          <span className={`text-sm ${getDNSStatusColor(domain.dns.dkim)}`}>
                            DKIM: {domain.dns.dkim}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getDNSStatusIcon(domain.dns.dmarc)}
                          <span className={`text-sm ${getDNSStatusColor(domain.dns.dmarc)}`}>
                            DMARC: {domain.dns.dmarc}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getDNSStatusIcon(domain.dns.mx)}
                          <span className={`text-sm ${getDNSStatusColor(domain.dns.mx)}`}>
                            MX: {domain.dns.mx}
                          </span>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <span>{domain.accountsUsing} accounts using</span>
                        {domain.type === "purchased" && domain.renewalDate && (
                          <span>Renews: {new Date(domain.renewalDate).toLocaleDateString()}</span>
                        )}
                        {domain.type === "purchased" && domain.monthlyPrice && (
                          <span>${domain.monthlyPrice}/month</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(domain.fullDomain)}
                        title="Copy domain"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.info("DNS settings coming soon")}
                        title="DNS settings"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteDomain(domain.id, domain.fullDomain)}
                        title="Delete domain"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Domains;