import { TrendingUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  period: string;
}

export const StatCard = ({ title, value, change, period }: StatCardProps) => {
  return (
    <div
      className="flex-1"
      style={{
        height: '143px',
        borderRadius: '24px',
        background: '#FFFFFF',
        boxShadow: '0px 3px 33px 0px #0000000F',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minWidth: 0,
      }}
    >
      {/* Title */}
      <p
        className="font-abeezee"
        style={{
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: '100%',
          letterSpacing: '0%',
          color: '#000000',
          margin: 0,
          marginBottom: '8px',
        }}
      >
        {title}
      </p>

      {/* Value */}
      <p
        className="font-lufga font-bold"
        style={{
          fontSize: '20px',
          lineHeight: '100%',
          letterSpacing: '0%',
          color: '#000000',
          margin: 0,
          marginBottom: '8px',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      {/* Change and Period Row */}
      <div className="flex items-center gap-2" style={{ marginTop: 'auto' }}>
        <span
          className="font-abeezee flex items-center gap-1"
          style={{
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '100%',
            letterSpacing: '0%',
            color: '#000000',
          }}
        >
          {change}
          <TrendingUp className="w-4 h-4" style={{ color: '#AEF31F' }} />
        </span>
        <span
          className="font-abeezee"
          style={{
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: '100%',
            letterSpacing: '0%',
            color: '#000000',
          }}
        >
          {period}
        </span>
      </div>
    </div>
  );
};
