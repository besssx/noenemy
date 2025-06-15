import React, { useEffect, useMemo } from 'react';
import { useBids } from '../contexts/BidsContext';

const formatExpiration = (timestamp) => {
  if (!timestamp) return 'N/A';
  const now = new Date();
  const endDate = new Date(timestamp * 1000);
  const diffTime = endDate - now;
  if (diffTime <= 0) return "Expired";

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  
  if (diffDays > 1) return `in ${diffDays} d.`;
  if (diffHours > 0) return `in ${diffHours} h.`;
  return `in ${Math.ceil(diffTime / (1000 * 60))} min.`;
};

const handleOpenExternal = (e, url) => {
  e.preventDefault();
  window.electronAPI.invoke('open-external-link', url);
};


function TempRealBidsPage() {
  const { 
    bids, 
    isLoading, 
    status, 
    expandedCollections, 
    loadBids, 
    toggleCollection 
  } = useBids();

  useEffect(() => {
    loadBids();
  }, [loadBids]); 
  
  const handleRefresh = () => {
    loadBids(true);
  };

  const groupedAndSortedBids = useMemo(() => {
    if (!bids || bids.length === 0) return {};

    const grouped = bids.reduce((acc, bid) => {
      const slug = bid.collectionSlug || 'unknown-collection';
      const name = bid.collectionName || 'Unknown Collection';

      if (!acc[slug]) {
        acc[slug] = {
          name: name,
          bids: []
        };
      }
      acc[slug].bids.push(bid);
      return acc;
    }, {});

    for (const slug in grouped) {
      grouped[slug].bids.sort((a, b) => a.expiration - b.expiration);
    }

    return grouped;
  }, [bids]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Temp bids <span style={{fontSize: '0.7em', color: '#ccc'}}>({status})</span></h1>
        <button onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      {Object.entries(groupedAndSortedBids).map(([slug, groupData]) => (
        <div className="card" style={{ marginTop: '20px', maxWidth: '1200px' }} key={slug}>
          <h2 
            onClick={() => toggleCollection(slug)} 
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
          >
            <span>{groupData.name} ({groupData.bids.length} bids)</span>
            <span>{expandedCollections[slug] ? 'Collapse [-]' : 'Expand [+]'}</span>
          </h2>

          {expandedCollections[slug] && (
            <table className="wallets-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Our Bid (WETH)</th>
                  <th>Top Bid (WETH)</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {groupData.bids.map(bid => {
                  const openseaUrl = `https://opensea.io/assets/ethereum/${bid.contractAddress}/${bid.tokenId}`;
                  return (
                    <tr key={bid.id}>
                      <td>
                        <a 
                          href={openseaUrl}
                          onClick={(e) => handleOpenExternal(e, openseaUrl)}
                        >
                          #{bid.tokenId}
                        </a>
                      </td>
                      <td>{bid.bidPrice}</td>
                      <td style={{ color: parseFloat(bid.topBid) > bid.bidPrice ? 'lightcoral' : 'lightgreen' }}>
                          {bid.topBid}
                      </td>
                      <td>{formatExpiration(bid.expiration)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

export default TempRealBidsPage;