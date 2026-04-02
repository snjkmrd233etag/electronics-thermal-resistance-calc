import { useEffect, useMemo, useReducer, useState } from 'react';
import Meta from '@/components/Meta';

const MATERIALS = [
    { name: 'Copper', conductivity: 385, notes: 'Heat spreaders, bus bars' },
    { name: 'Aluminum 6061', conductivity: 167, notes: 'Heatsinks, chassis' },
    { name: 'Aluminum 1100', conductivity: 222, notes: 'Pure aluminum' },
    { name: 'Solder (63/37)', conductivity: 50, notes: 'Die attach' },
    { name: 'Thermal Grease (typ.)', conductivity: 5, notes: 'Typical range 1-8 W/m·K' },
    { name: 'Thermal Pad (typ.)', conductivity: 3, notes: 'Typical range 1-5 W/m·K' },
    { name: 'FR4 PCB (through-plane)', conductivity: 0.3, notes: 'Poor conductor' },
    { name: 'FR4 PCB (in-plane)', conductivity: 0.81, notes: 'Better in-plane' },
    { name: 'Kovar', conductivity: 17, notes: 'IC packages' },
    { name: 'Silicon (die)', conductivity: 150, notes: 'For die calculations' },
    { name: 'Alumina (Al2O3)', conductivity: 25, notes: 'Ceramic substrates' },
    { name: 'AlN (Aluminum Nitride)', conductivity: 180, notes: 'High-performance substrates' },
    { name: 'Indium foil', conductivity: 82, notes: 'Soft metal TIM' },
    { name: 'Phase Change Material', conductivity: 5, notes: 'Typical range 3-7 W/m·K' },
];

const THETA_JC_PRESETS = [
    { label: 'Xilinx VU9P (FPGA)', value: 0.3 },
    { label: 'Xilinx ZU19EG (MPSoC)', value: 0.5 },
    { label: 'Intel Xeon D-1500', value: 0.8 },
    { label: 'LTC3779 (Power Reg)', value: 2.0 },
    { label: 'GaN FET (typ. RF)', value: 1.5 },
];

const APP_LINKS = [
    { label: 'Stack Calc', href: 'https://cw-stack-calc.vercel.app/' },
    { label: 'Wire Calc', href: 'https://cw-wire-calc.vercel.app/' },
    { label: 'Unit Converter', href: 'https://defenseengineeringunitconverter.vercel.app/?category=force&value=100&from=kn&to=lbf&precision=2' },
    { label: 'Earned Value', href: 'https://earned-value-management.vercel.app/' },
    { label: 'Supplier Scorecard', href: 'https://suplier-performance-scorecard-gener.vercel.app/' },
];

function createId() {
    return Math.random().toString(36).slice(2, 10);
}

function directLayer(name, value) {
    return {
        id: createId(),
        name,
        mode: 'direct',
        R_direct: String(value),
        thickness_mm: '',
        conductivity: '',
        area_mm2: '',
        width_mm: '',
        height_mm: '',
    };
}

function physicalLayer(name, thickness, conductivity, area) {
    return {
        id: createId(),
        name,
        mode: 'physical',
        R_direct: '',
        thickness_mm: String(thickness),
        conductivity: String(conductivity),
        area_mm2: String(area),
        width_mm: '',
        height_mm: '',
    };
}

function conductionPreset() {
    return [
        directLayer('Die to Case (θ_jc)', 0.5),
        physicalLayer('Thermal Interface Material', 0.25, 3.0, 400),
        physicalLayer('Heat Spreader (Cu)', 2, 385, 600),
        directLayer('Card-Lock / Wedge-Lock', 0.15),
        directLayer('Cold Plate / Chassis Wall', 0.3),
        directLayer('Chassis to Ambient', 0.5),
    ];
}

function airPreset() {
    return [
        directLayer('Die to Case (θ_jc)', 0.8),
        physicalLayer('Thermal Interface Material', 0.1, 1.5, 300),
        directLayer('Heatsink Body', 1.2),
        directLayer('Heatsink to Air (forced convection)', 0.8),
    ];
}

function emptyLayer() {
    return {
        id: createId(),
        name: '',
        mode: 'direct',
        R_direct: '',
        thickness_mm: '',
        conductivity: '',
        area_mm2: '',
        width_mm: '',
        height_mm: '',
    };
}

const INITIAL_STATE = {
    power_W: '35',
    t_ambient: '55',
    t_j_max: '125',
    scenarioAmbient: 55,
    parallelMode: false,
    layers: conductionPreset(),
    layersB: airPreset(),
};

function reducer(state, action) {
    if (action.type === 'SET_FIELD') {
        return { ...state, [action.field]: action.value };
    }
    if (action.type === 'TOGGLE_PARALLEL') {
        return { ...state, parallelMode: action.value };
    }
    if (action.type === 'SET_PRESET') {
        const key = action.chain === 'B' ? 'layersB' : 'layers';
        return { ...state, [key]: action.preset === 'air' ? airPreset() : conductionPreset() };
    }
    if (action.type === 'ADD_LAYER') {
        const key = action.chain === 'B' ? 'layersB' : 'layers';
        return { ...state, [key]: [...state[key], emptyLayer()] };
    }
    if (action.type === 'DELETE_LAYER') {
        const key = action.chain === 'B' ? 'layersB' : 'layers';
        return { ...state, [key]: state[key].filter((layer) => layer.id !== action.id) };
    }
    if (action.type === 'MOVE_LAYER') {
        const key = action.chain === 'B' ? 'layersB' : 'layers';
        const next = [...state[key]];
        const [item] = next.splice(action.from, 1);
        next.splice(action.to, 0, item);
        return { ...state, [key]: next };
    }
    if (action.type === 'UPDATE_LAYER') {
        const key = action.chain === 'B' ? 'layersB' : 'layers';
        return {
            ...state,
            [key]: state[key].map((layer) => {
                if (layer.id !== action.id) {
                    return layer;
                }
                const updated = { ...layer, ...action.patch };
                if (
                    Object.prototype.hasOwnProperty.call(action.patch, 'width_mm') ||
                    Object.prototype.hasOwnProperty.call(action.patch, 'height_mm')
                ) {
                    const width = toNumber(updated.width_mm);
                    const height = toNumber(updated.height_mm);
                    if (width > 0 && height > 0) {
                        updated.area_mm2 = String(round(width * height, 2));
                    }
                }
                return updated;
            }),
        };
    }
    return state;
}

function toNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function round(value, decimals = 2) {
    if (!Number.isFinite(value)) {
        return NaN;
    }
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function formatNumber(value, decimals = 2, fallback = '—') {
    return Number.isFinite(value) ? value.toFixed(decimals) : fallback;
}

function formatSigned(value, decimals = 1) {
    if (!Number.isFinite(value)) {
        return '—';
    }
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}`;
}

function calculateLayerResistance(layer) {
    if (layer.mode === 'direct') {
        const resistance = toNumber(layer.R_direct);
        return {
            resistance,
            valid: Number.isFinite(resistance) && resistance > 0,
        };
    }

    const thickness = toNumber(layer.thickness_mm);
    const conductivity = toNumber(layer.conductivity);
    const area = toNumber(layer.area_mm2);
    const resistance =
        Number.isFinite(thickness) &&
        Number.isFinite(conductivity) &&
        Number.isFinite(area) &&
        thickness > 0 &&
        conductivity > 0 &&
        area > 0
            ? (thickness / 1000) / (conductivity * (area / 1000000))
            : NaN;

    return {
        resistance,
        valid: Number.isFinite(resistance) && resistance > 0,
    };
}

function analyzeSerial(layers, power, ambient, tMax) {
    const evaluated = layers.map((layer) => ({ ...layer, ...calculateLayerResistance(layer) }));
    const valid = evaluated.length > 0 && evaluated.every((layer) => layer.valid);
    const totalResistance = valid ? evaluated.reduce((sum, layer) => sum + layer.resistance, 0) : NaN;
    const junctionTemperature = Number.isFinite(totalResistance) ? ambient + power * totalResistance : NaN;
    const thermalMargin = Number.isFinite(junctionTemperature) ? tMax - junctionTemperature : NaN;
    const maxAllowablePower =
        Number.isFinite(totalResistance) && totalResistance > 0 ? (tMax - ambient) / totalResistance : NaN;

    let remainingResistance = totalResistance;
    const breakdown = evaluated.map((layer) => {
        const tIn = Number.isFinite(remainingResistance) ? ambient + power * remainingResistance : NaN;
        remainingResistance -= layer.resistance;
        const tOut = Number.isFinite(remainingResistance) ? ambient + power * remainingResistance : NaN;
        return {
            ...layer,
            tIn,
            tOut,
            contributionPct: Number.isFinite(totalResistance) && totalResistance > 0
                ? (layer.resistance / totalResistance) * 100
                : NaN,
        };
    });

    return {
        mode: 'serial',
        valid,
        breakdown,
        totalResistance,
        junctionTemperature,
        thermalMargin,
        maxAllowablePower,
        interfaceTemperatures: [junctionTemperature, ...breakdown.map((layer) => layer.tOut)],
    };
}

function analyzeParallel(layersA, layersB, power, ambient, tMax) {
    const pathA = layersA.map((layer) => ({ ...layer, ...calculateLayerResistance(layer) }));
    const pathB = layersB.map((layer) => ({ ...layer, ...calculateLayerResistance(layer) }));
    const validA = pathA.length > 0 && pathA.every((layer) => layer.valid);
    const validB = pathB.length > 0 && pathB.every((layer) => layer.valid);
    const resistanceA = validA ? pathA.reduce((sum, layer) => sum + layer.resistance, 0) : NaN;
    const resistanceB = validB ? pathB.reduce((sum, layer) => sum + layer.resistance, 0) : NaN;
    const totalResistance =
        Number.isFinite(resistanceA) &&
        Number.isFinite(resistanceB) &&
        resistanceA > 0 &&
        resistanceB > 0
            ? 1 / (1 / resistanceA + 1 / resistanceB)
            : NaN;
    const deltaT = Number.isFinite(totalResistance) ? power * totalResistance : NaN;
    const junctionTemperature = Number.isFinite(deltaT) ? ambient + deltaT : NaN;
    const thermalMargin = Number.isFinite(junctionTemperature) ? tMax - junctionTemperature : NaN;
    const maxAllowablePower =
        Number.isFinite(totalResistance) && totalResistance > 0 ? (tMax - ambient) / totalResistance : NaN;
    const pathPowerA =
        Number.isFinite(deltaT) && Number.isFinite(resistanceA) && resistanceA > 0 ? deltaT / resistanceA : NaN;
    const pathPowerB =
        Number.isFinite(deltaT) && Number.isFinite(resistanceB) && resistanceB > 0 ? deltaT / resistanceB : NaN;

    function withTemps(layers, pathResistance, pathPower, label) {
        let remaining = pathResistance;
        return layers.map((layer) => {
            const tIn = Number.isFinite(remaining) ? ambient + pathPower * remaining : NaN;
            remaining -= layer.resistance;
            const tOut = Number.isFinite(remaining) ? ambient + pathPower * remaining : NaN;
            return {
                ...layer,
                pathLabel: label,
                tIn,
                tOut,
                contributionPct: Number.isFinite(pathResistance) && pathResistance > 0
                    ? (layer.resistance / pathResistance) * 100
                    : NaN,
            };
        });
    }

    const breakdownA = withTemps(pathA, resistanceA, pathPowerA, 'Route A');
    const breakdownB = withTemps(pathB, resistanceB, pathPowerB, 'Route B');

    return {
        mode: 'parallel',
        valid: validA && validB,
        breakdown: [...breakdownA, ...breakdownB],
        pathA: {
            totalResistance: resistanceA,
            power: pathPowerA,
            layers: breakdownA,
            interfaceTemperatures: [junctionTemperature, ...breakdownA.map((layer) => layer.tOut)],
        },
        pathB: {
            totalResistance: resistanceB,
            power: pathPowerB,
            layers: breakdownB,
            interfaceTemperatures: [junctionTemperature, ...breakdownB.map((layer) => layer.tOut)],
        },
        totalResistance,
        junctionTemperature,
        thermalMargin,
        maxAllowablePower,
    };
}

function computeResults(state) {
    const power = toNumber(state.power_W);
    const ambient = toNumber(state.t_ambient);
    const tMax = toNumber(state.t_j_max);
    const globalsValid =
        Number.isFinite(power) && power >= 0 &&
        Number.isFinite(ambient) &&
        Number.isFinite(tMax);

    if (!globalsValid) {
        return {
            mode: state.parallelMode ? 'parallel' : 'serial',
            valid: false,
            breakdown: [],
            totalResistance: NaN,
            junctionTemperature: NaN,
            thermalMargin: NaN,
            maxAllowablePower: NaN,
        };
    }

    return state.parallelMode
        ? analyzeParallel(state.layers, state.layersB, power, ambient, tMax)
        : analyzeSerial(state.layers, power, ambient, tMax);
}

function cloneForSolver(state, selectedLayerKey, nextThickness) {
    const [chain, id] = selectedLayerKey.split(':');
    const key = chain === 'B' ? 'layersB' : 'layers';
    return {
        ...state,
        [key]: state[key].map((layer) =>
            layer.id === id ? { ...layer, thickness_mm: String(nextThickness) } : layer
        ),
    };
}

function findLayerByKey(state, key) {
    const [chain, id] = key.split(':');
    const source = chain === 'B' ? state.layersB : state.layers;
    return source.find((layer) => layer.id === id) || null;
}

function solveMaxThickness(state, selectedLayerKey) {
    if (!selectedLayerKey) {
        return NaN;
    }

    const initialAtZero = computeResults(cloneForSolver(state, selectedLayerKey, 0));
    const limit = toNumber(state.t_j_max);

    if (!Number.isFinite(limit) || !Number.isFinite(initialAtZero.junctionTemperature)) {
        return NaN;
    }

    if (initialAtZero.junctionTemperature > limit) {
        return 0;
    }

    let low = 0;
    let high = Math.max(5, toNumber(findLayerByKey(state, selectedLayerKey)?.thickness_mm) || 1);
    let highResult = computeResults(cloneForSolver(state, selectedLayerKey, high));

    while (Number.isFinite(highResult.junctionTemperature) && highResult.junctionTemperature < limit && high < 200) {
        high *= 2;
        highResult = computeResults(cloneForSolver(state, selectedLayerKey, high));
    }

    for (let index = 0; index < 30; index += 1) {
        const mid = (low + high) / 2;
        const result = computeResults(cloneForSolver(state, selectedLayerKey, mid));
        if (!Number.isFinite(result.junctionTemperature) || result.junctionTemperature >= limit) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return round(low, 3);
}

function useDebouncedValue(value, delay) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const handle = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handle);
    }, [value, delay]);

    return debounced;
}

function gradientColor(temp, ambient, junction) {
    if (!Number.isFinite(temp) || !Number.isFinite(ambient) || !Number.isFinite(junction) || junction <= ambient) {
        return '#14b8a6';
    }
    const ratio = Math.min(1, Math.max(0, (temp - ambient) / (junction - ambient)));
    const hue = 200 - ratio * 165;
    return `hsl(${hue} 78% 56%)`;
}

function isDieLayer(name) {
    return /die|junction|θ_jc/i.test(name || '');
}

function renderChainSvg(layers, ambient, junction, title) {
    const vertical = layers.length > 5;

    if (vertical) {
        const width = 560;
        const height = 120 + layers.length * 96;
        return (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
                <text x="30" y="30" fill="#dbe7f4" fontSize="14" fontWeight="700">{title}</text>
                <text x="30" y="54" fill="#f8b34a" fontSize="16" fontWeight="700">
                    Junction {formatNumber(junction, 1)}°C
                </text>
                {layers.map((layer, index) => {
                    const y = 78 + index * 92;
                    const fill = gradientColor(layer.tIn, ambient, junction);
                    return (
                        <g key={layer.id}>
                            <rect x="34" y={y} width="492" height="70" rx="18" fill={fill} fillOpacity="0.25" stroke={fill} strokeWidth="1.5" />
                            <text x="56" y={y + 24} fill="#f8fafc" fontSize="15" fontWeight="700">{layer.name || `Layer ${index + 1}`}</text>
                            <text x="56" y={y + 46} fill="#cbd5e1" fontSize="13">R = {formatNumber(layer.resistance, 3)} °C/W</text>
                            <text x="56" y={y + 62} fill="#94a3b8" fontSize="12">T_out = {formatNumber(layer.tOut, 1)} °C</text>
                            {index < layers.length - 1 ? (
                                <line x1="280" y1={y + 70} x2="280" y2={y + 92} stroke="#475569" strokeDasharray="4 4" />
                            ) : null}
                        </g>
                    );
                })}
                <text x="30" y={height - 20} fill="#5eead4" fontSize="16" fontWeight="700">
                    Ambient {formatNumber(ambient, 1)}°C
                </text>
            </svg>
        );
    }

    const width = 980;
    const blockWidth = Math.max(130, Math.floor((width - 160) / Math.max(layers.length, 1)));
    const height = 270;
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
            <text x="24" y="26" fill="#dbe7f4" fontSize="14" fontWeight="700">{title}</text>
            <text x="24" y="56" fill="#f8b34a" fontSize="18" fontWeight="700">
                Junction {formatNumber(junction, 1)}°C
            </text>
            {layers.map((layer, index) => {
                const x = 96 + index * blockWidth;
                const fill = gradientColor(layer.tIn, ambient, junction);
                return (
                    <g key={layer.id}>
                        <rect x={x} y="74" width={blockWidth - 18} height="92" rx="18" fill={fill} fillOpacity="0.24" stroke={fill} strokeWidth="1.5" />
                        <text x={x + 14} y="102" fill="#f8fafc" fontSize="14" fontWeight="700">{layer.name || `Layer ${index + 1}`}</text>
                        <text x={x + 14} y="126" fill="#cbd5e1" fontSize="13">R = {formatNumber(layer.resistance, 3)} °C/W</text>
                        <text x={x + 14} y="148" fill="#94a3b8" fontSize="12">T_out = {formatNumber(layer.tOut, 1)} °C</text>
                        {index < layers.length - 1 ? (
                            <line x1={x + blockWidth - 18} y1="120" x2={x + blockWidth} y2="120" stroke="#475569" strokeWidth="2" />
                        ) : null}
                    </g>
                );
            })}
            <text x={width - 132} y="56" fill="#5eead4" fontSize="18" fontWeight="700">
                Ambient {formatNumber(ambient, 1)}°C
            </text>
        </svg>
    );
}

function GradientBar({ temperatures, ambient, junction }) {
    if (!temperatures?.length || !Number.isFinite(junction)) {
        return (
            <div className="rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-950 to-slate-900 p-5 text-sm text-slate-400 shadow-lg shadow-slate-950/20">
                Fill in the basic numbers on the left to see the heat range here.
            </div>
        );
    }

    return (
        <div className="rounded-3xl border border-slate-700/80 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-lg shadow-slate-950/20">
            <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-400">
                <span>Heat Range</span>
                <span>{formatNumber(ambient, 1)}°C to {formatNumber(junction, 1)}°C</span>
            </div>
            <div className="relative h-4 rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 via-40% to-amber-400">
                {temperatures.map((temp, index) => {
                    const percent = junction === ambient ? 0 : ((temp - ambient) / (junction - ambient)) * 100;
                    return (
                        <span
                            key={`${temp}-${index}`}
                            className="absolute top-1/2 h-7 w-px -translate-y-1/2 bg-slate-950"
                            style={{ left: `${Math.min(100, Math.max(0, percent))}%` }}
                        />
                    );
                })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-300">
                {temperatures.map((temp, index) => (
                    <span key={`${temp}-label-${index}`} className="rounded-full border border-slate-700 px-3 py-1">
                        Node {index}: {formatNumber(temp, 1)}°C
                    </span>
                ))}
            </div>
        </div>
    );
}

function MaterialModal({ isOpen, query, onClose, onQueryChange, onSelect }) {
    if (!isOpen) {
        return null;
    }

    const filtered = MATERIALS.filter((material) => {
        const haystack = `${material.name} ${material.notes}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl shadow-slate-950/60">
                <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-100">Material Library</h2>
                        <p className="mt-1 text-sm text-slate-400">Choose a common material to fill in the conductivity value automatically.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
                    >
                        Close
                    </button>
                </div>
                <div className="border-b border-slate-800 px-6 py-4">
                    <input
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder="Search materials"
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-teal-400"
                    />
                </div>
                <div className="max-h-[60vh] overflow-auto px-6 py-4">
                    <table className="w-full text-left text-sm text-slate-200">
                        <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-[0.18em] text-slate-400">
                            <tr>
                                <th className="px-3 py-3">Material</th>
                                <th className="px-3 py-3">k (W/m·K)</th>
                                <th className="px-3 py-3">Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((material) => (
                                <tr
                                    key={material.name}
                                    className="cursor-pointer border-t border-slate-800 transition hover:bg-slate-800/70"
                                    onClick={() => onSelect(material)}
                                >
                                    <td className="px-3 py-3 font-medium text-slate-100">{material.name}</td>
                                    <td className="px-3 py-3 text-teal-300">{material.conductivity}</td>
                                    <td className="px-3 py-3 text-slate-400">{material.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function NumericField({ label, value, onChange, suffix, tooltip, hint }) {
    return (
        <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
                {label}
                {tooltip ? <span className="cursor-help text-xs text-slate-500" title={tooltip}>?</span> : null}
            </span>
            <div className="flex overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/90">
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    inputMode="decimal"
                    className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
                {suffix ? (
                    <span className="flex items-center border-l border-slate-700 px-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                        {suffix}
                    </span>
                ) : null}
            </div>
            {hint ? <span className="mt-2 block text-xs leading-5 text-slate-500">{hint}</span> : null}
        </label>
    );
}

function LayerCard({
    chain,
    index,
    layer,
    evaluated,
    onLayerChange,
    onDelete,
    onMove,
    onOpenMaterial,
    onPresetSelect,
    onDragStart,
    onDragOver,
    onDrop,
}) {
    const invalid = !evaluated.valid;
    const label = layer.name || `Step ${index + 1}`;
    const isDirect = layer.mode === 'direct';
    const showThetaPreset = isDieLayer(layer.name) || index === 0;

    return (
        <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`rounded-3xl border p-4 sm:p-5 shadow-lg shadow-slate-950/15 ${
                invalid ? 'border-rose-500/70 bg-rose-950/20' : 'border-slate-800 bg-slate-900/85'
            }`}
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        draggable
                        onDragStart={onDragStart}
                        className="mt-1 rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400 transition hover:border-slate-500 hover:text-white"
                        title="Drag to reorder"
                    >
                        :::
                    </button>
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Step {index + 1} • {chain}</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-100">{label}</h3>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onMove(index, Math.max(0, index - 1))}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 disabled:opacity-50"
                        disabled={index === 0}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        onClick={() => onMove(index, index + 1)}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500"
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="rounded-full border border-rose-500/50 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/10"
                    >
                        ×
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <NumericField
                    label="Step name"
                    value={layer.name}
                    onChange={(value) => onLayerChange({ name: value })}
                    tooltip="Use simple names like chip package, thermal pad, heat spreader, heatsink, or enclosure."
                    hint="Name the part heat moves through at this step."
                />

                <div>
                    <div className="mb-2 text-sm font-medium text-slate-200">How do you want to fill in this step?</div>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1">
                        <button
                            type="button"
                            onClick={() => onLayerChange({ mode: 'direct' })}
                            className={`rounded-2xl px-3 py-2 text-sm transition ${
                                isDirect ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                            I know the resistance value
                        </button>
                        <button
                            type="button"
                            onClick={() => onLayerChange({ mode: 'physical' })}
                            className={`rounded-2xl px-3 py-2 text-sm transition ${
                                !isDirect ? 'bg-teal-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                        >
                            Calculate from size + material
                        </button>
                    </div>
                </div>

                {showThetaPreset ? (
                    <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-200">Common chip/package examples</span>
                        <select
                            defaultValue=""
                            onChange={(event) => onPresetSelect(event.target.value)}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                        >
                            <option value="">Select component preset</option>
                            {THETA_JC_PRESETS.map((preset) => (
                                <option key={preset.label} value={preset.value}>
                                    {preset.label} ({preset.value} °C/W)
                                </option>
                            ))}
                            <option value="custom">Custom (enter value)</option>
                        </select>
                    </label>
                ) : null}

                {isDirect ? (
                    <NumericField
                        label="Resistance for this step"
                        value={layer.R_direct}
                        onChange={(value) => onLayerChange({ R_direct: value })}
                        suffix="°C/W"
                        hint="Use this if a datasheet or previous calculation already gives you the value."
                    />
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        <NumericField
                            label="Thickness"
                            value={layer.thickness_mm}
                            onChange={(value) => onLayerChange({ thickness_mm: value })}
                            suffix="mm"
                            hint="How thick this material layer is."
                        />
                        <div className="space-y-4">
                            <NumericField
                                label="Material heat-transfer value"
                                value={layer.conductivity}
                                onChange={(value) => onLayerChange({ conductivity: value })}
                                suffix="W/m·K"
                                tooltip="Higher numbers usually move heat better."
                                hint="If you do not know this number, use Choose Material."
                            />
                            <button
                                type="button"
                                onClick={onOpenMaterial}
                                className="rounded-full border border-teal-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-300 transition hover:border-teal-300 hover:text-teal-200"
                            >
                                Choose Material
                            </button>
                        </div>
                        <NumericField
                            label="Contact area"
                            value={layer.area_mm2}
                            onChange={(value) => onLayerChange({ area_mm2: value })}
                            suffix="mm²"
                            hint="The heat-flow area for this step."
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <NumericField label="Width" value={layer.width_mm} onChange={(value) => onLayerChange({ width_mm: value })} suffix="mm" />
                            <NumericField label="Height" value={layer.height_mm} onChange={(value) => onLayerChange({ height_mm: value })} suffix="mm" />
                        </div>
                        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                            Calculated resistance for this step = {formatNumber(evaluated.resistance, 4)} °C/W
                        </div>
                    </div>
                )}

                <div className={`rounded-2xl px-4 py-3 text-sm ${invalid ? 'bg-rose-500/10 text-rose-200' : 'bg-slate-950/80 text-slate-300'}`}>
                    {invalid ? 'Enter numbers greater than zero. In size-and-material mode, thickness, material value, and contact area are all required.' : `This step adds ${formatNumber(evaluated.resistance, 4)} °C/W of resistance to heat flow.`}
                </div>
            </div>
        </div>
    );
}

function PresetButtons({ onPreset }) {
    return (
        <div className="flex flex-wrap gap-3">
            <button
                type="button"
                onClick={() => onPreset('vpx')}
                className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200 transition hover:border-amber-300 hover:bg-amber-400/15"
            >
                Conduction-Cooled VPX
            </button>
            <button
                type="button"
                onClick={() => onPreset('air')}
                className="rounded-full border border-teal-400/40 bg-teal-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200 transition hover:border-teal-300 hover:bg-teal-400/15"
            >
                Air-Cooled COTS
            </button>
        </div>
    );
}

function ThermalDiagram({ results, ambient, debouncedResults }) {
    const junction = debouncedResults.junctionTemperature;

    return (
        <div className="space-y-5 rounded-[28px] border border-slate-700/80 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-2xl shadow-slate-950/25 sm:space-y-6 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Visual Output</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-50">Heat Flow View</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                        This view shows how heat travels from the chip through each step until it reaches the surrounding air.
                    </p>
                </div>
                <div className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    results.valid && Number.isFinite(results.thermalMargin) && results.thermalMargin > 0
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-200'
                }`}>
                    {results.valid && Number.isFinite(results.thermalMargin) && results.thermalMargin > 0
                        ? `SAFE - Margin: ${formatSigned(results.thermalMargin, 1)}°C`
                        : results.valid
                            ? `TOO HOT - Over by ${formatNumber(Math.abs(results.thermalMargin), 1)}°C`
                            : 'Fill in the inputs to get a safety result'}
                </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/85 p-4">
                {debouncedResults.mode === 'parallel' ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                        <div>{renderChainSvg(debouncedResults.pathA.layers, ambient, junction, 'Route A')}</div>
                        <div>{renderChainSvg(debouncedResults.pathB.layers, ambient, junction, 'Route B')}</div>
                    </div>
                ) : (
                    renderChainSvg(debouncedResults.breakdown, ambient, junction, 'Primary Chain')
                )}
            </div>

            {debouncedResults.mode === 'parallel' ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <GradientBar temperatures={debouncedResults.pathA.interfaceTemperatures} ambient={ambient} junction={junction} />
                    <GradientBar temperatures={debouncedResults.pathB.interfaceTemperatures} ambient={ambient} junction={junction} />
                </div>
            ) : (
                <GradientBar temperatures={debouncedResults.interfaceTemperatures} ambient={ambient} junction={junction} />
            )}
        </div>
    );
}

export default function Home() {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
    const [dragState, setDragState] = useState(null);
    const [materialTarget, setMaterialTarget] = useState(null);
    const [materialQuery, setMaterialQuery] = useState('');
    const [scenarioOpen, setScenarioOpen] = useState(true);
    const [copyStatus, setCopyStatus] = useState('');
    const [selectedSolverLayer, setSelectedSolverLayer] = useState('');
    const [modeMenuOpen, setModeMenuOpen] = useState(false);

    const results = useMemo(() => computeResults(state), [state]);
    const debouncedState = useDebouncedValue(state, 150);
    const debouncedResults = useMemo(() => computeResults(debouncedState), [debouncedState]);
    const ambient = toNumber(state.t_ambient);
    const scenarioAmbientState = useMemo(() => ({ ...state, t_ambient: String(state.scenarioAmbient) }), [state]);
    const scenarioResults = useMemo(() => computeResults(scenarioAmbientState), [scenarioAmbientState]);

    const physicalLayerOptions = useMemo(() => {
        const source = [
            ...state.layers.map((layer) => ({ chain: 'A', layer })),
            ...(state.parallelMode ? state.layersB.map((layer) => ({ chain: 'B', layer })) : []),
        ];

        return source
            .filter(({ layer }) => layer.mode === 'physical')
            .map(({ chain, layer }) => ({
                key: `${chain}:${layer.id}`,
                label: `${chain === 'A' ? 'Route A' : 'Route B'} • ${layer.name || 'Unnamed step'}`,
            }));
    }, [state.layers, state.layersB, state.parallelMode]);

    useEffect(() => {
        if (physicalLayerOptions.length === 0) {
            setSelectedSolverLayer('');
            return;
        }
        if (!physicalLayerOptions.some((option) => option.key === selectedSolverLayer)) {
            setSelectedSolverLayer(physicalLayerOptions[0].key);
        }
    }, [physicalLayerOptions, selectedSolverLayer]);

    const maxTimThickness = useMemo(
        () => solveMaxThickness(state, selectedSolverLayer),
        [state, selectedSolverLayer]
    );

    async function copySummary() {
        const lines = [
            `CW ThermalCalc summary - ${new Date().toLocaleString()}`,
            `Cooling steps: ${results.breakdown.map((layer) => `${layer.pathLabel ? `${layer.pathLabel} ` : ''}${layer.name || 'Unnamed step'} (${formatNumber(layer.resistance, 3)} °C/W)`).join(', ')}`,
            `Total resistance: ${formatNumber(results.totalResistance, 2)} °C/W`,
            `Predicted chip temperature: ${formatNumber(results.junctionTemperature, 1)} °C | Safety margin: ${formatSigned(results.thermalMargin, 1)}°C`,
            `Maximum allowed power at these conditions: ${formatNumber(results.maxAllowablePower, 2)} W`,
        ].join('\n');

        try {
            await navigator.clipboard.writeText(lines);
            setCopyStatus('Results copied to clipboard.');
        } catch (error) {
            setCopyStatus('Clipboard access failed in this browser.');
        }
    }

    function applyMaterial(material) {
        if (!materialTarget) {
            return;
        }
        dispatch({
            type: 'UPDATE_LAYER',
            chain: materialTarget.chain,
            id: materialTarget.id,
            patch: { conductivity: String(material.conductivity) },
        });
        setMaterialTarget(null);
        setMaterialQuery('');
    }

    function selectLayoutMode(mode) {
        if (mode === 'single') {
            dispatch({ type: 'TOGGLE_PARALLEL', value: false });
        }
        if (mode === 'parallel') {
            dispatch({ type: 'TOGGLE_PARALLEL', value: true });
        }
        if (mode === 'guide') {
            const guide = document.getElementById('quick-start-guide');
            if (guide) {
                guide.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        setModeMenuOpen(false);
    }

    function renderLayerStack(chainKey, title, layers, evaluatedLayers) {
        return (
            <div className="space-y-5 xl:min-w-0">
                <div className="rounded-[28px] border border-slate-700/80 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-5 shadow-xl shadow-slate-950/20">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{chainKey === 'A' ? 'Main Route' : 'Second Route'}</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-50">{title}</h3>
                            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                                Add each part that heat passes through on its way from the device to the air.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => dispatch({ type: 'ADD_LAYER', chain: chainKey })}
                            className="rounded-full border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-200 transition hover:border-teal-300 hover:bg-teal-400/15 sm:px-4 sm:text-xs"
                        >
                            + Add Part
                        </button>
                    </div>
                    <PresetButtons onPreset={(preset) => dispatch({ type: 'SET_PRESET', chain: chainKey, preset })} />
                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                        <span>{layers.length} {layers.length === 1 ? 'part' : 'parts'}</span>
                        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Scroll inside this panel when the list gets long</span>
                    </div>
                    <div className="app-scrollbar mt-4 max-h-[68vh] overflow-y-auto pr-2 sm:max-h-[60vh]">
                        <div className="space-y-4">
                            {layers.map((layer, index) => (
                                <LayerCard
                                    key={layer.id}
                                    chain={chainKey === 'A' ? 'Route A' : 'Route B'}
                                    index={index}
                                    layer={layer}
                                    evaluated={evaluatedLayers[index] || { resistance: NaN, valid: false }}
                                    onLayerChange={(patch) => dispatch({ type: 'UPDATE_LAYER', chain: chainKey, id: layer.id, patch })}
                                    onDelete={() => dispatch({ type: 'DELETE_LAYER', chain: chainKey, id: layer.id })}
                                    onMove={(from, to) => {
                                        if (to < 0 || to >= layers.length) {
                                            return;
                                        }
                                        dispatch({ type: 'MOVE_LAYER', chain: chainKey, from, to });
                                    }}
                                    onOpenMaterial={() => setMaterialTarget({ chain: chainKey, id: layer.id })}
                                    onPresetSelect={(value) => {
                                        if (!value || value === 'custom') {
                                            return;
                                        }
                                        dispatch({
                                            type: 'UPDATE_LAYER',
                                            chain: chainKey,
                                            id: layer.id,
                                            patch: { mode: 'direct', R_direct: value },
                                        });
                                    }}
                                    onDragStart={() => setDragState({ chain: chainKey, index })}
                                    onDragOver={(event) => event.preventDefault()}
                                    onDrop={() => {
                                        if (!dragState || dragState.chain !== chainKey || dragState.index === index) {
                                            return;
                                        }
                                        dispatch({ type: 'MOVE_LAYER', chain: chainKey, from: dragState.index, to: index });
                                        setDragState(null);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <Meta title="CW ThermalCalc" description="A guided calculator that checks whether an electronic device stays within a safe temperature." />
            <MaterialModal
                isOpen={Boolean(materialTarget)}
                query={materialQuery}
                onClose={() => {
                    setMaterialTarget(null);
                    setMaterialQuery('');
                }}
                onQueryChange={setMaterialQuery}
                onSelect={applyMaterial}
            />
            <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.14),_transparent_24%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] text-slate-100">
                <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
                    <nav className="mb-4 rounded-[28px] border border-slate-700/80 bg-gradient-to-r from-slate-900/90 to-slate-950/90 px-4 py-4 shadow-xl shadow-slate-950/15">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="mr-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                                Engineering Apps
                            </span>
                            {APP_LINKS.map((app) => (
                                <a
                                    key={app.href}
                                    href={app.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-sm text-slate-200 transition hover:-translate-y-0.5 hover:border-teal-400 hover:text-white"
                                >
                                    {app.label}
                                </a>
                            ))}
                        </div>
                    </nav>
                    <header className="mb-8 rounded-[32px] border border-slate-700/80 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_26%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] px-4 py-5 shadow-2xl shadow-slate-950/25 sm:px-6 sm:py-7">
                        <div className="flex flex-wrap items-start justify-between gap-5">
                            <div>
                                <p className="text-xs uppercase tracking-[0.28em] text-teal-300">Curtiss-Wright Defense Electronics</p>
                                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">CW ThermalCalc</h1>
                                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                                    A guided heat-check tool for electronics. Enter the device heat, the surrounding temperature, and the cooling parts to see if the chip stays within a safe temperature.
                                </p>
                            </div>
                            <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-1 xl:grid-cols-2">
                                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/60 px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Step 1</div>
                                    <div className="mt-2 text-sm text-slate-200">Enter power, surrounding temperature, and the safe limit.</div>
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Step 2</div>
                                    <div className="mt-2 text-sm text-slate-200">List the parts that carry heat away from the device.</div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <section id="quick-start-guide" className="mb-8 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-4 text-sm text-slate-300 shadow-lg shadow-slate-950/10">
                            <span className="font-semibold text-slate-100">Quick start:</span> leave the sample values in place if you want to see a working example first.
                        </div>
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-100 shadow-lg shadow-slate-950/10">
                            <span className="font-semibold">Green result:</span> the current setup stays below the safe temperature limit.
                        </div>
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100 shadow-lg shadow-slate-950/10">
                            <span className="font-semibold">Red result:</span> one or more parts need better cooling or a lower power level.
                        </div>
                    </section>

                    <div className="grid gap-6 xl:grid-cols-[1.18fr_1.1fr_0.92fr]">
                        <section className="space-y-6">
                            <div className="rounded-[28px] border border-slate-700/80 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-xl shadow-slate-950/20 sm:p-6">
                                <div className="mb-5 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inputs</p>
                                        <h2 className="mt-2 text-2xl font-semibold text-slate-50">Basic Setup</h2>
                                        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                                            Start with three numbers: how much heat the device makes, how hot the surrounding air is, and the highest safe chip temperature.
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setModeMenuOpen((current) => !current)}
                                            className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-300 transition hover:border-teal-400 hover:text-white"
                                        >
                                            <span>{state.parallelMode ? 'Two cooling routes' : 'One cooling route'}</span>
                                            <span className={`text-xs transition-transform duration-200 ${modeMenuOpen ? 'rotate-180' : ''}`}>⌄</span>
                                        </button>
                                        <div
                                            className={`absolute right-0 z-20 mt-3 w-64 origin-top-right overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 shadow-2xl shadow-slate-950/40 transition-all duration-200 ${
                                                modeMenuOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => selectLayoutMode('single')}
                                                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-slate-900 ${!state.parallelMode ? 'text-teal-300' : 'text-slate-200'}`}
                                            >
                                                <span>One cooling route</span>
                                                {!state.parallelMode ? <span>•</span> : null}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectLayoutMode('parallel')}
                                                className={`flex w-full items-center justify-between border-t border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-900 ${state.parallelMode ? 'text-teal-300' : 'text-slate-200'}`}
                                            >
                                                <span>Two cooling routes</span>
                                                {state.parallelMode ? <span>•</span> : null}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => selectLayoutMode('guide')}
                                                className="flex w-full items-center justify-between border-t border-slate-800 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-900"
                                            >
                                                <span>Quick help</span>
                                                <span className="text-slate-500">→</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <NumericField label="Device heat / power" value={state.power_W} onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'power_W', value })} suffix="W" tooltip="How much heat the device produces." hint="Use the power that turns into heat." />
                                    <NumericField
                                        label="Surrounding air temperature"
                                        value={state.t_ambient}
                                        onChange={(value) => {
                                            dispatch({ type: 'SET_FIELD', field: 't_ambient', value });
                                            const ambientValue = toNumber(value);
                                            if (Number.isFinite(ambientValue)) {
                                                dispatch({ type: 'SET_FIELD', field: 'scenarioAmbient', value: ambientValue });
                                            }
                                        }}
                                        suffix="°C"
                                        hint="Use the expected ambient temperature around the equipment."
                                    />
                                    <NumericField label="Maximum safe chip temperature" value={state.t_j_max} onChange={(value) => dispatch({ type: 'SET_FIELD', field: 't_j_max', value })} suffix="°C" tooltip="The highest temperature the chip can safely reach." hint="This usually comes from the component datasheet." />
                                </div>
                                <div className="mt-4 grid gap-3 rounded-3xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300 md:grid-cols-3">
                                    <div>
                                        <div className="font-semibold text-slate-100">If you know datasheet values</div>
                                        <div className="mt-1 text-slate-400">Use the I know the resistance value option for that step.</div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-100">If you know dimensions</div>
                                        <div className="mt-1 text-slate-400">Use the Calculate from size + material option and choose a material.</div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-100">If heat leaves two ways</div>
                                        <div className="mt-1 text-slate-400">Switch to two cooling routes and build both paths separately.</div>
                                    </div>
                                </div>
                            </div>

                            {state.parallelMode ? (
                                <div className="space-y-6">
                                    {renderLayerStack('A', 'Cooling Route A', state.layers, results.pathA?.layers || [])}
                                    {renderLayerStack('B', 'Cooling Route B', state.layersB, results.pathB?.layers || [])}
                                </div>
                            ) : (
                                renderLayerStack('A', 'Cooling Route', state.layers, results.breakdown)
                            )}
                        </section>

                        <section className="space-y-6">
                            <ThermalDiagram results={results} ambient={ambient} debouncedResults={debouncedResults} />
                        </section>
                        <section className="space-y-6">
                            <div className="rounded-[28px] border border-slate-700/80 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 shadow-xl shadow-slate-950/20 sm:p-6">
                                <div className="mb-5">
                                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Results</p>
                                    <h2 className="mt-2 text-2xl font-semibold text-slate-50">Results Summary</h2>
                                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                                        Review the predicted chip temperature, how much margin you have left, and whether the design still looks safe.
                                    </p>
                                </div>
                                <div className={`mb-4 rounded-3xl border px-4 py-4 text-sm ${
                                    results.valid && Number.isFinite(results.thermalMargin) && results.thermalMargin >= 0
                                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                                        : 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                                }`}>
                                    {results.valid && Number.isFinite(results.thermalMargin) && results.thermalMargin >= 0
                                        ? `This setup looks safe at the current conditions. The chip is predicted to stay ${formatNumber(results.thermalMargin, 1)}°C below the limit.`
                                        : results.valid
                                            ? `This setup runs too hot at the current conditions. Reduce power or improve one or more cooling parts by about ${formatNumber(Math.abs(results.thermalMargin), 1)}°C of margin.`
                                            : 'Enter the required values above to see whether the setup is safe.'}
                                </div>
                                <div className="overflow-hidden rounded-3xl border border-slate-800">
                                    <table className="w-full text-left text-sm">
                                        <tbody>
                                            {[
                                                ['Total resistance to heat flow', `${formatNumber(results.totalResistance, 2)} °C/W`],
                                                ['Predicted chip temperature', `${formatNumber(results.junctionTemperature, 1)} °C`],
                                                ['Maximum safe chip temperature', `${formatNumber(toNumber(state.t_j_max), 1)} °C`],
                                                ['Safety margin', `${formatSigned(results.thermalMargin, 1)} °C`],
                                                ['Maximum device power at these conditions', `${formatNumber(results.maxAllowablePower, 2)} W`],
                                            ].map(([label, value]) => (
                                                <tr key={label} className="border-b border-slate-800 last:border-b-0">
                                                    <td className="bg-slate-950/70 px-4 py-3 text-slate-400">{label}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-100">{value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {results.mode === 'parallel' ? (
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3 text-sm">
                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Route A</div>
                                            <div className="mt-2 text-slate-200">Resistance = {formatNumber(results.pathA?.totalResistance, 2)} °C/W</div>
                                            <div className="mt-1 text-slate-400">Heat handled = {formatNumber(results.pathA?.power, 2)} W</div>
                                        </div>
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3 text-sm">
                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Route B</div>
                                            <div className="mt-2 text-slate-200">Resistance = {formatNumber(results.pathB?.totalResistance, 2)} °C/W</div>
                                            <div className="mt-1 text-slate-400">Heat handled = {formatNumber(results.pathB?.power, 2)} W</div>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="mt-6">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h3 className="text-lg font-semibold text-slate-100">Step-by-Step Temperature Drop</h3>
                                        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                            {results.mode === 'parallel' ? '% of route drop' : '% of total drop'}
                                        </span>
                                    </div>
                                    <div className="overflow-auto rounded-3xl border border-slate-800">
                                        <table className="min-w-full text-left text-sm">
                                            <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.18em] text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-3">Step</th>
                                                    <th className="px-4 py-3">Resistance</th>
                                                    <th className="px-4 py-3">% of Drop</th>
                                                    <th className="px-4 py-3">Temp In</th>
                                                    <th className="px-4 py-3">Temp Out</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.breakdown.map((layer) => (
                                                    <tr key={`${layer.pathLabel || 'A'}-${layer.id}`} className="border-t border-slate-800">
                                                        <td className="px-4 py-3 text-slate-200">
                                                            {layer.pathLabel ? `${layer.pathLabel} • ` : ''}
                                                            {layer.name || 'Unnamed step'}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-300">{formatNumber(layer.resistance, 3)}</td>
                                                        <td className="px-4 py-3 text-slate-300">{formatNumber(layer.contributionPct, 1)}%</td>
                                                        <td className="px-4 py-3 text-slate-300">{formatNumber(layer.tIn, 1)}</td>
                                                        <td className="px-4 py-3 text-slate-300">{formatNumber(layer.tOut, 1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/75">
                                    <button
                                        type="button"
                                        onClick={() => setScenarioOpen((current) => !current)}
                                        className="flex w-full items-center justify-between px-5 py-4 text-left"
                                    >
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">What-If Tools</div>
                                            <div className="mt-1 text-lg font-semibold text-slate-100">Try different conditions</div>
                                        </div>
                                        <span className="text-slate-400">{scenarioOpen ? '−' : '+'}</span>
                                    </button>
                                    {scenarioOpen ? (
                                        <div className="space-y-5 border-t border-slate-800 px-5 py-5">
                                            <div>
                                                <label className="mb-2 block text-sm font-medium text-slate-200">What if the surrounding air gets hotter?</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="85"
                                                    value={state.scenarioAmbient}
                                                    onChange={(event) => dispatch({ type: 'SET_FIELD', field: 'scenarioAmbient', value: Number(event.target.value) })}
                                                    className="w-full accent-teal-400"
                                                />
                                                <div className="mt-2 flex items-center justify-between text-sm text-slate-400">
                                                    <span>{state.scenarioAmbient}°C air temperature</span>
                                                    <span>Predicted chip temp = {formatNumber(scenarioResults.junctionTemperature, 1)}°C</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="block text-sm font-medium text-slate-200">Maximum allowed thickness for a selected material layer</label>
                                                <select
                                                    value={selectedSolverLayer}
                                                    onChange={(event) => setSelectedSolverLayer(event.target.value)}
                                                    className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 focus:border-amber-400"
                                                >
                                                    {physicalLayerOptions.map((option) => (
                                                        <option key={option.key} value={option.key}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                                                    Thickest this layer can be before the chip exceeds the limit: {formatNumber(maxTimThickness, 3)} mm
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
                                                Maximum device power at the current conditions: <span className="font-semibold text-slate-100">{formatNumber(results.maxAllowablePower, 2)} W</span>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={copySummary}
                                        className="rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-300 hover:bg-amber-400/15"
                                    >
                                        Copy Summary
                                    </button>
                                    {copyStatus ? <span className="text-sm text-slate-400">{copyStatus}</span> : <span className="text-sm text-slate-500">Copy a simple summary for email, chat, or review notes.</span>}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </>
    );
}
