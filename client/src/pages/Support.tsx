import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  MessageSquare,
  Send,
  Paperclip,
  X,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function Support() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [deleteTicketId, setDeleteTicketId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize notification sound
  useEffect(() => {
    // Create a simple notification sound using Web Audio API
    const createNotificationSound = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    };
    
    audioRef.current = { play: createNotificationSound } as any;
  }, []);

  // Fetch tickets
  const { data: tickets, isLoading, refetch } = trpc.tickets.list.useQuery();
  
  // Fetch selected ticket messages
  const { data: ticketMessages, refetch: refetchMessages } = trpc.tickets.getMessages.useQuery(
    { ticketId: selectedTicketId! },
    { enabled: !!selectedTicketId }
  );

  // Get selected ticket details
  const selectedTicket = tickets?.find((t: any) => t.id === selectedTicketId);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [ticketMessages]);

  // Mutations
  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: (data) => {
      toast.success(language === "ar" ? "تم إنشاء التذكرة بنجاح" : "Ticket created successfully");
      setIsNewTicketDialogOpen(false);
      refetch();
      setSelectedTicketId(data.id);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendMessage = trpc.tickets.addMessage.useMutation({
    onSuccess: () => {
      setNewMessage("");
      setSelectedImage(null);
      setImagePreview(null);
      refetchMessages();
      // Play notification sound
      audioRef.current?.play();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteTicketMutation = trpc.tickets.deleteTicket.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم حذف التذكرة بنجاح" : "Ticket deleted successfully");
      setDeleteTicketId(null);
      setSelectedTicketId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error(language === "ar" ? "يرجى اختيار صورة" : "Please select an image");
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicketId) return;
    if (!newMessage.trim() && !selectedImage) {
      toast.error(language === "ar" ? "يرجى كتابة رسالة أو اختيار صورة" : "Please write a message or select an image");
      return;
    }

    let attachmentUrl = "";
    if (selectedImage) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedImage);
        
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) throw new Error("Upload failed");
        
        const data = await response.json();
        attachmentUrl = data.url;
      } catch (error) {
        toast.error(language === "ar" ? "فشل رفع الصورة" : "Failed to upload image");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    sendMessage.mutate({
      ticketId: selectedTicketId,
      message: newMessage.trim() || (language === "ar" ? "[صورة]" : "[Image]"),
      attachmentUrl: attachmentUrl || undefined,
    });
  };

  const handleCreateTicket = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createTicket.mutate({
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
      priority: formData.get("priority") as any,
      category: formData.get("category") as string || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; labelAr: string; className: string }> = {
      open: { label: "Open", labelAr: "مفتوحة", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
      in_progress: { label: "In Progress", labelAr: "قيد المعالجة", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
      waiting: { label: "Waiting", labelAr: "بانتظار", className: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
      resolved: { label: "Resolved", labelAr: "محلولة", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      closed: { label: "Closed", labelAr: "مغلقة", className: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
    };
    
    const config = statusConfig[status] || statusConfig.open;
    return (
      <Badge variant="outline" className={config.className}>
        {language === "ar" ? config.labelAr : config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { label: string; labelAr: string; className: string }> = {
      low: { label: "Low", labelAr: "منخفضة", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      medium: { label: "Medium", labelAr: "متوسطة", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
      high: { label: "High", labelAr: "عالية", className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
      urgent: { label: "Urgent", labelAr: "عاجلة", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    };
    
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <Badge variant="outline" className={config.className}>
        {language === "ar" ? config.labelAr : config.label}
      </Badge>
    );
  };

  const isAdmin = user?.role === "owner" || user?.role === "super_admin";

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "الدعم الفني" : "Technical Support"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar" ? "تواصل مع فريق الدعم الفني" : "Contact our support team"}
          </p>
        </div>
        <Button onClick={() => setIsNewTicketDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {language === "ar" ? "تذكرة جديدة" : "New Ticket"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {language === "ar" ? "التذاكر" : "Tickets"}
            </CardTitle>
            <CardDescription>
              {language === "ar" ? `${tickets?.length || 0} تذكرة` : `${tickets?.length || 0} tickets`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  {language === "ar" ? "جاري التحميل..." : "Loading..."}
                </div>
              ) : tickets && tickets.length > 0 ? (
                <div className="space-y-1 p-2">
                  {tickets.map((ticket: any) => {
                    const unreadCount = ticketMessages?.filter((m: any) => !m.isRead && m.senderId !== user?.id).length || 0;
                    return (
                      <button
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedTicketId === ticket.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium truncate">
                                #{ticket.ticketNumber}
                              </span>
                              {unreadCount > 0 && (
                                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5">
                                  {unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate mb-1">{ticket.subject}</p>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(ticket.status)}
                              {getPriorityBadge(ticket.priority)}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{language === "ar" ? "لا توجد تذاكر" : "No tickets"}</p>
                  <Button
                    variant="link"
                    onClick={() => setIsNewTicketDialogOpen(true)}
                    className="mt-2"
                  >
                    {language === "ar" ? "إنشاء تذكرة جديدة" : "Create new ticket"}
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      #{selectedTicket.ticketNumber}
                      <span className="text-base font-normal text-muted-foreground">
                        {selectedTicket.subject}
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTicketId(selectedTicket.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {language === "ar" ? "حذف" : "Delete"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[450px] p-4">
                  {ticketMessages && ticketMessages.length > 0 ? (
                    <div className="space-y-4">
                      {ticketMessages.map((message: any) => {
                        const isOwnMessage = message.senderId === user?.id;
                        const isRead = message.isRead;
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                            style={{ opacity: isRead ? 0.6 : 1 }}
                          >
                            <div
                              className={`max-w-[70%] rounded-lg p-3 ${
                                isOwnMessage
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">
                                  {message.senderName}
                                </span>
                                {isRead && (
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {message.message}
                              </p>
                              {message.attachmentUrl && (
                                <img
                                  src={message.attachmentUrl}
                                  alt="Attachment"
                                  className="mt-2 rounded cursor-pointer max-w-full h-auto"
                                  onClick={() => setViewerImage(message.attachmentUrl)}
                                />
                              )}
                              <span className="text-xs opacity-70 mt-1 block">
                                {new Date(message.createdAt).toLocaleString(language === "ar" ? "ar-SA" : "en-US")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>{language === "ar" ? "لا توجد رسائل" : "No messages"}</p>
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <div className="border-t p-4">
                  {imagePreview && (
                    <div className="mb-2 relative inline-block">
                      <img src={imagePreview} alt="Preview" className="h-20 rounded" />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={() => {
                          setSelectedImage(null);
                          setImagePreview(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder={language === "ar" ? "اكتب رسالتك..." : "Type your message..."}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isUploading || sendMessage.isPending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isUploading || sendMessage.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[600px]">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">
                  {language === "ar" ? "اختر تذكرة لعرض الرسائل" : "Select a ticket to view messages"}
                </p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* New Ticket Dialog */}
      <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تذكرة دعم جديدة" : "New Support Ticket"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar" ? "املأ النموذج أدناه لإنشاء تذكرة دعم جديدة" : "Fill out the form below to create a new support ticket"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div>
              <Label htmlFor="subject">{language === "ar" ? "الموضوع" : "Subject"}</Label>
              <Input id="subject" name="subject" required />
            </div>
            <div>
              <Label htmlFor="priority">{language === "ar" ? "الأولوية" : "Priority"}</Label>
              <Select name="priority" defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{language === "ar" ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="medium">{language === "ar" ? "متوسطة" : "Medium"}</SelectItem>
                  <SelectItem value="high">{language === "ar" ? "عالية" : "High"}</SelectItem>
                  <SelectItem value="urgent">{language === "ar" ? "عاجلة" : "Urgent"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">{language === "ar" ? "الفئة (اختياري)" : "Category (optional)"}</Label>
              <Input id="category" name="category" />
            </div>
            <div>
              <Label htmlFor="message">{language === "ar" ? "الرسالة" : "Message"}</Label>
              <Textarea id="message" name="message" required rows={4} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsNewTicketDialogOpen(false)}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={createTicket.isPending}>
                {createTicket.isPending
                  ? (language === "ar" ? "جاري الإنشاء..." : "Creating...")
                  : (language === "ar" ? "إنشاء" : "Create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTicketId} onOpenChange={() => setDeleteTicketId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "تأكيد الحذف" : "Confirm Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar"
                ? "هل أنت متأكد من حذف هذه التذكرة؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this ticket? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === "ar" ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTicketId) {
                  deleteTicketMutation.mutate({ id: deleteTicketId });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "ar" ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Viewer Modal */}
      <Dialog open={!!viewerImage} onOpenChange={() => setViewerImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "عرض الصورة" : "View Image"}</DialogTitle>
          </DialogHeader>
          {viewerImage && (
            <div className="relative">
              <img src={viewerImage} alt="Full size" className="w-full h-auto rounded" />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2"
                onClick={() => setViewerImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
