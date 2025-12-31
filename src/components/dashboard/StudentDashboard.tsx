import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { BookOpen, Calendar, Award, User, Loader2 } from 'lucide-react';

interface StudentData {
  id: string;
  student_id: string;
  name: string;
  email: string;
  semester: number;
  status: string;
}

interface EnrollmentWithCourse {
  id: string;
  course: {
    name: string;
    code: string;
    credits: number;
  };
}

export function StudentDashboard() {
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, total: 0 });
  const [avgGrade, setAvgGrade] = useState<number | null>(null);

  useEffect(() => {
    const fetchStudentData = async () => {
      if (!user) return;

      try {
        // Fetch student record
        const { data: studentData, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (studentError) throw studentError;
        
        if (!studentData) {
          setLoading(false);
          return;
        }

        setStudent(studentData);

        // Fetch enrollments with course details
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select(`
            id,
            course:courses (
              name,
              code,
              credits
            )
          `)
          .eq('student_id', studentData.id);

        setEnrollments(enrollmentsData as unknown as EnrollmentWithCourse[] || []);

        // Fetch attendance stats
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status')
          .eq('student_id', studentData.id);

        if (attendanceData) {
          const present = attendanceData.filter(a => a.status === 'present').length;
          setAttendanceStats({ present, total: attendanceData.length });
        }

        // Fetch results average
        const { data: resultsData } = await supabase
          .from('results')
          .select('marks_obtained, total_marks')
          .eq('student_id', studentData.id);

        if (resultsData && resultsData.length > 0) {
          const avg = resultsData.reduce((sum, r) => sum + (Number(r.marks_obtained) / Number(r.total_marks) * 100), 0) / resultsData.length;
          setAvgGrade(Math.round(avg * 10) / 10);
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <User className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Student Profile Not Found</h2>
          <p className="text-muted-foreground">
            Your student profile has not been set up yet. Please contact an administrator.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.present / attendanceStats.total) * 100) 
    : 0;

  return (
    <DashboardLayout>
      <PageHeader
        title={`Welcome, ${student.name}!`}
        description="Here's your academic overview"
      />

      {/* Student Info Card */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="text-2xl font-bold">{student.name}</h2>
              <p className="text-muted-foreground">{student.email}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="text-sm bg-muted px-3 py-1 rounded-full">
                  ID: {student.student_id}
                </span>
                <span className="text-sm bg-muted px-3 py-1 rounded-full">
                  Semester {student.semester}
                </span>
                <StatusBadge status={student.status} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Enrolled Courses"
          value={enrollments.length}
          icon={BookOpen}
          description="Active course enrollments"
          iconClassName="bg-info/10 text-info"
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendancePercentage}%`}
          icon={Calendar}
          description={`${attendanceStats.present} of ${attendanceStats.total} classes`}
          iconClassName="bg-success/10 text-success"
        />
        <StatCard
          title="Average Grade"
          value={avgGrade !== null ? `${avgGrade}%` : '--'}
          icon={Award}
          description="Overall performance"
          iconClassName="bg-warning/10 text-warning"
        />
      </div>

      {/* Enrolled Courses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            My Courses
          </CardTitle>
          <CardDescription>Courses you are currently enrolled in</CardDescription>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              You are not enrolled in any courses yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{enrollment.course.name}</h3>
                      <p className="text-sm text-muted-foreground">{enrollment.course.code}</p>
                    </div>
                    <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                      {enrollment.course.credits} Credits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
