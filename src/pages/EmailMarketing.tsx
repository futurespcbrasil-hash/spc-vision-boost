import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Mail, LogIn, Upload, ImagePlus, Eye, Send, Pause, Play, RotateCcw,
  CheckCircle2, AlertCircle, FileSpreadsheet, Clock, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Contact = { email: string; selected: boolean };
type CampaignButton = { id: string; text: string; kind: "whatsapp" | "website"; target: string; whatsappMessage: string };
type SendLog = { email: string; status: "sent" | "error"; message: string; at: string };

const PROJECT_ID = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
const EDGE_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/google-calendar`;
const DEFAULT_MESSAGE = `Olá, tudo bem?

Aqui é da Future Soluções. Gostaria de apresentar nosso sistema emissor de notas fiscais, que ajuda a simplificar a rotina da sua empresa.

Com o nosso emissor, você conta com emissão de documentos fiscais conforme as funcionalidades contratadas e notas ilimitadas no plano.

Planos a partir de R$ 60 por mês.

Se tiver interesse, responda a este e-mail para conhecer a solução e verificar se ela atende à sua empresa.

Atenciosamente,
Equipe Future Soluções`;

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char] || char));
const makeHtml = (message: string, imageData?: string, buttons: CampaignButton[] = []) => {
  const paragraphs = message.split(/\n{2,}/).map((part) => `<p style="margin:0 0 14px">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
  const image = imageData
    ? `<div style="margin:20px 0"><img src="${imageData}" alt="Imagem da Future Soluções" style="max-width:100%;height:auto"></div>`
    : "";
  const buttonMarkup = buttons.map((button) => {
    const target = button.kind === "whatsapp"
      ? `https://wa.me/${button.target.replace(/\D/g, "")}${button.whatsappMessage.trim() ? `?text=${encodeURIComponent(button.whatsappMessage.trim())}` : ""}`
      : button.target.trim();
    if (!/^https?:\/\//i.test(target)) return "";
    const label = escapeHtml(button.text.trim() || (button.kind === "whatsapp" ? "Fale conosco pelo WhatsApp" : "Saiba mais"));
    return `<div style="margin:12px 0;text-align:center"><a href="${escapeHtml(target)}" style="display:inline-block;background:${button.kind === "whatsapp" ? "#168447" : "#6D28D9"};color:#fff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:6px;min-width:180px;text-align:center">${label}</a></div>`;
  }).join("");
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;line-height:1.55"><div style="max-width:640px;margin:0 auto;padding:24px">${paragraphs}${image}${buttonMarkup}<p style="margin-top:28px;font-size:12px;color:#666">Você recebeu este e-mail por se tratar de um contato comercial. Se não quiser receber novas mensagens da Future Soluções, responda com “não quero receber”.</p></div></body></html>`;
};

