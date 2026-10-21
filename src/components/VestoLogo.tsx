/* eslint-disable @next/next/no-img-element */

type Size = 'sm' | 'md' | 'lg';

// lg empilha o slogan sob o logo no celular e volta a ficar ao lado a partir de sm
const SIZES: Record<Size, { wrap: string; logo: string; slogan: string; rule: string; gap: string }> = {
  sm: { wrap: 'flex-row', logo: 'h-8', slogan: 'text-[12px]', rule: 'h-6', gap: 'gap-3' },
  md: { wrap: 'flex-row', logo: 'h-9 sm:h-11', slogan: 'text-[11.5px] sm:text-sm max-[359px]:hidden', rule: 'h-6 sm:h-7 max-[359px]:hidden', gap: 'gap-2.5 sm:gap-4' },
  lg: { wrap: 'flex-col sm:flex-row', logo: 'h-20 sm:h-24', slogan: 'text-base sm:text-lg', rule: 'hidden sm:block h-12', gap: 'gap-3 sm:gap-5' },
};

interface Props {
  size?: Size;
  /** Mostra "Tailored by technology" ao lado do logo. */
  slogan?: boolean;
  className?: string;
}

/** Marca Vesto: V sobre VESTO, com o slogan ao lado separado por um fio. */
export function VestoLogo({ size = 'md', slogan = true, className = '' }: Props) {
  const s = SIZES[size];
  return (
    <div className={`flex ${s.wrap} items-center ${s.gap} ${className}`}>
      <img src="/brand/vesto-empilhado-dourado.svg" alt="Vesto" className={`${s.logo} w-auto shrink-0`} />
      {slogan && (
        <>
          <span aria-hidden className={`${s.rule} w-px bg-primary/40 shrink-0`} />
          <span className={`font-display italic ${s.slogan} text-muted-foreground leading-tight whitespace-nowrap`}>
            Tailored by technology
          </span>
        </>
      )}
    </div>
  );
}
