import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: string;
  student: { name: string; student_id: string } | null;
  course: { name: string; code: string } | null;
}

export function EnrollmentsManagement() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ student_id: '', course_id: '' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [enrollRes, studentsRes, coursesRes] = await Promise.all([
      supabase.from('enrollments').select('*, student:students(name, student_id), course:courses(name, code)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, name, student_id'),
      supabase.from('courses').select('id, name, code'),
    ]);
    setEnrollments(enrollRes.data as unknown as Enrollment[] || []);
    setStudents(studentsRes.data || []);
    setCourses(coursesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.course_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Select both student and course.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('enrollments').insert([formData]);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Success', description: 'Student enrolled.' }); setDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('enrollments').delete().eq('id', id);
    toast({ title: 'Deleted' });
    fetchData();
  };

  const columns: Column<Enrollment>[] = [
    { key: 'student', header: 'Student', render: (e) => <span className="font-medium">{e.student?.name} ({e.student?.student_id})</span> },
    { key: 'course', header: 'Course', render: (e) => `${e.course?.code} - ${e.course?.name}` },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Enrollments" description="Manage student course enrollments" actions={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Enroll Student</Button>} />
      <DataTable columns={columns} data={enrollments} loading={loading} actions={(e) => <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enroll Student</DialogTitle><DialogDescription>Select a student and course.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Student</Label><Select value={formData.student_id} onValueChange={(v) => setFormData({...formData, student_id: v})}><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.student_id})</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Course</Label><Select value={formData.course_id} onValueChange={(v) => setFormData({...formData, course_id: v})}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Enroll</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