const EmailMarketing = () => {
  const [campaignName, setCampaignName] = useState("Nova campanha");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [savedCampaigns, setSavedCampaigns] = useState<any[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState("draft");
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState("Conheça o emissor fiscal da Future Soluções");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageMimeType, setImageMimeType] = useState("");
  const [campaignButtons, setCampaignButtons] = useState<CampaignButton[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [dailyLimit, setDailyLimit] = useState(100);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEmail, setCurrentEmail] = useState("");
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [sentEmails, setSentEmails] = useState<string[]>([]);
  const [failedEmails, setFailedEmails] = useState<string[]>([]);
  const stopRef = useRef(false);
  const pauseRef = useRef(false);
  const restoringCampaignRef = useRef(false);
  const campaignRestoreAttemptedRef = useRef(false);
  const CAMPAIGN_SESSION_KEY = "spc-email-marketing-active-campaign";

  const selectedContacts = useMemo(() => contacts.filter((contact) => contact.selected), [contacts]);
  const htmlPreview = useMemo(() => makeHtml(message, imageData || undefined, campaignButtons), [message, imageData, campaignButtons]);
  const sentToday = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return logs.filter((log) => log.status === "sent" && new Date(log.at).toLocaleDateString("en-CA") === today).length;
  }, [logs]);

  const db = supabase as any;

  const refreshSavedCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const { data, error } = await db.from("email_marketing_campaigns")
        .select("id,name,status,updated_at,contacts,logs,automation_enabled")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setSavedCampaigns(data || []);
    } catch (error) {
      console.error("Falha ao carregar campanhas salvas", error);
      toast.error("Não foi possível carregar as campanhas salvas.");
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => { void refreshSavedCampaigns(); }, [refreshSavedCampaigns]);

  // Keep the active campaign identity across Chrome tab discards/reloads.
  useEffect(() => {
    if (!campaignId) return; // Preserve the previous ID until the restoration effect reads it.
    try { window.sessionStorage.setItem(CAMPAIGN_SESSION_KEY, campaignId); } catch { /* storage may be disabled */ }
  }, [campaignId]);

  // On a fresh mount, reopen the last campaign from the server rather than showing an empty editor.
  useEffect(() => {
    if (campaignRestoreAttemptedRef.current || loadingCampaigns) return;
    campaignRestoreAttemptedRef.current = true;
    let savedId: string | null = null;
    try { savedId = window.sessionStorage.getItem(CAMPAIGN_SESSION_KEY); } catch { /* storage may be disabled */ }
    if (!savedId) return;
    restoringCampaignRef.current = true;
    void openSavedCampaign(savedId).finally(() => { restoringCampaignRef.current = false; });
  }, [loadingCampaigns]);

  const persistCampaign = useCallback(async (options: {
    createIfMissing?: boolean; status?: string; name?: string;
    contacts?: Contact[]; logs?: SendLog[]; autoSave?: boolean;
  } = {}, showToast = false) => {
    setSavingCampaign(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sua sessão do CRM expirou. Entre novamente.");
      const payload = {
        user_id: user.id,
        name: (options.name ?? campaignName).trim() || "Campanha sem nome",
        ...(options.autoSave ? {} : { status: options.status ?? campaignStatus }),
        subject, message,
        image_data: imageData || null,
        image_name: imageName || null,
        image_mime_type: imageMimeType || null,
        campaign_buttons: campaignButtons,
        contacts: options.contacts ?? contacts,
        ...(options.autoSave ? {} : { logs: options.logs ?? logs }),
        delay_seconds: delaySeconds,
        daily_limit: dailyLimit,
        updated_at: new Date().toISOString(),
      };
      let error: any = null;
      if (campaignId && !options.createIfMissing) {
        ({ error } = await db.from("email_marketing_campaigns").update(payload).eq("id", campaignId));
      } else {
        const { data, error: insertError } = await db.from("email_marketing_campaigns")
          .insert(payload).select("id").single();
        error = insertError;
        if (!error && data?.id) setCampaignId(data.id);
      }
      if (error) throw error;
      if (options.status) setCampaignStatus(options.status);
      await refreshSavedCampaigns();
      if (showToast) toast.success("Campanha salva no CRM.");
      return true;
    } catch (error) {
      console.error("Falha ao salvar campanha", error);
      if (showToast) toast.error(error instanceof Error ? error.message : "Não foi possível salvar a campanha.");
      return false;
    } finally {
      setSavingCampaign(false);
    }
  }, [campaignName, campaignStatus, subject, message, imageData, imageName, imageMimeType, campaignButtons, contacts, logs, delaySeconds, dailyLimit, campaignId, refreshSavedCampaigns]);

  const openSavedCampaign = async (id: string) => {
    setLoadingCampaign(true);
    try {
      const { data, error } = await db.from("email_marketing_campaigns").select("*").eq("id", id).single();
      if (error) throw error;
      setCampaignId(data.id);
      setCampaignName(data.name || "Campanha sem nome");
      setCampaignStatus(data.status || "draft");
      setSending(data.status === "sending" && data.automation_enabled === true);
      setCurrentEmail(data.last_worker_email || "");
      setSubject(data.subject || "");
      setMessage(data.message || "");
      setImageData(data.image_data || "");
      setImageName(data.image_name || "");
      setImageMimeType(data.image_mime_type || "");
      setCampaignButtons(Array.isArray(data.campaign_buttons) ? data.campaign_buttons : []);
      const restoredContacts = Array.isArray(data.contacts) ? data.contacts : [];
      const restoredLogs = Array.isArray(data.logs) ? data.logs : [];
      setContacts(restoredContacts);
      setLogs(restoredLogs);
      setSentEmails([...new Set(restoredLogs.filter((log: SendLog) => log.status === "sent").map((log: SendLog) => log.email))] as string[]);
      setFailedEmails([...new Set(restoredLogs.filter((log: SendLog) => log.status === "error").map((log: SendLog) => log.email))] as string[]);
      setFileName("Lista salva na campanha");
      setDelaySeconds(data.delay_seconds || 60);
      setDailyLimit(data.daily_limit || 100);
      setProgress(restoredContacts.length ? Math.round((restoredContacts.filter((contact: Contact) => restoredLogs.some((log: SendLog) => log.email === contact.email && log.status === "sent")).length / restoredContacts.length) * 100) : 0);
      setPreviewOpen(false);
      toast.success(`Campanha "${data.name}" carregada.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a campanha.");
    } finally {
      setLoadingCampaign(false);
    }
  };

  const newCampaign = () => {
    if (sending) return;
    try { window.sessionStorage.removeItem(CAMPAIGN_SESSION_KEY); } catch { /* storage may be disabled */ }
    setCampaignId(null);
    setCampaignName(`Campanha ${new Date().toLocaleString("pt-BR")}`);
    setCampaignStatus("draft");
    setContacts([]); setFileName(""); setLogs([]); setSentEmails([]); setFailedEmails([]);
    setProgress(0); setCurrentEmail(""); setImageData(""); setImageName(""); setImageMimeType("");
    setCampaignButtons([]); setSubject("Conheça o emissor fiscal da Future Soluções"); setMessage(DEFAULT_MESSAGE);
    setPreviewOpen(false);
  };

  useEffect(() => {
    if (!campaignId || !sending) return;
    let active = true;
    const poll = async () => {
      const { data, error } = await db.from("email_marketing_campaigns")
        .select("status,automation_enabled,logs,contacts,last_worker_email")
        .eq("id", campaignId).maybeSingle();
      if (!active || error || !data) return;
      const nextLogs = Array.isArray(data.logs) ? data.logs : [];
      const nextContacts = Array.isArray(data.contacts) ? data.contacts : [];
      setLogs(nextLogs);
      setContacts(nextContacts);
      setSentEmails([...new Set(nextLogs.filter((log: SendLog) => log.status === "sent").map((log: SendLog) => log.email))] as string[]);
      setFailedEmails([...new Set(nextLogs.filter((log: SendLog) => log.status === "error").map((log: SendLog) => log.email))] as string[]);
      setCurrentEmail(data.last_worker_email || "");
      setCampaignStatus(data.status || "draft");
      const isRunning = data.status === "sending" && data.automation_enabled === true;
      if (!isRunning) {
        setSending(false);
        setPaused(data.status === "paused");
      }
      await refreshSavedCampaigns();
    };
    const interval = window.setInterval(() => { void poll(); }, 15000);
    void poll();
    return () => { active = false; window.clearInterval(interval); };
  }, [campaignId, sending, db, refreshSavedCampaigns]);

  useEffect(() => {
    // Enquanto a fila do servidor está ativa, a tela nunca grava o estado de execução.
    // Status e logs da campanha em execução pertencem ao worker; o autosave só grava o editor.
    if (loadingCampaign || savingCampaign || sending) return;
    const hasEditorContent = contacts.length > 0 || imageData || campaignButtons.length > 0
      || campaignName !== "Nova campanha"
      || subject !== "Conheça o emissor fiscal da Future Soluções"
      || message !== DEFAULT_MESSAGE;
    if (!hasEditorContent) return;
    const timer = window.setTimeout(() => {
      void persistCampaign({ createIfMissing: !campaignId, autoSave: true, status: "draft" }, false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [campaignId, loadingCampaign, savingCampaign, sending, campaignName, subject, message, imageData, imageName, imageMimeType, campaignButtons, contacts, delaySeconds, dailyLimit, persistCampaign]);

  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sua sessão do CRM expirou. Entre novamente.");
    return {
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    };
  }, []);

  const checkGoogle = useCallback(async (showToast = false) => {
    setCheckingGoogle(true);
    try {
      const headers = await authHeaders();
      const response = await fetch(`${EDGE_BASE}?action=gmail-status`, { headers });
      const data = await response.json();
      const connected = response.ok && data.connected === true;
      setGoogleConnected(connected);
      if (showToast) toast[connected ? "success" : "error"](connected ? "Gmail pronto para enviar." : (data.error || "Conecte o Gmail para enviar campanhas."));
      return connected;
    } catch (error) {
      setGoogleConnected(false);
      if (showToast) toast.error(error instanceof Error ? error.message : "Não foi possível verificar o Gmail.");
      return false;
    } finally {
      setCheckingGoogle(false);
    }
  }, [authHeaders]);

  useEffect(() => { void checkGoogle(); }, [checkGoogle]);

  const connectGoogle = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch(`${EDGE_BASE}?action=auth-url&include_gmail=true&return_path=%2Fcampanhas%2Femail&redirect_uri=${encodeURIComponent(window.location.origin)}`, { headers });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Não foi possível iniciar o login Google.");
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao conectar Google.");
    }
  };

  const importList = async (file?: File) => {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
      let headerRow = -1;
      let emailColumn = -1;
      for (let rowIndex = 0; rowIndex < Math.min(rows.length, 20); rowIndex++) {
        const row = rows[rowIndex] as unknown[];
        const col = row.findIndex((cell) => /^(e-?mail|email|e-mail address|email address|correio eletr[oô]nico)$/i.test(String(cell).trim()) || /(^|\b)(e-?mail|email)(\b|$)/i.test(String(cell).trim()));
        if (col >= 0) { headerRow = rowIndex; emailColumn = col; break; }
      }
      if (headerRow < 0 || emailColumn < 0) {
        toast.error("Não encontrei uma coluna identificada como E-mail/Email. Confira o cabeçalho da planilha.");
        return;
      }
      const unique = new Set<string>();
      for (const row of rows.slice(headerRow + 1) as unknown[][]) {
        const email = String(row[emailColumn] ?? "").trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) unique.add(email);
      }
      if (!unique.size) {
        toast.error("A coluna de e-mail foi encontrada, mas não há endereços válidos abaixo do cabeçalho.");
        return;
      }
      const imported = [...unique].map((email) => ({ email, selected: true }));
      setContacts(imported);
      setFileName(file.name);
      setLogs([]);
      setSentEmails([]);
      setFailedEmails([]);
      setProgress(0);
      const suggestedName = file.name.replace(/\\.(xlsx|xls|csv)$/i, "").trim() || `Campanha ${new Date().toLocaleString("pt-BR")}`;
      try { window.sessionStorage.removeItem(CAMPAIGN_SESSION_KEY); } catch { /* storage may be disabled */ }
      setCampaignId(null);
      setCampaignName(suggestedName);
      setCampaignStatus("draft");
      const saved = await persistCampaign({ createIfMissing: true, status: "draft", name: suggestedName, contacts: imported, logs: [] }, false);
      if (!saved) toast.error("A lista foi carregada, mas não foi possível salvar a campanha. Tente Salvar campanha.");
      else toast.success(`${imported.length} e-mails importados. Campanha salva no CRM.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
    }
  };

  const importImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 4 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(String(reader.result || ""));
      setImageName(file.name);
      setImageMimeType(file.type);
      toast.success("Imagem adicionada à mensagem.");
    };
    reader.onerror = () => toast.error("Não foi possível carregar a imagem.");
    reader.readAsDataURL(file);
  };

  const toggleContact = (email: string, selected: boolean) => setContacts((previous) => previous.map((contact) => contact.email === email ? { ...contact, selected } : contact));
  const updateAll = (selected: boolean) => setContacts((previous) => previous.map((contact) => ({ ...contact, selected })));

  const waitWhilePaused = async () => {
    while (pauseRef.current && !stopRef.current) await new Promise((resolve) => window.setTimeout(resolve, 500));
  };

  const startSending = async () => {
    if (!googleConnected && !(await checkGoogle(true))) return;
    if (!subject.trim() || !message.trim()) { toast.error("Preencha o assunto e a mensagem."); return; }
    const invalidButton = campaignButtons.find((button) => button.kind === "whatsapp" ? button.target.replace(/\D/g, "").length < 8 : !/^https?:\/\//i.test(button.target.trim()));
    if (invalidButton) { toast.error(invalidButton.kind === "whatsapp" ? "Informe o telefone do WhatsApp com DDI e DDD." : "Informe uma URL válida começando com https:// ou http://."); return; }
    if (!selectedContacts.length) { toast.error("Selecione pelo menos um e-mail."); return; }
    const alreadySent = new Set(sentEmails);
    if (selectedContacts.every((contact) => alreadySent.has(contact.email))) {
      setCampaignStatus("completed");
      await persistCampaign({ status: "completed" }, false);
      toast.info("Todos os e-mails selecionados já constam como enviados nesta campanha.");
      return;
    }
    const retryLogs = logs.filter((log) => log.status !== "error");
    const saved = await persistCampaign({ createIfMissing: !campaignId, status: "sending", logs: retryLogs }, false);
    if (!saved) { toast.error("Não foi possível salvar a campanha antes de ativar o envio."); return; }
    let activeId = campaignId;
    if (!activeId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sua sessão expirou. Entre novamente."); return; }
      const { data: row, error } = await db.from("email_marketing_campaigns")
        .select("id").eq("user_id", user.id).eq("name", campaignName.trim() || "Campanha sem nome")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (error || !row?.id) { toast.error("A campanha foi salva, mas não consegui localizar seu registro para ativar o envio."); return; }
      activeId = row.id;
      setCampaignId(activeId);
    }
    const { error: activationError } = await db.from("email_marketing_campaigns").update({
      status: "sending", automation_enabled: true, next_send_at: new Date().toISOString(),
      worker_lock_until: null, completed_at: null, logs: retryLogs, updated_at: new Date().toISOString(),
    }).eq("id", activeId);
    if (activationError) { toast.error("Não foi possível ativar o envio automático no servidor."); return; }
    setLogs(retryLogs);
    setFailedEmails([]);
    setCampaignStatus("sending");
    setSending(true);
    setPaused(false);
    await refreshSavedCampaigns();
    toast.success("Envio automático ativado no servidor. Um e-mail será processado por vez, conforme o intervalo configurado, mesmo que você feche esta tela.");
  };

  const pauseSending = async () => {
    if (!campaignId) return;
    const { error } = await db.from("email_marketing_campaigns").update({
      status: "paused", automation_enabled: false, next_send_at: null, updated_at: new Date().toISOString(),
    }).eq("id", campaignId);
    if (error) { toast.error("Não foi possível pausar a campanha no servidor."); return; }
    setCampaignStatus("paused");
    setSending(false);
    setPaused(true);
    await refreshSavedCampaigns();
    toast.info("Campanha pausada. O envio pode terminar a mensagem que já estava em andamento.");
  };

  const resumeSending = async () => { await startSending(); };

  const stopSending = async () => { await pauseSending(); };
  const clearCampaign = () => {
    if (sending) return;
    newCampaign();
    toast.success("Editor limpo. As campanhas já salvas continuam disponíveis acima.");
  };
  const finishCampaign = async () => {
    if (sending) return;
    const allSent = selectedContacts.length > 0 && selectedContacts.every((contact) => sentEmails.includes(contact.email));
    const status = allSent ? "completed" : "paused";
    setCampaignStatus(status);
    const ok = await persistCampaign({ status }, true);
    if (ok && !allSent) toast.info("Campanha salva com pendências. Abra-a quando quiser enviar os e-mails restantes.");
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6" /> Campanhas — E-mail Marketing</h1>
          <p className="text-sm text-muted-foreground mt-1">Importe a lista do CNPJ Já, prepare a mensagem e envie com controle de ritmo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void checkGoogle(true)} disabled={checkingGoogle}><RotateCcw className="h-4 w-4 mr-2" /> Verificar Gmail</Button>
          {googleConnected ? (
            <Button variant="outline" onClick={() => void connectGoogle()}><RotateCcw className="h-4 w-4 mr-2" /> Reconectar Google</Button>
          ) : (
            <Button onClick={() => void connectGoogle()} disabled={checkingGoogle}><LogIn className="h-4 w-4 mr-2" /> Entrar com Google</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas salvas</CardTitle>
          <CardDescription>As listas, mensagens e resultados ficam guardados no CRM. Abra uma campanha para conferir os enviados e retomar os pendentes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 space-y-1"><Label htmlFor="campaign-name">Nome da campanha atual</Label><Input id="campaign-name" value={campaignName} maxLength={120} disabled={sending} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ex.: Emissor fiscal - CNPJJá outubro" /></div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => void persistCampaign({ createIfMissing: !campaignId }, true)} disabled={savingCampaign || sending || !contacts.length}>{savingCampaign ? "Salvando..." : "Salvar campanha"}</Button>
              <Button onClick={newCampaign} disabled={sending}>Nova campanha</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={campaignStatus === "completed" ? "default" : "secondary"}>{campaignStatus === "completed" ? "Concluída" : campaignStatus === "sending" ? "Em envio" : campaignStatus === "paused" ? "Pausada / com pendências" : "Rascunho / com pendências"}</Badge>
            {savingCampaign && <span>Salvando alterações…</span>}
          </div>
          {loadingCampaigns ? <p className="text-sm text-muted-foreground">Carregando campanhas…</p> : savedCampaigns.length ? (
            <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted"><tr><th className="p-2 text-left">Campanha</th><th className="p-2 text-left">Situação</th><th className="p-2 text-right">Enviados</th><th className="p-2 text-right">Falhas</th><th className="p-2 text-right">Pendentes</th><th className="p-2 text-left">Atualizada</th><th className="p-2">Ação</th></tr></thead><tbody>
              {savedCampaigns.map((item) => {
                const campaignContacts = Array.isArray(item.contacts) ? item.contacts : [];
                const campaignLogs = Array.isArray(item.logs) ? item.logs : [];
                const sent = new Set(campaignLogs.filter((log: SendLog) => log.status === "sent").map((log: SendLog) => log.email));
                const failed = new Set(campaignLogs.filter((log: SendLog) => log.status === "error").map((log: SendLog) => log.email));
                const pending = campaignContacts.filter((contact: Contact) => contact.selected && !sent.has(contact.email)).length;
                return <tr key={item.id} className="border-t">
                  <td className="p-2 font-medium">{item.name}</td>
                  <td className="p-2">{item.status === "completed" ? "Concluída" : item.status === "sending" ? "Em envio" : item.status === "paused" ? "Pausada" : "Com pendências"}</td>
                  <td className="p-2 text-right">{sent.size}</td><td className="p-2 text-right">{failed.size}</td><td className="p-2 text-right">{pending}</td>
                  <td className="p-2 whitespace-nowrap">{new Date(item.updated_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2 text-center"><Button size="sm" variant="outline" disabled={loadingCampaign || sending} onClick={() => void openSavedCampaign(item.id)}>{campaignId === item.id ? "Aberta" : "Abrir"}</Button></td>
                </tr>;
              })}
            </tbody></table></div>
          ) : <p className="text-sm text-muted-foreground">Nenhuma campanha salva ainda. Importe uma lista para criar a primeira.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> 1. Lista de contatos</CardTitle>
          <CardDescription>Excel ou CSV exportado do CNPJ Já. O sistema procura a coluna com o cabeçalho E-mail/Email e ignora as demais colunas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="email-list" className="cursor-pointer"><span className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted"><Upload className="h-4 w-4 mr-2" /> Carregar Excel/CSV</span></Label>
            <Input id="email-list" type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={sending} onChange={(event) => { void importList(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            {fileName && <Badge variant="secondary">{fileName}</Badge>}
            {contacts.length > 0 && <span className="text-sm text-muted-foreground">{contacts.length} e-mails válidos · {selectedContacts.length} selecionados</span>}
          </div>
          {contacts.length > 0 && <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => updateAll(true)}>Selecionar todos</Button>
              <Button size="sm" variant="outline" onClick={() => updateAll(false)}>Desmarcar todos</Button>
              <Button size="sm" variant="ghost" onClick={clearCampaign} disabled={sending}><Trash2 className="h-4 w-4 mr-1" /> Limpar campanha</Button>
            </div>
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Selecionar</th><th className="p-2 text-left">E-mail</th></tr></thead>
                <tbody>{contacts.map((contact) => <tr key={contact.email} className="border-t">
                  <td className="p-2"><input type="checkbox" checked={contact.selected} onChange={(event) => toggleContact(contact.email, event.target.checked)} aria-label={`Selecionar ${contact.email}`} /></td>
                  <td className="p-2 break-all">{contact.email}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Mensagem da campanha</CardTitle><CardDescription>Prepare a mensagem e confira a prévia antes de começar. A imagem será inserida no corpo do e-mail.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="campaign-subject">Assunto</Label><Input id="campaign-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} /></div>
          <div className="space-y-2"><Label htmlFor="campaign-message">Mensagem</Label><Textarea id="campaign-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={10} /></div>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="campaign-image" className="cursor-pointer"><span className="inline-flex items-center rounded-md border px-4 py-2 text-sm hover:bg-muted"><ImagePlus className="h-4 w-4 mr-2" /> {imageName ? "Trocar imagem" : "Adicionar imagem"}</span></Label>
            <Input id="campaign-image" type="file" accept="image/*" className="hidden" disabled={sending} onChange={(event) => { void importImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
            {imageName && <><span className="text-sm text-muted-foreground">{imageName}</span><Button variant="ghost" size="sm" onClick={() => { setImageData(""); setImageName(""); setImageMimeType(""); }}>Remover imagem</Button></>}
          </div>
          {imageData && <img src={imageData} alt="Prévia da imagem da campanha" className="max-h-48 max-w-full rounded border object-contain" />}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><Label>Botões e links da mensagem</Label><p className="text-xs text-muted-foreground mt-1">Adicione chamadas para ação clicáveis no corpo do e-mail.</p></div><Button type="button" variant="outline" size="sm" disabled={sending || campaignButtons.length >= 5} onClick={() => setCampaignButtons((previous) => [...previous, { id: crypto.randomUUID(), text: "Fale conosco pelo WhatsApp", kind: "whatsapp", target: "", whatsappMessage: "Olá! Gostaria de conhecer o emissor fiscal da Future Soluções." }])}>+ Adicionar botão</Button></div>
            {campaignButtons.length === 0 && <p className="text-sm text-muted-foreground">Nenhum botão adicionado. Você pode incluir um botão de WhatsApp ou um link para seu site.</p>}
            {campaignButtons.map((campaignButton, index) => <div key={campaignButton.id} className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor={`campaign-button-text-${campaignButton.id}`}>Texto do botão {index + 1}</Label><Input id={`campaign-button-text-${campaignButton.id}`} value={campaignButton.text} maxLength={80} disabled={sending} onChange={(event) => setCampaignButtons((previous) => previous.map((item) => item.id === campaignButton.id ? { ...item, text: event.target.value } : item))} /></div>
              <div className="space-y-2"><Label htmlFor={`campaign-button-kind-${campaignButton.id}`}>Tipo de link</Label><select id={`campaign-button-kind-${campaignButton.id}`} value={campaignButton.kind} disabled={sending} onChange={(event) => setCampaignButtons((previous) => previous.map((item) => item.id === campaignButton.id ? { ...item, kind: event.target.value as CampaignButton["kind"], target: "" } : item))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="whatsapp">WhatsApp</option><option value="website">Site / link</option></select></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor={`campaign-button-target-${campaignButton.id}`}>{campaignButton.kind === "whatsapp" ? "Telefone com DDI e DDD" : "Endereço do link (URL começando com https://)"}</Label><Input id={`campaign-button-target-${campaignButton.id}`} placeholder={campaignButton.kind === "whatsapp" ? "5554999999999" : "https://futuresolucoes.com.br"} value={campaignButton.target} disabled={sending} onChange={(event) => setCampaignButtons((previous) => previous.map((item) => item.id === campaignButton.id ? { ...item, target: event.target.value } : item))} /></div>
              {campaignButton.kind === "whatsapp" && <div className="space-y-2 sm:col-span-2"><Label htmlFor={`campaign-button-message-${campaignButton.id}`}>Mensagem inicial do WhatsApp (opcional)</Label><Input id={`campaign-button-message-${campaignButton.id}`} value={campaignButton.whatsappMessage} maxLength={300} disabled={sending} onChange={(event) => setCampaignButtons((previous) => previous.map((item) => item.id === campaignButton.id ? { ...item, whatsappMessage: event.target.value } : item))} /></div>}
              <div className="flex items-center justify-between gap-2 sm:col-span-2"><span className="text-xs text-muted-foreground">{campaignButton.kind === "whatsapp" ? "O link wa.me será montado automaticamente." : "O link será aberto ao clicar no botão do e-mail."}</span><Button type="button" size="sm" variant="ghost" disabled={sending} onClick={() => setCampaignButtons((previous) => previous.filter((item) => item.id !== campaignButton.id))}><Trash2 className="mr-1 h-4 w-4" /> Remover</Button></div>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(!previewOpen)}><Eye className="h-4 w-4 mr-2" /> {previewOpen ? "Ocultar prévia" : "Visualizar mensagem"}</Button>
          </div>
          {previewOpen && <div className="overflow-hidden rounded-lg border bg-white"><div className="border-b bg-muted px-4 py-3 text-sm text-foreground"><strong>Assunto:</strong> {subject}</div><iframe title="Prévia do e-mail" sandbox="" srcDoc={htmlPreview} className="h-[420px] w-full bg-white" /></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Ritmo de envio</CardTitle><CardDescription>Envio individual, em sequência, controlado pelo servidor. A fila pode continuar sem esta página aberta; status e resultados são atualizados pelo servidor e salvos no CRM.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="delay">Intervalo entre e-mails (segundos)</Label><Input id="delay" type="number" min={30} max={600} value={delaySeconds} disabled={sending} onChange={(event) => setDelaySeconds(Math.max(30, Math.min(600, Number(event.target.value) || 60)))} /><p className="text-xs text-muted-foreground">Mínimo 30 segundos; recomendado começar com 60 segundos ou mais.</p></div>
            <div className="space-y-2"><Label htmlFor="daily-limit">Limite nesta campanha por dia</Label><Input id="daily-limit" type="number" min={1} max={400} value={dailyLimit} disabled={sending} onChange={(event) => setDailyLimit(Math.max(1, Math.min(400, Number(event.target.value) || 100)))} /><p className="text-xs text-muted-foreground">Padrão conservador de 100/dia; o limite do Google pode variar por conta.</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={googleConnected ? "default" : "secondary"}>{googleConnected ? "Gmail conectado" : "Gmail não conectado"}</Badge>
            <span className="text-sm text-muted-foreground">Hoje nesta tela: {sentToday} enviados</span>
          </div>
          {sending && <div className="space-y-2"><div className="flex justify-between text-sm"><span>{paused ? "Envio pausado" : "Enviando para"} {currentEmail}</span><span>{progress}%</span></div><Progress value={progress} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={paused ? resumeSending : pauseSending}>{paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}{paused ? "Retomar" : "Pausar"}</Button><Button variant="destructive" onClick={stopSending}>Interromper fila</Button></div></div>}
          {!sending && <Button onClick={() => void startSending()} disabled={!contacts.length || !selectedContacts.length || checkingGoogle || savingCampaign}><Send className="h-4 w-4 mr-2" /> {sentEmails.length ? "Retomar envio dos pendentes" : "Iniciar envio"} ({Math.max(0, selectedContacts.filter((contact) => !sentEmails.includes(contact.email)).length)} contatos)</Button>}
          <Button variant="outline" onClick={() => void finishCampaign()} disabled={!contacts.length || sending || savingCampaign}>Finalizar / salvar campanha</Button>
          <p className="text-xs text-muted-foreground">Envie apenas para contatos com uma base legítima para contato comercial. Respeite pedidos de descadastro e não reenvie para quem pediu para não receber.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> 4. Resultado dos envios</CardTitle><CardDescription>O histórico fica salvo na campanha e continua disponível após sair ou atualizar a página.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><div className="text-sm text-muted-foreground">Enviados</div><div className="text-2xl font-semibold text-green-600">{sentEmails.length}</div></div>
            <div className="rounded-lg border p-3"><div className="text-sm text-muted-foreground">Falhas</div><div className="text-2xl font-semibold text-destructive">{failedEmails.length}</div></div>
            <div className="rounded-lg border p-3"><div className="text-sm text-muted-foreground">Restantes selecionados</div><div className="text-2xl font-semibold">{Math.max(0, selectedContacts.length - sentEmails.length)}</div></div>
          </div>
          {logs.length > 0 ? <div className="max-h-72 overflow-auto rounded-md border"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Status</th><th className="p-2 text-left">E-mail</th><th className="p-2 text-left">Detalhe</th><th className="p-2 text-left">Horário</th></tr></thead><tbody>{logs.map((log, index) => <tr key={`${log.email}-${log.at}-${index}`} className="border-t"><td className="p-2">{log.status === "sent" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}</td><td className="p-2 break-all">{log.email}</td><td className="p-2">{log.message}</td><td className="p-2 whitespace-nowrap">{new Date(log.at).toLocaleTimeString("pt-BR")}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">Nenhum envio iniciado nesta sessão.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailMarketing;
