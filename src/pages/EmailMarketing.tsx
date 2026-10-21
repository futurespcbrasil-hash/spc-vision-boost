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
const makeHtml = (message: string, imageData?: string) => {
  const paragraphs = message.split(/\n{2,}/).map((part) => `<p style="margin:0 0 14px">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
  const image = imageData
    ? `<div style="margin:20px 0"><img src="${imageData}" alt="Imagem da Future Soluções" style="max-width:100%;height:auto"></div>`
    : "";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222;line-height:1.55"><div style="max-width:640px;margin:0 auto;padding:24px">${paragraphs}${image}<p style="margin-top:28px;font-size:12px;color:#666">Você recebeu este e-mail por se tratar de um contato comercial. Se não quiser receber novas mensagens da Future Soluções, responda com “não quero receber”.</p></div></body></html>`;
};

const EmailMarketing = () => {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [checkingGoogle, setCheckingGoogle] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState("");
  const [subject, setSubject] = useState("Conheça o emissor fiscal da Future Soluções");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [imageData, setImageData] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageMimeType, setImageMimeType] = useState("");
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

  const selectedContacts = useMemo(() => contacts.filter((contact) => contact.selected), [contacts]);
  const htmlPreview = useMemo(() => makeHtml(message, imageData || undefined), [message, imageData]);
  const sentToday = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return logs.filter((log) => log.status === "sent" && new Date(log.at).toLocaleDateString("en-CA") === today).length;
  }, [logs]);

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
      toast.success(`${imported.length} e-mails válidos importados e selecionados.`);
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
    if (!selectedContacts.length) { toast.error("Selecione pelo menos um e-mail."); return; }
    if (selectedContacts.length + sentToday > dailyLimit) {
      toast.error(`O limite configurado é ${dailyLimit} e-mails por dia. Hoje já foram enviados ${sentToday} nesta tela.`);
      return;
    }
    const alreadySent = new Set(sentEmails);
    const queue = selectedContacts.filter((contact) => !alreadySent.has(contact.email));
    if (!queue.length) { toast.info("Todos os e-mails selecionados já constam como enviados nesta campanha."); return; }
    stopRef.current = false;
    pauseRef.current = false;
    setPaused(false);
    setSending(true);
    let done = 0;
    try {
      for (const contact of queue) {
        if (stopRef.current) break;
        await waitWhilePaused();
        if (stopRef.current) break;
        setCurrentEmail(contact.email);
        try {
          const headers = await authHeaders();
          const imageBase64 = imageData ? imageData.substring(imageData.indexOf(",") + 1) : "";
          const html = makeHtml(message, imageData ? "cid:campaign-image" : undefined);
          const response = await fetch(`${EDGE_BASE}?action=send-email`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              to: contact.email, subject: subject.trim(), html,
              imageBase64, imageMimeType, imageName,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || `Falha no envio (${response.status})`);
          const log: SendLog = { email: contact.email, status: "sent", message: result.message || "Enviado", at: new Date().toISOString() };
          setLogs((previous) => [log, ...previous]);
          setSentEmails((previous) => [...new Set([...previous, contact.email])]);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Erro de envio";
          const log: SendLog = { email: contact.email, status: "error", message: detail, at: new Date().toISOString() };
          setLogs((previous) => [log, ...previous]);
          setFailedEmails((previous) => [...new Set([...previous, contact.email])]);
          if (/insufficient|scope|permission|403/i.test(detail)) {
            toast.error("O Google não autorizou o envio pelo Gmail. Clique em Entrar com Google novamente para conceder a permissão de envio.");
            break;
          }
        }
        done += 1;
        setProgress(Math.round((done / queue.length) * 100));
        if (!stopRef.current && done < queue.length) {
          let remaining = Math.max(30, Math.min(600, Number(delaySeconds) || 60));
          while (remaining > 0 && !stopRef.current) {
            await waitWhilePaused();
            if (stopRef.current) break;
            await new Promise((resolve) => window.setTimeout(resolve, 1000));
            remaining -= 1;
          }
        }
      }
    } finally {
      setSending(false);
      setPaused(false);
      setCurrentEmail("");
      pauseRef.current = false;
      if (stopRef.current) toast.info("Envio interrompido. Os resultados já registrados foram mantidos.");
      else toast.success("Fila de envio finalizada. Confira os resultados abaixo.");
    }
  };

  const pauseSending = () => {
    pauseRef.current = true;
    setPaused(true);
  };
  const resumeSending = () => {
    pauseRef.current = false;
    setPaused(false);
  };
  const stopSending = () => { stopRef.current = true; pauseRef.current = false; setPaused(false); };
  const clearCampaign = () => {
    if (sending) return;
    setContacts([]); setFileName(""); setLogs([]); setSentEmails([]); setFailedEmails([]);
    setProgress(0); setCurrentEmail(""); setImageData(""); setImageName(""); setImageMimeType("");
    toast.success("Campanha limpa. Você pode importar uma nova lista.");
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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(!previewOpen)}><Eye className="h-4 w-4 mr-2" /> {previewOpen ? "Ocultar prévia" : "Visualizar mensagem"}</Button>
          </div>
          {previewOpen && <div className="overflow-hidden rounded-lg border bg-white"><div className="border-b bg-muted px-4 py-3 text-sm text-foreground"><strong>Assunto:</strong> {subject}</div><iframe title="Prévia do e-mail" sandbox="" srcDoc={htmlPreview} className="h-[420px] w-full bg-white" /></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Ritmo de envio</CardTitle><CardDescription>Envio individual, em sequência, para controlar o ritmo e identificar falhas. A fila roda enquanto esta página permanecer aberta.</CardDescription></CardHeader>
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
          {!sending && <Button onClick={() => void startSending()} disabled={!contacts.length || !selectedContacts.length || checkingGoogle}><Send className="h-4 w-4 mr-2" /> Iniciar envio para {selectedContacts.length} contatos</Button>}
          <p className="text-xs text-muted-foreground">Envie apenas para contatos com uma base legítima para contato comercial. Respeite pedidos de descadastro e não reenvie para quem pediu para não receber.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> 4. Resultado dos envios</CardTitle><CardDescription>O histórico desta sessão mostra sucesso e falhas por endereço.</CardDescription></CardHeader>
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
