import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Wifi,
  Users,
  CreditCard,
  Shield,
  Globe,
  Zap,
  BarChart3,
  Headphones,
  ArrowRight,
  Check,
  Star,
} from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  const features = [
    {
      icon: Wifi,
      title: "تكامل MikroTik",
      titleEn: "MikroTik Integration",
      description: "تكامل كامل مع أجهزة MikroTik عبر RADIUS للتحكم في PPPoE/PPTP",
      descriptionEn: "Full integration with MikroTik devices via RADIUS for PPPoE/PPTP control",
    },
    {
      icon: Users,
      title: "إدارة متعددة المستويات",
      titleEn: "Multi-Level Management",
      description: "لوحات تحكم منفصلة للمشرفين والموزعين والعملاء",
      descriptionEn: "Separate dashboards for admins, resellers, and clients",
    },
    {
      icon: CreditCard,
      title: "نظام الكروت",
      titleEn: "Voucher System",
      description: "إنشاء وإدارة كروت الشحن مع طباعة PDF",
      descriptionEn: "Create and manage voucher cards with PDF printing",
    },
    {
      icon: Shield,
      title: "أمان متقدم",
      titleEn: "Advanced Security",
      description: "مصادقة JWT وتشفير كامل للبيانات",
      descriptionEn: "JWT authentication and full data encryption",
    },
    {
      icon: Globe,
      title: "بوابات دفع متعددة",
      titleEn: "Multiple Payment Gateways",
      description: "دعم PayPal و Stripe وبنك فلسطين",
      descriptionEn: "Support for PayPal, Stripe, and Bank of Palestine",
    },
    {
      icon: BarChart3,
      title: "تقارير وإحصائيات",
      titleEn: "Reports & Analytics",
      description: "تقارير مفصلة عن الاستخدام والإيرادات",
      descriptionEn: "Detailed reports on usage and revenue",
    },
  ];

  const plans = [
    {
      name: "أساسي",
      nameEn: "Basic",
      price: "$29",
      period: "/شهر",
      periodEn: "/month",
      features: [
        "حتى 100 مستخدم",
        "جهاز NAS واحد",
        "دعم بريد إلكتروني",
        "تقارير أساسية",
      ],
      featuresEn: [
        "Up to 100 users",
        "1 NAS device",
        "Email support",
        "Basic reports",
      ],
    },
    {
      name: "احترافي",
      nameEn: "Professional",
      price: "$79",
      period: "/شهر",
      periodEn: "/month",
      popular: true,
      features: [
        "حتى 500 مستخدم",
        "5 أجهزة NAS",
        "دعم أولوية",
        "تقارير متقدمة",
        "نظام الموزعين",
      ],
      featuresEn: [
        "Up to 500 users",
        "5 NAS devices",
        "Priority support",
        "Advanced reports",
        "Reseller system",
      ],
    },
    {
      name: "مؤسسي",
      nameEn: "Enterprise",
      price: "$199",
      period: "/شهر",
      periodEn: "/month",
      features: [
        "مستخدمين غير محدود",
        "أجهزة NAS غير محدودة",
        "دعم 24/7",
        "API كامل",
        "تخصيص كامل",
      ],
      featuresEn: [
        "Unlimited users",
        "Unlimited NAS devices",
        "24/7 support",
        "Full API access",
        "Full customization",
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30" dir="rtl">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Wifi className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">RADIUS SaaS</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
              المميزات
            </a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              الأسعار
            </a>
            <a href="#contact" className="text-sm font-medium hover:text-primary transition-colors">
              تواصل معنا
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <a href={getLoginUrl()}>تسجيل الدخول</a>
            </Button>
            <Button asChild>
              <a href={getLoginUrl()}>ابدأ الآن</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              منصة إدارة خدمات الإنترنت
              <span className="text-primary block mt-2">المتكاملة</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              نظام RADIUS SaaS متكامل لإدارة مزودي خدمات الإنترنت مع تكامل كامل مع MikroTik، 
              نظام محاسبة متقدم، وبوابات دفع إلكتروني متعددة.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <a href={getLoginUrl()}>
                  ابدأ تجربتك المجانية
                  <ArrowRight className="mr-2 h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline">
                شاهد العرض التوضيحي
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">مميزات المنصة</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              كل ما تحتاجه لإدارة خدمات الإنترنت في مكان واحد
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">خطط الأسعار</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              اختر الخطة المناسبة لحجم عملك
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      الأكثر شعبية
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    اختر هذه الخطة
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">جاهز للبدء؟</h2>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8">
            انضم إلى مئات مزودي خدمات الإنترنت الذين يستخدمون منصتنا لإدارة أعمالهم بكفاءة
          </p>
          <Button size="lg" variant="secondary" asChild>
            <a href={getLoginUrl()}>
              ابدأ الآن مجاناً
              <ArrowRight className="mr-2 h-5 w-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Wifi className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-bold">RADIUS SaaS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                منصة متكاملة لإدارة خدمات الإنترنت ومزودي الخدمة
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">المنتج</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">المميزات</a></li>
                <li><a href="#pricing" className="hover:text-foreground">الأسعار</a></li>
                <li><a href="#" className="hover:text-foreground">التوثيق</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">الشركة</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">من نحن</a></li>
                <li><a href="#" className="hover:text-foreground">تواصل معنا</a></li>
                <li><a href="#" className="hover:text-foreground">الشركاء</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">قانوني</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">سياسة الخصوصية</a></li>
                <li><a href="#" className="hover:text-foreground">شروط الاستخدام</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2025 RADIUS SaaS. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
}
