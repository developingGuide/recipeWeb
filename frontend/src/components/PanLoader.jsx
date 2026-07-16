import PanSVG from './pan.svg?react';
import EggSVG from './egg.svg?react'; // full file, all paths
import './PanLoader.css';

export default function PanLoader() {
  return (
    <div className="loaderContainer">
      <div className="pan-loader">
        <div className="egg-wrap"><EggSVG className="egg" /></div>
        <div className="pan-wrap"><PanSVG className="pan" /></div>
      </div>
    </div>
  );
}