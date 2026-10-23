import { Check, Monitor, Moon, Palette, RotateCcw, Sun, Wallpaper } from 'lucide-react';
import { useThemePreference, type CRMTheme } from '@/components/ThemePreferenceProvider';

const options: {
  id: CRMTheme;
  title: string;
  description: string;
  icon: typeof Sun;
  swatches: string[];
}[] = [
  {
    id: 'future',
    title: 'Padrão Future',
    description: 'Identidade roxa atual, com contraste elegante e detalhes da marca.',
    icon: Palette,
    swatches: ['#5423B8', '#7C3AED', '#F8F6FC', '#FFFFFF'],
  },
  {
    id: 'light',
    title: 'Claro',
    description: 'Interface clara e arejada para ambientes bem iluminados.',
    icon: Sun,
    swatches: ['#6D35D4', '#F4F2F8', '#FFFFFF', '#DCD6E8'],
  },
  {
    id: 'dark',
    title: 'Escuro',
    description: 'Tons escuros para trabalhar com conforto em ambientes de pouca luz.',
    icon: Moon,
    swatches: ['#A78BFA', '#11101A', '#1C1A27', '#383447'],
  },
  {
    id: 'transparent',
    title: 'Transparente',
    description: 'Superfícies translúcidas com efeito de vidro. O papel de parede será configurado na próxima etapa.',
    icon: Wallpaper,
    swatches: ['#6D35D4', '#FFFFFFB8', '#EDE7FA99', '#B8A7D966'],
  },
];

const ThemePreview = ({ theme }: { theme: CRMTheme }) => (
  <div className={`theme-preview theme-preview-${theme}`} aria-hidden="true">
    <div className="theme-preview-sidebar">
      <span />
      <span />
      <span />
      <span />
    </div>
    <div className="theme-preview-main">
      <div className="theme-preview-topbar"><span /><span /></div>
      <div className="theme-preview-cards">
        <span /><span /><span />
      </div>
      <div className="theme-preview-panel">
        <i /><i /><i /><i />
      </div>
    </div>
  </div>
);

const Personalizacao = () => {
  const { theme, setTheme, resetTheme } = useThemePreference();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 animate-fade-in">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Palette size={14} /> EXPERIÊNCIA PERSONALIZADA
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Personalização</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ajuste a aparência do Vision para combinar com seu ambiente de trabalho. A escolha é individual para este usuário neste navegador.
            </p>
          </div>
          <button
            type="button"
            onClick={resetTheme}
            className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 sm:self-auto"
          >
            <RotateCcw size={15} /> Restaurar padrão
          </button>
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Escolha seu tema</h2>
          <p className="mt-1 text-sm text-muted-foreground">Você pode trocar de tema quando quiser.</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {options.map((option) => {
            const Icon = option.icon;
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setTheme(option.id)}
                className={`theme-option group rounded-2xl border bg-card p-3 text-left transition-all duration-200 ${selected ? 'theme-option-selected border-primary ring-2 ring-primary/15' : 'border-border/80 hover:-translate-y-0.5 hover:border-primary/35'}`}
              >
                <ThemePreview theme={option.id} />
                <div className="flex items-start gap-3 px-1 pt-4">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-foreground">{option.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                  </span>
                  {selected && <Check size={18} className="mt-1 shrink-0 text-primary" />}
                </div>
                <div className="mt-4 flex gap-1.5 px-1 pb-1">
                  {option.swatches.map((color) => (
                    <span key={color} className="h-2 flex-1 rounded-full" style={{ backgroundColor: color }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Monitor size={19} /></span>
          <div>
            <h2 className="font-semibold text-foreground">Sobre sua personalização</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              O tema selecionado é salvo separadamente por usuário neste navegador. A opção Transparente já aplica superfícies translúcidas; o envio de papel de parede com compactação automática será ativado na etapa de armazenamento seguro de imagens.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Personalizacao;
