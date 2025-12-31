import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Loader2, Mail, Lock, User, AlertCircle, Shield, BookOpen } from 'lucide-react';
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
  const [demoLoading, setDemoLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { signIn, signUp, prepareDemoUsers } = useAuth();
  const { toast } = useToast();

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

  const fillDemoCredentials = async (demoEmail: string, demoPassword: string) => {
    setDemoLoading(true);
    try {
      // Ensure demo users are always ready (idempotent)
      const { error } = await prepareDemoUsers();
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Demo Setup Failed',
          description: error.message,
        });
        return;
      }

      setEmail(demoEmail);
      setPassword(demoPassword);
      setErrors({});

      toast({
        title: 'Demo credentials filled',
        description: 'Click “Sign In” to continue.',
      });
    } finally {
      setDemoLoading(false);
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
            {/* Demo Access Buttons - Show prominently at top when logging in */}
            {isLogin && (
              <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm font-medium text-center mb-3">Quick Demo Access</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={demoLoading}
                    onClick={() => fillDemoCredentials('admin@sims.com', 'admin123')}
                    className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-primary/10 hover:border-primary"
                  >
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">Admin Demo</span>
                    <span className="text-xs text-muted-foreground">Full access</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={demoLoading}
                    onClick={() => fillDemoCredentials('student@sims.com', 'student123')}
                    className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-info/10 hover:border-info"
                  >
                    <BookOpen className="w-5 h-5 text-info" />
                    <span className="text-sm font-medium">Student #1</span>
                    <span className="text-xs text-muted-foreground">Demo Student</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={demoLoading}
                    onClick={() => fillDemoCredentials('student2@sims.com', 'student123')}
                    className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-info/10 hover:border-info"
                  >
                    <BookOpen className="w-5 h-5 text-info" />
                    <span className="text-sm font-medium">Student #2</span>
                    <span className="text-xs text-muted-foreground">Demo Student</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={demoLoading}
                    onClick={() => fillDemoCredentials('student3@sims.com', 'student123')}
                    className="h-auto py-3 flex flex-col items-center gap-1 hover:bg-info/10 hover:border-info"
                  >
                    <BookOpen className="w-5 h-5 text-info" />
                    <span className="text-sm font-medium">Student #3</span>
                    <span className="text-xs text-muted-foreground">Demo Student</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Tip: pick a demo account, then press <span className="font-medium">Sign In</span>.
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
