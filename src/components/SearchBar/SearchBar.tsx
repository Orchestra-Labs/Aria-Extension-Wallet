import React, { useEffect } from 'react';
import { Input, Separator } from '@/ui-kit';
import { useAtom } from 'jotai';
import { dialogSearchTermAtom, searchTermAtom } from '@/atoms';
import { SearchType } from '@/constants';

interface SearchBarProps {
  searchType: SearchType;
  isDialog?: boolean;
}

const PLACEHOLDERS = {
  chain: 'Search by chain name, id, or supported coins...',
  asset: 'Search by asset name or symbol...',
  validator: 'Search by validator name...',
};

export const SearchBar: React.FC<SearchBarProps> = ({ searchType, isDialog = false }) => {
  const [searchTerm, setSearchTerm] = useAtom(isDialog ? dialogSearchTermAtom : searchTermAtom);

  useEffect(() => {
    return () => setSearchTerm('');
  }, []);

  return (
    <>
      <Separator className="pt-2 px-4" />

      <div className="mt-2 mb-2 px-2">
        <Input
          type="text"
          variant="primary"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder={PLACEHOLDERS[searchType]}
        />
      </div>
    </>
  );
};
