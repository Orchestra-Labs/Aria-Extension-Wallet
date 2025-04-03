import { WINDOW_SIZE } from '@/constants';

import { Loader } from '../Loader';

const ScreenLoader = () => {
  return (
    <div style={WINDOW_SIZE}>
      <Loader />
    </div>
  );
};

export default ScreenLoader;
