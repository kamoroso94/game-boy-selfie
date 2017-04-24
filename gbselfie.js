"use strict";

class GBSelfie {
    constructor() {
    	this.video = null;
    	this.sound = null;
    	this.display = null;
    	this.canvas = null;
    	this.ctx = null;
    	this.draft = null;
    	this.draftCtx = null;
    	this.filterOutput = null;
    	this.shutter = null;
    	this.offsetX = 0;
    	this.offsetY = 0;
    	this.scale = 1;

        // GB colors            grayscale colors
    	this.colors = [
            [ 15,  56,  15],    // [  0,   0,   0],
            [ 48,  98,  48],    // [ 85,  85,  85],
            [139, 172,  15],    // [170, 170, 170],
            [155, 188,  15]     // [255, 255, 255]
        ];

        // 8-bit grayscale to 2-bit monochrome GB,
        // 256 / 4 = 64 = 8 x 8 threshold map
    	this.thresholdMap = [
        	[ 0, 48, 12, 60,  3, 51, 15, 63],
        	[32, 16, 44, 28, 35, 19, 47, 31],
        	[ 8, 56,  4, 52, 11, 59,  7, 55],
        	[40, 24, 36, 20, 43, 27, 39, 23],
        	[ 2, 50, 14, 62,  1, 49, 13, 61],
        	[34, 18, 46, 30, 33, 17, 45, 29],
        	[10, 58,  6, 54,  9, 57,  5, 53],
        	[42, 26, 38, 22, 41, 25, 37, 21]
        ];
    }

	init() {
		const width = 160;
		const height = 144;

		this.initDisplay();

		this.sound = new Audio();
		this.sound.src = `audio/shutter.${this.sound.canPlayType("audio/mpeg") ? "mp3" : "ogg"}`;
		this.sound.preload = "auto";
		this.video = document.querySelector("video");
		this.canvas = document.getElementById("screen");
		this.ctx = this.canvas.getContext("2d");
		this.shutter = document.getElementById("shutter");
		this.draft = document.createElement("canvas");
		this.draft.width = width;
		this.draft.height = height;
		this.draft.style.display = "none";
		this.draftCtx = this.draft.getContext("2d");
        this.alertBox = document.querySelector(".alert");

		this.initVideo(width, height);
	}

	initDisplay() {
		this.display = new Game();

		this.display.addEventListener("draw", (event) => {
			// const {dt} = event.detail;

			if(this.filterOutput != null) {
				this.ctx.putImageData(this.filterOutput, 0, 0);
				this.filterOutput = null;
			}
		});

		this.display.addEventListener("tick", (event) => {
			// const {dt} = event.detail;
            const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
            const intensity = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const mapSide = this.thresholdMap.length;
            const mapSize = mapSide ** 2;
            const colors = this.colors.length;

			this.draftCtx.drawImage(
				this.video,
				this.offsetX,
				this.offsetY,
				10 * this.scale + this.offsetX,
				9 * this.scale + this.offsetY,
				0,
				0,
				this.draft.width,
				this.draft.height
			);
			const input = this.draftCtx.getImageData(
				0,
				0,
				this.draft.width,
				this.draft.height
			);
			const output = this.draftCtx.createImageData(640, 576);

			// imageData
			const width = input.width;
			const height = input.height;
			const pixels = input.data;

			// filter
			for(let i = 0; i < pixels.length; i += 4) {
				const x = i / 4 % width;
				const y = Math.floor(i / 4 / width);
				const threshold = this.thresholdMap[x % mapSide][y % mapSide];
				const gray = intensity(pixels[i + 0], pixels[i + 1], pixels[i + 2]);
                const nearestPixel = clamp(Math.floor(colors * gray / 256 + threshold / mapSize - 0.5), 0, colors - 1);

				for(let k = 0; k < 4; k++) {
					for(let h = 0; h < 4; h++) {
						const j = 16 * x + 64 * width * y + 4 * h + 16 * width * k;
						output.data[j + 0] = this.colors[nearestPixel][0];
						output.data[j + 1] = this.colors[nearestPixel][1];
						output.data[j + 2] = this.colors[nearestPixel][2];
						output.data[j + 3] = 255;
					}
				}
			}

			this.filterOutput = output;
		});
	}

	initVideo(width, height) {
        const constraints = {video: {width, height, facingMode: "user"}};

		if(navigator.mediaDevices) {
			navigator.mediaDevices.getUserMedia(constraints)
                .then((stream) => this.loadVideo(stream))
                .catch((error) => {
    				console.log(error);
    				this.hideWebcam();
    			});
		} else if(navigator.getUserMedia) {
			navigator.getUserMedia(constraints,
                (stream) => this.loadVideo(stream),
                (error) => {
					console.log(error);
					this.hideWebcam();
				});
		} else {
			console.log("getUserMedia() unsupported");
			this.hideWebcam();
		}
	}

	loadVideo(stream) {
		if("srcObject" in this.video) {
			this.video.srcObject = stream;
		} else {
			this.video.src = window.URL.createObjectURL(stream); // throw new Error("video.srcObject unsupported");
		}

		this.video.addEventListener("loadeddata", (event) => {
			document.body.appendChild(this.draft);
            this.alert("success", "Connected!", "Click the camera icon to take a selfie!");

			this.orient();

			this.shutter.style.display = "block";
			this.shutter.addEventListener("click", (event) => {
				const timestamp = Date.now();

				this.display.pause();
				setTimeout(() => {
					this.display.resume();
				}, 500);
				this.sound.currentTime = 0;
				this.sound.play();
				this.shutter.href = this.canvas.toDataURL();
				this.shutter.download = `img${timestamp}`;
			});

            this.shutter.classList.add("active");
            this.display.resume();
		});
	}

	orient() {
		const w = this.video.videoWidth;
		const h = this.video.videoHeight;
		this.scale = Math.min(Math.floor(w / 10), Math.floor(h / 9));
		this.offsetX = Math.floor((w - 10 * this.scale) / 2);
		this.offsetY = Math.floor((h - 9 * this.scale) / 2);
	}

    alert(type, title, message) {
        this.alertBox.classList.remove("alert-success", "alert-warning", "alert-danger");
        this.alertBox.classList.add(`alert-${type}`);
        this.alertBox.innerHTML = `<strong>${title}</strong> ${message}`;
    }

	hideWebcam() {
		this.video.parentNode.removeChild(this.video);
        this.canvas.style.backgroundImage = `url("images/error.png")`;
        this.shutter.classList.remove("active");
        this.display.pause();
        this.alert("danger", "Oops!", "Sorry, but we can't access your webcam!");
	}
}

window.addEventListener("load", (event) => {
    const gbselfie = new GBSelfie();
    gbselfie.init();

    window.addEventListener("orientationchange", gbselfie.orient());
});
