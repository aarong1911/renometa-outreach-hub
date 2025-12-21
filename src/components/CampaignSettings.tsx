// src/components/CampaignSettings.tsx
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Settings, Clock, Calendar, Zap, Shield } from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";

interface CampaignSettingsProps {
  user: User;
  campaignId: string;
  campaignName: string;
}

interface SettingsData {
  maxEmailsPerDay: number;
  minutesBetweenEmails: number;
  sendingDays: string[];
  sendingStartHour: number;
  sendingEndHour: number;
  timezone: string;
  trackOpens: boolean;
  trackClicks: boolean;
  stopOnReply: boolean;
  stopOnAutoReply: boolean;
  warmupMode: boolean;
  maxLeadsPerDay: number;
}

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export default function CampaignSettings({
  user,
  campaignId,
  campaignName,
}: CampaignSettingsProps) {
  const [settings, setSettings] = useState<SettingsData>({
    maxEmailsPerDay: 50,
    minutesBetweenEmails: 5,
    sendingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    sendingStartHour: 9,
    sendingEndHour: 17,
    timezone: "America/New_York",
    trackOpens: true,
    trackClicks: true,
    stopOnReply: true,
    stopOnAutoReply: false,
    warmupMode: false,
    maxLeadsPerDay: 100,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [campaignId]);

  const loadSettings = async () => {
    try {
      const res = await authedFetch(
        user,
        `/.netlify/functions/getCampaigns?campaignId=${campaignId}`
      );
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      const campaign = data.campaigns?.[0];

      if (campaign) {
        setSettings({
          maxEmailsPerDay: campaign.maxEmailsPerDay || 50,
          minutesBetweenEmails: campaign.minutesBetweenEmails || 5,
          sendingDays: campaign.sendingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          sendingStartHour: campaign.sendingStartHour || 9,
          sendingEndHour: campaign.sendingEndHour || 17,
          timezone: campaign.timezone || "America/New_York",
          trackOpens: campaign.trackOpens !== false,
          trackClicks: campaign.trackClicks !== false,
          stopOnReply: campaign.stopOnReply !== false,
          stopOnAutoReply: campaign.stopOnAutoReply || false,
          warmupMode: campaign.warmupMode || false,
          maxLeadsPerDay: campaign.maxLeadsPerDay || 100,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load campaign settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/updateCampaignSettings", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          settings,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setSettings((prev) => ({
      ...prev,
      sendingDays: prev.sendingDays.includes(day)
        ? prev.sendingDays.filter((d) => d !== day)
        : [...prev.sendingDays, day],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Settings className="w-8 h-8 animate-pulse text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="text-2xl font-bold text-slate-800">{campaignName}</h3>
        <p className="text-slate-600 mt-1">Campaign Settings</p>
      </div>

      {/* Sending Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Sending Limits
          </CardTitle>
          <CardDescription>
            Control how many emails are sent and at what pace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Emails Per Day (per account)</Label>
              <Input
                type="number"
                min="1"
                max="500"
                value={settings.maxEmailsPerDay}
                onChange={(e) =>
                  setSettings({ ...settings, maxEmailsPerDay: Number(e.target.value) })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                Recommended: 50-100 for new accounts
              </p>
            </div>

            <div>
              <Label>Minutes Between Emails</Label>
              <Input
                type="number"
                min="1"
                max="60"
                value={settings.minutesBetweenEmails}
                onChange={(e) =>
                  setSettings({ ...settings, minutesBetweenEmails: Number(e.target.value) })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                Recommended: 2-10 minutes
              </p>
            </div>
          </div>

          <div>
            <Label>Max New Leads Per Day</Label>
            <Input
              type="number"
              min="1"
              max="1000"
              value={settings.maxLeadsPerDay}
              onChange={(e) =>
                setSettings({ ...settings, maxLeadsPerDay: Number(e.target.value) })
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Total new leads to contact per day across all accounts
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Sending Schedule
          </CardTitle>
          <CardDescription>
            When to send emails based on timezone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Timezone</Label>
            <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Sending Days</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DAYS_OF_WEEK.map((day) => (
                <Button
                  key={day}
                  size="sm"
                  variant={settings.sendingDays.includes(day) ? "default" : "outline"}
                  onClick={() => toggleDay(day)}
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Hour (24h format)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={settings.sendingStartHour}
                onChange={(e) =>
                  setSettings({ ...settings, sendingStartHour: Number(e.target.value) })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                {settings.sendingStartHour}:00 (9 = 9:00 AM)
              </p>
            </div>

            <div>
              <Label>End Hour (24h format)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={settings.sendingEndHour}
                onChange={(e) =>
                  setSettings({ ...settings, sendingEndHour: Number(e.target.value) })
                }
              />
              <p className="text-xs text-slate-500 mt-1">
                {settings.sendingEndHour}:00 (17 = 5:00 PM)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tracking & Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Tracking & Behavior
          </CardTitle>
          <CardDescription>
            Analytics and automation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Track Email Opens</Label>
              <p className="text-xs text-slate-500">
                Insert tracking pixel to track when emails are opened
              </p>
            </div>
            <Switch
              checked={settings.trackOpens}
              onCheckedChange={(checked) => setSettings({ ...settings, trackOpens: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Track Link Clicks</Label>
              <p className="text-xs text-slate-500">
                Track when links in emails are clicked
              </p>
            </div>
            <Switch
              checked={settings.trackClicks}
              onCheckedChange={(checked) => setSettings({ ...settings, trackClicks: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Stop on Reply</Label>
              <p className="text-xs text-slate-500">
                Stop sending to leads who reply to any email
              </p>
            </div>
            <Switch
              checked={settings.stopOnReply}
              onCheckedChange={(checked) => setSettings({ ...settings, stopOnReply: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Stop on Auto-Reply</Label>
              <p className="text-xs text-slate-500">
                Detect and stop on out-of-office messages
              </p>
            </div>
            <Switch
              checked={settings.stopOnAutoReply}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, stopOnAutoReply: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Warmup Mode</Label>
              <p className="text-xs text-slate-500">
                Gradually increase sending volume for new accounts
              </p>
            </div>
            <Switch
              checked={settings.warmupMode}
              onCheckedChange={(checked) => setSettings({ ...settings, warmupMode: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} size="lg">
          <Settings className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}