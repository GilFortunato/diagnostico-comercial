"use client";

const nodes = [
  [8, 24], [22, 12], [36, 31], [51, 14], [68, 25], [86, 11],
  [15, 55], [31, 49], [47, 63], [64, 49], [81, 58], [94, 42],
  [6, 84], [25, 77], [42, 91], [59, 78], [76, 88], [92, 74],
] as const;

const links = [
  [0,1],[0,6],[1,2],[1,7],[2,3],[2,7],[2,8],[3,4],[3,9],[4,5],[4,9],[4,10],[5,11],
  [6,7],[6,12],[7,8],[7,13],[8,9],[8,13],[8,14],[9,10],[9,15],[10,11],[10,15],[10,16],
  [11,17],[12,13],[13,14],[14,15],[15,16],[16,17]
] as const;

export function NeuralNetworkVisual() {
  return (
    <div className="share-neural" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id="shareNeuralLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(156,255,0,0.08)" />
            <stop offset="55%" stopColor="rgba(191,255,210,0.38)" />
            <stop offset="100%" stopColor="rgba(156,255,0,0.12)" />
          </linearGradient>
          <radialGradient id="shareNeuralNode">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#bfffd2" />
            <stop offset="100%" stopColor="#9cff00" />
          </radialGradient>
        </defs>
        <g className="share-neural-lines">
          {links.map(([a,b], index) => (
            <line
              key={index}
              x1={nodes[a][0]}
              y1={nodes[a][1]}
              x2={nodes[b][0]}
              y2={nodes[b][1]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {nodes.map(([x,y], index) => (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={index % 4 === 0 ? 1.15 : 0.72}
              className="share-neural-node"
              style={{ animationDelay: `${(index % 7) * 0.45}s` }}
            />
          ))}
        </g>
      </svg>
      <span className="share-neural-glow share-neural-glow-a" />
      <span className="share-neural-glow share-neural-glow-b" />
    </div>
  );
}
