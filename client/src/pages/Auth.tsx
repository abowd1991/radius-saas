import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock, Phone, Globe, ArrowRight, CheckCircle } from "lucide-react";
// OAuth removed - using local authentication only

type AuthView = "login" | "register" | "forgot-password" | "reset-password" | "verify-email";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<AuthView>("login");
  const [pendingEmail, setPendingEmail] = useState("");

  // Login form state
  const [loginForm, setLoginForm] = useState({
    usernameOrEmail: "",
    password: "",
  });

  // Register form state
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
  });

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  
  // Reset password state
  const [resetForm, setResetForm] = useState({
    code: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Email verification state
  const [verificationCode, setVerificationCode] = useState("");

  // Mutations
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("تم تسجيل الدخول بنجاح!");
      setLocation("/dashboard");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تسجيل الدخول");
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (_, variables) => {
      toast.success("تم إنشاء الحساب! تم إرسال رمز التحقق إلى بريدك الإلكتروني.");
      setPendingEmail(variables.email);
      setActiveView("verify-email");
    },
    onError: (error) => {
      toast.error(error.message || "فشل إنشاء الحساب");
    },
  });

  const forgotPasswordMutation = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال رمز استعادة كلمة المرور إلى بريدك الإلكتروني");
      setPendingEmail(forgotEmail);
      setActiveView("reset-password");
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ");
    },
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.");
      setActiveView("login");
      setResetForm({ code: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error) => {
      toast.error(error.message || "فشل تغيير كلمة المرور");
    },
  });

  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      toast.success("تم تأكيد البريد الإلكتروني بنجاح!");
      setActiveView("login");
      setLoginForm({ usernameOrEmail: registerForm.username || pendingEmail, password: "" });
    },
    onError: (error) => {
      toast.error(error.message || "رمز التحقق غير صحيح");
    },
  });

  const resendCodeMutation = trpc.auth.resendVerificationCode.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال رمز جديد إلى بريدك الإلكتروني");
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الرمز");
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.usernameOrEmail || !loginForm.password) {
      toast.error("الرجاء إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // ALL fields are REQUIRED
    if (!registerForm.name || registerForm.name.trim().length < 2) {
      toast.error("الاسم الكامل مطلوب (حرفين على الأقل)");
      return;
    }
    if (!registerForm.username || registerForm.username.trim().length < 3) {
      toast.error("اسم المستخدم مطلوب (3 أحرف على الأقل)");
      return;
    }
    if (!registerForm.email || !registerForm.email.includes("@") || !registerForm.email.includes(".")) {
      toast.error("البريد الإلكتروني غير صحيح");
      return;
    }
    if (!registerForm.password || registerForm.password.length < 6) {
      toast.error("كلمة المرور مطلوبة (6 أحرف على الأقل)");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }
    registerMutation.mutate({
      username: registerForm.username.trim(),
      email: registerForm.email.trim().toLowerCase(),
      password: registerForm.password,
      name: registerForm.name.trim(),
      phone: registerForm.phone || undefined,
    });
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("الرجاء إدخال البريد الإلكتروني");
      return;
    }
    forgotPasswordMutation.mutate({ email: forgotEmail });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetForm.code || !resetForm.newPassword) {
      toast.error("الرجاء إدخال الرمز وكلمة المرور الجديدة");
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }
    if (resetForm.newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    resetPasswordMutation.mutate({
      email: pendingEmail,
      code: resetForm.code,
      newPassword: resetForm.newPassword,
    });
  };

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      toast.error("الرجاء إدخال رمز التحقق");
      return;
    }
    verifyEmailMutation.mutate({
      email: pendingEmail,
      code: verificationCode,
    });
  };

  // Render login/register tabs
  const renderMainAuth = () => (
    <Tabs value={activeView === "register" ? "register" : "login"} onValueChange={(v) => setActiveView(v as AuthView)}>
      <CardHeader className="pb-4">
        <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
          <TabsTrigger value="login" className="data-[state=active]:bg-primary">
            تسجيل الدخول
          </TabsTrigger>
          <TabsTrigger value="register" className="data-[state=active]:bg-primary">
            إنشاء حساب
          </TabsTrigger>
        </TabsList>
      </CardHeader>

      <CardContent>
        {/* Login Tab */}
        <TabsContent value="login" className="mt-0">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-slate-200">
                اسم المستخدم أو البريد الإلكتروني
              </Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="login-username"
                  type="text"
                  placeholder="أدخل اسم المستخدم أو البريد"
                  value={loginForm.usernameOrEmail}
                  onChange={(e) => setLoginForm({ ...loginForm, usernameOrEmail: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="login-password" className="text-slate-200">
                  كلمة المرور
                </Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setActiveView("forgot-password")}
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="أدخل كلمة المرور"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          {/* Local authentication only - OAuth removed */}
        </TabsContent>

        {/* Register Tab */}
        <TabsContent value="register" className="mt-0">
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Name - REQUIRED */}
            <div className="space-y-2">
              <Label htmlFor="register-name" className="text-slate-200">
                الاسم الكامل <span className="text-red-400">*</span>
              </Label>
              <Input
                id="register-name"
                type="text"
                placeholder="اسمك الكامل"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>

            {/* Username - REQUIRED */}
            <div className="space-y-2">
              <Label htmlFor="register-username" className="text-slate-200">
                اسم المستخدم <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-username"
                  type="text"
                  placeholder="اختر اسم مستخدم فريد"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {/* Email - REQUIRED */}
            <div className="space-y-2">
              <Label htmlFor="register-email" className="text-slate-200">
                البريد الإلكتروني <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder="example@email.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            {/* Phone - Optional */}
            <div className="space-y-2">
              <Label htmlFor="register-phone" className="text-slate-200">
                رقم الهاتف <span className="text-slate-500">(اختياري)</span>
              </Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-phone"
                  type="tel"
                  placeholder="+966 5XX XXX XXXX"
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-password" className="text-slate-200">
                كلمة المرور <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-password"
                  type="password"
                  placeholder="6 أحرف على الأقل"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-confirm-password" className="text-slate-200">
                تأكيد كلمة المرور <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="register-confirm-password"
                  type="password"
                  placeholder="أعد إدخال كلمة المرور"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  dir="ltr"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري إنشاء الحساب...
                </>
              ) : (
                "إنشاء حساب جديد"
              )}
            </Button>

            <p className="text-xs text-slate-400 text-center mt-4">
              بإنشاء حساب، ستحصل على فترة تجريبية مجانية لمدة 7 أيام
            </p>
          </form>
        </TabsContent>
      </CardContent>

      <CardFooter className="flex justify-center border-t border-slate-700 pt-4">
        <p className="text-sm text-slate-400">
          {activeView === "login" ? (
            <>
              ليس لديك حساب؟{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setActiveView("register")}
              >
                إنشاء حساب جديد
              </button>
            </>
          ) : (
            <>
              لديك حساب بالفعل؟{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setActiveView("login")}
              >
                تسجيل الدخول
              </button>
            </>
          )}
        </p>
      </CardFooter>
    </Tabs>
  );

  // Render forgot password form
  const renderForgotPassword = () => (
    <>
      <CardHeader>
        <button
          type="button"
          className="flex items-center text-slate-400 hover:text-white mb-4"
          onClick={() => setActiveView("login")}
        >
          <ArrowRight className="h-4 w-4 ml-1" />
          العودة لتسجيل الدخول
        </button>
        <CardTitle className="text-white">استعادة كلمة المرور</CardTitle>
        <CardDescription className="text-slate-400">
          أدخل بريدك الإلكتروني وسنرسل لك رمز استعادة كلمة المرور
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email" className="text-slate-200">
              البريد الإلكتروني
            </Label>
            <div className="relative">
              <Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="forgot-email"
                type="email"
                placeholder="أدخل بريدك الإلكتروني"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                dir="ltr"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={forgotPasswordMutation.isPending}
          >
            {forgotPasswordMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              "إرسال رمز الاستعادة"
            )}
          </Button>
        </form>
      </CardContent>
    </>
  );

  // Render reset password form
  const renderResetPassword = () => (
    <>
      <CardHeader>
        <button
          type="button"
          className="flex items-center text-slate-400 hover:text-white mb-4"
          onClick={() => setActiveView("forgot-password")}
        >
          <ArrowRight className="h-4 w-4 ml-1" />
          العودة
        </button>
        <CardTitle className="text-white">تعيين كلمة مرور جديدة</CardTitle>
        <CardDescription className="text-slate-400">
          أدخل الرمز المرسل إلى {pendingEmail} وكلمة المرور الجديدة
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-code" className="text-slate-200">
              رمز الاستعادة
            </Label>
            <Input
              id="reset-code"
              type="text"
              placeholder="أدخل الرمز المكون من 6 أرقام"
              value={resetForm.code}
              onChange={(e) => setResetForm({ ...resetForm, code: e.target.value })}
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 text-center text-2xl tracking-widest"
              dir="ltr"
              maxLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-slate-200">
              كلمة المرور الجديدة
            </Label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="new-password"
                type="password"
                placeholder="6 أحرف على الأقل"
                value={resetForm.newPassword}
                onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-new-password" className="text-slate-200">
              تأكيد كلمة المرور الجديدة
            </Label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="أعد إدخال كلمة المرور"
                value={resetForm.confirmPassword}
                onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                className="pr-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                dir="ltr"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التغيير...
              </>
            ) : (
              "تغيير كلمة المرور"
            )}
          </Button>
        </form>
      </CardContent>
    </>
  );

  // Render email verification form
  const renderVerifyEmail = () => (
    <>
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-white">تأكيد البريد الإلكتروني</CardTitle>
        <CardDescription className="text-slate-400">
          تم إرسال رمز التحقق إلى<br />
          <span className="text-white font-medium">{pendingEmail}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerifyEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="verification-code" className="text-slate-200">
              رمز التحقق
            </Label>
            <Input
              id="verification-code"
              type="text"
              placeholder="أدخل الرمز المكون من 6 أرقام"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 text-center text-2xl tracking-widest"
              dir="ltr"
              maxLength={6}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={verifyEmailMutation.isPending}
          >
            {verifyEmailMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التحقق...
              </>
            ) : (
              <>
                <CheckCircle className="ml-2 h-4 w-4" />
                تأكيد البريد الإلكتروني
              </>
            )}
          </Button>

          <div className="text-center">
            <p className="text-sm text-slate-400 mb-2">لم تستلم الرمز؟</p>
            <Button
              type="button"
              variant="ghost"
              className="text-primary hover:text-primary/80"
              onClick={() => resendCodeMutation.mutate({ email: pendingEmail })}
              disabled={resendCodeMutation.isPending}
            >
              {resendCodeMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                "إعادة إرسال الرمز"
              )}
            </Button>
          </div>
        </form>
      </CardContent>

    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Radius Pro</h1>
          <p className="text-slate-400">نظام إدارة RADIUS المتكامل</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          {(activeView === "login" || activeView === "register") && renderMainAuth()}
          {activeView === "forgot-password" && renderForgotPassword()}
          {activeView === "reset-password" && renderResetPassword()}
          {activeView === "verify-email" && renderVerifyEmail()}
        </Card>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500">
            © 2026 RadiusPro. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </div>
  );
}
