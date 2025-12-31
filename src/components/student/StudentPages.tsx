import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Loader2, BookOpen, Calendar, Award } from 'lucide-react';
import { format } from 'date-fns';

export function StudentCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
      if (student) {
        const { data } = await supabase.from('enrollments').select('*, course:courses(*)').eq('student_id', student.id);
        setCourses(data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="My Courses" description="View your enrolled courses" />
      {courses.length === 0 ? <p className="text-center text-muted-foreground py-12">No courses enrolled.</p> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((e) => (
            <Card key={e.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center"><BookOpen className="w-6 h-6 text-primary" /></div>
                  <div><h3 className="font-semibold">{e.course.name}</h3><p className="text-sm text-muted-foreground">{e.course.code}</p><p className="text-sm mt-2">{e.course.credits} Credits</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function StudentAttendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
      if (student) {
        const { data } = await supabase.from('attendance').select('*, course:courses(name, code)').eq('student_id', student.id).order('date', { ascending: false });
        setAttendance(data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="My Attendance" description="View your attendance records" />
      {attendance.length === 0 ? <p className="text-center text-muted-foreground py-12">No attendance records.</p> : (
        <div className="space-y-3">
          {attendance.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div><p className="font-medium">{a.course.code} - {a.course.name}</p><p className="text-sm text-muted-foreground">{format(new Date(a.date), 'MMM dd, yyyy')}</p></div>
                </div>
                <StatusBadge status={a.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function StudentResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).maybeSingle();
      if (student) {
        const { data } = await supabase.from('results').select('*, course:courses(name, code)').eq('student_id', student.id).order('created_at', { ascending: false });
        setResults(data || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="My Results" description="View your academic results" />
      {results.length === 0 ? <p className="text-center text-muted-foreground py-12">No results available.</p> : (
        <div className="space-y-3">
          {results.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Award className="w-5 h-5 text-warning" />
                  <div><p className="font-medium">{r.course.code} - {r.course.name}</p><p className="text-sm text-muted-foreground">{r.exam_type}</p></div>
                </div>
                <div className="text-right"><p className="text-xl font-bold">{r.marks_obtained}/{r.total_marks}</p>{r.grade && <p className="text-sm text-muted-foreground">Grade: {r.grade}</p>}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
