import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const SUIT_GLYPH = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);
export function CardView({ card, small, faceDown, selected, legal, dimmed, onClick }) {
    if (faceDown) {
        return (_jsx("div", { className: `card-back shrink-0 rounded-md border border-teal-900 ${small ? 'h-12 w-9' : 'h-20 w-14'}`, "aria-hidden": true }));
    }
    const red = RED_SUITS.has(card.suit);
    return (_jsxs("button", { type: "button", onClick: onClick, disabled: !onClick, "aria-label": `${String(card.rank)} of ${card.suit}`, className: `card-ivory relative shrink-0 rounded-md border text-left transition-transform duration-150 ${small ? 'h-20 w-14 px-1 py-0.5' : 'h-24 w-[4.25rem] px-1.5 py-1 sm:h-28 sm:w-20'} ${selected ? '-translate-y-3 ring-2 ring-amber-300' : ''} ${legal && !selected ? 'hover:-translate-y-1.5 cursor-pointer card-legal' : ''} ${dimmed ? 'opacity-40 saturate-50' : ''} ${onClick && !legal ? 'cursor-not-allowed' : ''}`, children: [_jsx("div", { className: `font-bold leading-none ${red ? 'text-red-700' : 'text-slate-900'} ${small ? 'text-sm' : 'text-lg'}`, children: String(card.rank) }), _jsx("div", { className: `leading-none ${red ? 'text-red-700' : 'text-slate-900'} ${small ? 'text-base' : 'text-2xl'}`, children: SUIT_GLYPH[card.suit] }), _jsxs("div", { className: `absolute bottom-1 right-1 rotate-180 leading-none ${red ? 'text-red-700' : 'text-slate-900'} ${small ? 'text-xs' : 'text-sm'}`, children: [String(card.rank), SUIT_GLYPH[card.suit]] })] }));
}
