import { Loader } from '../Loader';

const ScreenLoader = () => {
  return (
    <div
      style={{
        height: window.innerHeight,
        width: window.innerWidth,
      }}
    >
      <Loader />
    </div>
  );
};

export default ScreenLoader;
