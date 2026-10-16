import { Card } from '@bhabi-thulla/game-engine';

const SUIT_GLYPH: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

interface Props {
  card: Card;
  small?: boolean;
  faceDown?: boolean;
  selected?: boolean;
  legal?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

export function CardView({ card, small, faceDown, selected, legal, dimmed, onClick }: Props) {
  if (faceDown) {
    return (
      <div
        className={`card-back shrink-0 rounded-md border border-teal-900 ${
          small ? 'h-12 w-9' : 'h-20 w-14'
        }`}
        aria-hidden
      />
    );
  }
  const red = RED_SUITS.has(card.suit);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${String(card.rank)} of ${card.suit}`}
      className={`card-ivory relative shrink-0 rounded-md border text-left transition-transform duration-150 ${
        small ? 'h-20 w-14 px-1 py-0.5' : 'h-24 w-[4.25rem] px-1.5 py-1 sm:h-28 sm:w-20'
      } ${selected ? '-translate-y-3 ring-2 ring-amber-300' : ''} ${
        legal && !selected ? 'hover:-translate-y-1.5 cursor-pointer card-legal' : ''
      } ${dimmed ? 'opacity-40 saturate-50' : ''} ${onClick && !legal ? 'cursor-not-allowed' : ''}`}
    >
      <div className={`font-bold leading-none ${red ? 'text-red-700' : 'text-slate-900'} ${small ? 'text-sm' : 'text-lg'}`}>
        {String(card.rank)}
      </div>
      <div className={`leading-none ${red ? 'text-red-700' : 'text-slate-900'} ${small ? 'text-base' : 'text-2xl'}`}>
        {SUIT_GLYPH[card.suit]}
      </div>
      <div className={`absolute bottom-1 right-1 rotate-180 leading-none ${red ? 'text-red-700' : 'text-slate-900'} ${small ? 'text-xs' : 'text-sm'}`}>
        {String(card.rank)}
        {SUIT_GLYPH[card.suit]}
      </div>
    </button>
  );
}
