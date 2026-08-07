import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const outputDirectory = join(root, "sdk");
const declarationDirectory = join("/tmp", `kore-sdk-declarations-${process.pid}`);

const bundles = [
	{ name: "engine_sdk", entrypoint: join(root, "src/engine/sdk/index.ts") },
	{ name: "ui_sdk", entrypoint: join(root, "src/engine/ui-sdk/index.ts") },
	{ name: "audio_sdk", entrypoint: join(root, "src/engine/audio-sdk/index.ts") },
	{ name: "presentation_sdk", entrypoint: join(root, "src/engine/presentation-sdk/index.ts") },
	{ name: "kore_sdk", entrypoint: join(root, "src/kore/sdk/index.ts") },
] as const;

const engineDeclaration = `/** Standalone public Engine SDK declaration. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SystemSettings = { systemId: string; schemaVersion: 1; state: Record<string, unknown> };
export interface EngineTransformState { schemaVersion: 1; position: { x: number; y: number }; rotation: number; }
export interface EngineMovementState { schemaVersion: 1; velocity: { x: number; y: number }; angularVelocity: number; enabled: boolean; }
export declare function createTransformState(input: { position: { x: number; y: number }; rotation?: number }): EngineTransformState;
export declare function createMovementState(input: { velocity: { x: number; y: number }; angularVelocity?: number; enabled?: boolean }): EngineMovementState;
export declare function validateTransformState(value: unknown): asserts value is EngineTransformState;
export declare function validateMovementState(value: unknown): asserts value is EngineMovementState;
export declare const MOVEMENT_SET_VELOCITY_EFFECT_ID: "movement.set-velocity";
export declare const MOVEMENT_ADD_VELOCITY_EFFECT_ID: "movement.add-velocity";
export declare const MOVEMENT_SCALE_SPEED_EFFECT_ID: "movement.scale-speed";
export interface MovementVelocityPayload { x: number; y: number; }
export interface MovementScaleSpeedPayload { factor: number; }
export declare const TRANSFORM_CAPABILITY: "transform.state";
export declare const TRANSFORM_SET_POSITION_EFFECT_ID: "transform.set-position";
export declare const TRANSFORM_SET_ROTATION_EFFECT_ID: "transform.set-rotation";
export interface TransformSetPositionPayload { x: number; y: number; }
export interface TransformSetRotationPayload { rotation: number; }
export type EngineEffectSettings = { type: string; schemaVersion?: 1; typeValue: JsonValue };
export interface EngineEffectDefinition {
    id: string;
    schemaVersion?: 1;
    requiresCapability?: readonly string[];
    targetType?: string;
    lifecycleCategory?: string;
    validatePayload?: (payload: JsonValue) => void;
}
export type EngineEffectDescriptor = Omit<EngineEffectDefinition, "validatePayload">;
export interface EngineSystemDefinition {
    id: string;
    schemaVersion?: 1;
    provides?: readonly string[];
    requires?: readonly string[];
    before?: readonly string[];
    after?: readonly string[];
    replaces?: readonly string[];
    optional?: boolean;
    state?: Record<string, JsonValue>;
    acceptsEffects?: readonly string[];
}
export type EngineFrameworkSettings = { schemaVersion: 1; systems: SystemSettings[]; systemOrder: string[] };
export interface EngineWorldSettings {
    schemaVersion: 1;
    id: string;
    worldSize: { x: number; y: number };
    background?: JsonValue;
    entities: JsonValue[];
    structures: JsonValue[];
    effects: JsonValue[];
    framework?: EngineFrameworkSettings;
}
export declare class EngineSystemRegistry {
    register(definition: EngineSystemDefinition): this;
    select(ids: readonly string[]): EngineFrameworkSettings;
    validate(settings: unknown): asserts settings is EngineFrameworkSettings;
    validateEffectSupport(settings: unknown, effects: readonly unknown[], catalog: EngineEffectRegistry): void;
}
export declare class EngineEffectRegistry {
    register(definition: EngineEffectDefinition): this;
    get(id: string): EngineEffectDefinition | undefined;
    validate(effect: unknown): asserts effect is EngineEffectSettings;
    describe(): EngineEffectDescriptor[];
}
export declare function registerMovementCommands(registry: EngineEffectRegistry): EngineEffectRegistry;
export declare function registerTransformEffects(registry: EngineEffectRegistry): EngineEffectRegistry;
export declare class EngineWorldBuilder {
    constructor(id: string, worldSize: { x: number; y: number });
    setBackground(background: JsonValue): this;
    addEntity(entity: JsonValue): this;
    addStructure(structure: JsonValue): this;
    addEffect(effect: JsonValue): this;
    useFramework(framework: EngineFrameworkSettings): this;
    build(): EngineWorldSettings;
    buildJson(space?: number): string;
}
export declare const engine: {
    readonly createWorld: (options: { id: string; worldSize: { x: number; y: number } }) => EngineWorldBuilder;
    readonly createSystemRegistry: () => EngineSystemRegistry;
    readonly createEffectRegistry: () => EngineEffectRegistry;
    readonly createTransformState: typeof createTransformState;
    readonly createMovementState: typeof createMovementState;
    readonly createEntity: <T extends JsonValue>(settings: T) => T;
    readonly createStructure: <T extends JsonValue>(settings: T) => T;
    readonly createEffect: <T extends JsonValue>(settings: T) => T;
    readonly validate: (value: unknown) => asserts value is JsonValue;
    readonly buildJson: (settings: EngineWorldSettings | EngineFrameworkSettings, space?: number) => string;
};
`;

