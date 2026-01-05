import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Download, 
  Printer, 
  FileText, 
  Image as ImageIcon,
  Star,
  Settings2,
  Eye,
  Loader2,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";

export default function PrintCards() {
  // State
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [cardsPerPage, setCardsPerPage] = useState(55);
  const [columnsPerPage, setColumnsPerPage] = useState(5);
  const [marginTop, setMarginTop] = useState(1.8);
  const [marginHorizontal, setMarginHorizontal] = useState(1.8);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  // Fetch data
  const { data: batches, isLoading: loadingBatches } = trpc.vouchers.getBatches.useQuery();
  const { data: templates, isLoading: loadingTemplates } = trpc.templates.list.useQuery();
  const { data: defaultTemplate } = trpc.templates.getDefault.useQuery();

  // Generate PDF mutation
  const generatePDF = trpc.vouchers.generateBatchPDFWithTemplate.useMutation({
    onSuccess: (data) => {
      setGeneratedUrl(data.htmlUrl);
      toast.success(`تم إنشاء ملف PDF بنجاح (${data.cardsCount} كرت)`);
      setGenerating(false);
    },
    onError: (error) => {
      toast.error(`فشل إنشاء PDF: ${error.message}`);
      setGenerating(false);
    },
  });

  // Legacy PDF generation (without template)
  const generateLegacyPDF = trpc.vouchers.generateBatchPDF.useMutation({
    onSuccess: (data) => {
      setGeneratedUrl(data.htmlUrl);
      toast.success(`تم إنشاء ملف PDF بنجاح (${data.cardsCount} كرت)`);
      setGenerating(false);
    },
    onError: (error) => {
      toast.error(`فشل إنشاء PDF: ${error.message}`);
      setGenerating(false);
    },
  });

  // Set default template when loaded
  useEffect(() => {
    if (defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [defaultTemplate, selectedTemplateId]);

  // Handle generate
  const handleGenerate = () => {
    if (!selectedBatchId) {
      toast.error("الرجاء اختيار دفعة الكروت");
      return;
    }

    setGenerating(true);
    setGeneratedUrl(null);

    if (selectedTemplateId) {
      generatePDF.mutate({
        batchId: selectedBatchId,
        templateId: selectedTemplateId,
      });
    } else {
      generateLegacyPDF.mutate({
        batchId: selectedBatchId,
        cardsPerPage,
      });
    }
  };

  // Get selected batch info
  const selectedBatch = batches?.find(b => b.batchId === selectedBatchId);
  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">طباعة البطاقات</h1>
            <p className="text-muted-foreground">إنشاء ملفات PDF للطباعة باستخدام القوالب</p>
          </div>
          <Link href="/card-templates">
            <Button variant="outline">
              <Settings2 className="ml-2 h-4 w-4" />
              إدارة القوالب
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Select Batch */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">1</Badge>
                  اختيار دفعة الكروت
                </CardTitle>
                <CardDescription>
                  اختر الدفعة التي تريد طباعتها
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر دفعة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingBatches ? (
                      <SelectItem value="loading" disabled>جاري التحميل...</SelectItem>
                    ) : batches && batches.length > 0 ? (
                      batches.map((batch) => (
                        <SelectItem key={batch.batchId} value={batch.batchId}>
                          <div className="flex items-center gap-2">
                            <span>{batch.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {batch.quantity} كرت
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="empty" disabled>لا توجد دفعات</SelectItem>
                    )}
                  </SelectContent>
                </Select>

                {selectedBatch && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">إجمالي الكروت:</span>
                        <span className="font-medium mr-2">{selectedBatch.quantity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">غير مستخدمة:</span>
                        <span className="font-medium mr-2 text-green-600">{selectedBatch.quantity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                        <span className="font-medium mr-2">
                          {new Date(selectedBatch.createdAt).toLocaleDateString('ar-SA')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select Template */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
                  اختيار قالب البطاقة
                </CardTitle>
                <CardDescription>
                  اختر تصميم البطاقة للطباعة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : templates && templates.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`relative cursor-pointer rounded-lg border-2 transition-all overflow-hidden ${
                          selectedTemplateId === template.id
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        <div className="aspect-video bg-muted">
                          <img
                            src={template.imageUrl}
                            alt={template.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="p-2 text-center">
                          <span className="text-xs font-medium truncate block">
                            {template.name}
                          </span>
                        </div>
                        {template.isDefault && (
                          <Badge className="absolute top-1 right-1 text-[10px] px-1 py-0 bg-yellow-500">
                            <Star className="h-2 w-2 ml-0.5" />
                            افتراضي
                          </Badge>
                        )}
                        {selectedTemplateId === template.id && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <Badge className="bg-primary">محدد</Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-3">لا توجد قوالب</p>
                    <Link href="/card-templates">
                      <Button variant="outline" size="sm">
                        رفع قوالب جديدة
                        <ChevronRight className="mr-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Use default template option */}
                {!selectedTemplateId && templates && templates.length === 0 && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                    سيتم استخدام التصميم الافتراضي للنظام
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Print Settings (if no template) */}
            {!selectedTemplateId && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">3</Badge>
                    إعدادات الطباعة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>عدد الكروت في الصفحة</Label>
                      <Input
                        type="number"
                        value={cardsPerPage}
                        onChange={(e) => setCardsPerPage(parseInt(e.target.value) || 8)}
                        min={1}
                        max={20}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>عدد الأعمدة</Label>
                      <Input
                        type="number"
                        value={columnsPerPage}
                        onChange={(e) => setColumnsPerPage(parseInt(e.target.value) || 5)}
                        min={1}
                        max={10}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>الهوامش العلوية: {marginTop} سم</Label>
                    <Slider
                      value={[marginTop]}
                      onValueChange={([v]) => setMarginTop(v)}
                      min={0}
                      max={5}
                      step={0.1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>الهوامش الأفقية: {marginHorizontal} سم</Label>
                    <Slider
                      value={[marginHorizontal]}
                      onValueChange={([v]) => setMarginHorizontal(v)}
                      min={0}
                      max={5}
                      step={0.1}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Preview & Actions */}
          <div className="space-y-6">
            {/* Template Preview */}
            {selectedTemplate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">معاينة القالب</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={selectedTemplate.imageUrl}
                      alt={selectedTemplate.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    <p><strong>القالب:</strong> {selectedTemplate.name}</p>
                    <p><strong>الأبعاد:</strong> {selectedTemplate.cardWidth} × {selectedTemplate.cardHeight}</p>
                    <p><strong>كروت/صفحة:</strong> {selectedTemplate.cardsPerPage || 8}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generate Button */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  className="w-full h-12 text-lg"
                  onClick={handleGenerate}
                  disabled={!selectedBatchId || generating}
                >
                  {generating ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الإنشاء...
                    </>
                  ) : (
                    <>
                      <Download className="ml-2 h-5 w-5" />
                      تحميل PDF
                    </>
                  )}
                </Button>

                {generatedUrl && (
                  <div className="mt-4 space-y-2">
                    <Separator />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(generatedUrl, '_blank')}
                      >
                        <Eye className="ml-2 h-4 w-4" />
                        معاينة
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedUrl;
                          link.download = `cards-${selectedBatchId}.html`;
                          link.click();
                        }}
                      >
                        <Download className="ml-2 h-4 w-4" />
                        تحميل
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      افتح الملف في المتصفح واستخدم Ctrl+P للطباعة
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">نصائح سريعة</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>• اختر قالب البطاقة المناسب للخدمة</p>
                <p>• يمكنك تعديل مواضع النصوص من صفحة القوالب</p>
                <p>• استخدم Ctrl+P في المتصفح للطباعة</p>
                <p>• تأكد من إعدادات الطابعة (بدون هوامش)</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
