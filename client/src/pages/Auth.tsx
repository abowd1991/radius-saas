import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock, Phone, Globe } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

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
    onSuccess: () => {
      toast.success("تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.");
      setActiveTab("login");
      setLoginForm({
        usernameOrEmail: registerForm.username,
        password: "",
      });
    },
    onError: (error) => {
      toast.error(error.message || "فشل إنشاء الحساب");
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
    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }
    if (registerForm.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    registerMutation.mutate({
      username: registerForm.username,
      email: registerForm.email,
      password: registerForm.password,
      name: registerForm.name || undefined,
      phone: registerForm.phone || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">راديوس</h1>
          <p className="text-slate-400">نظام إدارة RADIUS المتكامل</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "register")}>
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
                    <Label htmlFor="login-password" className="text-slate-200">
                      كلمة المرور
                    </Label>
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

                {/* OAuth Login Option */}
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-600" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-slate-800 px-2 text-slate-400">أو</span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full mt-4 border-slate-600 text-slate-200 hover:bg-slate-700"
                    onClick={() => window.location.href = getLoginUrl()}
                  >
                    <Globe className="ml-2 h-4 w-4" />
                    تسجيل الدخول عبر Manus
                  </Button>
                </div>
              </TabsContent>

              {/* Register Tab */}
              <TabsContent value="register" className="mt-0">
                <form onSubmit={handleRegister} className="space-y-4">
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
                      />
                    </div>
                  </div>

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
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-slate-200">
                      الاسم الكامل
                    </Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="اسمك الكامل (اختياري)"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-phone" className="text-slate-200">
                      رقم الهاتف
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
                {activeTab === "login" ? (
                  <>
                    ليس لديك حساب؟{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setActiveTab("register")}
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
                      onClick={() => setActiveTab("login")}
                    >
                      تسجيل الدخول
                    </button>
                  </>
                )}
              </p>
            </CardFooter>
          </Tabs>
        </Card>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          © 2024 راديوس - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
