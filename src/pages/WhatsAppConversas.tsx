import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, Smile, Search, User, Building, GitBranch, Calendar, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockConversations, mockAccounts, WhatsAppConversation } from '@/data/whatsappMockData';

const WhatsAppConversas = () => {
  const [conversations] = useState(mockConversations);
  const [selectedConvo, setSelectedConvo] = useState<WhatsAppConversation | null>(conversations[0]);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');

  const filtered = conversations.filter(c => {
    const matchSearch = c.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactNumber.includes(searchTerm);
    const matchAccount = accountFilter === 'all' || c.accountId === accountFilter;
    return matchSearch && matchAccount;
  });

  const handleSend = () => {
    if (!message.trim() || !selectedConvo) return;
    setMessage('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Conversas</h1>
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {mockAccounts.filter(a => a.status === 'connected').map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[340px_1fr] gap-4 h-[calc(100vh-180px)]">
        {/* Conversation List */}
        <Card className="flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar conversa..." className="pl-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtered.map(convo => (
              <button key={convo.id} onClick={() => setSelectedConvo(convo)}
                className={`w-full flex items-start gap-3 p-3 text-left border-b transition-colors hover:bg-muted/50
                  ${selectedConvo?.id === convo.id ? 'bg-muted' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate">{convo.contactName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{convo.lastMessageTime}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                  <span className="text-[10px] text-muted-foreground">{convo.accountName}</span>
                </div>
                {convo.unreadCount > 0 && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-[10px] h-5 w-5 flex items-center justify-center p-0 rounded-full flex-shrink-0">
                    {convo.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className="flex flex-col overflow-hidden">
          {selectedConvo ? (
            <>
              {/* Header */}
              <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedConvo.contactName}</p>
                    <p className="text-xs text-muted-foreground">{selectedConvo.contactNumber}</p>
                  </div>
                </div>
                {selectedConvo.leadId && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs"><Building size={12} />{selectedConvo.leadCompany}</Badge>
                    <Badge variant="outline" className="gap-1 text-xs"><GitBranch size={12} />{selectedConvo.leadStage}</Badge>
                  </div>
                )}
              </div>

              {/* CRM Quick Actions */}
              {selectedConvo.leadId && (
                <div className="px-3 py-2 border-b flex items-center gap-2 bg-muted/10 overflow-x-auto">
                  <Button variant="outline" size="sm" className="text-xs gap-1 flex-shrink-0"><GitBranch size={12} />Mover p/ Negociação</Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1 flex-shrink-0"><GitBranch size={12} />Mover p/ Fechamento</Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1 flex-shrink-0"><Calendar size={12} />Agendar Retorno</Button>
                  <Button variant="outline" size="sm" className="text-xs gap-1 flex-shrink-0"><ExternalLink size={12} />Abrir Lead</Button>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {selectedConvo.messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-xl text-sm
                        ${msg.fromMe ? 'bg-green-100 text-green-900' : 'bg-muted text-foreground'}`}>
                        {msg.type === 'document' && (
                          <div className="flex items-center gap-2 mb-1 text-xs font-medium">
                            <Paperclip size={12} /> {msg.fileName}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${msg.fromMe ? 'text-green-600' : 'text-muted-foreground'} text-right`}>{msg.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t flex items-center gap-2">
                <Button variant="ghost" size="icon" className="flex-shrink-0"><Smile size={20} /></Button>
                <Button variant="ghost" size="icon" className="flex-shrink-0"><Paperclip size={20} /></Button>
                <Input placeholder="Digite uma mensagem..." value={message} onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1" />
                <Button onClick={handleSend} size="icon" className="bg-green-500 hover:bg-green-600 flex-shrink-0"><Send size={18} /></Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa para começar
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default WhatsAppConversas;
