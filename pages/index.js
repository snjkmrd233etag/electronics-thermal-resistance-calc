import { useMemo, useReducer, useState } from 'react';
import Meta from '@/components/Meta';

const MATERIALS = [
    { name: 'Copper', conductivity: 385 },
    { name: 'Aluminum 6061', conductivity: 167 },
    { name: 'Aluminum 1100', conductivity: 222 },
    { name: 'Solder (63/37)', conductivity: 50 },
    { name: 'Thermal Grease', conductivity: 5 },
    { name: 'Thermal Pad', conductivity: 3 },
    { name: 'FR4 PCB (through-plane)', conductivity: 0.3 },
    { name: 'FR4 PCB (in-plane)', conductivity: 0.81 },
    { name: 'Kovar', conductivity: 17 },
    { name: 'Silicon (die)', conductivity: 150 },
    { name: 'Alumina (Al2O3)', conductivity: 25 },
    { name: 'AlN (Aluminum Nitride)', conductivity: 180 },
    { name: 'Indium foil', conductivity: 82 },
    { name: 'Phase Change Material', conductivity: 5 },
];

function createId() {
    return Math.random().toString(36).slice(2, 10);
}

const NAV_SECTIONS = [
    {
        title: 'Thermal Tools',
        items: [
            { label: 'Stack calc', href: 'https://cw-stack-calc.vercel.app/' },
            { label: 'Reliability calc', href: 'https://cw-relicalc.vercel.app/' },
            { label: 'Wire calc', href: 'https://cw-wire-calc.vercel.app/' },
        ],
    },
    {
        title: 'Utility apps',
        items: [
            { label: 'Unit converter', href: 'https://defenseengineeringunitconverter.vercel.app/?category=force&value=100&from=kn&to=lbf&precision=2' },
            { label: 'Earned value', href: 'https://earned-value-management.vercel.app/' },
        ],
    },
];

const THEME_OPTIONS = [
    { label: 'Night', value: 'midnight' },
    { label: 'Daylight', value: 'daylight' },
];

const FLAT_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

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
        materialName: '',
    };
}

function physicalLayer(name, thickness, conductivity, area, materialName = '') {
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
        materialName,
    };
}

function conductionPreset() {
    return [
        directLayer('Die to Case (theta_jc)', 0.5),
        physicalLayer('Thermal Interface Material', 0.25, 3.0, 400, 'Thermal Pad'),
        physicalLayer('Heat Spreader', 2, 385, 600, 'Copper'),
        directLayer('Card-Lock / Wedge-Lock', 0.15),
        directLayer('Cold Plate / Chassis Wall', 0.3),
        directLayer('Chassis to Ambient', 0.5),
    ];
}

