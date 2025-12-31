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

interface CourseResultSummary {
  courseId: string;
  code: string;
  name: string;
  totalExams: number;
  avgPercentage: number;
  bestGrade: string | null;
  grades: Record<string, number>;
}

export function StudentResults() {
  const { user } = useAuth();
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseSummaries, setCourseSummaries] = useState<CourseResultSummary[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseResultSummary | null>(null);

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
          .select('*, course:courses(id, name, code)')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false });

        const resultsData = data as unknown as (ResultRecord & { course: { id: string; name: string; code: string } })[] || [];
        setResults(resultsData);

        // Group by course and calculate summaries
        const courseMap = new Map<string, { 
          courseId: string; 
          code: string; 
          name: string; 
          totalMarks: number; 
          obtainedMarks: number; 
          count: number;
          grades: Record<string, number>;
          bestGrade: string | null;
        }>();
        
        const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
        
        resultsData.forEach(r => {
          const courseId = (r.course as { id: string; name: string; code: string }).id;
          const existing = courseMap.get(courseId);
          
          if (existing) {
            existing.totalMarks += Number(r.total_marks);
            existing.obtainedMarks += Number(r.marks_obtained);
            existing.count++;
            if (r.grade) {
              existing.grades[r.grade] = (existing.grades[r.grade] || 0) + 1;
              // Update best grade
              const currentBestIdx = gradeOrder.indexOf(existing.bestGrade || 'F');
              const newGradeIdx = gradeOrder.indexOf(r.grade);
              if (newGradeIdx < currentBestIdx || newGradeIdx !== -1 && currentBestIdx === -1) {
                existing.bestGrade = r.grade;
              }
            }
          } else {
            courseMap.set(courseId, {
              courseId,
              code: r.course.code,
              name: r.course.name,
              totalMarks: Number(r.total_marks),
              obtainedMarks: Number(r.marks_obtained),
              count: 1,
              grades: r.grade ? { [r.grade]: 1 } : {},
              bestGrade: r.grade || null,
            });
          }
        });

        // Convert to summary format
        const summaries: CourseResultSummary[] = Array.from(courseMap.values()).map(c => ({
          courseId: c.courseId,
          code: c.code,
          name: c.name,
          totalExams: c.count,
          avgPercentage: c.totalMarks > 0 ? Math.round((c.obtainedMarks / c.totalMarks) * 100) : 0,
          bestGrade: c.bestGrade,
          grades: c.grades,
        }));

        setCourseSummaries(summaries);
      }
      setLoading(false);
    };
    fetchResults();
  }, [user]);

  const getCourseResults = () => {
    if (!selectedCourse) return [];
    return results.filter(r => r.course.code === selectedCourse.code);
  };

  const getGradeColor = (grade: string | null) => {
    if (!grade) return { bg: 'bg-muted', text: 'text-muted-foreground' };
    if (grade === 'A+' || grade === 'A' || grade === 'A-') return { bg: 'bg-success/10', text: 'text-success' };
    if (grade.startsWith('B')) return { bg: 'bg-info/10', text: 'text-info' };
    if (grade.startsWith('C')) return { bg: 'bg-warning/10', text: 'text-warning' };
    return { bg: 'bg-destructive/10', text: 'text-destructive' };
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
    const courseResults = getCourseResults();
    
    return (
      <DashboardLayout>
        <PageHeader 
          title={`${selectedCourse.code} - ${selectedCourse.name}`}
          description="Exam results for this course"
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
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/10">
                <p className="text-3xl font-bold text-primary">{selectedCourse.avgPercentage}%</p>
                <p className="text-xs text-muted-foreground">Average Score</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold">{selectedCourse.totalExams}</p>
                <p className="text-xs text-muted-foreground">Total Exams</p>
              </div>
              {selectedCourse.bestGrade && (
                <div className={`text-center p-4 rounded-lg ${getGradeColor(selectedCourse.bestGrade).bg}`}>
                  <p className={`text-3xl font-bold ${getGradeColor(selectedCourse.bestGrade).text}`}>
                    {selectedCourse.bestGrade}
                  </p>
                  <p className="text-xs text-muted-foreground">Best Grade</p>
                </div>
              )}
            </div>
            
            {/* Grade Distribution */}
            {Object.keys(selectedCourse.grades).length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-3">Grade Distribution</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedCourse.grades)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([grade, count]) => (
                      <span 
                        key={grade}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(grade).bg} ${getGradeColor(grade).text}`}
                      >
                        {grade}: {count}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Records */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exam Results</CardTitle>
            <CardDescription>All exam results for this course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {courseResults.map((r) => {
                const percentage = Math.round((r.marks_obtained / r.total_marks) * 100);
                const colors = getGradeColor(r.grade);
                return (
                  <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.bg}`}>
                        <span className={`text-lg font-bold ${colors.text}`}>
                          {r.grade || '-'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{r.exam_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(r.created_at), 'MMM dd, yyyy')}
                        </p>
                        {r.remarks && (
                          <p className="text-sm text-muted-foreground italic">"{r.remarks}"</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {r.marks_obtained}
                        <span className="text-muted-foreground text-lg">/{r.total_marks}</span>
                      </p>
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
                );
              })}
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
        title="My Results" 
        description="Select a course to view your exam results" 
      />

      {courseSummaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No results available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseSummaries.map((course) => {
            const colors = getGradeColor(course.bestGrade);
            return (
              <Card 
                key={course.courseId} 
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary"
                onClick={() => setSelectedCourse(course)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Award className="w-6 h-6 text-primary" />
                    </div>
                    {course.bestGrade && (
                      <span className={`text-sm font-bold px-2 py-1 rounded ${colors.bg} ${colors.text}`}>
                        Best: {course.bestGrade}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{course.name}</CardTitle>
                  <CardDescription className="font-medium">{course.code}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Exams</span>
                    <span className="font-medium">{course.totalExams}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Average Score</span>
                    <span className={`font-medium ${
                      course.avgPercentage >= 80 ? 'text-success' :
                      course.avgPercentage >= 60 ? 'text-info' :
                      course.avgPercentage >= 50 ? 'text-warning' :
                      'text-destructive'
                    }`}>
                      {course.avgPercentage}%
                    </span>
                  </div>
                  <Progress value={course.avgPercentage} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    Click to view detailed results
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
