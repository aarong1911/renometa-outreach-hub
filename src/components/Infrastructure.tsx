// src/components/Infrastructure.tsx
// Email infrastructure management with Airtable backend

import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Server, Mail, Shield, CheckCircle2, AlertCircle, RefreshCw, Settings } from "lucide-react";

interface InfrastructureAccount {
  id: string;
  email: string;
  provider: string;
  type: string;
  status: string;
  dns: {
    spf: string;
    dkim: string;
    dmarc: string;
  };
  dailyUsage: {
    current: number;
    limit: number;
    percentage: number;
  };
  smtp: {
    host: string;
    port: number;
    configured: boolean;
  };
  warmup: {
    enabled: boolean;
    daysActive: number;
    currentLimit: number;
    maxLimit: number;
  };
  createdAt?: string;
  lastSentAt?: string;
}

const Infrastructure = ({ user }: { user: User }) => {
  const [accounts, setAccounts] = useState<InfrastructureAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadInfrastructure();
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(loadInfrastructure, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadInfrastructure = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);

      const response = await fetch('/.netlify/functions/getInfrastructure');
      
      if (!response.ok) {
        throw new Error('Failed to fetch infrastructure data');
      }

      const data = await response.json();
      setAccounts(data.infrastructure || []);

      if (showToast) {
        toast.success("Infrastructure data refreshed");
      }
    } catch (error) {
      console.error("Error loading infrastructure:", error);
      toast.error("Failed to load infrastructure data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadInfrastructure(true);
  };

  const getDNSStatusColor = (status: string) => {
    if (status.includes('OK')) return 'bg-green-500';
    if (status.includes('PENDING')) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getDNSStatusText = (status: string) => {
    if (status.includes('OK')) return 'OK';
    if (status.includes('PENDING')) return 'Pending';
    return 'Check';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Server className="w-8 h-8 animate-pulse text-blue-500 mx-auto mb-2" />
          <p className="text-slate-600">Loading infrastructure data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Email Infrastructure</h2>
          <p className="text-slate-600 mt-1">Manage email accounts and DNS configuration</p>
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

      {/* Infrastructure Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Email Accounts
          </CardTitle>
          <CardDescription>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">No email accounts configured</p>
              <p className="text-sm text-slate-500">Add accounts to Airtable to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">Provider</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">DNS Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">Daily Usage</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-slate-50 transition-colors">
                      {/* Email */}
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-sm">{account.email}</p>
                          <p className="text-xs text-slate-500 capitalize">{account.type}</p>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="capitalize">
                          {account.provider}
                        </Badge>
                      </td>

                      {/* DNS Status */}
                      <td className="py-4 px-4">
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${getDNSStatusColor(account.dns.spf)}`} />
                            <span className="text-xs text-slate-600">SPF: {getDNSStatusText(account.dns.spf)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${getDNSStatusColor(account.dns.dkim)}`} />
                            <span className="text-xs text-slate-600">DKIM: {getDNSStatusText(account.dns.dkim)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Daily Usage */}
                      <td className="py-4 px-4">
                        <div className="w-32">
                          <div className="flex justify-between text-xs mb-1">
                            <span>{account.dailyUsage.current}/{account.dailyUsage.limit}</span>
                            <span>{account.dailyUsage.percentage.toFixed(0)}%</span>
                          </div>
                          <Progress 
                            value={account.dailyUsage.percentage} 
                            className="h-2"
                          />
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => toast.info("Account settings coming soon")}
                        >
                          <Settings className="w-4 h-4" />
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

      {/* SMTP Configuration Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {accounts.filter(a => a.smtp.configured).length}
              </p>
              <p className="text-sm text-slate-600">SMTP Configured</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {accounts.filter(a => 
                  a.dns.spf.includes('OK') && 
                  a.dns.dkim.includes('OK')
                ).length}
              </p>
              <p className="text-sm text-slate-600">DNS Verified</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Mail className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {accounts.filter(a => a.warmup.enabled).length}
              </p>
              <p className="text-sm text-slate-600">Warmup Active</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Infrastructure;