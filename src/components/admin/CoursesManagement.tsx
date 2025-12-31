import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { syncInsert, syncUpdate, syncDelete } from '@/lib/syncToExternal';

interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  credits: number;
  department_id: string | null;
  instructor_id: string | null;
  semester: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

interface Instructor {
  id: string;
  name: string;
}

const initialFormState = {
  name: '',
  code: '',
  description: '',
  credits: 3,
  department_id: '',
  instructor_id: '',
  semester: '',
};

export function CoursesManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [coursesRes, departmentsRes, instructorsRes] = await Promise.all([
        supabase.from('courses').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name'),
        supabase.from('instructors').select('id, name'),
      ]);

      setCourses(coursesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setInstructors(instructorsRes.data || []);
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
    setEditingCourse(null);
    setFormData(initialFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      code: course.code,
      description: course.description || '',
      credits: course.credits,
      department_id: course.department_id || '',
      instructor_id: course.instructor_id || '',
      semester: course.semester || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (course: Course) => {
    setDeletingCourse(course);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description || null,
        credits: formData.credits,
        department_id: formData.department_id || null,
        instructor_id: formData.instructor_id || null,
        semester: formData.semester || null,
      };

      if (editingCourse) {
        const { data, error } = await supabase
          .from('courses')
          .update(payload)
          .eq('id', editingCourse.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          await syncUpdate('courses', data);
        }
        
        toast({ title: 'Success', description: 'Course updated & synced.' });
      } else {
        const { data, error } = await supabase
          .from('courses')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          await syncInsert('courses', data);
        }
        
        toast({ title: 'Success', description: 'Course created & synced.' });
      }

      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'An error occurred.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCourse) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', deletingCourse.id);

      if (error) throw error;
      
      // Sync delete to external Supabase
      await syncDelete('courses', deletingCourse.id);
      
      toast({ title: 'Success', description: 'Course deleted & synced.' });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'An error occurred.',
      });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Course>[] = [
    { key: 'code', header: 'Code', render: (c) => <span className="font-mono font-medium">{c.code}</span> },
    { key: 'name', header: 'Course Name', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'credits', header: 'Credits', render: (c) => <span className="text-center">{c.credits}</span> },
    { key: 'semester', header: 'Semester', render: (c) => c.semester || '-' },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Courses"
        description="Manage course catalog"
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={courses}
        loading={loading}
        searchPlaceholder="Search courses..."
        emptyMessage="No courses found. Add your first course to get started."
        actions={(course) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(course)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(course)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
            <DialogDescription>
              {editingCourse ? 'Update the course information.' : 'Fill in the details to create a new course.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Course Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., CS101"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="credits">Credits</Label>
                <Select
                  value={String(formData.credits)}
                  onValueChange={(v) => setFormData({ ...formData, credits: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((c) => (
                      <SelectItem key={c} value={String(c)}>{c} Credits</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Course Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Introduction to Computer Science"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Course description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(v) => setFormData({ ...formData, department_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructor">Instructor</Label>
                <Select
                  value={formData.instructor_id}
                  onValueChange={(v) => setFormData({ ...formData, instructor_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester">Semester</Label>
              <Input
                id="semester"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                placeholder="e.g., Fall 2024"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCourse ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingCourse?.name}</strong>? This action cannot be undone.
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
