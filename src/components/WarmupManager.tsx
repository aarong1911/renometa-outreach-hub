// src/components/WarmupManager.tsx
// Updated to use Google Sheets via Netlify Functions instead of Firestore
// This component displays warmup accounts, activity, and statistics from Google Sheets

import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Radio, Mail, TrendingUp, CheckCircle2, Calendar, Activity, RefreshCw } from "lucide-react";

interface EmailAccount {
  email: string;
  provider: string;
  status: string;
  dailyLimit: number;
  currentCount: number;
  totalSent: number;
  createdAt?: string;
  daysActive?: number;
  warmupStage?: number;
  warmupProgress?: number;
  startLimit?: number;
  dailyIncrement?: number;
  maxLimit?: number;
}

interface ActivityLog {
  status: string;
  sentAt: string;
  fromAccount: string;
  toAccount: string;
  subject: string;
  body: string;
  messageId: string;
  campaignId: string;
}

interface Reply {
  repliedAt: string;
  fromAccount: string;
  toAccount: string;
  originalMessageId: string;
  replyDelay: string;
}

interface Stats {
  totalAccounts: number;
  totalSent: number;
  totalReplies: number;
  replyRate: string;
  todaySent: number;
}

const WarmupManager = ({ user }: { user: User }) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("accounts");

  useEffect(() => {
    loadWarmupData();
    
    // Refresh data every 2 minutes
    const interval = setInterval(loadWarmupData, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadWarmupData = async (showRefreshToast = false) => {
    try {
      if (showRefreshToast) setRefreshing(true);

      // Call all Netlify functions in parallel
      const [accountsRes, activityRes, repliesRes, statsRes] = await Promise.all([
        fetch('/.netlify/functions/getAccounts'),
        fetch('/.netlify/functions/getActivity'),
        fetch('/.netlify/functions/getReplies'),
        fetch('/.netlify/functions/getStats'),
      ]);

      if (!accountsRes.ok || !activityRes.ok || !repliesRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const accountsData = await accountsRes.json();
      const activityData = await activityRes.json();
      const repliesData = await repliesRes.json();
      const statsData = await statsRes.json();

      setAccounts(accountsData.accounts || []);
      setActivity(activityData.activity || []);
      setReplies(repliesData.replies || []);
      setStats(statsData.stats || null);

      if (showRefreshToast) {
        toast.success("Data refreshed");
      }
    } catch (error) {
      console.error("Error loading warmup data:", error);
      toast.error("Failed to load warmup data. Check your Netlify functions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWarmupData(true);
  };

  // Warmup stage is now calculated by the API based on actual progress
  // No need to calculate it here anymore

  const getAccountMetrics = (accountEmail: string) => {
    const accountActivity = activity.filter(a => a.fromAccount === accountEmail);
    const accountReplies = replies.filter(r => r.fromAccount === accountEmail);
    
    if (accountActivity.length === 0) return null;

    const totalSent = accountActivity.length;
    const totalReplied = accountReplies.length;
    const avgReplyRate = (totalReplied / totalSent) * 100;

    return {
      totalSent,
      totalReplied,
      avgReplyRate: avgReplyRate.toFixed(1)
    };
  };

  const getWarmupProgress = (account: EmailAccount) => {
    // Use the warmupProgress calculated by the API
    return account.warmupProgress || 0;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-500";
      case "paused":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  const getRecentActivity = () => {
    return activity.slice(0, 10);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Radio className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-slate-600">Loading warmup data from Airtable...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Email Warmup Network</h2>
          <p className="text-slate-600 mt-1">Automated email warmup powered by Make.com & Airtable</p>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Mail className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalAccounts}</p>
                <p className="text-xs text-slate-600">Accounts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalSent}</p>
                <p className="text-xs text-slate-600">Total Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.totalReplies}</p>
                <p className="text-xs text-slate-600">Replies</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Activity className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.replyRate}%</p>
                <p className="text-xs text-slate-600">Reply Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Calendar className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{stats.todaySent}</p>
                <p className="text-xs text-slate-600">Today</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accounts">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="metrics">Performance</TabsTrigger>
        </TabsList>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          {accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Radio className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">No warmup accounts configured yet</p>
                <p className="text-sm text-slate-500">Add accounts to Airtable to get started with warmup.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account, index) => {
                const progress = getWarmupProgress(account);
                const metrics = getAccountMetrics(account.email);
                const stage = account.warmupStage || 1; // Use stage from API

                return (
                  <Card key={index} className="relative overflow-hidden">
                    {/* Status indicator */}
                    <div className={`absolute top-0 right-0 w-3 h-3 rounded-full ${getStatusColor(account.status)} m-3`} />
                    
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2 pr-6">
                        <Mail className="w-5 h-5 text-blue-500" />
                        {account.email}
                      </CardTitle>
                      <CardDescription className="capitalize">{account.provider} Account</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Daily usage */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-600">Daily Usage</span>
                          <span className="font-semibold">
                            {account.currentCount}/{account.dailyLimit}
                          </span>
                        </div>
                        <Progress 
                          value={(account.currentCount / account.dailyLimit) * 100} 
                          className="h-2"
                        />
                      </div>

                      {/* Warmup progress */}
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-600">Warmup Progress</span>
                          <span className="font-semibold">Stage {stage}/5</span>
                        </div>
                        <Progress value={progress} className="h-2" />
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

                      {/* Status badge */}
                      <div className="pt-4 border-t">
                        <Badge 
                          variant={account.status.toLowerCase() === 'active' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {account.status}
                        </Badge>
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
              <CardDescription>Last 10 emails sent by Make.com automation</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">No activity yet. Waiting for Make.com automation to run...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getRecentActivity().map((log, index) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <p className="font-medium text-sm">{log.fromAccount}</p>
                          <span className="text-slate-400">→</span>
                          <p className="text-sm text-slate-600">{log.toAccount}</p>
                        </div>
                        <p className="text-xs text-slate-500 ml-6">
                          {log.subject}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <Badge variant={log.status === 'sent' ? 'default' : 'secondary'}>
                          {log.status}
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(log.sentAt).toLocaleString()}
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
                      <p className="text-2xl font-bold">{stats?.totalSent || 0}</p>
                      <p className="text-sm text-slate-600">Total Emails Sent</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">{stats?.totalReplies || 0}</p>
                      <p className="text-sm text-slate-600">Total Replies</p>
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
                {accounts.map((account, index) => {
                  const metrics = getAccountMetrics(account.email);
                  if (!metrics) return null;

                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
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
      </Tabs>

    </div>
  );
};

export default WarmupManager;