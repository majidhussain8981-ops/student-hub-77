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
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { syncInsert, syncUpdate, syncDelete } from '@/lib/syncToExternal';

interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: string;
  enrollment_date: string;
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
  status: 'enrolled',
};

export function EnrollmentsManagement() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [deletingEnrollment, setDeletingEnrollment] = useState<Enrollment | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [enrollRes, studentsRes, coursesRes] = await Promise.all([
        supabase
          .from('enrollments')
          .select('*, student:students(name, student_id), course:courses(name, code)')
          .order('created_at', { ascending: false }),
        supabase.from('students').select('id, name, student_id'),
        supabase.from('courses').select('id, name, code'),
      ]);
      setEnrollments(enrollRes.data as unknown as Enrollment[] || []);
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
    setEditingEnrollment(null);
    setFormData(initialFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (enrollment: Enrollment) => {
    setEditingEnrollment(enrollment);
    setFormData({
      student_id: enrollment.student_id,
      course_id: enrollment.course_id,
      status: enrollment.status,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (enrollment: Enrollment) => {
    setDeletingEnrollment(enrollment);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.course_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Select both student and course.' });
      return;
    }

    setSaving(true);
    try {
      if (editingEnrollment) {
        const { data, error } = await supabase
          .from('enrollments')
          .update({ status: formData.status })
          .eq('id', editingEnrollment.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          await syncUpdate('enrollments', data);
        }
        
        toast({ title: 'Success', description: 'Enrollment updated & synced.' });
      } else {
        // Check for duplicate enrollment
        const { data: existing } = await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', formData.student_id)
          .eq('course_id', formData.course_id)
          .maybeSingle();

        if (existing) {
          toast({ variant: 'destructive', title: 'Error', description: 'Student is already enrolled in this course.' });
          setSaving(false);
          return;
        }

        const { data, error } = await supabase
          .from('enrollments')
          .insert([formData])
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          await syncInsert('enrollments', data);
        }
        
        toast({ title: 'Success', description: 'Student enrolled & synced.' });
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
    if (!deletingEnrollment) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', deletingEnrollment.id);

      if (error) throw error;
      
      // Sync delete to external Supabase
      await syncDelete('enrollments', deletingEnrollment.id);

      toast({ title: 'Success', description: 'Enrollment deleted & synced.' });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Enrollment>[] = [
    { 
      key: 'student', 
      header: 'Student', 
      render: (e) => (
        <div>
          <span className="font-medium">{e.student?.name}</span>
          <p className="text-sm text-muted-foreground">{e.student?.student_id}</p>
        </div>
      ) 
    },
    { 
      key: 'course', 
      header: 'Course', 
      render: (e) => (
        <div>
          <span className="font-medium">{e.course?.code}</span>
          <p className="text-sm text-muted-foreground">{e.course?.name}</p>
        </div>
      ) 
    },
    { 
      key: 'enrollment_date', 
      header: 'Date', 
      render: (e) => format(new Date(e.enrollment_date), 'MMM dd, yyyy') 
    },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
  ];

  return (
    <DashboardLayout>
      <PageHeader 
        title="Enrollments" 
        description="Manage student course enrollments" 
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Enroll Student
          </Button>
        } 
      />

      <DataTable 
        columns={columns} 
        data={enrollments} 
        loading={loading}
        searchPlaceholder="Search enrollments..."
        emptyMessage="No enrollments found."
        actions={(enrollment) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(enrollment)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(enrollment)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEnrollment ? 'Edit Enrollment' : 'Enroll Student'}</DialogTitle>
            <DialogDescription>
              {editingEnrollment ? 'Update the enrollment status.' : 'Select a student and course to create an enrollment.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select 
                value={formData.student_id} 
                onValueChange={(v) => setFormData({...formData, student_id: v})}
                disabled={!!editingEnrollment}
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
                disabled={!!editingEnrollment}
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
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({...formData, status: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingEnrollment ? 'Update' : 'Enroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Enrollment</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{deletingEnrollment?.student?.name}</strong> from{' '}
              <strong>{deletingEnrollment?.course?.name}</strong>? This action cannot be undone.
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
