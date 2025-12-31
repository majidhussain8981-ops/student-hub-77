import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Attendance { id: string; student_id: string; course_id: string; date: string; status: string; student: { name: string } | null; course: { name: string; code: string } | null; }

export function AttendanceManagement() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ student_id: '', course_id: '', date: format(new Date(), 'yyyy-MM-dd'), status: 'present' });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    const [attRes, studentsRes, coursesRes] = await Promise.all([
      supabase.from('attendance').select('*, student:students(name), course:courses(name, code)').order('date', { ascending: false }),
      supabase.from('students').select('id, name'),
      supabase.from('courses').select('id, name, code'),
    ]);
    setAttendance(attRes.data as unknown as Attendance[] || []);
    setStudents(studentsRes.data || []);
    setCourses(coursesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.course_id) { toast({ variant: 'destructive', title: 'Error', description: 'Fill all fields.' }); return; }
    setSaving(true);
    const { error } = await supabase.from('attendance').insert([formData]);
    if (error) toast({ variant: 'destructive', title: 'Error', description: error.message });
    else { toast({ title: 'Recorded' }); setDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  const columns: Column<Attendance>[] = [
    { key: 'date', header: 'Date', render: (a) => format(new Date(a.date), 'MMM dd, yyyy') },
    { key: 'student', header: 'Student', render: (a) => a.student?.name },
    { key: 'course', header: 'Course', render: (a) => `${a.course?.code}` },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Attendance" description="Record and manage attendance" actions={<Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />Record Attendance</Button>} />
      <DataTable columns={columns} data={attendance} loading={loading} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Attendance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} /></div>
            <div className="space-y-2"><Label>Student</Label><Select value={formData.student_id} onValueChange={(v) => setFormData({...formData, student_id: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Course</Label><Select value={formData.course_id} onValueChange={(v) => setFormData({...formData, course_id: v})}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Status</Label><Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="present">Present</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="excused">Excused</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
