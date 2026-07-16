import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  consultarSPC,
  maskDocumento,
  TIPO_CONSULTA_OPTIONS,
  type TipoDocumento,
  type TipoConsulta,
} from '@/services/spcService';

// ---------- Renderizador dinâmico ----------
const isPlainObject = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const EMPTY = <span className="text-muted-foreground italic">Não informado</span>;

const formatLabel = (key: string) =>
  key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const formatPrimitive = (v: any) => {
  if (v === null || v === undefined || v === '') return EMPTY;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return String(v);
  return String(v);
};

const RenderValue = ({ value }: { value: any }) => {
  if (value === null || value === undefined || value === '') return <>{EMPTY}</>;
  if (Array.isArray(value)) return <RenderArray arr={value} />;
  if (isPlainObject(value)) return <RenderObject obj={value} />;
  return <>{formatPrimitive(value)}</>;
};

const RenderObject = ({ obj }: { obj: Record<string, any> }) => {
  const entries = Object.entries(obj);
  if (entries.length === 0) return <>{EMPTY}</>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
      {entries.map(([k, v]) => {
        const complex = isPlainObject(v) || Array.isArray(v);
        return (
          <div key={k} className={complex ? 'md:col-span-2 border-t border-border/40 pt-2 mt-1' : 'flex flex-col'}>
            <span className="text-xs font-medium text-muted-foreground">{formatLabel(k)}</span>
            <div className="text-sm text-foreground break-words">
              <RenderValue value={v} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RenderArray = ({ arr }: { arr: any[] }) => {
  if (arr.length === 0) return <span className="text-muted-foreground italic">Nenhum registro</span>;

  // Array de primitivos
  if (arr.every((i) => !isPlainObject(i) && !Array.isArray(i))) {
    return (
      <ul className="list-disc pl-5 space-y-1 text-sm">
        {arr.map((i, idx) => (
          <li key={idx}>{formatPrimitive(i)}</li>
        ))}
      </ul>
    );
  }

  // Array de objetos -> tabela
  if (arr.every(isPlainObject)) {
    const cols = Array.from(new Set(arr.flatMap((o) => Object.keys(o))));
    return (
      <div className="overflow-x-auto rounded-md border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c} className="whitespace-nowrap">{formatLabel(c)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {arr.map((row, idx) => (
              <TableRow key={idx}>
                {cols.map((c) => (
                  <TableCell key={c} className="align-top text-sm">
                    <RenderValue value={row[c]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Misto
  return (
    <div className="space-y-2">
      {arr.map((i, idx) => (
        <div key={idx} className="rounded-md border border-border/50 p-2">
          <RenderValue value={i} />
        </div>
      ))}
    </div>
  );
};

// ---------- Página ----------
const ConsultaSPC = () => {
  const [tipoDoc, setTipoDoc] = useState<TipoDocumento>('CPF');
  const [documento, setDocumento] = useState('');
  const [tipoConsulta, setTipoConsulta] = useState<TipoConsulta>('SPC_MAXI');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Record<string, any> | null>(null);

  const handleTipoDocChange = (v: string) => {
    const t = v as TipoDocumento;
    setTipoDoc(t);
    setDocumento((d) => maskDocumento(d, t));
  };

  const handleConsultar = async () => {
    if (!documento.trim()) {
      toast.error('Informe o documento para consulta.');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const data = await consultarSPC({
        tipoDocumento: tipoDoc,
        documento: documento.replace(/\D/g, ''),
        tipoConsulta,
      });
      setResultado(data);
      toast.success('Consulta realizada com sucesso.');
    } catch (e: any) {
      toast.error('Falha ao consultar', { description: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  };

  const grupos = resultado ? Object.entries(resultado) : [];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta SPC Brasil</h1>
        <p className="text-sm text-muted-foreground">
          Realize consultas de CPF e CNPJ através da API do SPC Brasil.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova Consulta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-sm">Tipo de Documento</Label>
            <RadioGroup
              value={tipoDoc}
              onValueChange={handleTipoDocChange}
              className="flex gap-6 mt-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CPF" id="cpf" />
                <Label htmlFor="cpf" className="cursor-pointer">CPF</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="CNPJ" id="cnpj" />
                <Label htmlFor="cnpj" className="cursor-pointer">CNPJ</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="documento" className="text-sm">Documento</Label>
              <Input
                id="documento"
                value={documento}
                onChange={(e) => setDocumento(maskDocumento(e.target.value, tipoDoc))}
                placeholder={tipoDoc === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Tipo de Consulta</Label>
              <Select value={tipoConsulta} onValueChange={(v) => setTipoConsulta(v as TipoConsulta)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_CONSULTA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleConsultar} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Consultando SPC Brasil...' : 'Consultar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado da Consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={grupos.map(([k]) => k)} className="w-full">
              {grupos.map(([key, value]) => (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger className="text-sm font-semibold">
                    {formatLabel(key)}
                    {Array.isArray(value) && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        ({value.length} {value.length === 1 ? 'registro' : 'registros'})
                      </span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-1">
                      <RenderValue value={value} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConsultaSPC;