function airPreset() {
    return [
        directLayer('Die to Case (theta_jc)', 0.8),
        physicalLayer('Thermal Interface Material', 0.1, 1.5, 300, 'Thermal Grease'),
        directLayer('Heatsink Body', 1.2),
        directLayer('Heatsink to Air', 0.8),
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
        materialName: '',
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
                const width = toNumber(updated.width_mm);
                const height = toNumber(updated.height_mm);
                if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
                    updated.area_mm2 = String(round(width * height, 2));
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
        return { resistance, valid: Number.isFinite(resistance) && resistance > 0 };
    }

    const thickness = toNumber(layer.thickness_mm);
    const conductivity = toNumber(layer.conductivity);
    const area = toNumber(layer.area_mm2);
    const resistance =
        Number.isFinite(thickness) &&
        thickness > 0 &&
        Number.isFinite(conductivity) &&
        conductivity > 0 &&
        Number.isFinite(area) &&
        area > 0
            ? (thickness / 1000) / (conductivity * (area / 1000000))
            : NaN;

    return { resistance, valid: Number.isFinite(resistance) && resistance > 0 };
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
            contributionPct:
                Number.isFinite(totalResistance) && totalResistance > 0
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
        resistanceA > 0 &&
        Number.isFinite(resistanceB) &&
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
                contributionPct:
                    Number.isFinite(pathResistance) && pathResistance > 0
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
        pathA: { totalResistance: resistanceA, power: pathPowerA, layers: breakdownA },
        pathB: { totalResistance: resistanceB, power: pathPowerB, layers: breakdownB },
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
        Number.isFinite(power) &&
        power >= 0 &&
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

function findLayerByKey(state, key) {
    const [chain, id] = key.split(':');
    const source = chain === 'B' ? state.layersB : state.layers;
    return source.find((layer) => layer.id === id) || null;
}

function cloneForSolver(state, selectedLayerKey, nextThickness) {
    const [chain, id] = selectedLayerKey.split(':');
    const key = chain === 'B' ? 'layersB' : 'layers';
    return {
        ...state,
        [key]: state[key].map((layer) => (layer.id === id ? { ...layer, thickness_mm: String(nextThickness) } : layer)),
    };
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

function NumericField({ label, value, onChange, suffix, hint }) {
    return (
        <label className="block">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            <div className="mt-2 flex items-center rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 focus-within:border-amber-300">
                <input
                    type="number"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="w-full bg-transparent text-lg text-slate-50 outline-none"
                />
                <span className="pl-3 text-sm text-slate-400">{suffix}</span>
            </div>
            {hint ? <span className="mt-2 block text-xs text-slate-500">{hint}</span> : null}
        </label>
    );
}

function SegmentControl({ value, onChange, options }) {
    return (
        <div className="inline-flex rounded-full border border-slate-700 bg-slate-950/80 p-1">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                        value === option.value ? 'bg-amber-300 text-slate-950' : 'text-slate-300 hover:text-white'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function ThemeToggle({ value, onChange }) {
    return (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-200">
            {THEME_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                        value === option.value ? 'bg-amber-300/90 text-slate-900' : 'text-slate-400 hover:text-amber-200'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function ToolNav({ sections }) {
    return (
        <div className="space-y-6">
            {sections.map((section) => (
                <div key={section.title}>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{section.title}</div>
                    <div className="mt-2 space-y-2">
                        {section.items.map((item) => (
                            <a
                                key={item.label}
                                href={item.href}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-2xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-300 hover:text-white"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function MetricCard({ label, value, helper }) {
    return (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-50">{value}</div>
            {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
        </div>
    );
}

function SummaryInsights({ results }) {
    const biggestDriver = results.breakdown.reduce(
        (max, layer) => (layer.resistance > (max?.resistance ?? -Infinity) ? layer : max),
        null
    );

    return (
        <div className="space-y-3 text-sm leading-6 text-slate-300">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="font-semibold text-slate-100">Primary takeaway</div>
                <div className="mt-2">
                    {results.valid
                        ? `The stack totals ${formatNumber(results.totalResistance, 2)} C/W and drives the junction to ${formatNumber(results.junctionTemperature, 1)} C.`
                        : 'The calculator needs valid inputs before it can identify the thermal bottleneck.'}
                </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <div className="font-semibold text-slate-100">Most important step</div>
                <div className="mt-2">
                    {biggestDriver
                        ? `${biggestDriver.name || 'Unnamed step'} contributes ${formatNumber(biggestDriver.contributionPct, 1)}% of the total resistance. Improve this first.`
                        : 'No dominant step yet because the stack is incomplete.'}
                </div>
            </div>
            {results.mode === 'parallel' ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                    <div className="font-semibold text-slate-100">Parallel path note</div>
                    <div className="mt-2">
                        Route A carries {formatNumber(results.pathA?.power, 2)} W and Route B carries {formatNumber(results.pathB?.power, 2)} W.
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function LayerEditor({ chain, title, layers, breakdown, dispatch }) {
    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{chain === 'B' ? 'Alternate path' : 'Cooling path'}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-50">{title}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                        Order steps from the chip outward. Use direct resistance for datasheet values or derive it from material and geometry.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => dispatch({ type: 'SET_PRESET', chain, preset: 'conduction' })} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-amber-300 hover:text-white">Chassis preset</button>
                    <button type="button" onClick={() => dispatch({ type: 'SET_PRESET', chain, preset: 'air' })} className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-amber-300 hover:text-white">Air-cooled preset</button>
                    <button type="button" onClick={() => dispatch({ type: 'ADD_LAYER', chain })} className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/15">Add step</button>
                </div>
            </div>

            <div className="mt-5 space-y-3">
                {layers.map((layer, index) => {
                    const result = breakdown.find((item) => item.id === layer.id);

                    return (
                        <details key={layer.id} className="rounded-3xl border border-slate-800 bg-slate-950/65">
                            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3 text-sm font-semibold text-slate-100">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</div>
                                    <div className="font-semibold">{layer.name || 'Unnamed step'}</div>
                                </div>
                                <div className="text-xs text-slate-400">
                                    <span className="block">{layer.mode === 'direct' ? 'Known C/W' : 'From material'}</span>
                                    <span className="mt-1 block">
                                        {result?.valid ? `${formatNumber(result.resistance, 3)} C/W` : 'Complete required inputs'}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            dispatch({ type: 'MOVE_LAYER', chain, from: index, to: index - 1 });
                                        }}
                                        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Move up
                                    </button>
                                    <button
                                        type="button"
                                        disabled={index === layers.length - 1}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            dispatch({ type: 'MOVE_LAYER', chain, from: index, to: index + 1 });
                                        }}
                                        className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Move down
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            dispatch({ type: 'DELETE_LAYER', chain, id: layer.id });
                                        }}
                                        className="rounded-full border border-rose-400/30 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/10"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </summary>

                            <div className="px-4 pb-5 pt-1">
                                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-200">Step name</span>
                                        <input
                                            type="text"
                                            value={layer.name}
                                            onChange={(event) =>
                                                dispatch({
                                                    type: 'UPDATE_LAYER',
                                                    chain,
                                                    id: layer.id,
                                                    patch: { name: event.target.value },
                                                })
                                            }
                                            placeholder="Thermal pad, heatsink, chassis wall, etc."
                                            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-50 outline-none transition focus:border-amber-300"
                                        />
                                    </label>

                                    <div>
                                        <span className="text-sm font-medium text-slate-200">Input method</span>
                                        <div className="mt-2">
                                            <SegmentControl
                                                value={layer.mode}
                                                onChange={(value) =>
                                                    dispatch({
                                                        type: 'UPDATE_LAYER',
                                                        chain,
                                                        id: layer.id,
                                                        patch: { mode: value },
                                                    })
                                                }
                                                options={[
                                                    { value: 'direct', label: 'Known C/W' },
                                                    { value: 'physical', label: 'From material' },
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {layer.mode === 'direct' ? (
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <NumericField
                                            label="Thermal resistance"
                                            value={layer.R_direct}
                                            onChange={(value) =>
                                                dispatch({
                                                    type: 'UPDATE_LAYER',
                                                    chain,
                                                    id: layer.id,
                                                    patch: { R_direct: value },
                                                })
                                            }
                                            suffix="C/W"
                                            hint="Use datasheet or measured interface resistance."
                                        />
                                    </div>
                                ) : (
                                    <div className="mt-4 space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                            <NumericField
                                                label="Thickness"
                                                value={layer.thickness_mm}
                                                onChange={(value) =>
                                                    dispatch({
                                                        type: 'UPDATE_LAYER',
                                                        chain,
                                                        id: layer.id,
                                                        patch: { thickness_mm: value },
                                                    })
                                                }
                                                suffix="mm"
                                            />
                                            <NumericField
                                                label="Conductivity"
                                                value={layer.conductivity}
                                                onChange={(value) =>
                                                    dispatch({
                                                        type: 'UPDATE_LAYER',
                                                        chain,
                                                        id: layer.id,
                                                        patch: { conductivity: value, materialName: '' },
                                                    })
                                                }
                                                suffix="W/m K"
                                            />
                                            <NumericField
                                                label="Area"
                                                value={layer.area_mm2}
                                                onChange={(value) =>
                                                    dispatch({
                                                        type: 'UPDATE_LAYER',
                                                        chain,
                                                        id: layer.id,
                                                        patch: { area_mm2: value },
                                                    })
                                                }
                                                suffix="mm²"
                                            />
                                            <label className="block">
                                                <span className="text-sm font-medium text-slate-200">Common material</span>
                                                <select
                                                    value={layer.materialName}
                                                    onChange={(event) => {
                                                        const material = MATERIALS.find((item) => item.name === event.target.value);
                                                        dispatch({
                                                            type: 'UPDATE_LAYER',
                                                            chain,
                                                            id: layer.id,
                                                            patch: {
                                                                materialName: event.target.value,
                                                                conductivity: material ? String(material.conductivity) : layer.conductivity,
                                                            },
                                                        });
                                                    }}
                                                    className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-50 outline-none transition focus:border-amber-300"
                                                >
                                                    <option value="">Choose material</option>
                                                    {MATERIALS.map((material) => (
                                                        <option key={material.name} value={material.name}>
                                                            {material.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>

                                        <details className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                                            <summary className="cursor-pointer text-sm font-medium text-slate-200">
                                                Optional: derive area from width and height
                                            </summary>
                                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                                <NumericField label="Width" value={layer.width_mm} onChange={(value) => dispatch({ type: 'UPDATE_LAYER', chain, id: layer.id, patch: { width_mm: value } })} suffix="mm" />
                                                <NumericField label="Height" value={layer.height_mm} onChange={(value) => dispatch({ type: 'UPDATE_LAYER', chain, id: layer.id, patch: { height_mm: value } })} suffix="mm" />
                                            </div>
                                        </details>
                                    </div>
                                )}
                            </div>
                        </details>
                    );
                })}
            </div>
        </section>
    );
}

export default function HomePage() {
    const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
    const [selectedSolverLayer, setSelectedSolverLayer] = useState('');
    const [theme, setTheme] = useState('midnight');

    const results = useMemo(() => computeResults(state), [state]);
    const scenarioResults = useMemo(() => computeResults({ ...state, t_ambient: String(state.scenarioAmbient) }), [state]);
    const physicalLayerOptions = useMemo(() => {
        const routes = [
            { prefix: 'A', title: 'Route A', layers: state.layers },
            { prefix: 'B', title: 'Route B', layers: state.layersB },
        ];

        return routes.flatMap((route) =>
            route.layers
                .filter((layer) => layer.mode === 'physical')
                .map((layer) => ({ key: `${route.prefix}:${layer.id}`, label: `${route.title} · ${layer.name || 'Unnamed layer'}` }))
        );
    }, [state.layers, state.layersB]);
    const selectedSolverLayerKey = selectedSolverLayer || physicalLayerOptions[0]?.key || '';
    const maxTimThickness = useMemo(() => solveMaxThickness(state, selectedSolverLayerKey), [selectedSolverLayerKey, state]);
    const mainThemeClass =
        theme === 'midnight'
            ? 'bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] text-slate-100'
            : 'bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_24%),linear-gradient(180deg,_#eef2ff_0%,_#dbeafe_100%)] text-slate-900';

    return (
        <>
            <Meta title="Electronics Thermal Resistance Calculator" description="A focused calculator for checking whether an electronics cooling path stays within thermal limits." />
            <main data-theme={theme} className={`app-theme min-h-screen ${mainThemeClass}`}>
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    <div className="space-y-4">
                        <div className="lg:hidden rounded-[28px] border border-slate-800 bg-slate-900/70 p-4 shadow-xl shadow-slate-950/20">
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">More tools</p>
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                {FLAT_NAV_ITEMS.map((item) => (
                                    <a
                                        key={item.label}
                                        href={item.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-shrink-0 rounded-2xl border border-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-amber-300 hover:text-white"
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </div>
                        </div>
                        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                            <aside className="hidden lg:block">
                                <div className="sticky top-6 space-y-6 rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Workspace links</p>
                                        <p className="mt-1 text-sm text-slate-400">Jump between related calculations without losing context.</p>
                                    </div>
                                    <ToolNav sections={NAV_SECTIONS} />
                                </div>
                            </aside>
                            <div className="space-y-6">
                    <header className="rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_24%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.98))] px-6 py-7 shadow-2xl shadow-slate-950/20 sm:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-3">
                                <p className="text-xs uppercase tracking-[0.28em] text-amber-300">Thermal check</p>
                                <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">Electronics Thermal Resistance Calculator</h1>
                                <p className="max-w-3xl text-base leading-7 text-slate-300">This page keeps the focus on one goal: define the cooling path and see whether the junction stays within limit.</p>
                            </div>
                            <ThemeToggle value={theme} onChange={setTheme} />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">1</div>
                                <div className="mt-2 text-sm text-slate-200">Enter power, ambient, and max junction.</div>
                            </div>
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">2</div>
                                <div className="mt-2 text-sm text-slate-200">Build one route, or two if heat splits.</div>
                            </div>
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4">
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">3</div>
                                <div className="mt-2 text-sm text-slate-200">Read the verdict and fix the biggest bottleneck first.</div>
                            </div>
                        </div>
                    </header>

                    <section className="mt-6 rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-5">
                            <div>
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Operating point</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-50">Core inputs</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">These three values define the thermal problem. The rest is just the path the heat takes to ambient.</p>
                            </div>
                            <div>
                                <span className="mb-2 block text-sm font-medium text-slate-200">Cooling layout</span>
                                <SegmentControl value={state.parallelMode ? 'parallel' : 'single'} onChange={(value) => dispatch({ type: 'TOGGLE_PARALLEL', value: value === 'parallel' })} options={[{ value: 'single', label: 'One route' }, { value: 'parallel', label: 'Two routes' }]} />
                            </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                            <NumericField label="Power dissipated" value={state.power_W} onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'power_W', value })} suffix="W" hint="Use actual heat dissipation." />
                            <NumericField
                                label="Ambient temperature"
                                value={state.t_ambient}
                                onChange={(value) => {
                                    dispatch({ type: 'SET_FIELD', field: 't_ambient', value });
                                    const ambientValue = toNumber(value);
                                    if (Number.isFinite(ambientValue)) {
                                        dispatch({ type: 'SET_FIELD', field: 'scenarioAmbient', value: ambientValue });
                                    }
                                }}
                                suffix="C"
                                hint="Temperature around the assembly."
                            />
                            <NumericField label="Max junction temperature" value={state.t_j_max} onChange={(value) => dispatch({ type: 'SET_FIELD', field: 't_j_max', value })} suffix="C" hint="Usually from the device datasheet." />
                        </div>
                    </section>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
                        <div className="space-y-6">
                            <LayerEditor chain="A" title={state.parallelMode ? 'Cooling route A' : 'Cooling route'} layers={state.layers} breakdown={state.parallelMode ? results.pathA?.layers || [] : results.breakdown} dispatch={dispatch} />
                            {state.parallelMode ? <LayerEditor chain="B" title="Cooling route B" layers={state.layersB} breakdown={results.pathB?.layers || []} dispatch={dispatch} /> : null}
                        </div>

                        <aside className="space-y-5 xl:sticky xl:top-6">
                            <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
                                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Result</p>
                                <h2 className="mt-2 text-2xl font-semibold text-slate-50">{results.valid && results.thermalMargin >= 0 ? 'Pass' : 'Needs work'}</h2>
                                <p className={`mt-3 rounded-2xl border px-4 py-4 text-sm leading-6 ${results.valid && results.thermalMargin >= 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}>
                                    {results.valid
                                        ? results.thermalMargin >= 0
                                            ? `Predicted junction is ${formatNumber(results.junctionTemperature, 1)} C with ${formatNumber(results.thermalMargin, 1)} C of margin.`
                                            : `Predicted junction is ${formatNumber(results.junctionTemperature, 1)} C, which is ${formatNumber(Math.abs(results.thermalMargin), 1)} C over limit.`
                                        : 'Complete all required numeric fields to calculate the thermal result.'}
                                </p>

                                <div className="mt-5 grid gap-3">
                                    <MetricCard label="Predicted junction" value={`${formatNumber(results.junctionTemperature, 1)} C`} />
                                    <MetricCard label="Safety margin" value={`${formatSigned(results.thermalMargin, 1)} C`} />
                                    <MetricCard label="Total resistance" value={`${formatNumber(results.totalResistance, 2)} C/W`} />
                                    <MetricCard label="Max allowable power" value={`${formatNumber(results.maxAllowablePower, 2)} W`} />
                                    {results.mode === 'parallel' ? (
                                        <>
                                            <MetricCard label="Route A" value={`${formatNumber(results.pathA?.totalResistance, 2)} C/W`} helper={`${formatNumber(results.pathA?.power, 2)} W through path`} />
                                            <MetricCard label="Route B" value={`${formatNumber(results.pathB?.totalResistance, 2)} C/W`} helper={`${formatNumber(results.pathB?.power, 2)} W through path`} />
                                        </>
                                    ) : null}
                                </div>
                            </div>

                            <details className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20" open>
                                <summary className="cursor-pointer text-lg font-semibold text-slate-100">Why it passes or fails</summary>
                                <div className="mt-5"><SummaryInsights results={results} /></div>
                            </details>

                            <details className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
                                <summary className="cursor-pointer text-lg font-semibold text-slate-100">Advanced checks</summary>
                                <div className="mt-5 space-y-5">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                        <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Hotter ambient</div>
                                        <input type="range" min="0" max="85" value={state.scenarioAmbient} onChange={(event) => dispatch({ type: 'SET_FIELD', field: 'scenarioAmbient', value: Number(event.target.value) })} className="mt-4 w-full accent-amber-300" />
                                        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-300">
                                            <span>{state.scenarioAmbient} C ambient</span>
                                            <span>{formatNumber(scenarioResults.junctionTemperature, 1)} C junction</span>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                                        <label className="block">
                                            <span className="text-sm font-medium text-slate-200">Thickness limit for a physical layer</span>
                                            <select value={selectedSolverLayerKey} onChange={(event) => setSelectedSolverLayer(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-50 outline-none transition focus:border-amber-300">
                                                {physicalLayerOptions.map((option) => (
                                                    <option key={option.key} value={option.key}>{option.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
                                            Maximum thickness before exceeding the current junction limit: {formatNumber(maxTimThickness, 3)} mm
                                        </div>
                                    </div>
                                </div>
                            </details>

                            <details className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/20">
                                <summary className="cursor-pointer text-lg font-semibold text-slate-100">Detailed breakdown</summary>
                                <div className="mt-5 overflow-hidden rounded-3xl border border-slate-800">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-950/80 text-xs uppercase tracking-[0.18em] text-slate-500">
                                            <tr>
                                                <th className="px-4 py-3">Step</th>
                                                <th className="px-4 py-3">Resistance</th>
                                                <th className="px-4 py-3">Share</th>
                                                <th className="px-4 py-3">Temp in</th>
                                                <th className="px-4 py-3">Temp out</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.breakdown.map((layer) => (
                                                <tr key={`${layer.pathLabel || 'A'}-${layer.id}`} className="border-t border-slate-800">
                                                    <td className="px-4 py-3 text-slate-200">{layer.pathLabel ? `${layer.pathLabel}: ` : ''}{layer.name || 'Unnamed step'}</td>
                                                    <td className="px-4 py-3 text-slate-300">{formatNumber(layer.resistance, 3)}</td>
                                                    <td className="px-4 py-3 text-slate-300">{formatNumber(layer.contributionPct, 1)}%</td>
                                                    <td className="px-4 py-3 text-slate-300">{formatNumber(layer.tIn, 1)} C</td>
                                                    <td className="px-4 py-3 text-slate-300">{formatNumber(layer.tOut, 1)} C</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </details>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    </div>
            </main>
        </>
    );
}
