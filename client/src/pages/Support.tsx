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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Headphones,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, X, Paperclip } from "lucide-react";

export default function Support() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch tickets
  const { data: tickets, isLoading, refetch } = trpc.tickets.list.useQuery();
  
  // Fetch selected ticket messages
  const { data: ticketMessages, refetch: refetchMessages } = trpc.tickets.getMessages.useQuery(
    { ticketId: selectedTicketId! },
    { enabled: !!selectedTicketId }
  );

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
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // No size limit - allow any image size
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

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeTicket = trpc.tickets.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إغلاق التذكرة" : "Ticket closed");
      refetch();
      refetchMessages();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticketMessages]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="default" className="bg-blue-500">{t("support.open")}</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-yellow-500">{t("support.in_progress")}</Badge>;
      case "resolved":
        return <Badge variant="default" className="bg-green-500">{t("support.resolved")}</Badge>;
      case "closed":
        return <Badge variant="secondary">{t("support.closed")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low":
        return <Badge variant="outline">{t("support.low")}</Badge>;
      case "medium":
        return <Badge variant="secondary">{t("support.medium")}</Badge>;
      case "high":
        return <Badge variant="default" className="bg-orange-500">{t("support.high")}</Badge>;
      case "urgent":
        return <Badge variant="destructive">{t("support.urgent")}</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCreateTicket = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createTicket.mutate({
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
      priority: formData.get("priority") as "low" | "medium" | "high" | "urgent",
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !selectedTicketId) return;

    let attachmentUrl: string | undefined;

    // Upload image to S3 if selected
    if (selectedImage) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedImage);
        
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

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
      message: newMessage || (language === "ar" ? "صورة" : "Image"),
      attachmentUrl,
    });
  };;

  const selectedTicket = tickets?.find((t: any) => t.id === selectedTicketId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("support.title")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "تواصل مع فريق الدعم الفني" : "Contact our support team"}
          </p>
        </div>
        <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
              {t("support.new_ticket")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("support.new_ticket")}</DialogTitle>
              <DialogDescription>
                {language === "ar" ? "أرسل استفسارك وسنرد عليك في أقرب وقت" : "Submit your inquiry and we'll respond shortly"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTicket}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">{t("support.subject")}</Label>
                  <Input id="subject" name="subject" required />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="priority">{t("support.priority")}</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("support.low")}</SelectItem>
                      <SelectItem value="medium">{t("support.medium")}</SelectItem>
                      <SelectItem value="high">{t("support.high")}</SelectItem>
                      <SelectItem value="urgent">{t("support.urgent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t("support.message")}</Label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    placeholder={language === "ar" ? "اكتب رسالتك هنا..." : "Write your message here..."}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsNewTicketDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createTicket.isPending}>
                  {createTicket.isPending ? (language === "ar" ? "جاري الإرسال..." : "Sending...") : t("common.submit")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tickets List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">{language === "ar" ? "التذاكر" : "Tickets"}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : tickets?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {language === "ar" ? "لا توجد تذاكر" : "No tickets found"}
                </div>
              ) : (
                <div className="divide-y">
                  {tickets?.map((ticket: any) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full p-4 text-start hover:bg-muted/50 transition-colors ${
                        selectedTicketId === ticket.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ticket.subject}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            #{ticket.id} • {formatDate(ticket.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2">
          {selectedTicket ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedTicket.subject}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>#{selectedTicket.id}</span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </CardDescription>
                  </div>
                  {selectedTicket.status !== "closed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeTicket.mutate({ id: selectedTicket.id, status: "closed" })}
                      disabled={closeTicket.isPending}
                    >
                      <CheckCircle2 className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                      {language === "ar" ? "إغلاق التذكرة" : "Close Ticket"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[350px] p-4">
                  <div className="space-y-4">
                    {ticketMessages?.map((msg: any) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.senderId === user?.id ? "flex-row-reverse" : ""
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.senderId === user?.id ? "bg-primary" : "bg-muted"
                        }`}>
                          {msg.senderId === user?.id ? (
                            <User className="h-4 w-4 text-primary-foreground" />
                          ) : (
                            <Headphones className="h-4 w-4" />
                          )}
                        </div>
                        <div className={`flex-1 max-w-[80%] ${
                          msg.senderId === user?.id ? "text-end" : ""
                        }`}>
                          <div className={`inline-block p-3 rounded-lg ${
                            msg.senderId === user?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            {msg.attachmentUrl && (
                              <a 
                                href={msg.attachmentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block mt-2"
                              >
                                <img 
                                  src={msg.attachmentUrl} 
                                  alt="Attachment" 
                                  className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                {selectedTicket.status !== "closed" && (
                  <form onSubmit={handleSendMessage} className="border-t p-4">
                    {imagePreview && (
                      <div className="mb-3 relative inline-block">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="max-h-32 rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading || sendMessage.isPending}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={language === "ar" ? "اكتب رسالتك..." : "Type your message..."}
                        disabled={sendMessage.isPending || isUploading}
                      />
                      <Button 
                        type="submit" 
                        disabled={sendMessage.isPending || isUploading || (!newMessage.trim() && !selectedImage)}
                      >
                        {isUploading ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center h-[500px] text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">
                {language === "ar" ? "اختر تذكرة" : "Select a ticket"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {language === "ar" 
                  ? "اختر تذكرة من القائمة لعرض المحادثة" 
                  : "Choose a ticket from the list to view the conversation"
                }
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
