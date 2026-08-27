import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Play, FileSpreadsheet, Phone, History, Loader2, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  maskCNPJ, onlyDigits, normalizePhone, situacaoTone, situacaoEmoji, situacaoClass,
  enderecoCompleto, hojeArquivo, type CNPJResultado,
} from '@/lib/cnpjUtils';

const CHUNK = 10;
const PAGE_SIZE = 25;

interface Lote {
  id: string;
  nome_arquivo: string;
  total: number;
  processados: number;
  encontrados: number;
  ativos: number;
  com_telefone: number;
  status: string;
  created_at: string;
}

const detectarColunaCNPJ = (rows: Record<string, any>[]): string | null => {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '');
  const exata = keys.find((k) => ['cnpj', 'cpfcnpj', 'cnpjcpf', 'documento'].includes(norm(k)));
  if (exata) return exata;
  const parcial = keys.find((k) => norm(k).includes('cnpj'));
  if (parcial) return parcial;
  // fallback: coluna cujos valores tenham 14 dígitos na maioria
  return keys.find((k) => {
    const amostra = rows.slice(0, 30).map((r) => onlyDigits(r[k]));
    const validos = amostra.filter((v) => v.length === 14).length;
    return validos >= Math.max(1, Math.floor(amostra.length * 0.6));
  }) ?? null;
};

