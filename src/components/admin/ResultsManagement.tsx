import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';

interface Result { id: string; student_id: string; course_id: string; exam_type: string; marks_obtained: number; total_marks: number; grade: string | null; student: { name: string } | null; course: { name: string; code: string } | null; }

export function ResultsManagement() {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ student_id: '', course_id: '', exam_type: 'Midterm', marks_obtained: '', total_marks: '100', grade: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [resRes, studentsRes, coursesRes] = await Promise.all([
      supabase.from('results').select('*, student:students(name), course:courses(name, code)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, name'),
      supabase.from('courses').select('id, name, code'),
    ]);
    setResults(resRes.data as unknown as Result[] || []);
    setStudents(studentsRes.data || []);
    setCourses(coursesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.course_id || !formData.marks_obtained) { toast({ variant: 'destructive', title: 'Error', description: 'Fill all fields.' }); return; }
    setSaving(true);
    const { error } = await supabase.from('results').insert([{ ...formData, marks_obtained: parseFloat(formData.marks_obtained), total_marks: parseFloat(formData.total_marks) }]);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Saved' }); setDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  const columns: Column<Result>[] = [
    { key: 'student', header: 'Student', render: (r) => r.student?.name },
    { key: 'course', header: 'Course', render: (r) => r.course?.code },
    { key: 'exam_type', header: 'Exam' },
    { key: 'marks', header: 'Marks', render: (r) => `${r.marks_obtained}/${r.total_marks}` },
    { key: 'grade', header: 'Grade', render: (r) => r.grade || '-' },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Results" description="Manage student results" actions={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Result</Button>} />
      <DataTable columns={columns} data={results} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Result</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Student</Label><Select value={formData.student_id} onValueChange={(v) => setFormData({...formData, student_id: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Course</Label><Select value={formData.course_id} onValueChange={(v) => setFormData({...formData, course_id: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Exam Type</Label><Select value={formData.exam_type} onValueChange={(v) => setFormData({...formData, exam_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Midterm">Midterm</SelectItem><SelectItem value="Final">Final</SelectItem><SelectItem value="Quiz">Quiz</SelectItem><SelectItem value="Assignment">Assignment</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Grade</Label><Input value={formData.grade} onChange={(e) => setFormData({...formData, grade: e.target.value})} placeholder="A, B, C..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Marks Obtained</Label><Input type="number" value={formData.marks_obtained} onChange={(e) => setFormData({...formData, marks_obtained: e.target.value})} /></div>
              <div className="space-y-2"><Label>Total Marks</Label><Input type="number" value={formData.total_marks} onChange={(e) => setFormData({...formData, total_marks: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
