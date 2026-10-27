import SwipeCardDeck, {
  type SwipeCardDeckProps,
  formatCardNumber,
  getBankGradient,
} from "./SwipeCardDeck";

export type SwipeableItem = {
  id: string;
  [key: string]: any;
};

export type { SwipeCardDeckProps };
export { formatCardNumber, getBankGradient };
export default SwipeCardDeck;
