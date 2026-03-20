import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileText, Check, X, Loader2, Download } from 'lucide-react';

interface ParsedRow {
  admission_no: string;
  full_name: string;
  class: string;
  pickup_point: string;
  parent_phone: string;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  
  const admIdx = headers.findIndex(h => h.includes('admission'));
  const nameIdx = headers.findIndex(h => h.includes('name'));
  const classIdx = headers.findIndex(h => h.includes('class'));
  const pickupIdx = headers.findIndex(h => h.includes('pickup'));
  const phoneIdx = headers.findIndex(h => h.includes('phone'));

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(',').map(c => c.trim());
    return {
      admission_no: cols[admIdx >= 0 ? admIdx : 0] || '',
      full_name: cols[nameIdx >= 0 ? nameIdx : 1] || '',
      class: cols[classIdx >= 0 ? classIdx : 2] || '',
      pickup_point: cols[pickupIdx >= 0 ? pickupIdx : 3] || '',
      parent_phone: cols[phoneIdx >= 0 ? phoneIdx : 4] || '',
    };
  }).filter(r => r.full_name && r.admission_no);
}

const BulkCsvUpload = () => {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      if (parsed.length === 0) toast.error('No valid rows found in CSV');
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (rows.length === 0) return;
    setUploading(true);
    try {
      const { error } = await supabase.from('students').insert(
        rows.map(r => ({
          admission_no: r.admission_no,
          full_name: r.full_name,
          class: r.class,
          pickup_point: r.pickup_point,
          parent_phone: r.parent_phone,
          status: 'waiting',
        }))
      );
      if (error) throw error;
      toast.success(`${rows.length} students added successfully`);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setRows([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'Admission No,Name,Class,Pickup Point,Parent Phone\nADM-2024-001,Aman Kumar,5,Tilak Nagar Chowk,9123456780\nADM-2024-002,Neha Singh,7,Station Road,9345678120';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-card p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Upload className="h-5 w-5 text-secondary" /> Bulk CSV Upload
        </h3>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
          <Download className="h-4 w-4" /> Template
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Upload a CSV file with columns: <strong>Admission No, Name, Class, Pickup Point, Parent Phone</strong>
      </p>

      <div
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-secondary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
        {fileName ? (
          <div className="flex items-center justify-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-secondary" />
            <span className="font-medium">{fileName}</span>
            <span className="text-muted-foreground">({rows.length} students)</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Click to select CSV file</p>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Adm. No</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Class</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pickup Point</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Valid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 text-foreground font-mono text-xs">{r.admission_no}</td>
                    <td className="px-3 py-2 text-foreground">{r.full_name}</td>
                    <td className="px-3 py-2 text-foreground">{r.class}</td>
                    <td className="px-3 py-2 text-foreground">{r.pickup_point}</td>
                    <td className="px-3 py-2 text-foreground">{r.parent_phone}</td>
                    <td className="px-3 py-2">
                      {r.full_name && r.admission_no ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleUpload} disabled={uploading} className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload {rows.length} Students
            </Button>
            <Button variant="outline" onClick={() => { setRows([]); setFileName(''); if (fileRef.current) fileRef.current.value = ''; }}>
              Clear
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default BulkCsvUpload;
