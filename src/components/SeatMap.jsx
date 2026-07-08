import React, { useMemo } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  HELD_OTHER_COLOR,
  SELECTED_COLOR,
  SOLD_COLOR,
  getSeatFill,
  getSeatTextColor,
} from '@/lib/seatColors';

const SEAT_SIZE = 22;
const SEAT_GAP = 6;
const ROW_LABEL_WIDTH = 34;
const TOP_PADDING = 64;

/**
 * Mapa de butacas. Recibe una lista ya normalizada de butacas:
 *   { seatId, row, col, label, status, price, zoneName, zoneColor, isActive, heldByMe }
 * status: 'available' | 'held' | 'sold'
 *
 * Importante: el color se aplica con el atributo SVG `fill`, no con
 * clases de Tailwind de `background-color` — eso no tiene efecto sobre
 * <rect>, que es lo que renderiza cada butaca (por eso antes se veían
 * todas negras: el fill por defecto de un <rect> sin color es negro).
 *
 * En modo `readOnly` solo se usa para visualizar (ej. preview del admin).
 * En modo interactivo, `selectedIds` + `onToggle` manejan la selección
 * del comprador ANTES de retener las butacas contra el backend.
 */
const SeatMap = ({ seats, selectedIds, onToggle, readOnly = false, className }) => {
  const { rows, cols, activeSeats } = useMemo(() => {
    const active = seats.filter((s) => s.isActive !== false);
    const maxRow = active.reduce((m, s) => Math.max(m, s.row), 0);
    const maxCol = active.reduce((m, s) => Math.max(m, s.col), 0);
    return { rows: maxRow + 1, cols: maxCol + 1, activeSeats: active };
  }, [seats]);

  const width = ROW_LABEL_WIDTH + cols * (SEAT_SIZE + SEAT_GAP);
  const height = TOP_PADDING + rows * (SEAT_SIZE + SEAT_GAP);

  const rowLabels = useMemo(() => {
    const map = new Map();
    for (const s of activeSeats) {
      if (!map.has(s.row)) map.set(s.row, s.rowLabel);
    }
    return map;
  }, [activeSeats]);

  const canClick = (seat) =>
    !readOnly && seat.isActive !== false && seat.status !== 'sold' && !(seat.status === 'held' && !seat.heldByMe);

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${Math.max(height, 120)}`}
        width="100%"
        style={{ minWidth: Math.min(width, 640) }}
        className="mx-auto"
      >
        {/* Escenario */}
        <path
          d={`M ${width * 0.15} 40 Q ${width / 2} 4 ${width * 0.85} 40`}
          fill="none"
          stroke="#C9A227"
          strokeWidth="2"
          opacity="0.7"
        />
        <text
          x={width / 2}
          y="30"
          textAnchor="middle"
          fontSize="10"
          letterSpacing="3"
          fill="#C9A227"
          fontFamily="Inter, sans-serif"
        >
          ESCENARIO
        </text>

        {/* Etiquetas de fila */}
        {Array.from(rowLabels.entries()).map(([row, label]) => (
          <text
            key={`row-${row}`}
            x={ROW_LABEL_WIDTH / 2}
            y={TOP_PADDING + row * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2 + 4}
            textAnchor="middle"
            fontSize="10"
            fill="#B4A9BE"
            fontFamily="DM Mono, monospace"
          >
            {label}
          </text>
        ))}

        {/* Butacas */}
        {activeSeats.map((seat) => {
          const x = ROW_LABEL_WIDTH + seat.col * (SEAT_SIZE + SEAT_GAP);
          const y = TOP_PADDING + seat.row * (SEAT_SIZE + SEAT_GAP);
          const clickable = canClick(seat);
          const isLocallySelected = !!selectedIds?.has(seat.seatId);
          const fill = getSeatFill(seat, { isLocallySelected });
          const textColor = getSeatTextColor(fill);
          return (
            <g
              key={seat.seatId}
              transform={`translate(${x}, ${y})`}
              onClick={() => clickable && onToggle?.(seat)}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
            >
              <title>
                {seat.label} — {seat.zoneName} — {formatCurrency(seat.price)}
                {seat.status === 'sold' ? ' (vendida)' : ''}
                {seat.status === 'held' && !seat.heldByMe ? ' (ocupada temporalmente)' : ''}
              </title>
              <rect
                width={SEAT_SIZE}
                height={SEAT_SIZE}
                rx="4"
                fill={fill}
                className="transition-transform duration-150"
                style={{ transform: isLocallySelected || (seat.status === 'held' && seat.heldByMe) ? 'scale(1.1)' : 'scale(1)', transformOrigin: 'center', transformBox: 'fill-box' }}
              />
              <text
                x={SEAT_SIZE / 2}
                y={SEAT_SIZE / 2 + 3}
                textAnchor="middle"
                className="pointer-events-none"
                fontSize="8"
                fontFamily="DM Mono, monospace"
                fill={textColor}
              >
                {seat.seatNumber}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SeatMap;

/**
 * Leyenda del mapa. `zones` es la lista de zonas de precio realmente
 * presentes en este evento: [{ name, color, price }]
 */
export const SeatMapLegend = ({ zones = [] }) => (
  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
    {zones.map((zone) => (
      <LegendItem key={zone.name} color={zone.color} label={`${zone.name} — ${formatCurrency(zone.price)}`} />
    ))}
    <LegendItem color={SELECTED_COLOR} label="Seleccionada" />
    <LegendItem color={HELD_OTHER_COLOR} label="Ocupada temporalmente" />
    <LegendItem color={SOLD_COLOR} label="Vendida" />
  </div>
);

const LegendItem = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="h-3 w-3 rounded-sm inline-block" style={{ backgroundColor: color }} />
    {label}
  </div>
);
