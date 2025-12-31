import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, BookOpen, Calendar, Award, Users, Clock, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Course {
  id: string;
  name: string;
  code: string;
  credits: number;
  description: string | null;
  semester: string | null;
  instructor: { name: string } | null;
}

interface Enrollment {
  id: string;
  status: string;
  enrollment_date: string;
  course: Course;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
  course: { code: string; name: string };
}

interface ResultRecord {
  id: string;
  exam_type: string;
  marks_obtained: number;
  total_marks: number;
  grade: string | null;
  remarks: string | null;
  course: { code: string; name: string };
  created_at: string;
}

export function StudentCourses() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCredits, setTotalCredits] = useState(0);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return;
      
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (student) {
        const { data } = await supabase
          .from('enrollments')
          .select(`
            id,
            status,
            enrollment_date,
            course:courses(
              id,
              name,
              code,
              credits,
              description,
              semester,
              instructor:instructors(name)
            )
          `)
          .eq('student_id', student.id);

        const enrollmentData = data as unknown as Enrollment[] || [];
        setEnrollments(enrollmentData);
        setTotalCredits(enrollmentData.reduce((sum, e) => sum + (e.course?.credits || 0), 0));
      }
      setLoading(false);
    };
    fetchCourses();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader 
        title="My Courses" 
        description={`You are enrolled in ${enrollments.length} courses (${totalCredits} total credits)`} 
      />

      {enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {enrollments.map((e) => (
            <Card key={e.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <CardTitle className="text-lg">{e.course.name}</CardTitle>
                <CardDescription>{e.course.code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Credits</span>
                  <span className="font-medium">{e.course.credits}</span>
                </div>
                {e.course.semester && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Semester</span>
                    <span className="font-medium">{e.course.semester}</span>
                  </div>
                )}
                {e.course.instructor && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Instructor</span>
                    <span className="font-medium">{e.course.instructor.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Enrolled</span>
                  <span className="font-medium">{format(new Date(e.enrollment_date), 'MMM dd, yyyy')}</span>
                </div>
                {e.course.description && (
                  <p className="text-sm text-muted-foreground pt-2 border-t">
                    {e.course.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

interface CourseAttendanceSummary {
  courseId: string;
  code: string;
  name: string;
  totalClasses: number;
  attended: number;
  absent: number;
  late: number;
  excused: number;
  attendancePercentage: number;
}

export function StudentAttendance() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseSummaries, setCourseSummaries] = useState<CourseAttendanceSummary[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseAttendanceSummary | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!user) return;
      
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (student) {
        const { data } = await supabase
          .from('attendance')
          .select('*, course:courses(id, name, code)')
          .eq('student_id', student.id)
          .order('date', { ascending: false });

        const attendanceData = data as unknown as (AttendanceRecord & { course: { id: string; name: string; code: string } })[] || [];
        setAttendance(attendanceData);

        // Group by course and calculate summaries
        const courseMap = new Map<string, CourseAttendanceSummary>();
        
        attendanceData.forEach(a => {
          const courseId = (a.course as { id: string; name: string; code: string }).id;
          const existing = courseMap.get(courseId);
          
          if (existing) {
            existing.totalClasses++;
            if (a.status === 'present') existing.attended++;
            else if (a.status === 'absent') existing.absent++;
            else if (a.status === 'late') existing.late++;
            else if (a.status === 'excused') existing.excused++;
          } else {
            courseMap.set(courseId, {
              courseId,
              code: a.course.code,
              name: a.course.name,
              totalClasses: 1,
              attended: a.status === 'present' ? 1 : 0,
              absent: a.status === 'absent' ? 1 : 0,
              late: a.status === 'late' ? 1 : 0,
              excused: a.status === 'excused' ? 1 : 0,
              attendancePercentage: 0,
            });
          }
        });

        // Calculate percentages
        courseMap.forEach(summary => {
          summary.attendancePercentage = summary.totalClasses > 0 
            ? Math.round((summary.attended / summary.totalClasses) * 100) 
            : 0;
        });

        setCourseSummaries(Array.from(courseMap.values()));
      }
      setLoading(false);
    };
    fetchAttendance();
  }, [user]);

  const getCourseAttendance = () => {
    if (!selectedCourse) return [];
    return attendance.filter(a => a.course.code === selectedCourse.code);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Show course details view
  if (selectedCourse) {
    const courseAttendance = getCourseAttendance();
    
    return (
      <DashboardLayout>
        <PageHeader 
          title={`${selectedCourse.code} - ${selectedCourse.name}`}
          description="Attendance details for this course"
        />
        
        <button 
          onClick={() => setSelectedCourse(null)}
          className="mb-6 text-primary hover:underline flex items-center gap-2"
        >
          ← Back to all courses
        </button>

        {/* Course Stats */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Attendance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Attendance Rate</span>
              <span className={`font-bold text-lg ${selectedCourse.attendancePercentage >= 75 ? 'text-success' : 'text-warning'}`}>
                {selectedCourse.attendancePercentage}%
              </span>
            </div>
            <Progress value={selectedCourse.attendancePercentage} className="h-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{selectedCourse.totalClasses}</p>
                <p className="text-xs text-muted-foreground">Total Classes</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-success/10">
                <p className="text-2xl font-bold text-success">{selectedCourse.attended}</p>
                <p className="text-xs text-muted-foreground">Present</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/10">
                <p className="text-2xl font-bold text-destructive">{selectedCourse.absent}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-warning/10">
                <p className="text-2xl font-bold text-warning">{selectedCourse.late + selectedCourse.excused}</p>
                <p className="text-xs text-muted-foreground">Late/Excused</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Records</CardTitle>
            <CardDescription>All class attendance for this course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {courseAttendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{format(new Date(a.date), 'EEEE, MMMM dd, yyyy')}</p>
                      {a.remarks && (
                        <p className="text-sm text-muted-foreground italic">"{a.remarks}"</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // Show courses list view
  return (
    <DashboardLayout>
      <PageHeader 
        title="My Attendance" 
        description="Select a course to view your attendance details" 
      />

      {courseSummaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No attendance records found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseSummaries.map((course) => (
            <Card 
              key={course.courseId} 
              className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
              onClick={() => setSelectedCourse(course)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${
                    course.attendancePercentage >= 75 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                  }`}>
                    {course.attendancePercentage}%
                  </span>
                </div>
                <CardTitle className="text-lg mt-3">{course.name}</CardTitle>
                <CardDescription className="font-medium">{course.code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Classes</span>
                  <span className="font-medium">{course.totalClasses}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Classes Attended</span>
                  <span className="font-medium text-success">{course.attended}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Classes Missed</span>
                  <span className="font-medium text-destructive">{course.absent}</span>
                </div>
                <Progress value={course.attendancePercentage} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Click to view detailed attendance
                </p>
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
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgPercentage, setAvgPercentage] = useState(0);
  const [gradeDistribution, setGradeDistribution] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchResults = async () => {
      if (!user) return;
      
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (student) {
        const { data } = await supabase
          .from('results')
          .select('*, course:courses(name, code)')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false });

        const resultsData = data as unknown as ResultRecord[] || [];
        setResults(resultsData);

        // Calculate average
        if (resultsData.length > 0) {
          const avg = resultsData.reduce((sum, r) => 
            sum + (Number(r.marks_obtained) / Number(r.total_marks) * 100), 0
          ) / resultsData.length;
          setAvgPercentage(Math.round(avg * 10) / 10);

          // Calculate grade distribution
          const distribution: Record<string, number> = {};
          resultsData.forEach(r => {
            if (r.grade) {
              distribution[r.grade] = (distribution[r.grade] || 0) + 1;
            }
          });
          setGradeDistribution(distribution);
        }
      }
      setLoading(false);
    };
    fetchResults();
  }, [user]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader 
        title="My Results" 
        description="View your academic performance and exam results" 
      />

      {/* Summary Card */}
      {results.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-5xl font-bold text-primary">{avgPercentage}%</p>
                <p className="text-muted-foreground mt-1">Average Score</p>
              </div>
              <div className="flex items-center justify-between text-sm border-t pt-4">
                <span className="text-muted-foreground">Total Exams</span>
                <span className="font-bold">{results.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5" />
                Grade Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(gradeDistribution)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([grade, count]) => (
                    <div 
                      key={grade} 
                      className={`px-4 py-3 rounded-lg text-center min-w-[60px] ${
                        grade === 'A+' || grade === 'A' ? 'bg-success/10 text-success' :
                        grade === 'B' ? 'bg-info/10 text-info' :
                        grade === 'C' ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      }`}
                    >
                      <p className="text-2xl font-bold">{grade}</p>
                      <p className="text-xs opacity-80">{count} {count === 1 ? 'exam' : 'exams'}</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results List */}
      {results.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No results available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const percentage = Math.round((r.marks_obtained / r.total_marks) * 100);
            return (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        r.grade === 'A+' || r.grade === 'A' ? 'bg-success/10' :
                        r.grade === 'B' ? 'bg-info/10' :
                        r.grade === 'C' ? 'bg-warning/10' :
                        'bg-destructive/10'
                      }`}>
                        <span className={`text-lg font-bold ${
                          r.grade === 'A+' || r.grade === 'A' ? 'text-success' :
                          r.grade === 'B' ? 'text-info' :
                          r.grade === 'C' ? 'text-warning' :
                          'text-destructive'
                        }`}>
                          {r.grade || '-'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{r.course.code} - {r.course.name}</p>
                        <p className="text-sm text-muted-foreground">{r.exam_type}</p>
                        {r.remarks && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{r.remarks}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{r.marks_obtained}<span className="text-muted-foreground text-lg">/{r.total_marks}</span></p>
                      <p className={`text-sm font-medium ${
                        percentage >= 80 ? 'text-success' :
                        percentage >= 60 ? 'text-info' :
                        percentage >= 50 ? 'text-warning' :
                        'text-destructive'
                      }`}>
                        {percentage}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
