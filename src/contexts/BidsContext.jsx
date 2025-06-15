import React, { createContext, useState, useCallback, useContext, useRef } from 'react';

export const BidsContext = createContext();

export const BidsProvider = ({ children }) => {
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Waiting...");
  const [expandedCollections, setExpandedCollections] = useState({});
  
  const isLoadingRef = useRef(false);

  const loadBids = useCallback(async (forceRefresh = false) => {
    if (isLoadingRef.current || (bids.length > 0 && !forceRefresh)) {
      if (bids.length > 0) {
        setStatus(`Loaded ${bids.length} bids (from cache).`);
      }
      return;
    }
    
    isLoadingRef.current = true;
    setIsLoading(true);
    setStatus("Loading and enriching data...");

    try {
      const fetchedBids = await window.electronAPI.invoke('get-temp-bids');
      if (fetchedBids) {
        setBids(fetchedBids);
        
        const initialExpandedState = fetchedBids.reduce((acc, bid) => {
          const slug = bid.collectionSlug || 'unknown-collection';
          if (expandedCollections[slug] === undefined) {
            acc[slug] = true;
          }
          return acc;
        }, {});
        setExpandedCollections(prev => ({ ...prev, ...initialExpandedState }));

        setStatus(`Loaded ${fetchedBids.length} bids.`);
      }
    } catch (error) {
      console.error("Error loading temp bids:", error);
      setStatus(`Error loading: ${error.message}`);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [bids.length, expandedCollections]);

  const toggleCollection = (slug) => {
    setExpandedCollections(prev => ({
      ...prev,
      [slug]: !prev[slug]
    }));
  };

  const value = {
    bids,
    isLoading,
    status,
    expandedCollections,
    loadBids,
    toggleCollection
  };

  return (
    <BidsContext.Provider value={value}>
      {children}
    </BidsContext.Provider>
  );
};

export const useBids = () => {
  return useContext(BidsContext);
};