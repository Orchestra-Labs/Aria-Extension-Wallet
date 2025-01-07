import React from 'react';
import 'tippy.js/dist/tippy.css';
import mainPageImage from '@/assets/images/main_page.png';
import { PointerIcon } from 'lucide-react';

interface StakingGuideProps {}

const StakingGuide: React.FC<StakingGuideProps> = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="relative">
        <img src={mainPageImage} alt="Main Page" className="w-64 h-64 object-cover" />
        <div className="absolute top-[-20px] left-[50%] transform -translate-x-1/2 animate-press">
          <PointerIcon className="w-12 h-12 text-white" />
        </div>
      </div>
    </div>
  );
};

export default StakingGuide;
