import { useAtom } from 'jotai';
import React, { useEffect } from 'react';

import { dialogSearchTermAtom, searchTermAtom } from '@/atoms';
import { Input, Separator } from '@/ui-kit';

interface SearchBarProps {
  isDialog?: boolean;
  isValidatorSearch?: boolean;
}

const PLACEHOLDERS = {
  asset: 'Search by asset name or symbol...',
  validator: 'Search by validator name...',
};

export const SearchBar: React.FC<SearchBarProps> = ({
  isDialog = false,
  isValidatorSearch = false,
}) => {
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
          placeholder={isValidatorSearch ? PLACEHOLDERS.validator : PLACEHOLDERS.asset}
        />
      </div>
    </>
  );
};
