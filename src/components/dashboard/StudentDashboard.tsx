import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Calendar, Award, User, Loader2, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface StudentData {
  id: string;
  student_id: string;
  name: string;
  email: string;
  phone: string | null;
  semester: number;
  status: string;
  department_id: string | null;
}

interface EnrollmentWithCourse {
  id: string;
  status: string;
  course: {
    id: string;
    name: string;
    code: string;
    credits: number;
  };
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  course: {
    code: string;
    name: string;
  };
}

interface ResultRecord {
  id: string;
  exam_type: string;
  marks_obtained: number;
  total_marks: number;
  grade: string | null;
  course: {
    code: string;
    name: string;
  };
}

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithCourse[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [recentResults, setRecentResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [avgGrade, setAvgGrade] = useState<number | null>(null);
  const [department, setDepartment] = useState<string | null>(null);

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

        // Fetch department name
        if (studentData.department_id) {
          const { data: deptData } = await supabase
            .from('departments')
            .select('name')
            .eq('id', studentData.department_id)
            .maybeSingle();
          setDepartment(deptData?.name || null);
        }

        // Fetch all data in parallel
        const [enrollmentsRes, attendanceRes, resultsRes] = await Promise.all([
          supabase
            .from('enrollments')
            .select(`id, status, course:courses(id, name, code, credits)`)
            .eq('student_id', studentData.id),
          supabase
            .from('attendance')
            .select(`id, date, status, course:courses(code, name)`)
            .eq('student_id', studentData.id)
            .order('date', { ascending: false }),
          supabase
            .from('results')
            .select(`id, exam_type, marks_obtained, total_marks, grade, course:courses(code, name)`)
            .eq('student_id', studentData.id)
            .order('created_at', { ascending: false }),
        ]);

        setEnrollments(enrollmentsRes.data as unknown as EnrollmentWithCourse[] || []);
        setRecentAttendance((attendanceRes.data as unknown as AttendanceRecord[] || []).slice(0, 5));
        setRecentResults((resultsRes.data as unknown as ResultRecord[] || []).slice(0, 5));

        // Calculate attendance stats
        const allAttendance = attendanceRes.data || [];
        const present = allAttendance.filter(a => a.status === 'present').length;
        const absent = allAttendance.filter(a => a.status === 'absent').length;
        const late = allAttendance.filter(a => a.status === 'late').length;
        setAttendanceStats({ present, absent, late, total: allAttendance.length });

        // Calculate average grade
        const allResults = resultsRes.data || [];
        if (allResults.length > 0) {
          const avg = allResults.reduce((sum, r) => sum + (Number(r.marks_obtained) / Number(r.total_marks) * 100), 0) / allResults.length;
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

  const totalCredits = enrollments.reduce((sum, e) => sum + (e.course?.credits || 0), 0);

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
                {department && (
                  <span className="text-sm bg-muted px-3 py-1 rounded-full">
                    {department}
                  </span>
                )}
                <StatusBadge status={student.status} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Enrolled Courses"
          value={enrollments.length}
          icon={BookOpen}
          description={`${totalCredits} total credits`}
          iconClassName="bg-info/10 text-info"
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendancePercentage}%`}
          icon={Calendar}
          description={`${attendanceStats.present}/${attendanceStats.total} classes`}
          iconClassName={attendancePercentage >= 75 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
        />
        <StatCard
          title="Average Grade"
          value={avgGrade !== null ? `${avgGrade}%` : '--'}
          icon={Award}
          description="Overall performance"
          iconClassName={avgGrade !== null && avgGrade >= 60 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
        />
        <StatCard
          title="Total Results"
          value={recentResults.length}
          icon={TrendingUp}
          description="Exams completed"
          iconClassName="bg-accent/10 text-accent"
        />
      </div>

      {/* Attendance Breakdown */}
      {attendanceStats.total > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Attendance Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Overall Attendance</span>
                <span className="font-medium">{attendancePercentage}%</span>
              </div>
              <Progress value={attendancePercentage} className="h-3" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center p-3 rounded-lg bg-success/10">
                  <p className="text-2xl font-bold text-success">{attendanceStats.present}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-destructive/10">
                  <p className="text-2xl font-bold text-destructive">{attendanceStats.absent}</p>
                  <p className="text-xs text-muted-foreground">Absent</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-warning/10">
                  <p className="text-2xl font-bold text-warning">{attendanceStats.late}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Enrolled Courses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent" />
                My Courses
              </CardTitle>
              <CardDescription>Currently enrolled courses</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/my-courses')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                You are not enrolled in any courses yet.
              </p>
            ) : (
              <div className="space-y-3">
                {enrollments.slice(0, 4).map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{enrollment.course.name}</p>
                      <p className="text-sm text-muted-foreground">{enrollment.course.code}</p>
                    </div>
                    <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded">
                      {enrollment.course.credits} Cr
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-warning" />
                Recent Results
              </CardTitle>
              <CardDescription>Latest exam results</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/my-results')}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentResults.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No results available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentResults.slice(0, 4).map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{result.course.code}</p>
                      <p className="text-sm text-muted-foreground">{result.exam_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{result.marks_obtained}/{result.total_marks}</p>
                      {result.grade && (
                        <p className="text-sm text-muted-foreground">Grade: {result.grade}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Attendance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-info" />
              Recent Attendance
            </CardTitle>
            <CardDescription>Your latest attendance records</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/my-attendance')}>
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
              {recentAttendance.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{att.course.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(att.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <StatusBadge status={att.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
