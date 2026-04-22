// Zentrales Datenmodell für die Map
export const mapData = {
    name: "",
    background: null,

    screenResolution: { x: 1600, y: 900, factor: 100 },

    mapBoundarys: [],
    holes: [],
    players: [],

    friction: 1.0,
    drift: 0.0,

    items: [],
    effects: [],

    // NEU: Modus
    mode: {
        type: "last_man_standing",
        params: {
            itemsEnabled: true,
            hazardsEnabled: false,
            allowTies: false
        }
    },

    // NEU: AI
    ai: {
        difficulty: "normal",
        aggressiveness: 50,
        riskTaking: 40,
        itemPriority: 50,
        hazardAwareness: 60,
        errorRate: 20
    }
};

// Default-Werte für NEW MAP
export function resetMapData() {
    mapData.name = "";
    mapData.background = null;

    mapData.mapBoundarys = [];
    mapData.holes = [];
    mapData.players = [];

    mapData.friction = 1.0;
    mapData.drift = 0.0;

    mapData.items = [];
    mapData.effects = [];

    // NEU: Mode zurücksetzen
    mapData.mode = {
        type: "last_man_standing",
        params: {
            itemsEnabled: true,
            hazardsEnabled: false,
            allowTies: false
        }
    };

    // NEU: AI zurücksetzen
    mapData.ai = {
        difficulty: "normal",
        aggressiveness: 50,
        riskTaking: 40,
        itemPriority: 50,
        hazardAwareness: 60,
        errorRate: 20
    };
}

