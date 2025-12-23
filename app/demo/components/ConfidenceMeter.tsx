'use client';

interface ConfidenceMeterProps {
  confidence: number; // 0.0 to 1.0
  threshold?: number; // Default 0.7
}

export function ConfidenceMeter({ confidence, threshold = 0.7 }: ConfidenceMeterProps) {
  const percentage = Math.round(confidence * 100);

  // Color coding based on threshold
  const getColor = () => {
    if (confidence >= threshold) {
      return 'bg-green-500';
    } else if (confidence >= threshold - 0.2) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  const getTextColor = () => {
    if (confidence >= threshold) {
      return 'text-green-600';
    } else if (confidence >= threshold - 0.2) {
      return 'text-yellow-600';
    } else {
      return 'text-red-600';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-700">Confidence</span>
        <span className={`text-sm font-bold ${getTextColor()}`}>
          {percentage}%
        </span>
      </div>
      <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        {/* Threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
          style={{ left: `${threshold * 100}%` }}
        />
        {/* Progress bar */}
        <div
          className={`h-full ${getColor()} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>0%</span>
        <span className="font-medium">Threshold: {Math.round(threshold * 100)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
