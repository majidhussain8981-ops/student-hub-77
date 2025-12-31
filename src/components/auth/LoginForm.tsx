import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Loader2, Mail, Lock, User, AlertCircle, Shield, BookOpen, Zap } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Name is too long'),
});

export function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { signIn, signUp, prepareDemoUsers } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse({ email, password });
      } else {
        signupSchema.parse({ email, password, fullName });
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isLogin) {
        const { error, role } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Login Failed',
            description:
              error.message === 'Invalid login credentials'
                ? 'Invalid email or password. Please try again.'
                : error.message,
          });
        } else {
          toast({
            title: 'Welcome back!',
            description: `Successfully logged in as ${role || 'user'}.`,
          });
          navigate('/dashboard', { replace: true });
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Sign Up Failed',
            description: error.message.includes('already registered')
              ? 'This email is already registered. Please login instead.'
              : error.message,
          });
        } else {
          toast({
            title: 'Account Created!',
            description: 'Your account has been created successfully.',
          });
          setIsLogin(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const instantDemoSignIn = async (demoEmail: string, demoPassword: string, label: string) => {
    setDemoLoading(label);
    try {
      // Ensure demo users are always ready (idempotent)
      const { error: prepError } = await prepareDemoUsers();
      if (prepError) {
        toast({
          variant: 'destructive',
          title: 'Demo Setup Failed',
          description: prepError.message,
        });
        return;
      }

      // Immediately sign in
      const { error, role } = await signIn(demoEmail, demoPassword);
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Demo Login Failed',
          description: error.message,
        });
      } else {
        toast({
          title: 'Welcome!',
          description: `Signed in as ${role || 'demo user'}.`,
        });
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SIMS</h1>
          <p className="text-muted-foreground mt-1">Student Information Management System</p>
        </div>

        <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold">
              {isLogin ? 'Welcome back' : 'Create account'}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Enter your credentials to access your dashboard' 
                : 'Fill in your details to create a new account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* One-Click Demo Access - Sign in instantly */}
            {isLogin && (
              <div className="mb-6 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-muted/50 border border-primary/20">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Instant Demo Access</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="default"
                    disabled={!!demoLoading}
                    onClick={() => instantDemoSignIn('admin@sims.com', 'admin123', 'admin')}
                    className="h-auto py-4 flex flex-col items-center gap-1 bg-primary hover:bg-primary/90"
                  >
                    {demoLoading === 'admin' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Shield className="w-6 h-6" />
                    )}
                    <span className="text-sm font-medium">Admin Demo</span>
                    <span className="text-xs opacity-80">Full system access</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!!demoLoading}
                    onClick={() => instantDemoSignIn('student@sims.com', 'student123', 'student')}
                    className="h-auto py-4 flex flex-col items-center gap-1"
                  >
                    {demoLoading === 'student' ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <BookOpen className="w-6 h-6" />
                    )}
                    <span className="text-sm font-medium">Student Demo</span>
                    <span className="text-xs text-muted-foreground">John Doe</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Click a button to <span className="font-medium">sign in instantly</span>
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={errors.fullName ? 'border-destructive' : ''}
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.fullName}
                    </p>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={errors.password ? 'border-destructive' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          DBMS Semester Project • Student Information Management System
        </p>
      </div>
    </div>
  );
}
