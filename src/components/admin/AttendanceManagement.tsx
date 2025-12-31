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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { syncInsert, syncUpdate, syncDelete } from '@/lib/syncToExternal';

interface Attendance {
  id: string;
  student_id: string;
  course_id: string;
  date: string;
  status: string;
  remarks: string | null;
  student: { name: string; student_id: string } | null;
  course: { name: string; code: string } | null;
}

interface Student {
  id: string;
  name: string;
  student_id: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
}

const initialFormState = {
  student_id: '',
  course_id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  status: 'present',
  remarks: '',
};

export function AttendanceManagement() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [deletingAttendance, setDeletingAttendance] = useState<Attendance | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [attRes, studentsRes, coursesRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('*, student:students(name, student_id), course:courses(name, code)')
          .order('date', { ascending: false }),
        supabase.from('students').select('id, name, student_id'),
        supabase.from('courses').select('id, name, code'),
      ]);
      setAttendance(attRes.data as unknown as Attendance[] || []);
      setStudents(studentsRes.data || []);
      setCourses(coursesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateDialog = () => {
    setEditingAttendance(null);
    setFormData(initialFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (att: Attendance) => {
    setEditingAttendance(att);
    setFormData({
      student_id: att.student_id,
      course_id: att.course_id,
      date: att.date,
      status: att.status,
      remarks: att.remarks || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (att: Attendance) => {
    setDeletingAttendance(att);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.course_id || !formData.date) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        student_id: formData.student_id,
        course_id: formData.course_id,
        date: formData.date,
        status: formData.status,
        remarks: formData.remarks || null,
      };

      if (editingAttendance) {
        const { data, error } = await supabase
          .from('attendance')
          .update(payload)
          .eq('id', editingAttendance.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          syncUpdate('attendance', data);
        }
        
        toast({ title: 'Success', description: 'Attendance updated successfully.' });
      } else {
        const { data, error } = await supabase
          .from('attendance')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          syncInsert('attendance', data);
        }
        
        toast({ title: 'Success', description: 'Attendance recorded successfully.' });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAttendance) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', deletingAttendance.id);

      if (error) throw error;
      
      // Sync delete to external Supabase
      syncDelete('attendance', deletingAttendance.id);

      toast({ title: 'Success', description: 'Attendance deleted successfully.' });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Attendance>[] = [
    { 
      key: 'date', 
      header: 'Date', 
      render: (a) => format(new Date(a.date), 'MMM dd, yyyy') 
    },
    { 
      key: 'student', 
      header: 'Student', 
      render: (a) => (
        <div>
          <span className="font-medium">{a.student?.name}</span>
          <p className="text-sm text-muted-foreground">{a.student?.student_id}</p>
        </div>
      ) 
    },
    { 
      key: 'course', 
      header: 'Course', 
      render: (a) => (
        <div>
          <span className="font-medium">{a.course?.code}</span>
          <p className="text-sm text-muted-foreground">{a.course?.name}</p>
        </div>
      ) 
    },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { 
      key: 'remarks', 
      header: 'Remarks', 
      render: (a) => <span className="text-sm text-muted-foreground">{a.remarks || '-'}</span> 
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader 
        title="Attendance" 
        description="Record and manage student attendance" 
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Record Attendance
          </Button>
        } 
      />

      <DataTable 
        columns={columns} 
        data={attendance} 
        loading={loading}
        searchPlaceholder="Search attendance..."
        emptyMessage="No attendance records found."
        actions={(att) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(att)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(att)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAttendance ? 'Edit Attendance' : 'Record Attendance'}</DialogTitle>
            <DialogDescription>
              {editingAttendance ? 'Update the attendance record.' : 'Record attendance for a student.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input 
                type="date" 
                value={formData.date} 
                onChange={(e) => setFormData({...formData, date: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select 
                value={formData.student_id} 
                onValueChange={(v) => setFormData({...formData, student_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.student_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select 
                value={formData.course_id} 
                onValueChange={(v) => setFormData({...formData, course_id: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({...formData, status: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="excused">Excused</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea 
                value={formData.remarks} 
                onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                placeholder="Optional remarks..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingAttendance ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Attendance Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this attendance record for{' '}
              <strong>{deletingAttendance?.student?.name}</strong> on{' '}
              <strong>{deletingAttendance?.date}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
