const EVENT_TYPES = Object.freeze([
  "NODE_ACTIVATED", "NODE_DEACTIVATED", "NODE_TRANSMITTING",
  "TRAFFIC_STARTED", "TRAFFIC_COMPLETED", "REGION_ACTIVITY",
  "COUNTRY_ACTIVITY", "SCAN_STARTED", "SCAN_COMPLETED",
  "NETWORK_SURGE", "COUNTRY_SELECTED", "COUNTRY_UNSELECTED", "VIEW_CHANGED"
]);

function mulberry32(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class EventEngine {
  constructor(bus, stateManager, nodeNetwork, trafficEngine) {
    this.bus = bus;
    this.stateManager = stateManager;
    this.nodeNetwork = nodeNetwork;
    this.trafficEngine = trafficEngine;
    this.random = mulberry32(0xC0FFEE);
    this.counter = 0;
    this.active = [];
    this.nextAmbientAt = 2.2;
    this.reducedMotion = false;
    this.enabled = true;
  }

  setReducedMotion(value) { this.reducedMotion = Boolean(value); }
  setEnabled(value) { this.enabled = Boolean(value); }

  emit(type, { scope = "global", duration = 1, data = {}, startTime = null } = {}) {
    if (!EVENT_TYPES.includes(type)) throw new Error(`EventEngine: type inconnu ${type}`);
    const now = startTime ?? this.stateManager.get().runtime.elapsed;
    const event = {
      id: `evt-${++this.counter}`,
      type,
      scope,
      data,
      startTime: now,
      duration: Math.max(0.05, duration),
      progress: 0,
      completed: false
    };
    this.active.push(event);
    this.apply(event);
    this.bus.emit("event:created", event);
    this.bus.emit(type, event);
    return event;
  }

  apply(event) {
    switch (event.type) {
      case "NODE_ACTIVATED":
      case "NODE_TRANSMITTING":
        this.nodeNetwork.setState(event.data.nodeId, event.type === "NODE_TRANSMITTING" ? "transmitting" : "active", event.duration);
        break;
      case "NODE_DEACTIVATED":
        this.nodeNetwork.setState(event.data.nodeId, "idle", 0);
        break;
      case "TRAFFIC_STARTED":
        this.trafficEngine.startFromEvent(event);
        this.bus.emit("traffic:started", event);
        break;
      case "NETWORK_SURGE":
        this.nodeNetwork.surge(event.duration);
        break;
      default:
        break;
    }
  }

  ambientDelay() {
    const intensity = this.stateManager.get().network.intensity;
    const base = this.reducedMotion ? 7.5 : 3.6;
    const spread = this.reducedMotion ? 4.5 : 4.2;
    return Math.max(2.2, base + this.random() * spread - intensity * 1.2);
  }

  scheduleAmbient(now) {
    const roll = this.random();
    if (roll < 0.66) {
      const route = this.trafficEngine.pickRoute(this.random);
      if (!route) return;
      const duration = this.reducedMotion ? 5.6 : 3.0 + this.random() * 2.2;
      this.emit("TRAFFIC_STARTED", {
        scope: "global",
        duration,
        startTime: now,
        data: { routeId: route.id, from: route.from, to: route.to, intensity: 0.45 + this.random() * 0.45 }
      });
      this.emit("NODE_TRANSMITTING", { scope: "node", duration: Math.min(2.1, duration), startTime: now, data: { nodeId: route.from } });
    } else if (roll < 0.86) {
      const node = this.nodeNetwork.pickNode(this.random, 1);
      if (!node) return;
      const scanDuration = this.reducedMotion ? 4.5 : 2.6 + this.random() * 1.6;
      this.emit("NODE_ACTIVATED", { scope: "node", duration: Math.min(1.8, scanDuration), startTime: now, data: { nodeId: node.id } });
      this.emit("SCAN_STARTED", {
        scope: "node",
        duration: scanDuration,
        startTime: now,
        data: { nodeId: node.id, lat: node.location.lat, lon: node.location.lon, country: node.location.country }
      });
    } else if (roll < 0.97) {
      const node = this.nodeNetwork.pickNode(this.random, 1);
      if (!node) return;
      this.emit("COUNTRY_ACTIVITY", {
        scope: "country",
        duration: 4 + this.random() * 4,
        startTime: now,
        data: { country: node.location.country, strength: 0.35 + this.random() * 0.45 }
      });
    } else {
      this.emit("NETWORK_SURGE", { scope: "global", duration: this.reducedMotion ? 2.5 : 1.6, startTime: now, data: { strength: 0.65 } });
    }
  }

  update() {
    const now = this.stateManager.get().runtime.elapsed;
    for (const event of this.active) {
      event.progress = Math.max(0, Math.min(1, (now - event.startTime) / event.duration));
      if (event.progress >= 1 && !event.completed) {
        event.completed = true;
        if (event.type === "TRAFFIC_STARTED") {
          this.emit("TRAFFIC_COMPLETED", { scope: event.scope, duration: 0.15, startTime: now, data: event.data });
        } else if (event.type === "SCAN_STARTED") {
          this.emit("SCAN_COMPLETED", { scope: event.scope, duration: 0.15, startTime: now, data: event.data });
        } else if (event.type === "NODE_ACTIVATED" || event.type === "NODE_TRANSMITTING") {
          this.emit("NODE_DEACTIVATED", { scope: "node", duration: 0.12, startTime: now, data: { nodeId: event.data.nodeId } });
        }
        this.bus.emit("event:completed", event);
      }
    }
    this.active = this.active.filter((event) => !event.completed || now - event.startTime < event.duration + 0.25);

    if (!this.enabled || now < this.nextAmbientAt) return;
    this.scheduleAmbient(now);
    this.nextAmbientAt = now + this.ambientDelay();
  }

  events(type = null) {
    return type ? this.active.filter((event) => event.type === type && !event.completed) : this.active.filter((event) => !event.completed);
  }

  destroy() { this.active.length = 0; }
}
