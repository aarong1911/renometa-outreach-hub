// src/components/CampaignBuilder.tsx
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
import { Textarea } from "@/components/ui/textarea";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit,
  Mail,
  Clock,
  Save,
  Eye,
  ChevronLeft,
  FileText,
  Users,
} from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";

interface CampaignBuilderProps {
  user: User;
  campaignId: string;
  campaignName: string;
  onBack: () => void;
}

interface CampaignStep {
  id?: string;
  stepNumber: number;
  stepType: "initial" | "followup";
  delayDays: number;
  subject: string;
  body: string;
  templateId?: string;
  isActive: boolean;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

interface EmailAccount {
  id: string;
  email: string;
  provider: string;
  status: string;
  currentDailyLimit: number;
  sentToday: number;
}

interface LeadList {
  id: string;
  name: string;
  leadCount: number;
}

const MERGE_TAGS = [
  { tag: "{{firstName}}", label: "First Name" },
  { tag: "{{lastName}}", label: "Last Name" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{company}}", label: "Company" },
  { tag: "{{phone}}", label: "Phone" },
  { tag: "{{website}}", label: "Website" },
  { tag: "{{city}}", label: "City" },
  { tag: "{{state}}", label: "State" },
];

export default function CampaignBuilder({
  user,
  campaignId,
  campaignName,
  onBack,
}: CampaignBuilderProps) {
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [assignedAccounts, setAssignedAccounts] = useState<EmailAccount[]>([]);
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [assignedLists, setAssignedLists] = useState<LeadList[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState<CampaignStep | null>(null);

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState("");

  useEffect(() => {
    loadData();
  }, [campaignId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSteps(),
        loadTemplates(),
        loadAccounts(),
        loadAssignedAccounts(),
        loadLeadLists(),
        loadAssignedLists(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadSteps = async () => {
    try {
      const res = await authedFetch(
        user,
        `/.netlify/functions/getCampaignSteps?campaignId=${campaignId}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setSteps(data.steps || []);
    } catch (error) {
      console.error("Error loading steps:", error);
      toast.error("Failed to load campaign steps");
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await authedFetch(user, "/.netlify/functions/getTemplates");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await authedFetch(user, "/.netlify/functions/getAccounts");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  };

  const loadAssignedAccounts = async () => {
    try {
      const res = await authedFetch(
        user,
        `/.netlify/functions/getCampaignAccounts?campaignId=${campaignId}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAssignedAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error loading assigned accounts:", error);
    }
  };

  const loadLeadLists = async () => {
    try {
      const res = await authedFetch(user, "/.netlify/functions/getLeadLists");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLeadLists(data.lists || []);
    } catch (error) {
      console.error("Error loading lead lists:", error);
    }
  };

  const loadAssignedLists = async () => {
    try {
      const res = await authedFetch(
        user,
        `/.netlify/functions/getCampaignLeadLists?campaignId=${campaignId}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAssignedLists(data.lists || []);
    } catch (error) {
      console.error("Error loading assigned lists:", error);
    }
  };

  const openStepEditor = (step?: CampaignStep) => {
    if (step) {
      setEditingStep(step);
    } else {
      // New step
      setEditingStep({
        stepNumber: steps.length + 1,
        stepType: steps.length === 0 ? "initial" : "followup",
        delayDays: steps.length === 0 ? 0 : 2,
        subject: "",
        body: "",
        isActive: true,
      });
    }
    setStepDialogOpen(true);
  };

  const saveStep = async () => {
    if (!editingStep) return;

    if (!editingStep.subject.trim() || !editingStep.body.trim()) {
      toast.error("Subject and body are required");
      return;
    }

    setSaving(true);
    try {
      if (editingStep.id) {
        // Update existing
        const res = await authedFetch(user, "/.netlify/functions/updateCampaignStep", {
          method: "POST",
          body: JSON.stringify({
            stepId: editingStep.id,
            ...editingStep,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Step updated");
      } else {
        // Create new
        const res = await authedFetch(user, "/.netlify/functions/addCampaignStep", {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            ...editingStep,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success("Step added");
      }

      setStepDialogOpen(false);
      setEditingStep(null);
      await loadSteps();
    } catch (error) {
      console.error("Error saving step:", error);
      toast.error("Failed to save step");
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template || !editingStep) return;

    setEditingStep({
      ...editingStep,
      subject: template.subject,
      body: template.body,
      templateId: template.id,
    });
    toast.success(`Template "${template.name}" applied`);
  };

  const insertMergeTag = (tag: string, field: "subject" | "body") => {
    if (!editingStep) return;

    const current = editingStep[field];
    setEditingStep({
      ...editingStep,
      [field]: current + tag,
    });
  };

  const previewStepWithMergeData = (step: CampaignStep) => {
    setPreviewStep(step);
    setPreviewDialogOpen(true);
  };

  const renderPreview = () => {
    if (!previewStep) return null;

    // Sample data
    const sampleData = {
      "{{firstName}}": "John",
      "{{lastName}}": "Doe",
      "{{email}}": "john.doe@example.com",
      "{{company}}": "Acme Corp",
      "{{phone}}": "(555) 123-4567",
      "{{website}}": "acmecorp.com",
      "{{city}}": "San Francisco",
      "{{state}}": "CA",
    };

    let subject = previewStep.subject;
    let body = previewStep.body;

    Object.entries(sampleData).forEach(([tag, value]) => {
      subject = subject.replace(new RegExp(tag, "g"), value);
      body = body.replace(new RegExp(tag, "g"), value);
    });

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-xs text-slate-500">Subject</Label>
          <p className="font-semibold">{subject}</p>
        </div>
        <div>
          <Label className="text-xs text-slate-500">Body</Label>
          <div className="whitespace-pre-wrap p-4 bg-slate-50 rounded border">
            {body}
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Preview uses sample data. Actual emails will use real lead data.
        </div>
      </div>
    );
  };

  const addAccountToCampaign = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an account");
      return;
    }

    try {
      const res = await authedFetch(user, "/.netlify/functions/addAccountToCampaign", {
        method: "POST",
        body: JSON.stringify({ campaignId, accountId: selectedAccountId }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      if (data.alreadyLinked) {
        toast.info("Account already assigned to this campaign");
      } else {
        toast.success("Account added to campaign");
      }

      setAccountDialogOpen(false);
      setSelectedAccountId("");
      await loadAssignedAccounts();
    } catch (error) {
      console.error("Error adding account:", error);
      toast.error("Failed to add account");
    }
  };

  const addListToCampaign = async () => {
    if (!selectedListId) {
      toast.error("Please select a list");
      return;
    }

    try {
      const res = await authedFetch(user, "/.netlify/functions/addListToCampaign", {
        method: "POST",
        body: JSON.stringify({ campaignId, listId: selectedListId }),
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      if (data.alreadyLinked) {
        toast.info("List already assigned to this campaign");
      } else {
        toast.success("List added to campaign");
      }

      setListDialogOpen(false);
      setSelectedListId("");
      await loadAssignedLists();
    } catch (error) {
      console.error("Error adding list:", error);
      toast.error("Failed to add list");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Mail className="w-8 h-8 animate-pulse text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-slate-800">{campaignName}</h2>
            <p className="text-slate-600 mt-1">Campaign Builder</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Email Sequence */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Sequence Steps */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Email Sequence
                  </CardTitle>
                  <CardDescription>{steps.length} step{steps.length !== 1 ? 's' : ''}</CardDescription>
                </div>
                <Button onClick={() => openStepEditor()} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="text-center py-12">
                  <Mail className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600 mb-4">No email steps yet</p>
                  <Button onClick={() => openStepEditor()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Step
                  </Button>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {steps.map((step, index) => (
                    <AccordionItem key={step.id || index} value={`step-${index}`}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-4 w-full">
                          <Badge variant={step.stepType === "initial" ? "default" : "secondary"}>
                            Step {step.stepNumber}
                          </Badge>
                          {step.delayDays > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              +{step.delayDays} days
                            </Badge>
                          )}
                          <span className="flex-1 text-left font-medium truncate">
                            {step.subject || "No subject"}
                          </span>
                          {!step.isActive && (
                            <Badge variant="outline" className="text-xs text-slate-500">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-4">
                          <div>
                            <Label className="text-xs text-slate-500">Subject</Label>
                            <p className="font-medium">{step.subject}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Body Preview</Label>
                            <p className="text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">
                              {step.body}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => previewStepWithMergeData(step)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openStepEditor(step)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Configuration */}
        <div className="space-y-6">
          {/* Email Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Accounts</CardTitle>
              <CardDescription>
                Accounts used to send emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded"
                >
                  <div>
                    <p className="text-sm font-medium">{account.email}</p>
                    <p className="text-xs text-slate-500">{account.provider}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {account.sentToday}/{account.currentDailyLimit}
                  </Badge>
                </div>
              ))}
              {assignedAccounts.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No accounts assigned
                </p>
              )}
              <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Email Account</DialogTitle>
                    <DialogDescription>
                      Select an account to use for this campaign
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.email} ({account.provider})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addAccountToCampaign}>Add Account</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Lead Lists */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Lists</CardTitle>
              <CardDescription>
                Target audience for this campaign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded"
                >
                  <div>
                    <p className="text-sm font-medium">{list.name}</p>
                    <p className="text-xs text-slate-500">{(list as any).source || 'manual'}</p>
                  </div>
                </div>
              ))}
              {assignedLists.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No lists assigned
                </p>
              )}
              <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add List
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Lead List</DialogTitle>
                    <DialogDescription>
                      Select a list to target with this campaign
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose list..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leadLists.map((list) => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.leadCount} leads)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setListDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={addListToCampaign}>Add List</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step Editor Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStep?.id ? "Edit Email Step" : "Add Email Step"}
            </DialogTitle>
            <DialogDescription>
              Create an email in your sequence with merge tags for personalization
            </DialogDescription>
          </DialogHeader>

          {editingStep && (
            <div className="space-y-4 py-4">
              {/* Step Configuration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Step Number</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editingStep.stepNumber}
                    onChange={(e) =>
                      setEditingStep({ ...editingStep, stepNumber: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label>Delay (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingStep.delayDays}
                    onChange={(e) =>
                      setEditingStep({ ...editingStep, delayDays: Number(e.target.value) })
                    }
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Days after previous step (0 for first email)
                  </p>
                </div>
              </div>

              {/* Template Selection */}
              {templates.length > 0 && (
                <div>
                  <Label>Apply Template (Optional)</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            {template.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Subject */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Subject</Label>
                  <div className="flex gap-1">
                    {MERGE_TAGS.slice(0, 4).map((tag) => (
                      <Button
                        key={tag.tag}
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => insertMergeTag(tag.tag, "subject")}
                        title={tag.label}
                      >
                        {tag.tag}
                      </Button>
                    ))}
                  </div>
                </div>
                <Input
                  value={editingStep.subject}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, subject: e.target.value })
                  }
                  placeholder="e.g., Quick question about {{company}}"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Email Body</Label>
                  <div className="flex flex-wrap gap-1">
                    {MERGE_TAGS.map((tag) => (
                      <Button
                        key={tag.tag}
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 px-2"
                        onClick={() => insertMergeTag(tag.tag, "body")}
                        title={tag.label}
                      >
                        {tag.tag}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={editingStep.body}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, body: e.target.value })
                  }
                  placeholder={`Hi {{firstName}},\n\nI noticed {{company}} is based in {{city}}...\n\nBest,\nYour Name`}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStepDialogOpen(false);
                    setEditingStep(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => previewStepWithMergeData(editingStep)} variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button onClick={saveStep} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Step"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview with sample merge data
            </DialogDescription>
          </DialogHeader>
          {renderPreview()}
        </DialogContent>
      </Dialog>
    </div>
  );
}