const ConsultaCNPJLote = () => {
  const [fileName, setFileName] = useState('');
  const [cnpjs, setCnpjs] = useState<string[]>([]);
  const [results, setResults] = useState<CNPJResultado[]>([]);
  const [running, setRunning] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Lote[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [page, setPage] = useState(1);
  const cancelRef = useRef(false);

  const [busca, setBusca] = useState('');
  const [fSituacao, setFSituacao] = useState('todas');
  const [fTelefone, setFTelefone] = useState('todos');
  const [fUF, setFUF] = useState('todas');
  const [fCidade, setFCidade] = useState('todas');

  const carregarHistorico = useCallback(async () => {
    const { data } = await supabase
      .from('cnpj_lotes').select('*').order('created_at', { ascending: false }).limit(20);
    setHistorico((data as Lote[]) ?? []);
  }, []);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      const col = detectarColunaCNPJ(rows);
      if (!col) {
        toast.error('Não foi possível identificar uma coluna de CNPJ. Envie um arquivo com a coluna "CNPJ".');
        return;
      }
      const lista = [...new Set(rows.map((r) => onlyDigits(r[col])).filter((c) => c.length === 14))];
      if (!lista.length) {
        toast.error('Nenhum CNPJ válido encontrado no arquivo.');
        return;
      }
      setFileName(file.name);
      setCnpjs(lista);
      setResults([]);
      setLoteId(null);
      setPage(1);
      toast.success(`${lista.length.toLocaleString('pt-BR')} CNPJs encontrados no arquivo.`);
    } catch {
      toast.error('Não foi possível ler o arquivo. Use XLSX ou CSV.');
    }
  };

  const iniciar = async () => {
    if (!cnpjs.length) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) { toast.error('Sessão expirada.'); return; }

    setRunning(true);
    cancelRef.current = false;

    let currentLote = loteId;
    if (!currentLote) {
      const { data, error } = await supabase.from('cnpj_lotes')
        .insert({ user_id: uid, nome_arquivo: fileName || 'lote.xlsx', total: cnpjs.length, status: 'processando' })
        .select('id').single();
      if (error) { toast.error('Erro ao criar o lote.'); setRunning(false); return; }
      currentLote = data.id;
      setLoteId(currentLote);
    }

    const jaFeitos = new Set(results.map((r) => r.cnpj));
    const pendentes = cnpjs.filter((c) => !jaFeitos.has(c));
    const acumulado = [...results];

    for (let i = 0; i < pendentes.length; i += CHUNK) {
      if (cancelRef.current) break;
      const bloco = pendentes.slice(i, i + CHUNK);
      let lote: CNPJResultado[] = [];
      try {
        const { data, error } = await supabase.functions.invoke('consulta-cnpj', { body: { cnpjs: bloco } });
        if (error || data?.error) throw new Error(error?.message || data?.error);
        lote = data.results as CNPJResultado[];
      } catch (e: any) {
        lote = bloco.map((c) => ({ cnpj: c, status: 'erro' as const, erro: e?.message || 'Falha na requisição' }));
      }

      acumulado.push(...lote);
      setResults([...acumulado]);

      await supabase.from('cnpj_consultas').insert(
        lote.map((r) => ({
          user_id: uid, lote_id: currentLote, cnpj: r.cnpj,
          razao_social: r.razao_social ?? null, nome_fantasia: r.nome_fantasia ?? null,
          situacao: r.situacao ?? null, cep: r.cep ?? null, logradouro: r.logradouro ?? null,
          numero: r.numero ?? null, complemento: r.complemento ?? null, bairro: r.bairro ?? null,
          cidade: r.cidade ?? null, uf: r.uf ?? null, telefone: r.telefone ?? null,
          telefone_2: r.telefone_2 ?? null, email: r.email ?? null,
          socios: (r.socios ?? []) as any, status: r.status, erro: r.erro ?? null,
        })),
      );

      await supabase.from('cnpj_lotes').update({
        processados: acumulado.length,
        encontrados: acumulado.filter((r) => r.status === 'encontrado').length,
        ativos: acumulado.filter((r) => situacaoTone(r.situacao) === 'ativa').length,
        com_telefone: acumulado.filter((r) => normalizePhone(r.telefone)).length,
        status: 'processando',
      }).eq('id', currentLote);
    }

    const concluido = !cancelRef.current;
    await supabase.from('cnpj_lotes').update({
      status: concluido ? 'concluido' : 'interrompido',
      completed_at: concluido ? new Date().toISOString() : null,
    }).eq('id', currentLote);

    setRunning(false);
    carregarHistorico();
    toast[concluido ? 'success' : 'info'](concluido ? 'Consulta em lote concluída.' : 'Processamento interrompido — os resultados já obtidos foram salvos.');
  };

  const abrirLote = async (l: Lote) => {
    const { data } = await supabase.from('cnpj_consultas').select('*').eq('lote_id', l.id).order('created_at');
    const rs = (data ?? []).map((r: any) => ({ ...r, socios: r.socios ?? [] })) as CNPJResultado[];
    setResults(rs);
    setCnpjs(rs.map((r) => r.cnpj));
    setFileName(l.nome_arquivo);
    setLoteId(l.id);
    setPage(1);
    toast.success(`Lote "${l.nome_arquivo}" carregado (${rs.length} registros).`);
  };

  const ufs = useMemo(() => [...new Set(results.map((r) => r.uf).filter(Boolean))].sort() as string[], [results]);
  const cidades = useMemo(
    () => [...new Set(results.filter((r) => fUF === 'todas' || r.uf === fUF).map((r) => r.cidade).filter(Boolean))].sort() as string[],
    [results, fUF],
  );

  const filtrados = useMemo(() => results.filter((r) => {
    if (fSituacao !== 'todas' && situacaoTone(r.situacao) !== fSituacao) return false;
    const tel = !!normalizePhone(r.telefone) || !!normalizePhone(r.telefone_2);
    if (fTelefone === 'com' && !tel) return false;
    if (fTelefone === 'sem' && tel) return false;
    if (fUF !== 'todas' && r.uf !== fUF) return false;
    if (fCidade !== 'todas' && r.cidade !== fCidade) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const alvo = `${r.cnpj} ${r.razao_social ?? ''} ${r.nome_fantasia ?? ''} ${r.cidade ?? ''}`.toLowerCase();
      if (!alvo.includes(q)) return false;
    }
    return true;
  }), [results, fSituacao, fTelefone, fUF, fCidade, busca]);

  const paginados = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));

  const resumo = useMemo(() => ({
    total: cnpjs.length,
    processados: results.length,
    encontrados: results.filter((r) => r.status === 'encontrado').length,
    naoEncontrados: results.filter((r) => r.status === 'nao_encontrado').length,
    erros: results.filter((r) => r.status === 'erro').length,
    ativos: results.filter((r) => situacaoTone(r.situacao) === 'ativa').length,
    baixados: results.filter((r) => situacaoTone(r.situacao) === 'baixada').length,
    comTelefone: results.filter((r) => normalizePhone(r.telefone) || normalizePhone(r.telefone_2)).length,
  }), [cnpjs, results]);

  const progresso = resumo.total ? Math.round((resumo.processados / resumo.total) * 100) : 0;

  const exportarCompleto = () => {
    if (!filtrados.length) { toast.error('Nenhum registro para exportar.'); return; }
    const linhas = filtrados.map((r) => {
      const s = r.socios?.[0];
      return {
        CNPJ: maskCNPJ(r.cnpj),
        'Razão Social': r.razao_social ?? '',
        'Nome Fantasia': r.nome_fantasia ?? '',
        Situação: r.situacao ?? '',
        CEP: r.cep ?? '',
        Endereço: r.logradouro ?? '',
        Número: r.numero ?? '',
        Complemento: r.complemento ?? '',
        Bairro: r.bairro ?? '',
        Cidade: r.cidade ?? '',
        UF: r.uf ?? '',
        Telefone: r.telefone ?? '',
        'Telefone 2': r.telefone_2 ?? '',
        'E-mail': r.email ?? '',
        Sócio: s?.nome ?? '',
        'Qualificação do Sócio': s?.qualificacao ?? '',
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), 'Consulta CNPJ');
    XLSX.writeFile(wb, `consulta_cnpj_${hojeArquivo()}.xlsx`);
  };

  const exportarTelefones = () => {
    const nums = [...new Set(
      filtrados.flatMap((r) => [normalizePhone(r.telefone), normalizePhone(r.telefone_2)]).filter(Boolean) as string[],
    )];
    if (!nums.length) { toast.error('Nenhum telefone válido nos registros filtrados.'); return; }
    const blob = new Blob([nums.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_cnpj_${hojeArquivo()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${nums.length} telefones exportados.`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta CNPJ em Lote</h1>
        <p className="text-sm text-muted-foreground">Importe uma lista de CNPJs para consultar empresas em lote.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-10 cursor-pointer transition
              ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
          >
            <Upload size={28} className="text-primary" />
            <span className="text-sm font-medium text-foreground">Arraste seu arquivo aqui</span>
            <span className="text-xs text-muted-foreground">Formatos aceitos: XLSX, CSV — coluna "CNPJ"</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>

          {cnpjs.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 text-sm">
                <span className="font-semibold text-foreground">{cnpjs.length.toLocaleString('pt-BR')} CNPJs encontrados</span>
                {fileName && <span className="text-muted-foreground"> — {fileName}</span>}
              </div>
              {running ? (
                <Button variant="outline" onClick={() => { cancelRef.current = true; }}>
                  <Square size={16} className="mr-2" /> Parar
                </Button>
              ) : (
                <Button onClick={iniciar}>
                  <Play size={16} className="mr-2" /> {results.length ? 'Continuar consulta' : 'Iniciar consulta'}
                </Button>
              )}
            </div>
          )}

          {(running || results.length > 0) && (
            <div className="mt-4 space-y-2">
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>Total: <b className="text-foreground">{resumo.total}</b></span>
                <span>Processados: <b className="text-foreground">{resumo.processados}</b></span>
                <span>Sucesso: <b className="text-emerald-600">{resumo.encontrados}</b></span>
                <span>Não encontrados: <b className="text-orange-600">{resumo.naoEncontrados}</b></span>
                <span>Erros: <b className="text-destructive">{resumo.erros}</b></span>
                <span>Restantes: <b className="text-foreground">{Math.max(0, resumo.total - resumo.processados)}</b></span>
                <span>{progresso}%</span>
                {running && <Loader2 size={12} className="animate-spin" />}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              ['Total de CNPJs', resumo.total],
              ['Encontrados', resumo.encontrados],
              ['Ativos', resumo.ativos],
              ['Baixados', resumo.baixados],
              ['Com telefone', resumo.comTelefone],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent className="py-4">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-xl font-bold text-foreground">{Number(value).toLocaleString('pt-BR')}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resultados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input placeholder="Pesquisar..." value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} />
                <Select value={fSituacao} onValueChange={(v) => { setFSituacao(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as situações</SelectItem>
                    <SelectItem value="ativa">Ativas</SelectItem>
                    <SelectItem value="baixada">Baixadas</SelectItem>
                    <SelectItem value="inapta">Inaptas</SelectItem>
                    <SelectItem value="suspensa">Suspensas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fTelefone} onValueChange={(v) => { setFTelefone(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Telefone" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="com">Com telefone</SelectItem>
                    <SelectItem value="sem">Sem telefone</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fUF} onValueChange={(v) => { setFUF(v); setFCidade('todas'); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as UFs</SelectItem>
                    {ufs.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fCidade} onValueChange={(v) => { setFCidade(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as cidades</SelectItem>
                    {cidades.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={exportarCompleto} variant="default"><FileSpreadsheet size={16} className="mr-2" /> 📊 Exportar lista completa</Button>
                <Button onClick={exportarTelefones} variant="outline"><Phone size={16} className="mr-2" /> 📱 Exportar números WhatsApp</Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Os telefones vêm do cadastro público da empresa. Não há confirmação de que sejam WhatsApp nem de que a empresa autorizou contato — respeite a LGPD.
              </p>

              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Nome Fantasia</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Sócio</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginados.map((r, i) => {
                      const tone = situacaoTone(r.situacao);
                      return (
                        <TableRow key={`${r.cnpj}-${i}`}>
                          <TableCell className="whitespace-nowrap">{maskCNPJ(r.cnpj)}</TableCell>
                          <TableCell className="font-medium">{r.razao_social || (r.erro ?? '—')}</TableCell>
                          <TableCell>{r.nome_fantasia || '—'}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${situacaoClass[tone]}`}>
                              {situacaoEmoji[tone]} {r.situacao || r.status}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">{enderecoCompleto(r) || '—'}</TableCell>
                          <TableCell>{r.cidade || '—'}</TableCell>
                          <TableCell>{r.uf || '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.socios?.[0]?.nome || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.telefone || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtrados.length.toLocaleString('pt-BR')} registro(s) filtrado(s)</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <span>{page} / {totalPaginas}</span>
                  <Button size="sm" variant="outline" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><History size={18} /> Histórico de lotes</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum lote processado ainda.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>CNPJs</TableHead>
                    <TableHead>Processados</TableHead>
                    <TableHead>Encontrados</TableHead>
                    <TableHead>Ativos</TableHead>
                    <TableHead>Com telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{l.nome_arquivo}</TableCell>
                      <TableCell>{l.total}</TableCell>
                      <TableCell>{l.processados}</TableCell>
                      <TableCell>{l.encontrados}</TableCell>
                      <TableCell>{l.ativos}</TableCell>
                      <TableCell>{l.com_telefone}</TableCell>
                      <TableCell className="capitalize">{l.status}</TableCell>
                      <TableCell><Button size="sm" variant="outline" onClick={() => abrirLote(l)}>Abrir</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConsultaCNPJLote;
