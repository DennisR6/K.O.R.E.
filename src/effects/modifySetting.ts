import type { IPhysics, SHAPE } from "../physics/physics.js";
import { EffectType, type Effect, type EffectSettings, type ModifySettingValue, type SettingKey, type SettingValue } from "./types.js";

interface ISettingMutable {
	setSetting(key: SettingKey, value: SettingValue): void;
	addSetting(key: SettingKey, value: SettingValue): void;
	removeSetting(key: SettingKey, value: SettingValue): void;
}

/** A serializable, allowlisted mutation of a runtime player setting. */
export class EffectModifySetting implements Effect {
	private readonly settings: ModifySettingValue

	constructor({ typeValue }: { typeValue: ModifySettingValue }) { this.settings = typeValue }

	public apply(entity: IPhysics<SHAPE>, override?: ModifySettingValue): void {
		if (!isSettingMutable(entity)) return
		const settings = override === undefined ? this.settings : (isModifySettingValue(override) ? override : this.settings)
		if (settings.operation === "add" && settings.key === "hp" && typeof settings.value === "number" && "dispatchNumericAdd" in entity && typeof entity.dispatchNumericAdd === "function") {
			entity.dispatchNumericAdd("hp", settings.value)
			return
		}
		if (settings.operation === "set" && settings.key === "hp" && typeof settings.value === "number" && "dispatchNumericSet" in entity && typeof entity.dispatchNumericSet === "function") {
			entity.dispatchNumericSet("hp", settings.value)
			return
		}
		if (settings.operation === "remove" && settings.key === "hp" && typeof settings.value === "number" && "dispatchNumericAdd" in entity && typeof entity.dispatchNumericAdd === "function") {
			entity.dispatchNumericAdd("hp", -settings.value)
			return
		}
		switch (settings.operation) {
			case "set": entity.setSetting(settings.key, settings.value); break
			case "add": entity.addSetting(settings.key, settings.value); break
			case "remove": entity.removeSetting(settings.key, settings.value); break
		}
	}

	public getType(): EffectType { return EffectType.ModifySetting }
	public toSettings(): EffectSettings {
		return {
			schemaVersion: 1, type: EffectType.ModifySetting,
			typeValue: { ...this.settings },
		}
	}
}

function isModifySettingValue(value: unknown): value is ModifySettingValue {
	return typeof value === "object" && value !== null && "operation" in value && "key" in value && "value" in value;
}

function isSettingMutable(entity: IPhysics<SHAPE>): entity is IPhysics<SHAPE> & ISettingMutable {
	return "setSetting" in entity && "addSetting" in entity && "removeSetting" in entity
}
