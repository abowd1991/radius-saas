import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Upload } from "lucide-react";

export default function SiteSettings() {
  const { data: settings, isLoading, refetch } = trpc.site.getSiteSettings.useQuery();
  const updateMutation = trpc.site.updateSiteSettings.useMutation();

  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMutation.mutateAsync(formData);
      alert("تم حفظ الإعدادات بنجاح!");
      refetch();
    } catch (error: any) {
      alert(`فشل الحفظ: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">إعدادات الموقع</h1>
          <p className="text-muted-foreground mt-1">
            تحكم كامل في محتوى وعلامة الموقع التجارية
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              حفظ التغييرات
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="branding" dir="rtl">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="branding">العلامة التجارية</TabsTrigger>
          <TabsTrigger value="hero">الصفحة الرئيسية</TabsTrigger>
          <TabsTrigger value="stats">الإحصائيات</TabsTrigger>
          <TabsTrigger value="contact">معلومات الاتصال</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>العلامة التجارية</CardTitle>
              <CardDescription>اسم الموقع، الشعار، والأيقونة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="siteName">اسم الموقع (English)</Label>
                  <Input
                    id="siteName"
                    value={formData.siteName || ""}
                    onChange={(e) => handleChange("siteName", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="siteNameAr">اسم الموقع (العربية)</Label>
                  <Input
                    id="siteNameAr"
                    value={formData.siteNameAr || ""}
                    onChange={(e) => handleChange("siteNameAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tagline">الشعار (English)</Label>
                  <Input
                    id="tagline"
                    value={formData.tagline || ""}
                    onChange={(e) => handleChange("tagline", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="taglineAr">الشعار (العربية)</Label>
                  <Input
                    id="taglineAr"
                    value={formData.taglineAr || ""}
                    onChange={(e) => handleChange("taglineAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="logoUrl">رابط الشعار (Logo URL)</Label>
                  <Input
                    id="logoUrl"
                    value={formData.logoUrl || ""}
                    onChange={(e) => handleChange("logoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div>
                  <Label htmlFor="faviconUrl">رابط الأيقونة (Favicon URL)</Label>
                  <Input
                    id="faviconUrl"
                    value={formData.faviconUrl || ""}
                    onChange={(e) => handleChange("faviconUrl", e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>معلومات الشركة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">اسم الشركة (English)</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName || ""}
                    onChange={(e) => handleChange("companyName", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="companyNameAr">اسم الشركة (العربية)</Label>
                  <Input
                    id="companyNameAr"
                    value={formData.companyNameAr || ""}
                    onChange={(e) => handleChange("companyNameAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="copyrightText">نص حقوق النشر (English)</Label>
                  <Input
                    id="copyrightText"
                    value={formData.copyrightText || ""}
                    onChange={(e) => handleChange("copyrightText", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="copyrightTextAr">نص حقوق النشر (العربية)</Label>
                  <Input
                    id="copyrightTextAr"
                    value={formData.copyrightTextAr || ""}
                    onChange={(e) => handleChange("copyrightTextAr", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hero Section Tab */}
        <TabsContent value="hero" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>قسم Hero (الصفحة الرئيسية)</CardTitle>
              <CardDescription>العنوان الرئيسي والوصف</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="heroTitle">العنوان الرئيسي (English)</Label>
                  <Input
                    id="heroTitle"
                    value={formData.heroTitle || ""}
                    onChange={(e) => handleChange("heroTitle", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="heroTitleAr">العنوان الرئيسي (العربية)</Label>
                  <Input
                    id="heroTitleAr"
                    value={formData.heroTitleAr || ""}
                    onChange={(e) => handleChange("heroTitleAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="heroSubtitle">العنوان الفرعي (English)</Label>
                  <Input
                    id="heroSubtitle"
                    value={formData.heroSubtitle || ""}
                    onChange={(e) => handleChange("heroSubtitle", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="heroSubtitleAr">العنوان الفرعي (العربية)</Label>
                  <Input
                    id="heroSubtitleAr"
                    value={formData.heroSubtitleAr || ""}
                    onChange={(e) => handleChange("heroSubtitleAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="heroDescription">الوصف (English)</Label>
                  <Textarea
                    id="heroDescription"
                    value={formData.heroDescription || ""}
                    onChange={(e) => handleChange("heroDescription", e.target.value)}
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="heroDescriptionAr">الوصف (العربية)</Label>
                  <Textarea
                    id="heroDescriptionAr"
                    value={formData.heroDescriptionAr || ""}
                    onChange={(e) => handleChange("heroDescriptionAr", e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إحصائيات الصفحة الرئيسية</CardTitle>
              <CardDescription>الأرقام التي تظهر في الصفحة الرئيسية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="uptimePercent">نسبة التشغيل (Uptime)</Label>
                  <Input
                    id="uptimePercent"
                    value={formData.uptimePercent || ""}
                    onChange={(e) => handleChange("uptimePercent", e.target.value)}
                    placeholder="99.9%"
                  />
                </div>
                <div>
                  <Label htmlFor="activeClients">العملاء النشطون</Label>
                  <Input
                    id="activeClients"
                    value={formData.activeClients || ""}
                    onChange={(e) => handleChange("activeClients", e.target.value)}
                    placeholder="+1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="managedCards">الكروت المُدارة</Label>
                  <Input
                    id="managedCards"
                    value={formData.managedCards || ""}
                    onChange={(e) => handleChange("managedCards", e.target.value)}
                    placeholder="+50K"
                  />
                </div>
                <div>
                  <Label htmlFor="supportHours">ساعات الدعم</Label>
                  <Input
                    id="supportHours"
                    value={formData.supportHours || ""}
                    onChange={(e) => handleChange("supportHours", e.target.value)}
                    placeholder="24/7"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>معلومات الاتصال</CardTitle>
              <CardDescription>البريد الإلكتروني، الهاتف، ووسائل التواصل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supportEmail">البريد الإلكتروني للدعم</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={formData.supportEmail || ""}
                    onChange={(e) => handleChange("supportEmail", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supportPhone">رقم الهاتف</Label>
                  <Input
                    id="supportPhone"
                    value={formData.supportPhone || ""}
                    onChange={(e) => handleChange("supportPhone", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supportHoursText">ساعات العمل (English)</Label>
                  <Input
                    id="supportHoursText"
                    value={formData.supportHoursText || ""}
                    onChange={(e) => handleChange("supportHoursText", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="supportHoursTextAr">ساعات العمل (العربية)</Label>
                  <Input
                    id="supportHoursTextAr"
                    value={formData.supportHoursTextAr || ""}
                    onChange={(e) => handleChange("supportHoursTextAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>وسائل التواصل الاجتماعي</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Facebook URL"
                    value={formData.facebookUrl || ""}
                    onChange={(e) => handleChange("facebookUrl", e.target.value)}
                  />
                  <Input
                    placeholder="Twitter URL"
                    value={formData.twitterUrl || ""}
                    onChange={(e) => handleChange("twitterUrl", e.target.value)}
                  />
                  <Input
                    placeholder="LinkedIn URL"
                    value={formData.linkedinUrl || ""}
                    onChange={(e) => handleChange("linkedinUrl", e.target.value)}
                  />
                  <Input
                    placeholder="Instagram URL"
                    value={formData.instagramUrl || ""}
                    onChange={(e) => handleChange("instagramUrl", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Tab */}
        <TabsContent value="seo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات SEO</CardTitle>
              <CardDescription>تحسين محركات البحث</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="metaTitle">عنوان الصفحة (English)</Label>
                  <Input
                    id="metaTitle"
                    value={formData.metaTitle || ""}
                    onChange={(e) => handleChange("metaTitle", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="metaTitleAr">عنوان الصفحة (العربية)</Label>
                  <Input
                    id="metaTitleAr"
                    value={formData.metaTitleAr || ""}
                    onChange={(e) => handleChange("metaTitleAr", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="metaDescription">الوصف (English)</Label>
                  <Textarea
                    id="metaDescription"
                    value={formData.metaDescription || ""}
                    onChange={(e) => handleChange("metaDescription", e.target.value)}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="metaDescriptionAr">الوصف (العربية)</Label>
                  <Textarea
                    id="metaDescriptionAr"
                    value={formData.metaDescriptionAr || ""}
                    onChange={(e) => handleChange("metaDescriptionAr", e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="metaKeywords">الكلمات المفتاحية</Label>
                <Textarea
                  id="metaKeywords"
                  value={formData.metaKeywords || ""}
                  onChange={(e) => handleChange("metaKeywords", e.target.value)}
                  rows={2}
                  placeholder="radius, internet, management, saas"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 ml-2" />
              حفظ جميع التغييرات
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
