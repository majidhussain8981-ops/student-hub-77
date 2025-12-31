import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Users, BookOpen, Building2, UserCog, ClipboardList, Calendar, Award, TrendingUp } from 'lucide-react';

interface DashboardStats {
  students: number;
  courses: number;
  departments: number;
  instructors: number;
  enrollments: number;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    students: 0,
    courses: 0,
    departments: 0,
    instructors: 0,
    enrollments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [studentsRes, coursesRes, departmentsRes, instructorsRes, enrollmentsRes, recentStudentsRes] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('departments').select('id', { count: 'exact', head: true }),
          supabase.from('instructors').select('id', { count: 'exact', head: true }),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }),
          supabase.from('students').select('*').order('created_at', { ascending: false }).limit(5),
        ]);

        setStats({
          students: studentsRes.count || 0,
          courses: coursesRes.count || 0,
          departments: departmentsRes.count || 0,
          instructors: instructorsRes.count || 0,
          enrollments: enrollmentsRes.count || 0,
        });
        setRecentStudents(recentStudentsRes.data || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <PageHeader
        title="Admin Dashboard"
        description={`Welcome back! Here's what's happening in your institution.`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Students"
          value={stats.students}
          icon={Users}
          description="Active students enrolled"
          iconClassName="bg-info/10 text-info"
        />
        <StatCard
          title="Courses"
          value={stats.courses}
          icon={BookOpen}
          description="Available courses"
          iconClassName="bg-success/10 text-success"
        />
        <StatCard
          title="Departments"
          value={stats.departments}
          icon={Building2}
          description="Academic departments"
          iconClassName="bg-warning/10 text-warning"
        />
        <StatCard
          title="Instructors"
          value={stats.instructors}
          icon={UserCog}
          description="Teaching faculty"
          iconClassName="bg-accent/10 text-accent"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Enrollments"
          value={stats.enrollments}
          icon={ClipboardList}
          description="Course enrollments"
        />
        <StatCard
          title="Attendance Rate"
          value="--"
          icon={Calendar}
          description="Average attendance"
        />
        <StatCard
          title="Average Performance"
          value="--"
          icon={Award}
          description="Overall grade average"
        />
      </div>

      {/* Recent Students */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Recent Students
          </CardTitle>
          <CardDescription>Latest student registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No students registered yet. Add your first student to get started!
            </p>
          ) : (
            <div className="space-y-3">
              {recentStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {student.name?.charAt(0).toUpperCase() || 'S'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">{student.student_id}</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{student.email}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
