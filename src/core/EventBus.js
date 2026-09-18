export class EventBus {
  constructor() { this.events = new Map(); }
  on(name, handler) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(handler);
    return () => this.off(name, handler);
  }
  off(name, handler) {
    const handlers = this.events.get(name);
    if (!handlers) return;
    handlers.delete(handler);
    if (!handlers.size) this.events.delete(name);
  }
  emit(name, detail) {
    this.events.get(name)?.forEach((handler) => {
      try { handler(detail); } catch (error) { console.error(`[CyberBackground] ${name}`, error); }
    });
  }
  clear() { this.events.clear(); }
}
