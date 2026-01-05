import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Download, 
  Printer, 
  Image as ImageIcon,
  Star,
  Eye,
  Loader2,
  Grid3X3,
  Upload,
  Plus,
  Trash2,
  QrCode,
  Check,
  X
} from "lucide-react";
import { useSearch } from "wouter";

export default function PrintCards() {
  // Get batch from URL query parameter
  const searchParams = useSearch();
  const urlBatchId = new URLSearchParams(searchParams).get('batch') || '';
  
  // State
  const [selectedBatchId, setSelectedBatchId] = useState<string>(urlBatchId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  
  // Enhanced print settings
  const [columns, setColumns] = useState(5);
  const [cardsPerPage, setCardsPerPage] = useState(50);
  const [marginTop, setMarginTop] = useState(5);
  const [marginBottom, setMarginBottom] = useState(5);
  const [marginLeft, setMarginLeft] = useState(5);
  const [marginRight, setMarginRight] = useState(5);
  const [spacingH, setSpacingH] = useState(2);
  const [spacingV, setSpacingV] = useState(2);
  
  // QR Code settings
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrDomain, setQrDomain] = useState("");
  
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Calculate rows based on columns and cards per page
  const rows = Math.ceil(cardsPerPage / columns);
  const actualCardsPerPage = columns * rows;

  // Fetch data
  const { data: batches, isLoading: loadingBatches } = trpc.vouchers.getBatches.useQuery();
  const { data: templates, isLoading: loadingTemplates, refetch: refetchTemplates } = trpc.templates.list.useQuery();
  const { data: defaultTemplate } = trpc.templates.getDefault.useQuery();
  const utils = trpc.useUtils();

  // Mutations
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => {
      refetchTemplates();
    },
  });
  
  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      refetchTemplates();
      toast.success("تم حذف القالب بنجاح");
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(`فشل حذف القالب: ${error.message}`);
    },
  });
  
  const setDefaultTemplate = trpc.templates.setDefault.useMutation({
    onSuccess: () => {
      refetchTemplates();
      utils.templates.getDefault.invalidate();
      toast.success("تم تعيين القالب كافتراضي");
    },
  });

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

  // Set default template when loaded
  useEffect(() => {
    if (defaultTemplate && !selectedTemplateId) {
      setSelectedTemplateId(defaultTemplate.id);
    }
  }, [defaultTemplate, selectedTemplateId]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadingFiles(files);
      setTemplateNames(files.map(f => f.name.replace(/\.[^/.]+$/, "")));
      setUploadDialogOpen(true);
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (uploadingFiles.length === 0) return;
    
    setUploading(true);
    let successCount = 0;
    
    for (let i = 0; i < uploadingFiles.length; i++) {
      const file = uploadingFiles[i];
      const name = templateNames[i] || file.name;
      
      try {
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:image/...;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        await createTemplate.mutateAsync({
          name,
          imageBase64: base64,
          imageType: file.type,
        });
        
        successCount++;
      } catch (error) {
        console.error(`Failed to upload ${name}:`, error);
      }
    }
    
    setUploading(false);
    setUploadDialogOpen(false);
    setUploadingFiles([]);
    setTemplateNames([]);
    
    if (successCount > 0) {
      toast.success(`تم رفع ${successCount} قالب بنجاح`);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle generate
  const handleGenerate = () => {
    if (!selectedBatchId) {
      toast.error("الرجاء اختيار دفعة الكروت");
      return;
    }

    setGenerating(true);
    setGeneratedUrl(null);

    generatePDF.mutate({
      batchId: selectedBatchId,
      templateId: selectedTemplateId || undefined,
      printSettings: {
        columns,
        cardsPerPage: actualCardsPerPage,
        marginTop,
        marginBottom,
        marginLeft,
        marginRight,
        spacingH,
        spacingV,
      },
      qrEnabled,
      qrDomain: qrEnabled ? qrDomain : undefined,
    });
  };

  // Get selected batch info
  const selectedBatch = batches?.find(b => b.batchId === selectedBatchId);
  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  // Calculate pages needed
  const pagesNeeded = selectedBatch ? Math.ceil(selectedBatch.quantity / actualCardsPerPage) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">طباعة البطاقات</h1>
            <p className="text-muted-foreground">إنشاء ملفات PDF للطباعة باستخدام القوالب</p>
          </div>
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
                      batches.filter(b => b.status === "completed").map((batch) => (
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">إجمالي الكروت:</span>
                        <span className="font-medium mr-2">{selectedBatch.quantity}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">كروت/صفحة:</span>
                        <span className="font-medium mr-2 text-primary">{actualCardsPerPage}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">عدد الصفحات:</span>
                        <span className="font-medium mr-2 text-blue-600">{pagesNeeded}</span>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
                      اختيار قالب البطاقة
                    </CardTitle>
                    <CardDescription>
                      اختر تصميم البطاقة أو ارفع قالب جديد
                    </CardDescription>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="ml-2 h-4 w-4" />
                      رفع قالب جديد
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {/* Default option */}
                    <div
                      className={`relative cursor-pointer rounded-lg border-2 transition-all overflow-hidden ${
                        selectedTemplateId === null
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedTemplateId(null)}
                    >
                      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                        <Grid3X3 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="p-2 text-center">
                        <span className="text-xs font-medium">التصميم الافتراضي</span>
                      </div>
                      {selectedTemplateId === null && (
                        <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    
                    {/* Add new template button */}
                    <div
                      className="cursor-pointer rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-all overflow-hidden"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="aspect-video bg-muted/50 flex flex-col items-center justify-center">
                        <Plus className="h-8 w-8 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">رفع قالب</span>
                      </div>
                      <div className="p-2 text-center">
                        <span className="text-xs font-medium text-muted-foreground">إضافة جديد</span>
                      </div>
                    </div>
                    
                    {templates && templates.map((template) => (
                      <div
                        key={template.id}
                        className={`relative cursor-pointer rounded-lg border-2 transition-all overflow-hidden group ${
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
                        
                        {/* Selected indicator */}
                        {selectedTemplateId === template.id && (
                          <div className="absolute top-1 left-1 bg-primary text-primary-foreground rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                        
                        {/* Default badge */}
                        {template.isDefault && (
                          <Badge className="absolute top-1 right-1 text-[10px] px-1 py-0 bg-yellow-500">
                            <Star className="h-2 w-2 ml-0.5" />
                            افتراضي
                          </Badge>
                        )}
                        
                        {/* Action buttons on hover */}
                        <div className="absolute bottom-10 left-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!template.isDefault && (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDefaultTemplate.mutate({ id: template.id });
                              }}
                              title="تعيين كافتراضي"
                            >
                              <Star className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(template.id);
                            }}
                            title="حذف"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {(!templates || templates.length === 0) && !loadingTemplates && (
                  <p className="text-center text-muted-foreground text-sm mt-4">
                    لا توجد قوالب مخصصة - يمكنك رفع قوالب جديدة أو استخدام التصميم الافتراضي
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Print Settings */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">3</Badge>
                  إعدادات الطباعة
                </CardTitle>
                <CardDescription>
                  تحكم في تخطيط البطاقات على صفحة A4
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Grid Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>عدد الأعمدة</Label>
                    <Select value={columns.toString()} onValueChange={(v) => setColumns(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n} أعمدة</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>عدد الكروت في الصفحة</Label>
                    <Select value={cardsPerPage.toString()} onValueChange={(v) => setCardsPerPage(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 100].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n} كرت</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Layout Preview */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">التخطيط:</span>
                    <span className="font-medium">
                      {columns} أعمدة × {rows} صفوف = {actualCardsPerPage} كرت/صفحة
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Margins */}
                <div>
                  <Label className="mb-3 block">الهوامش (مم)</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">علوي</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[marginTop]}
                          onValueChange={([v]) => setMarginTop(v)}
                          min={0}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm w-8 text-center">{marginTop}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">سفلي</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[marginBottom]}
                          onValueChange={([v]) => setMarginBottom(v)}
                          min={0}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm w-8 text-center">{marginBottom}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">يمين</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[marginRight]}
                          onValueChange={([v]) => setMarginRight(v)}
                          min={0}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm w-8 text-center">{marginRight}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">يسار</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[marginLeft]}
                          onValueChange={([v]) => setMarginLeft(v)}
                          min={0}
                          max={20}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm w-8 text-center">{marginLeft}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Spacing */}
                <div>
                  <Label className="mb-3 block">المسافة بين البطاقات (مم)</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">أفقي</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[spacingH]}
                          onValueChange={([v]) => setSpacingH(v)}
                          min={0}
                          max={10}
                          step={0.5}
                          className="flex-1"
                        />
                        <span className="text-sm w-8 text-center">{spacingH}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">عمودي</Label>
                      <div className="flex items-center gap-2">
                        <Slider
                          value={[spacingV]}
                          onValueChange={([v]) => setSpacingV(v)}
                          min={0}
                          max={10}
                          step={0.5}
                          className="flex-1"
                        />
                        <span className="text-sm w-8 text-center">{spacingV}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* QR Code Settings */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-5 w-5 text-muted-foreground" />
                      <Label>رمز QR Code</Label>
                    </div>
                    <Switch
                      checked={qrEnabled}
                      onCheckedChange={setQrEnabled}
                    />
                  </div>
                  
                  {qrEnabled && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">رابط الدخول (IP أو Domain)</Label>
                      <Input
                        value={qrDomain}
                        onChange={(e) => setQrDomain(e.target.value)}
                        placeholder="مثال: http://192.168.1.1/login أو http://hotspot.example.com"
                        dir="ltr"
                      />
                      <p className="text-xs text-muted-foreground">
                        سيتم إضافة QR Code يحتوي على هذا الرابط لكل بطاقة
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(generatedUrl, '_blank')}
                    >
                      <Eye className="ml-2 h-4 w-4" />
                      معاينة الملف
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        const printWindow = window.open(generatedUrl, '_blank');
                        if (printWindow) {
                          printWindow.onload = () => printWindow.print();
                        }
                      }}
                    >
                      <Printer className="ml-2 h-4 w-4" />
                      طباعة مباشرة
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">نصائح سريعة</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• ارفع قوالب مختلفة لكل نوع بطاقة (ساعة، ساعتين، يوم)</p>
                <p>• يمكنك تعيين قالب افتراضي بالضغط على نجمة</p>
                <p>• استخدم Ctrl+P في المتصفح للطباعة</p>
                <p>• تأكد من إعدادات الطابعة (بدون هوامش)</p>
                <p>• للحصول على أفضل نتيجة، استخدم 5 أعمدة و 50 كرت</p>
              </CardContent>
            </Card>

            {/* Selected Template Info */}
            {selectedTemplate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">القالب المحدد</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-3">
                    <img
                      src={selectedTemplate.imageUrl}
                      alt={selectedTemplate.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium">{selectedTemplate.name}</p>
                    {selectedTemplate.isDefault && (
                      <Badge variant="secondary" className="mt-1">
                        <Star className="h-3 w-3 ml-1" />
                        القالب الافتراضي
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>رفع قوالب جديدة</DialogTitle>
            <DialogDescription>
              أدخل اسم لكل قالب قبل الرفع
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[300px] overflow-y-auto">
            {uploadingFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-16 h-10 bg-muted rounded overflow-hidden flex-shrink-0">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Input
                  value={templateNames[index] || ''}
                  onChange={(e) => {
                    const newNames = [...templateNames];
                    newNames[index] = e.target.value;
                    setTemplateNames(newNames);
                  }}
                  placeholder="اسم القالب"
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setUploadingFiles(files => files.filter((_, i) => i !== index));
                    setTemplateNames(names => names.filter((_, i) => i !== index));
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleUpload} disabled={uploading || uploadingFiles.length === 0}>
              {uploading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الرفع...
                </>
              ) : (
                <>
                  <Upload className="ml-2 h-4 w-4" />
                  رفع {uploadingFiles.length} قالب
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا القالب؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteTemplate.mutate({ id: deleteConfirmId });
                }
              }}
              disabled={deleteTemplate.isPending}
            >
              {deleteTemplate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "حذف"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
