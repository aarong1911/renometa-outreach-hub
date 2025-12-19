// src/components/LeadsImport.tsx
// CSV Import Wizard (Instantly.ai style)

import { useState } from "react";
import { User } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, Download, ArrowRight, ArrowLeft } from "lucide-react";

interface LeadsImportProps {
  user: User;
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

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
}

const LeadsImport = ({ user, onComplete }: LeadsImportProps) => {
  const [step, setStep] = useState<Step>(1);
  const [sourceType, setSourceType] = useState<'csv' | 'xlsx'>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'import'>('skip');

  const fieldOptions = [
    { value: 'email', label: 'Email' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'name', label: 'Full Name' },
    { value: 'company', label: 'Company' },
    { value: 'phone', label: 'Phone' },
    { value: 'website', label: 'Website' },
    { value: 'address', label: 'Address' },
    { value: 'city', label: 'City' },
    { value: 'state', label: 'State' },
    { value: 'zip', label: 'ZIP Code' },
    { value: 'type', label: 'Type/Industry' },
    { value: 'rating', label: 'Rating' },
    { value: 'reviews', label: 'Reviews' },
    { value: 'custom', label: 'Custom Field' },
    { value: 'ignore', label: 'Do Not Import' },
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'xlsx') {
      toast.error('Please upload a CSV or XLSX file');
      return;
    }

    setFile(selectedFile);
    setSourceType(extension === 'csv' ? 'csv' : 'xlsx');
    
    // Read file content
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await generatePreview(content);
    };
    reader.readAsText(selectedFile);
  };

  const generatePreview = async (fileContent: string) => {
    try {
      const response = await fetch('/.netlify/functions/importPreview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          fileContent,
          fileType: sourceType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const data = await response.json();
      setPreviewData(data);
      setFieldMapping(data.suggestedMapping);
      setStep(3); // Move to mapping step
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Failed to process file');
    }
  };

  const handleImport = async () => {
    if (!file || !previewData) return;

    setImporting(true);

    try {
      // Read file again to get all rows
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim());
        
        // Parse all rows using the mapping
        const leads = [];
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(cell => cell.trim().replace(/['"]/g, ''));
          const lead: any = {};
          
          previewData.headers.forEach((header, index) => {
            const mappedField = fieldMapping[header];
            if (mappedField && mappedField !== 'ignore' && mappedField !== 'custom') {
              lead[mappedField] = row[index] || '';
            }
          });

          // Require at least email
          if (lead.email) {
            // Combine firstName + lastName into name if needed
            if (lead.firstName || lead.lastName) {
              lead.name = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
            }
            leads.push(lead);
          }
        }

        // Call bulkAddLeads
        const response = await fetch('/.netlify/functions/bulkAddLeads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            leads
          })
        });

        if (!response.ok) {
          throw new Error('Failed to import leads');
        }

        const result = await response.json();
        setStep(5);
        toast.success(`Successfully imported ${result.imported} leads!`);
      };
      reader.readAsText(file);

    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  // Step 1: Choose Source
  if (step === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Choose Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-32 flex flex-col gap-2"
              onClick={() => setStep(2)}
            >
              <FileText className="w-8 h-8" />
              <div>
                <p className="font-semibold">CSV File</p>
                <p className="text-xs text-slate-500">Upload .csv file</p>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="h-32 flex flex-col gap-2"
              onClick={() => {
                setSourceType('xlsx');
                setStep(2);
              }}
            >
              <FileText className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-semibold">Excel File</p>
                <p className="text-xs text-slate-500">Upload .xlsx file</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 2: Upload File
  if (step === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Upload File</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-2">
                Drop your {sourceType.toUpperCase()} file here
              </p>
              <p className="text-sm text-slate-500 mb-4">or</p>
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Choose File
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept={sourceType === 'csv' ? '.csv' : '.xlsx'}
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
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Map Fields
  if (step === 3 && previewData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Map Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Map your CSV columns to lead fields. Preview showing {previewData.sampleRows.length} of {previewData.totalRows} rows.
            </p>

            {/* Field Mapping */}
            <div className="space-y-3">
              {previewData.headers.map((header) => (
                <div key={header} className="flex items-center gap-4">
                  <div className="w-1/3">
                    <Label className="font-medium">{header}</Label>
                    <p className="text-xs text-slate-500">
                      {previewData.sampleRows[0]?.[header] || 'N/A'}
                    </p>
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
                        {fieldOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
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
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 4: Validation
  if (step === 4 && previewData) {
    const hasEmailMapping = Object.values(fieldMapping).includes('email');

    return (
      <Card>
        <CardHeader>
          <CardTitle>Import Leads - Review & Import</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Validation Summary */}
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

            {/* Email Required Warning */}
            {!hasEmailMapping && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900">Email field is required</p>
                  <p className="text-sm text-red-700">Please map at least one column to the Email field.</p>
                </div>
              </div>
            )}

            {/* Duplicate Action */}
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
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!hasEmailMapping || importing}
              >
                {importing ? 'Importing...' : `Import ${previewData.validation.validCount} Leads`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 5: Complete
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
              <Button onClick={onComplete}>
                View Leads
              </Button>
              <Button variant="outline" onClick={() => {
                setStep(1);
                setFile(null);
                setPreviewData(null);
              }}>
                Import More
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default LeadsImport;