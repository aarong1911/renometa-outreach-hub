// src/components/LeadsImport.tsx
import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { authedFetch } from "@/lib/api";

interface LeadsImportProps {
  user: User;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;
type SourceMode = "csv" | "gsheet";

interface PreviewData {
  headers: string[];
  sampleRows: any[];
  suggestedMapping: Record<string, string>;
  totalRows: number;
  validation: {
    validCount: number;
    invalidEmailCount: number;
    duplicateCount: number;
    errors: Array<{ row: number; error: string }>;
  };
  defaultListName?: string;
}

const stripExt = (filename: string) => filename.replace(/\.[^/.]+$/, "");

const fieldOptions = [
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "name", label: "Full Name" }, // will be split into first/last on backend
  { value: "company", label: "Company" },
  { value: "phone", label: "Phone" },
  { value: "website", label: "Website" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip", label: "ZIP Code" },
  { value: "type", label: "Type/Industry" },
  { value: "rating", label: "Rating" },
  { value: "reviews", label: "Reviews" },
  { value: "custom", label: "Custom Field" },
  { value: "ignore", label: "Do Not Import" },
];

export default function LeadsImport({ user, onComplete }: LeadsImportProps) {
  const [step, setStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<SourceMode>("csv");
  const [file, setFile] = useState<File | null>(null);

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update" | "import">("skip");

  const [listName, setListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  const [gsheetUrlOrId, setGsheetUrlOrId] = useState("");
  const [gsheetTabName, setGsheetTabName] = useState("Sheet1");

  const hasEmailMapping = useMemo(
    () => Object.values(fieldMapping).includes("email"),
    [fieldMapping]
  );

  const importSource = useMemo(() => {
    if (sourceType === "csv") return "csv-import";
    return "gsheet-import";
  }, [sourceType]);

  useEffect(() => {
    if (!listName) {
      if (sourceType === "csv" && file?.name) setListName(stripExt(file.name));
      if (sourceType === "gsheet" && gsheetUrlOrId)
        setListName(`Google Sheet - ${gsheetTabName || "Sheet1"}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, sourceType, gsheetUrlOrId, gsheetTabName]);

  const generateCsvPreview = async (csvText: string) => {
    const res = await authedFetch(user, "/.netlify/functions/importPreview", {
      method: "POST",
      body: JSON.stringify({ fileType: "csv", fileContent: csvText }),
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv") {
      toast.error("Please upload a CSV file (XLSX temporarily disabled)");
      return;
    }

    setFile(selectedFile);
    setSourceType("csv");
    setListName(stripExt(selectedFile.name));

    try {
      const csvText = await selectedFile.text();
      const data = await generateCsvPreview(csvText);

      setPreviewData(data);
      setFieldMapping(data.suggestedMapping || {});
      if (!listName && data.defaultListName) setListName(data.defaultListName);
      setStep(3);
      toast.success("CSV loaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to process CSV");
    }
  };

  const generateGsheetPreview = async () => {
    if (!gsheetUrlOrId.trim()) return toast.error("Spreadsheet URL/ID is required");
    if (!gsheetTabName.trim()) return toast.error("Tab name is required");

    try {
      const res = await authedFetch(user, "/.netlify/functions/gsheetPreview", {
        method: "POST",
        body: JSON.stringify({
          spreadsheet: gsheetUrlOrId.trim(),
          sheetName: gsheetTabName.trim(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      setPreviewData(data);
      setFieldMapping(data.suggestedMapping || {});
      setListName(data.defaultListName || `Google Sheet - ${gsheetTabName.trim()}`);
      setStep(3);
      toast.success("Google Sheet loaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Google Sheet preview");
    }
  };

  const createLeadList = async () => {
    const name = listName.trim();
    if (!name) throw new Error("List name is required");

    setCreatingList(true);
    try {
      const res = await authedFetch(user, "/.netlify/functions/createLeadList", {
        method: "POST",
        body: JSON.stringify({ name, source: importSource }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.listId as string;
    } finally {
      setCreatingList(false);
    }
  };

  const buildLeadsFromRows = (rows: any[], headers: string[]) => {
    return rows
      .map((rowObj) => {
        const lead: any = {};
        headers.forEach((header) => {
          const mapped = fieldMapping[header];
          if (!mapped || mapped === "ignore" || mapped === "custom") return;
          lead[mapped] = (rowObj?.[header] ?? "").toString().trim();
        });
        return lead;
      })
      .filter((l) => l.email);
  };

  const parseCsvToRows = (csvText: string, headers: string[]) => {
    const lines = csvText.split("\n").filter((l) => l.trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
      const obj: any = {};
      headers.forEach((h, idx) => (obj[h] = cells[idx] || ""));
      rows.push(obj);
    }

    return rows;
  };

  const handleImport = async () => {
    if (!previewData) return;
    if (!hasEmailMapping) return toast.error("Please map an Email field before importing");

    setImporting(true);
    try {
      const listId = await createLeadList();

      let leads: any[] = [];

      if (sourceType === "gsheet") {
        const res = await authedFetch(user, "/.netlify/functions/gsheetExport", {
          method: "POST",
          body: JSON.stringify({
            spreadsheet: gsheetUrlOrId.trim(),
            sheetName: gsheetTabName.trim(),
          }),
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        leads = buildLeadsFromRows(data.rows || [], previewData.headers);
      } else {
        if (!file) throw new Error("No file selected");
        const csvText = await file.text();
        const rows = parseCsvToRows(csvText, previewData.headers);
        leads = buildLeadsFromRows(rows, previewData.headers);
      }

      const res = await authedFetch(user, "/.netlify/functions/bulkAddLeads", {
        method: "POST",
        body: JSON.stringify({
          leads,
          listId,
          source: importSource,
          duplicateAction,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();

      setStep(5);
      toast.success(
        `Imported ${result.imported} leads` +
          (result.updated ? `, updated ${result.updated}` : "") +
          (result.skipped ? `, skipped ${result.skipped}` : "") +
          ` into "${listName.trim()}"`
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to import leads");
    } finally {
      setImporting(false);
    }
  };

  // STEP 1
  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Choose Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-32 flex flex-col gap-2"
              onClick={() => {
                setSourceType("csv");
                setStep(2);
              }}
            >
              <FileText className="w-8 h-8" />
              <div>
                <p className="font-semibold">CSV File</p>
                <p className="text-xs text-slate-500">Upload .csv file</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-32 flex flex-col gap-2 opacity-60 cursor-not-allowed"
              disabled
            >
              <FileText className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-semibold">Excel File</p>
                <p className="text-xs text-slate-500">
                  Disabled (xlsx advisory). Export to CSV.
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-32 flex flex-col gap-2"
              onClick={() => {
                setSourceType("gsheet");
                setStep(2);
              }}
            >
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-semibold">Google Sheets</p>
                <p className="text-xs text-slate-500">Import from a sheet</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // STEP 2
  if (step === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - {sourceType === "gsheet" ? "Google Sheets" : "Upload CSV"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sourceType === "gsheet" ? (
              <div className="space-y-3">
                <div>
                  <Label>Spreadsheet URL or ID</Label>
                  <Input
                    value={gsheetUrlOrId}
                    onChange={(e) => setGsheetUrlOrId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... or the ID"
                  />
                </div>
                <div>
                  <Label>Tab name (sheet)</Label>
                  <Input
                    value={gsheetTabName}
                    onChange={(e) => setGsheetTabName(e.target.value)}
                    placeholder="Sheet1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button onClick={generateGsheetPreview}>
                    Continue <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold mb-2">Drop your CSV file here</p>
                  <p className="text-sm text-slate-500 mb-4">or</p>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Choose File
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </Label>
                </div>

                {file && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium">{file.name}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // STEP 3
  if (step === 3 && previewData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Map Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Preview showing {previewData.sampleRows.length} of {previewData.totalRows} rows.
            </p>

            <div className="space-y-3">
              {previewData.headers.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <div className="w-1/3">
                    <Label className="font-medium">{header}</Label>
                    <p className="text-xs text-slate-500">{previewData.sampleRows[0]?.[header] || "N/A"}</p>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400" />

                  <div className="w-1/3">
                    <Select
                      value={fieldMapping[header]}
                      onValueChange={(value) => setFieldMapping({ ...fieldMapping, [header]: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // STEP 4
  if (step === 4 && previewData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Review & Import</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>List Name</Label>
              <Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="e.g. Miami Roofers" />
              <p className="text-xs text-slate-500">Imported leads will be grouped in this list.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-600">Total Rows</p>
                <p className="text-2xl font-bold">{previewData.totalRows}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-slate-600">Valid</p>
                <p className="text-2xl font-bold text-green-600">{previewData.validation.validCount}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-slate-600">Invalid</p>
                <p className="text-2xl font-bold text-red-600">{previewData.validation.invalidEmailCount}</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="text-sm text-slate-600">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600">{previewData.validation.duplicateCount}</p>
              </div>
            </div>

            {!hasEmailMapping && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Email field is required</p>
                  <p className="text-sm text-red-700">Please map at least one column to Email.</p>
                </div>
              </div>
            )}

            {previewData.validation.duplicateCount > 0 && (
              <div className="space-y-2">
                <Label>Handle Duplicates</Label>
                <Select value={duplicateAction} onValueChange={(v: any) => setDuplicateAction(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">Skip Duplicates</SelectItem>
                    <SelectItem value="update">Update Existing</SelectItem>
                    <SelectItem value="import">Import Anyway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!hasEmailMapping || importing || creatingList || !listName.trim()}
              >
                {importing ? "Importing..." : `Import ${previewData.validation.validCount} Leads`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // STEP 5
  if (step === 5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Complete!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Leads imported successfully</p>
            <p className="text-sm text-slate-600 mb-6">Your leads are now available in the system.</p>

            <div className="flex gap-2 justify-center">
              <Button onClick={onComplete}>View Leads</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setPreviewData(null);
                  setFieldMapping({});
                  setListName("");
                  setGsheetUrlOrId("");
                  setGsheetTabName("Sheet1");
                  setDuplicateAction("skip");
                }}
              >
                Import More
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
