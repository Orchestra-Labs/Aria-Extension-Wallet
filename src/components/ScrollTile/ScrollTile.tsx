import { LogoIcon } from '@/assets/icons';
import { TextFieldStatus } from '@/constants';
import { cn, selectTextColorByStatus, truncateString } from '@/helpers';

interface ScrollTileProps {
  title: string;
  subtitle: string;
  secondarySubtitle?: string | null;
  value: string;
  icon?: React.ReactNode;
  status?: TextFieldStatus;
  valueStatus?: TextFieldStatus;
  selected?: boolean;
  subtitleStatus?: TextFieldStatus;
  secondarySubtitleStatus?: TextFieldStatus;
  onClick?: () => void;
}

export const ScrollTile = ({
  title,
  subtitle,
  secondarySubtitle,
  value,
  icon,
  status = TextFieldStatus.GOOD,
  valueStatus = TextFieldStatus.GOOD,
  selected = false,
  subtitleStatus = TextFieldStatus.GOOD,
  secondarySubtitleStatus = TextFieldStatus.GOOD,
  onClick,
}: ScrollTileProps) => {
  const formattedTitle = truncateString(title, 10);
  const textColor = selectTextColorByStatus(status);
  const valueColor = selectTextColorByStatus(valueStatus);
  const subtitleColor = selectTextColorByStatus(subtitleStatus, 'text-neutral-1');
  const secondarySubtitleColor = selectTextColorByStatus(secondarySubtitleStatus, 'text-neutral-1');

  const baseClasses = 'p-2 min-h-[52px] rounded-md flex items-center cursor-pointer border';
  const selectedClasses = `border-blue bg-blue-hover text-blue-dark
    active:bg-blue-hover-secondary active:text-blue-dark active:border-blue 
    hover:bg-blue-pressed-secondary hover:text-blue hover:border-blue-darker`;
  const unselectedClasses = `border-neutral-4 text-neutral-1
    hover:bg-neutral-4 hover:text-neutral-1 hover:border-grey
    active:bg-neutral-2 active:text-neutral-1 active:border-grey`;

  const tileClasses = cn(baseClasses, selected ? selectedClasses : unselectedClasses);

  return (
    <div className={tileClasses} onClick={onClick}>
      <div className="rounded-full h-9 w-9 bg-neutral-2 p-1 flex items-center justify-center select-none">
        {icon || <LogoIcon />}
      </div>
      <div className="flex flex-col ml-3 select-none">
        <h6 className={`text-base ${textColor} text-left line-clamp-1 select-none`}>
          {formattedTitle}
        </h6>
        <p className={`text-xs ${subtitleColor} text-left line-clamp-1 select-none`}>{subtitle}</p>
      </div>
      <div className="flex-1" />
      {!secondarySubtitle && (
        <div className={`${valueColor} text-h6 line-clamp-1 select-none`}>{value}</div>
      )}
      {secondarySubtitle && (
        <div className="flex flex-col ml-3 select-none">
          <h6 className={`text-base ${valueColor} text-right line-clamp-1 select-none`}>{value}</h6>
          <div className={`text-xs ${secondarySubtitleColor} text-right line-clamp-1 select-none`}>
            {secondarySubtitle}
          </div>
        </div>
      )}
    </div>
  );
};
