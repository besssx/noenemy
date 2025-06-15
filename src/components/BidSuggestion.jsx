import React from 'react';

/**
 * Определяет, сколько знаков после запятой в числе
 */
const countDecimals = (value) => {
  if (Math.floor(value) === value) return 0;
  const str = value.toString();
  if (str.indexOf('.') !== -1 && str.indexOf('-') !== -1) {
    return str.split('-')[1] || '';
  } else if (str.indexOf('.') !== -1) {
    return str.split('.')[1].length || 0;
  }
  return 0;
}

const BidSuggestion = ({ bid }) => {
  const ourBidPrice = parseFloat(bid.bidPrice);
  const topBidPrice = parseFloat(bid.topBid);
  const secondBestBidPrice = bid.secondBestBid ? parseFloat(bid.secondBestBid) : null;

  const threshold = 0.10; // 10%

  // Случай 1: Нас перебили
  if (ourBidPrice < topBidPrice) {
    return <span style={{ color: 'lightcoral' }}>Outbid (Top: {topBidPrice} WETH)</span>;
  }

  // Случай 2: Наша ставка лучшая, но нет второй ставки для сравнения
  if (secondBestBidPrice === null) {
    return <span style={{ color: 'lightgreen' }}>Top Bid</span>;
  }
  
  // Случай 3: Наша ставка лучшая, и мы можем ее потенциально понизить
  const percentageOver = (ourBidPrice - secondBestBidPrice) / secondBestBidPrice;

  if (percentageOver > threshold) {
    // Рассчитываем новую ставку: берем вторую лучшую ставку и добавляем минимальный шаг
    const decimals = countDecimals(secondBestBidPrice);
    const increment = Math.pow(10, - (decimals + 1));
    const suggestedBid = (secondBestBidPrice + increment).toFixed(decimals + 1);

    return (
      <span style={{ color: 'orange' }}>
        Too high! Suggest: {suggestedBid}
      </span>
    );
  }

  // Случай 4: Наша ставка лучшая и находится в пределах разумного отрыва
  return <span style={{ color: 'lightgreen' }}>Top Bid</span>;
};

export default BidSuggestion;