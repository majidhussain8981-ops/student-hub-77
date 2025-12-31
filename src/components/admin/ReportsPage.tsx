import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Users, BookOpen, Calendar, Award } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

export function ReportsPage() {
  const { data: enrollmentStats, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['enrollment-stats'],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select(`
          *,
          students(name, student_id),
          courses(name, code)
        `);
      
      const { data: courses } = await supabase.from('courses').select('id, name, code');
      
      const courseStats = courses?.map(course => {
        const courseEnrollments = enrollments?.filter(e => e.course_id === course.id) || [];
        return {
          ...course,
          totalEnrolled: courseEnrollments.length,
          activeCount: courseEnrollments.filter(e => e.status === 'enrolled').length,
        };
      }) || [];
      
      return { enrollments, courseStats };
    },
  });

  const { data: attendanceStats, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-stats'],
    queryFn: async () => {
      const { data: attendance } = await supabase
        .from('attendance')
        .select(`
          *,
          students(name, student_id),
          courses(name, code)
        `);
      
      const totalRecords = attendance?.length || 0;
      const presentCount = attendance?.filter(a => a.status === 'present').length || 0;
      const absentCount = attendance?.filter(a => a.status === 'absent').length || 0;
      const lateCount = attendance?.filter(a => a.status === 'late').length || 0;
      
      return {
        attendance,
        summary: {
          total: totalRecords,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          presentPercentage: totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(1) : '0',
        },
      };
    },
  });

  const { data: resultsStats, isLoading: loadingResults } = useQuery({
    queryKey: ['results-stats'],
    queryFn: async () => {
      const { data: results } = await supabase
        .from('results')
        .select(`
          *,
          students(name, student_id),
          courses(name, code)
        `);
      
      const gradeDistribution: Record<string, number> = {};
      results?.forEach(r => {
        if (r.grade) {
          gradeDistribution[r.grade] = (gradeDistribution[r.grade] || 0) + 1;
        }
      });
      
      const avgMarks = results?.length 
        ? (results.reduce((acc, r) => acc + (Number(r.marks_obtained) / Number(r.total_marks)) * 100, 0) / results.length).toFixed(1)
        : '0';
      
      return {
        results,
        summary: {
          total: results?.length || 0,
          gradeDistribution,
          avgPercentage: avgMarks,
        },
      };
    },
  });

  const isLoading = loadingEnrollments || loadingAttendance || loadingResults;

  return (
    <DashboardLayout>
      <PageHeader
        title="Reports"
        description="View detailed reports and analytics across the system"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="enrollments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="enrollments" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{enrollmentStats?.enrollments?.length || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{enrollmentStats?.courseStats?.filter(c => c.totalEnrolled > 0).length || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Enrollments by Course</CardTitle>
                <CardDescription>Number of students enrolled in each course</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course Code</TableHead>
                      <TableHead>Course Name</TableHead>
                      <TableHead className="text-right">Total Enrolled</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollmentStats?.courseStats?.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell className="font-medium">{course.code}</TableCell>
                        <TableCell>{course.name}</TableCell>
                        <TableCell className="text-right">{course.totalEnrolled}</TableCell>
                        <TableCell className="text-right">{course.activeCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{attendanceStats?.summary.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Present</CardTitle>
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{attendanceStats?.summary.present}</div>
                  <p className="text-xs text-muted-foreground">{attendanceStats?.summary.presentPercentage}% attendance rate</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Absent</CardTitle>
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{attendanceStats?.summary.absent}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Late</CardTitle>
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{attendanceStats?.summary.late}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Attendance Records</CardTitle>
                <CardDescription>Latest attendance entries across all courses</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceStats?.attendance?.slice(0, 10).map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.students?.name}</TableCell>
                        <TableCell>{record.courses?.name}</TableCell>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={record.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Results</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{resultsStats?.summary.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Score</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{resultsStats?.summary.avgPercentage}%</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
                <CardDescription>Distribution of grades across all results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(resultsStats?.summary.gradeDistribution || {}).map(([grade, count]) => (
                    <div key={grade} className="flex items-center gap-2 rounded-lg border px-4 py-2">
                      <span className="text-lg font-bold">{grade}</span>
                      <span className="text-muted-foreground">({count as number} students)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Results</CardTitle>
                <CardDescription>Latest exam results entries</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Exam Type</TableHead>
                      <TableHead className="text-right">Marks</TableHead>
                      <TableHead>Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultsStats?.results?.slice(0, 10).map((result: any) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">{result.students?.name}</TableCell>
                        <TableCell>{result.courses?.name}</TableCell>
                        <TableCell>{result.exam_type}</TableCell>
                        <TableCell className="text-right">{result.marks_obtained}/{result.total_marks}</TableCell>
                        <TableCell>
                          <StatusBadge status={result.grade || 'N/A'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </DashboardLayout>
  );
}
