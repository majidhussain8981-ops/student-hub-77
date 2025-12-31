import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  head_name: string | null;
  created_at: string;
}

const initialFormState = {
  name: '',
  code: '',
  description: '',
  head_name: '',
};

export function DepartmentsManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateDialog = () => {
    setEditingDepartment(null);
    setFormData(initialFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      code: department.code,
      description: department.description || '',
      head_name: department.head_name || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (department: Department) => {
    setDeletingDepartment(department);
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
        head_name: formData.head_name || null,
      };

      if (editingDepartment) {
        const { error } = await supabase
          .from('departments')
          .update(payload)
          .eq('id', editingDepartment.id);
        
        if (error) throw error;
        toast({ title: 'Success', description: 'Department updated successfully.' });
      } else {
        const { error } = await supabase.from('departments').insert([payload]);
        if (error) throw error;
        toast({ title: 'Success', description: 'Department created successfully.' });
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
    if (!deletingDepartment) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deletingDepartment.id);

      if (error) throw error;
      
      toast({ title: 'Success', description: 'Department deleted successfully.' });
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

  const columns: Column<Department>[] = [
    { key: 'code', header: 'Code', render: (d) => <span className="font-mono font-medium">{d.code}</span> },
    { key: 'name', header: 'Department Name', render: (d) => <span className="font-medium">{d.name}</span> },
    { key: 'head_name', header: 'Head', render: (d) => d.head_name || '-' },
    { key: 'description', header: 'Description', render: (d) => (
      <span className="text-muted-foreground line-clamp-1">{d.description || '-'}</span>
    )},
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Departments"
        description="Manage academic departments"
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Department
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={departments}
        loading={loading}
        searchPlaceholder="Search departments..."
        emptyMessage="No departments found. Add your first department to get started."
        actions={(department) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(department)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(department)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDepartment ? 'Edit Department' : 'Add New Department'}</DialogTitle>
            <DialogDescription>
              {editingDepartment ? 'Update the department information.' : 'Fill in the details to create a new department.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Department Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., CS"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="head_name">Head of Department</Label>
                <Input
                  id="head_name"
                  value={formData.head_name}
                  onChange={(e) => setFormData({ ...formData, head_name: e.target.value })}
                  placeholder="Dr. Imran Malik"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Department Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Computer Science"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Department description..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingDepartment ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingDepartment?.name}</strong>? This action cannot be undone.
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
