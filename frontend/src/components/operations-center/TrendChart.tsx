import React, { useState, useCallback } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore, type TrendDataPoint } from '../../stores/dashboardStore';

interface TrendChartProps {
  isRunning: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ isRunning }) => {
  const trendData = useDashboardStore((s) => s.trendData);
  const setTrendData = useDashboardStore((s) => s.setTrendData);
  const [ghostActive, setGhostActive] = useState(false);

  const computeGhost = useCallback((
    actual: TrendDataPoint,
    prevGhost: TrendDataPoint | null,
    aiActions: number
  ) => {
    const waitDeg = aiActions * 2.8;
    const prevWait = prevGhost?.ghostWaitTime ?? actual.waitTime;
    const prevQueue = prevGhost?.ghostQueueDepth ?? actual.queueDepth;
    return {
      ghostWaitTime: parseFloat(
        Math.min(prevWait + waitDeg + Math.random() * 2, 300).toFixed(1)
      ),
      ghostQueueDepth: Math.min(
        Math.round(prevQueue * 1.12 + Math.random() * 1.5), 150
      ),
    };
  }, []);

  const handleGhostToggle = useCallback(() => {
    if (!ghostActive && trendData.length > 0) {
      let prev: TrendDataPoint | null = null;
      const updated = trendData.map(point => {
        const ghost = computeGhost(point, prev, point.aiActionsCount);
        prev = { ...point, ...ghost };
        return { ...point, ...ghost };
      });
      setTrendData(updated);
    } else if (ghostActive) {
      const updated = trendData.map(p => ({
        ...p, ghostWaitTime: undefined, ghostQueueDepth: undefined
      }));
      setTrendData(updated);
    }
    setGhostActive(prev => !prev);
  }, [ghostActive, computeGhost, trendData, setTrendData]);

  const latest = trendData[trendData.length - 1];
  const waitDelta = latest
    ? ((latest.ghostWaitTime ?? 0) - latest.waitTime).toFixed(1) : '0';
  const queueDelta = latest
    ? Math.round((latest.ghostQueueDepth ?? 0) - latest.queueDepth) : 0;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 20px',
      height: 300,
      overflow: 'hidden',
      flexShrink: 0,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)',
      position: 'relative',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isRunning ? '#10B981' : '#475569',
            display: 'inline-block',
            boxShadow: isRunning ? '0 0 12px rgba(16, 185, 129, 0.6)' : 'none',
            animation: isRunning ? 'livePulse 2s infinite' : 'none',
          }} />
          <span style={{
            fontSize: 12, fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
          }}>
            Operational Performance Trends
          </span>
          {isRunning && (
            <span style={{
              fontSize: 10, color: '#3B82F6',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '2px 8px', borderRadius: 4,
              fontWeight: 700, border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              LIVE • {latest?.tick ?? '0'}
            </span>
          )}
        </div>

        <button
          onClick={handleGhostToggle}
          style={{
            padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
            border: `1px solid ${ghostActive ? '#EF4444' : 'var(--border)'}`,
            background: ghostActive ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-input)',
            color: ghostActive ? '#EF4444' : 'var(--text-secondary)',
            fontSize: 11, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <span>{ghostActive ? '✕' : '◎'}</span>
          {ghostActive ? 'Exit What-If' : 'What-If Analysis'}
        </button>
      </div>

      {/* Ghost banner */}
      <AnimatePresence>
        {ghostActive && latest && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            style={{
              padding: '8px 14px', borderRadius: 8, marginBottom: 10,
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              fontSize: 11, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 10,
              overflow: 'hidden'
            }}
          >
            <span style={{ fontSize: 16 }}>🤖</span>
            <span>
              <strong style={{ color: '#EF4444' }}>AI Optimization Impact</strong>
              {` : Current operations are preventing `}
              <span style={{ color: '#10B981', fontWeight: 700 }}>+{waitDelta}s</span>
              {` of projected wait time buildup and `}
              <span style={{ color: '#10B981', fontWeight: 700 }}>{queueDelta}</span>
              {` additional contacts in queue.`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart */}
      {trendData.length === 0 ? (
        <div style={{
          height: 180, display: 'flex',
          flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 13,
          gap: 16,
          border: '1px dashed var(--border)',
          borderRadius: 8,
          margin: '10px 0'
        }}>
          <div className="animate-pulse w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center">
            <span className="text-2xl">📈</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {isRunning ? 'Calibrating Data Streams...' : 'Operational Intelligence Offline'}
            </p>
            <p style={{ fontSize: 11 }}>
              {isRunning ? 'Collecting live simulation metrics' : 'Start the demo to activate real-time tracking'}
            </p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart
            data={trendData}
            margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="waitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="queueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 500 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={30}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />

            <Tooltip
              contentStyle={{
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(8px)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
                fontSize: 12,
                padding: '10px 14px',
              }}
              itemStyle={{ padding: '2px 0' }}
              animationDuration={250}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingBottom: 15 }}
            />

            <Area
              yAxisId="left"
              type="monotone"
              dataKey="waitTime"
              stroke="#3B82F6"
              strokeWidth={3}
              fill="url(#waitGrad)"
              name="Avg Wait (s)"
              animationDuration={1500}
              isAnimationActive={true}
              dot={{ r: 3, strokeWidth: 1.5, fill: '#fff', stroke: '#3B82F6' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#3B82F6' }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="queueDepth"
              stroke="#F59E0B"
              strokeWidth={3}
              fill="url(#queueGrad)"
              name="Queue Depth"
              animationDuration={1500}
              isAnimationActive={true}
              dot={{ r: 3, strokeWidth: 1.5, fill: '#fff', stroke: '#F59E0B' }}
              activeDot={{ r: 6, strokeWidth: 0, fill: '#F59E0B' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="serviceLevel"
              stroke="#10B981"
              strokeWidth={2}
              dot={false}
              name="Service Level %"
              animationDuration={2000}
            />

            {ghostActive && (
              <>
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ghostWaitTime"
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  name="Wait (No AI)"
                  dot={false}
                  animationDuration={1000}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ghostQueueDepth"
                  stroke="#F97316"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  name="Queue (No AI)"
                  dot={false}
                  animationDuration={1000}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
