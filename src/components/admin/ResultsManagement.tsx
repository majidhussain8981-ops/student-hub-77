import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { syncInsert, syncUpdate, syncDelete } from '@/lib/syncToExternal';

interface Result {
  id: string;
  student_id: string;
  course_id: string;
  exam_type: string;
  marks_obtained: number;
  total_marks: number;
  grade: string | null;
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
  exam_type: 'Midterm',
  marks_obtained: '',
  total_marks: '100',
  grade: '',
  remarks: '',
};

export function ResultsManagement() {
  const [results, setResults] = useState<Result[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<Result | null>(null);
  const [deletingResult, setDeletingResult] = useState<Result | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [resRes, studentsRes, coursesRes] = await Promise.all([
        supabase
          .from('results')
          .select('*, student:students(name, student_id), course:courses(name, code)')
          .order('created_at', { ascending: false }),
        supabase.from('students').select('id, name, student_id'),
        supabase.from('courses').select('id, name, code'),
      ]);
      setResults(resRes.data as unknown as Result[] || []);
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
    setEditingResult(null);
    setFormData(initialFormState);
    setDialogOpen(true);
  };

  const openEditDialog = (result: Result) => {
    setEditingResult(result);
    setFormData({
      student_id: result.student_id,
      course_id: result.course_id,
      exam_type: result.exam_type,
      marks_obtained: String(result.marks_obtained),
      total_marks: String(result.total_marks),
      grade: result.grade || '',
      remarks: result.remarks || '',
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (result: Result) => {
    setDeletingResult(result);
    setDeleteDialogOpen(true);
  };

  // Auto-calculate grade based on percentage
  const calculateGrade = (marks: number, total: number): string => {
    const percentage = (marks / total) * 100;
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  };

  const handleSubmit = async () => {
    if (!formData.student_id || !formData.course_id || !formData.marks_obtained) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields.' });
      return;
    }

    const marksObtained = parseFloat(formData.marks_obtained);
    const totalMarks = parseFloat(formData.total_marks);

    if (marksObtained > totalMarks) {
      toast({ variant: 'destructive', title: 'Error', description: 'Marks obtained cannot exceed total marks.' });
      return;
    }

    setSaving(true);
    try {
      const grade = formData.grade || calculateGrade(marksObtained, totalMarks);
      
      const payload = {
        student_id: formData.student_id,
        course_id: formData.course_id,
        exam_type: formData.exam_type,
        marks_obtained: marksObtained,
        total_marks: totalMarks,
        grade,
        remarks: formData.remarks || null,
      };

      if (editingResult) {
        const { data, error } = await supabase
          .from('results')
          .update(payload)
          .eq('id', editingResult.id)
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          syncUpdate('results', data);
        }
        
        toast({ title: 'Success', description: 'Result updated successfully.' });
      } else {
        const { data, error } = await supabase
          .from('results')
          .insert([payload])
          .select()
          .single();
        
        if (error) throw error;
        
        // Sync to external Supabase
        if (data) {
          syncInsert('results', data);
        }
        
        toast({ title: 'Success', description: 'Result added successfully.' });
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
    if (!deletingResult) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('results')
        .delete()
        .eq('id', deletingResult.id);

      if (error) throw error;
      
      // Sync delete to external Supabase
      syncDelete('results', deletingResult.id);

      toast({ title: 'Success', description: 'Result deleted successfully.' });
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Result>[] = [
    { 
      key: 'student', 
      header: 'Student', 
      render: (r) => (
        <div>
          <span className="font-medium">{r.student?.name}</span>
          <p className="text-sm text-muted-foreground">{r.student?.student_id}</p>
        </div>
      ) 
    },
    { 
      key: 'course', 
      header: 'Course', 
      render: (r) => (
        <div>
          <span className="font-medium">{r.course?.code}</span>
          <p className="text-sm text-muted-foreground">{r.course?.name}</p>
        </div>
      ) 
    },
    { key: 'exam_type', header: 'Exam Type' },
    { 
      key: 'marks', 
      header: 'Marks', 
      render: (r) => (
        <div className="text-right">
          <span className="font-bold">{r.marks_obtained}</span>
          <span className="text-muted-foreground">/{r.total_marks}</span>
          <p className="text-sm text-muted-foreground">
            {Math.round((r.marks_obtained / r.total_marks) * 100)}%
          </p>
        </div>
      ) 
    },
    { 
      key: 'grade', 
      header: 'Grade', 
      render: (r) => (
        <span className={`font-bold text-lg ${
          r.grade === 'A+' || r.grade === 'A' ? 'text-success' :
          r.grade === 'B' ? 'text-info' :
          r.grade === 'C' ? 'text-warning' :
          'text-destructive'
        }`}>
          {r.grade || '-'}
        </span>
      ) 
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader 
        title="Results" 
        description="Manage student exam results and grades" 
        actions={
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Result
          </Button>
        } 
      />

      <DataTable 
        columns={columns} 
        data={results} 
        loading={loading}
        searchPlaceholder="Search results..."
        emptyMessage="No results found."
        actions={(result) => (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => openEditDialog(result)}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(result)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingResult ? 'Edit Result' : 'Add Result'}</DialogTitle>
            <DialogDescription>
              {editingResult ? 'Update the exam result.' : 'Enter the exam result details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Exam Type *</Label>
                <Select 
                  value={formData.exam_type} 
                  onValueChange={(v) => setFormData({...formData, exam_type: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Midterm">Midterm</SelectItem>
                    <SelectItem value="Final">Final</SelectItem>
                    <SelectItem value="Quiz">Quiz</SelectItem>
                    <SelectItem value="Assignment">Assignment</SelectItem>
                    <SelectItem value="Project">Project</SelectItem>
                    <SelectItem value="Practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grade (auto-calculated if empty)</Label>
                <Input 
                  value={formData.grade} 
                  onChange={(e) => setFormData({...formData, grade: e.target.value})}
                  placeholder="A, B, C..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marks Obtained *</Label>
                <Input 
                  type="number" 
                  value={formData.marks_obtained} 
                  onChange={(e) => setFormData({...formData, marks_obtained: e.target.value})}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Marks *</Label>
                <Input 
                  type="number" 
                  value={formData.total_marks} 
                  onChange={(e) => setFormData({...formData, total_marks: e.target.value})}
                  placeholder="100"
                  min="1"
                />
              </div>
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
              {editingResult ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Result</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {deletingResult?.exam_type} result for{' '}
              <strong>{deletingResult?.student?.name}</strong> in{' '}
              <strong>{deletingResult?.course?.name}</strong>? This action cannot be undone.
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