await mkdir(outputDirectory, { recursive: true });
await rm(declarationDirectory, { recursive: true, force: true });
for (const bundle of bundles) {
	await rm(join(outputDirectory, `${bundle.name}.js`), { force: true });
	await rm(join(outputDirectory, `${bundle.name}.d.ts`), { force: true });
}

const declarationBuild = Bun.spawnSync(["npx", "tsc", "--declaration", "--emitDeclarationOnly", "--outDir", declarationDirectory, "-p", "tsconfig.json"], { stdout: "pipe", stderr: "pipe" });
if (declarationBuild.exitCode !== 0) {
	process.stderr.write(new TextDecoder().decode(declarationBuild.stderr));
	process.exit(declarationBuild.exitCode ?? 1);
}

for (const bundle of bundles) {
	const result = await Bun.build({
		entrypoints: [bundle.entrypoint],
		outdir: outputDirectory,
		naming: `${bundle.name}.js`,
		target: "browser",
		format: "esm",
		splitting: false,
		minify: false,
		sourcemap: "none",
	});
	if (!result.success) {
		for (const log of result.logs) console.error(log);
		process.exit(1);
	}
	const runtime = await Bun.file(join(outputDirectory, `${bundle.name}.js`)).text();
	await Bun.write(join(outputDirectory, `${bundle.name}.js`), runtime.replace(/^\/\/ src\/.*\r?\n/gm, "").replaceAll("/src/", "/"));
}

await Bun.write(join(outputDirectory, "engine_sdk.d.ts"), engineDeclaration);

const uiDeclaration = await Bun.file(join(declarationDirectory, "engine/ui-sdk/index.d.ts")).text();
await Bun.write(join(outputDirectory, "ui_sdk.d.ts"), normalizeUiDeclaration(uiDeclaration));

const audioDeclaration = await Bun.file(join(declarationDirectory, "engine/audio-sdk/index.d.ts")).text();
await Bun.write(join(outputDirectory, "audio_sdk.d.ts"), normalizeGenericDeclaration(audioDeclaration, "Audio SDK"));

const presentationDeclaration = await Bun.file(join(declarationDirectory, "engine/presentation-sdk/index.d.ts")).text();
await Bun.write(join(outputDirectory, "presentation_sdk.d.ts"), normalizeGenericDeclaration(presentationDeclaration, "Presentation SDK"));

const koreDeclaration = await Bun.file(join(declarationDirectory, "kore/sdk/index.d.ts")).text();
await Bun.write(join(outputDirectory, "kore_sdk.d.ts"), normalizeKoreDeclaration(koreDeclaration));

await rm(declarationDirectory, { recursive: true, force: true });

function normalizeUiDeclaration(declaration: string): string {
	return `/** Standalone public UI SDK declaration. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type EngineFrameworkSettings = { schemaVersion: 1; systems: Array<{ systemId: string; schemaVersion: 1; state: Record<string, unknown> }>; systemOrder: string[] };
${removeInternalTypeImports(declaration.replace(/^import .*\r?\n/gm, ""))}`;
}

function normalizeGenericDeclaration(declaration: string, label: string): string {
	const imports = new Set<string>();
	for (const line of declaration.match(/^import .*$/gm) ?? []) {
		const match = line.match(/\{(.*)\}/);
		if (!match) continue;
		for (const part of match[1]!.split(",")) {
			const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
			if (/^[A-Za-z_$][\w$]*$/.test(name)) imports.add(name);
		}
	}
	let body = declaration.replace(/^import .*\r?\n/gm, "");
	const aliases = [...imports].map(name => `type ${name} = any;\ndeclare const ${name}: any;`).join("\n");
	return `/** Standalone public ${label} declaration. */\n${aliases}\n${removeInternalTypeImports(body)}`;
}

function normalizeKoreDeclaration(declaration: string): string {
	const imports = new Set<string>();
	for (const line of declaration.match(/^import .*$/gm) ?? []) {
		const match = line.match(/\{(.*)\}/);
		if (!match) continue;
		for (const part of match[1]!.split(",")) {
			const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0];
			if (/^[A-Za-z_$][\w$]*$/.test(name)) imports.add(name);
		}
	}
	let body = declaration
		.replace(/^import .*\r?\n/gm, "")
		.replace(/^export \{.* from .*\r?\n/gm, "")
		.replace(/^export type \{.* from .*\r?\n/gm, "")
		.replace(/^export type \{.*\};\r?\n/gm, "");
	for (const name of imports) body = body.replace(new RegExp(`\\b${name}\\b`, "g"), "any");
	const aliases = [...imports].map(name => `type ${name} = any;\ndeclare const ${name}: any;`).join("\n");
	return `/** Standalone public KORE SDK declaration. */
${aliases}
export type RuntimeItemEffect = any;
export type KoreItemInput = any;
export type KoreGameModeInput = any;
export type KoreMatchDefinition = any;
export type KoreMatchHeader = any;
export type KoreMatchOptions = any;
export type GameSettings = any;
export type ContentPackage = any;
export type LoadedContentPackage = any;
export type MapDocument = any;
export type MapSpawnRegion = any;
export declare function createRuntimeItemEffect(...args: any[]): any;
export declare function resolveRuntimeItemEffects(...args: any[]): any;
export declare function applyRuntimeForceEffects(...args: any[]): any;
export declare function composeItemEffects(...effects: any[]): any;
export declare function createItem(...args: any[]): any;
${removeInternalTypeImports(body)}`;
}

function removeInternalTypeImports(value: string): string {
	return value.replace(/import\("[^"\r\n]+"\)\.[A-Za-z_$][\w$]*/g, "any");
}
