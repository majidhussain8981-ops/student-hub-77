import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface Instructor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  qualification: string | null;
  specialization: string | null;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

const initialFormState = {
  name: '',
  email: '',
  phone: '',
  department_id: '',
  qualification: '',
  specialization: '',
};

export function InstructorsManagement() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);
  const [deletingInstructor, setDeletingInstructor] = useState<Instructor | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [instructorsRes, departmentsRes] = await Promise.all([
        supabase.from('instructors').select('*').order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name'),
      ]);

      setInstructors(instructorsRes.data || []);
      setDepartments(departmentsRes.data || []);
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
    setEditingInstructor(null);
    setFormData(initialFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setFormData({
      name: instructor.name,
      email: instructor.email,
      phone: instructor.phone || '',
      department_id: instructor.department_id || '',
      qualification: instructor.qualification || '',
      specialization: instructor.specialization || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (instructor: Instructor) => {
    setDeletingInstructor(instructor);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
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
        email: formData.email,
        phone: formData.phone || null,
        department_id: formData.department_id || null,
        qualification: formData.qualification || null,
        specialization: formData.specialization || null,
      };

      if (editingInstructor) {
        const { data, error } = await supabase
          .from('instructors')
          .update(payload)
          .eq('id', editingInstructor.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          syncUpdate('instructors', data);
        }
        
        toast({ title: 'Success', description: 'Instructor updated successfully.' });
      } else {
        const { data, error } = await supabase
          .from('instructors')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          syncInsert('instructors', data);
        }
        
        toast({ title: 'Success', description: 'Instructor created successfully.' });
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
    if (!deletingInstructor) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('instructors')
        .delete()
        .eq('id', deletingInstructor.id);

      if (error) throw error;
      
      // Sync delete to external Supabase
      syncDelete('instructors', deletingInstructor.id);
      
      toast({ title: 'Success', description: 'Instructor deleted successfully.' });
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

  const columns: Column<Instructor>[] = [
    { key: 'name', header: 'Name', render: (i) => <span className="font-medium">{i.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'qualification', header: 'Qualification', render: (i) => i.qualification || '-' },
    { key: 'specialization', header: 'Specialization', render: (i) => i.specialization || '-' },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Instructors"
        description="Manage teaching faculty"
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Instructor
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={instructors}
        loading={loading}
        searchPlaceholder="Search instructors..."
        emptyMessage="No instructors found. Add your first instructor to get started."
        actions={(instructor) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(instructor)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(instructor)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingInstructor ? 'Edit Instructor' : 'Add New Instructor'}</DialogTitle>
            <DialogDescription>
              {editingInstructor ? 'Update the instructor information.' : 'Fill in the details to add a new instructor.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Dr. Fatima Noor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="fatima@university.edu"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+92-321-1234567"
                />
              </div>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification</Label>
                <Input
                  id="qualification"
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  placeholder="Ph.D. in Computer Science"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                  placeholder="Machine Learning"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingInstructor ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Instructor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingInstructor?.name}</strong>? This action cannot be undone.
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
