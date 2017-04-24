"use strict";

class Game {
	constructor(state = {}, tps = 30) {
		this.state = state;
		this.TPS = tps;
		this.listeners = {};
	}

	// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget#_Simple_implementation_of_EventTarget
	addEventListener(type, callback) {
		if(!(type in this.listeners)) {
			this.listeners[type] = new Set();
		}

		this.listeners[type].add(callback);
	}

	removeEventListener(type, callback) {
		if(!(type in this.listeners)) {
			return;
		}

		this.listeners[type].delete(callback);

		if(this.listeners[type].size == 0) {
			delete this.listeners[type];
		}
	}

	dispatchEvent(event) {
		if (!(event.type in this.listeners)) {
			return true;
		}

		for(const listener of this.listeners[event.type]) {
			listener.call(this, event);
		}

		return !event.defaultPrevented;
	}

	resumeDraw() {
		this.pauseDraw();
		this.lastDraw = Date.now();

		// draw loop
		const draw = () => {
			const currentDraw = Date.now();
			const dt = currentDraw - this.lastDraw;

			this.dispatchEvent(new CustomEvent("draw", {detail: {dt}}));
			this.lastDraw = currentDraw;
			this.drawId = requestAnimationFrame(draw);
		};

		this.drawId = requestAnimationFrame(draw);
	}

	resumeTick() {
		this.pauseTick();
		this.lastTick = Date.now();

		// tick loop
		this.tickId = setInterval(() => {
			const currentTick = Date.now();
			const dt = currentTick - this.lastTick;

			this.dispatchEvent(new CustomEvent("tick", {detail: {dt}}));
			this.lastTick = currentTick;
		}, 1000 / this.TPS);
	}

	resume() {
		if(this.dispatchEvent(new CustomEvent("resume"))) {
			this.resumeDraw();
			this.resumeTick();
		}
	}

	pauseDraw() {
		cancelAnimationFrame(this.drawId);
	}

	pauseTick() {
		clearInterval(this.tickId);
	}

	pause() {
		if(this.dispatchEvent(new CustomEvent("pause"))) {
			this.pauseDraw();
			this.pauseTick();
		}
	}

	setTPS(tps) {
		this.pauseTick();
		this.TPS = tps;

		if(this.TPS > 0) {
			this.resumeTick();
		}
	}
}
