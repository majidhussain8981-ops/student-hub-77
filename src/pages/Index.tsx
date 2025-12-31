import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GraduationCap, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="text-center max-w-lg animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary mb-6">
          <GraduationCap className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Student Information Management System</h1>
        <p className="text-lg text-muted-foreground mb-8">
          A comprehensive platform for managing students, courses, attendance, and academic results.
        </p>
        <Button size="lg" onClick={() => navigate('/login')} className="gap-2">
          Get Started <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Index;
