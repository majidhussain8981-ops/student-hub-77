import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { 
  Users, BookOpen, Building2, UserCog, ClipboardList, Calendar, Award, 
  TrendingUp, Plus, ArrowRight, Loader2 
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  students: number;
  courses: number;
  departments: number;
  instructors: number;
  enrollments: number;
  attendanceRate: number;
  avgPerformance: number;
}

interface RecentActivity {
  id: string;
  type: 'student' | 'enrollment' | 'attendance' | 'result';
  description: string;
  timestamp: string;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileName, setProfileName] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats>({
    students: 0,
    courses: 0,
    departments: 0,
    instructors: 0,
    enrollments: 0,
    attendanceRate: 0,
    avgPerformance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentStudents, setRecentStudents] = useState<any[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch admin profile name
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', user.id)
            .maybeSingle();
          setProfileName(profile?.full_name || user.user_metadata?.full_name || 'Admin');
        }

        const [
          studentsRes, 
          coursesRes, 
          departmentsRes, 
          instructorsRes, 
          enrollmentsRes, 
          recentStudentsRes,
          attendanceRes,
          resultsRes,
          recentEnrollmentsRes,
          recentAttendanceRes
        ] = await Promise.all([
          supabase.from('students').select('id', { count: 'exact', head: true }),
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('departments').select('id', { count: 'exact', head: true }),
          supabase.from('instructors').select('id', { count: 'exact', head: true }),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }),
          supabase.from('students').select('*').order('created_at', { ascending: false }).limit(5),
          supabase.from('attendance').select('status'),
          supabase.from('results').select('marks_obtained, total_marks'),
          supabase.from('enrollments').select('*, student:students(name), course:courses(name, code)').order('created_at', { ascending: false }).limit(5),
          supabase.from('attendance').select('*, student:students(name), course:courses(code)').order('created_at', { ascending: false }).limit(5),
        ]);

        // Calculate attendance rate
        const attendanceData = attendanceRes.data || [];
        const presentCount = attendanceData.filter(a => a.status === 'present' || a.status === 'late').length;
        const attendanceRate = attendanceData.length > 0 
          ? Math.round((presentCount / attendanceData.length) * 100) 
          : 0;

        // Calculate average performance
        const resultsData = resultsRes.data || [];
        const avgPerformance = resultsData.length > 0
          ? Math.round(resultsData.reduce((sum, r) => sum + (Number(r.marks_obtained) / Number(r.total_marks) * 100), 0) / resultsData.length)
          : 0;

        setStats({
          students: studentsRes.count || 0,
          courses: coursesRes.count || 0,
          departments: departmentsRes.count || 0,
          instructors: instructorsRes.count || 0,
          enrollments: enrollmentsRes.count || 0,
          attendanceRate,
          avgPerformance,
        });
        setRecentStudents(recentStudentsRes.data || []);
        setRecentEnrollments(recentEnrollmentsRes.data || []);
        setRecentAttendance(recentAttendanceRes.data || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={`Welcome, ${profileName}!`}
        description="Here's what's happening in your institution today."
      />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Button onClick={() => navigate('/students')} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
        <Button onClick={() => navigate('/courses')} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Course
        </Button>
        <Button onClick={() => navigate('/enrollments')} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Enrollment
        </Button>
        <Button onClick={() => navigate('/attendance')} variant="outline" size="sm">
          <Calendar className="w-4 h-4 mr-2" />
          Record Attendance
        </Button>
        <Button onClick={() => navigate('/results')} variant="outline" size="sm">
          <Award className="w-4 h-4 mr-2" />
          Add Result
        </Button>
      </div>

      {/* Primary Stats Grid */}
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
          value={`${stats.attendanceRate}%`}
          icon={Calendar}
          description="Average attendance"
          iconClassName={stats.attendanceRate >= 75 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
        />
        <StatCard
          title="Average Performance"
          value={`${stats.avgPerformance}%`}
          icon={Award}
          description="Overall grade average"
          iconClassName={stats.avgPerformance >= 60 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
        />
      </div>

      {/* Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Students */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent" />
                Recent Students
              </CardTitle>
              <CardDescription>Latest student registrations</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/students')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students registered yet.
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
                    <StatusBadge status={student.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Enrollments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-info" />
                Recent Enrollments
              </CardTitle>
              <CardDescription>Latest course enrollments</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/enrollments')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentEnrollments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No enrollments yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentEnrollments.map((enrollment: any) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium">{enrollment.student?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {enrollment.course?.code} - {enrollment.course?.name}
                      </p>
                    </div>
                    <StatusBadge status={enrollment.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-success" />
                Recent Attendance
              </CardTitle>
              <CardDescription>Latest attendance records</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/attendance')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentAttendance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No attendance records yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentAttendance.map((att: any) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{att.student?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {att.course?.code} • {format(new Date(att.date), 'MMM dd')}
                      </p>
                    </div>
                    <StatusBadge status={att.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
