"use strict";
//MediaStream: onended, oninactive, onactive :)
var GBSelfie = {
    localMediaStream: null,
    video: null,
    sound: null,
    canvas: null,
    ctx: null,
    draft: null,
    draftCtx: null,
	filterOutput: null,
    alertBox: null,
    shutter: null,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    drawId: 0,
    tickId: 0,
    colors: [
         15, 56, 15,
         48, 98, 48,
        139,172, 15,
        155,188, 15
    ],
    thresholdMap4x4: [
        [ 1, 9, 3,11],
        [13, 5,15, 7],
        [ 4,12, 2,10],
        [16, 8,14, 6]
    ],
    init: function() {
        GBSelfie.sound = new Audio();
        if(GBSelfie.sound.canPlayType("audio/mpeg")) {
            GBSelfie.sound.src = "audio/shutter.mp3";
        } else {
            GBSelfie.sound.src = "audio/shutter.ogg";
        }
        GBSelfie.sound.preload = "auto";
        GBSelfie.video = document.querySelector("video");
        GBSelfie.canvas = document.getElementById("screen");
        GBSelfie.ctx = GBSelfie.canvas.getContext("2d");
        GBSelfie.shutter = document.getElementById("shutter");
        GBSelfie.draft = document.createElement("canvas");
        GBSelfie.draft.width = 160;
        GBSelfie.draft.height = 144;
        GBSelfie.draft.style.display = "none";
        GBSelfie.draftCtx = GBSelfie.draft.getContext("2d");
        GBSelfie.alertBox = document.querySelector(".alert");
		
		if(navigator.getUserMedia) {
			navigator.getUserMedia(
				{video:{width:640,height:576,facingMode:"user"}},
				GBSelfie.load,
				function(e) {
					console.log(e);
					GBSelfie.hideWebcam();
				}
			);
		} else {
			console.log("getUserMedia() unsupported");
			GBSelfie.hideWebcam();
		}
    },
    load: function(stream) {
        GBSelfie.video.src = window.URL.createObjectURL(stream);
        GBSelfie.localMediaStream = stream;
        GBSelfie.video.addEventListener("loadeddata",function() {
            document.body.appendChild(GBSelfie.draft);
            GBSelfie.alertBox.className = GBSelfie.alertBox.className.replace(/alert-\w+/,"alert-success");
            GBSelfie.alertBox.innerHTML = "<strong>Connected!</strong> Click the camera icon to take a selfie!";
			
            GBSelfie.orient();
            
            GBSelfie.drawId = requestAnimationFrame(GBSelfie.draw);
			GBSelfie.tickId = setTimeout(GBSelfie.tick,1000/60);
            GBSelfie.shutter.style.display = "block";
            GBSelfie.shutter.addEventListener("click",function() {
                var timestamp = Date.now();
                cancelAnimationFrame(GBSelfie.drawId);
				clearTimeout(GBSelfie.tick);
                setTimeout(function() {
                    GBSelfie.drawId = requestAnimationFrame(GBSelfie.draw);
					GBSelfie.tickId = setTimeout(GBSelfie.tick,1000/60);
                },500);
                GBSelfie.sound.currentTime = 0;
                GBSelfie.sound.play();
                this.href = GBSelfie.canvas.toDataURL();
                this.download = "img"+timestamp+".png";
            });
        });
    },
    tick: function() {
		GBSelfie.tickId = setTimeout(GBSelfie.tick,1000/60);
        GBSelfie.draftCtx.drawImage(
            GBSelfie.video,
            GBSelfie.offsetX,
            GBSelfie.offsetY,
            10*GBSelfie.scale+GBSelfie.offsetX,
            9*GBSelfie.scale+GBSelfie.offsetY,
            0,
            0,
            GBSelfie.draft.width,
            GBSelfie.draft.height
        );
        var input = GBSelfie.draftCtx.getImageData(
            0,
            0,
            GBSelfie.draft.width,
            GBSelfie.draft.height
        );
        var output = GBSelfie.draftCtx.createImageData(640,576);
        
        // imageData
        var width = input.width;
        var height = input.height;
        var pixel = input.data;

        // filter
        for(var i=0; i<pixel.length; i+=4) {
            var x = i/4%width;
            var y = Math.floor(i/4/width);
            var map = GBSelfie.thresholdMap4x4[x%4][y%4];
            
            var gray = Math.floor(0.2126*pixel[i+0]+0.7152*pixel[i+1]+0.0722*pixel[i+2]);
            var oldPixel = gray+gray*map/17;
            var newPixel = Math.max(0,Math.min(3,Math.floor(oldPixel*3/255)));
            
            for(var k=0; k<4; k++) {
                for(var h=0; h<4; h++) {
                    var j = 16*x+64*width*y+4*h+16*width*k;
                    output.data[j+0] = GBSelfie.colors[3*newPixel+0];
                    output.data[j+1] = GBSelfie.colors[3*newPixel+1];
                    output.data[j+2] = GBSelfie.colors[3*newPixel+2];
                    output.data[j+3] = 255;
                }
            }
        }
		GBSelfie.filterOutput = output;
	},
	draw: function(timestamp) {
        GBSelfie.drawId = requestAnimationFrame(GBSelfie.draw);
		if(GBSelfie.filterOutput) {
			GBSelfie.ctx.putImageData(GBSelfie.filterOutput,0,0);
		}
    },
    orient: function() {
        var w = GBSelfie.video.videoWidth;
        var h = GBSelfie.video.videoHeight;
        GBSelfie.scale = Math.min(Math.floor(w/10),Math.floor(h/9));
        GBSelfie.offsetX = Math.floor((w-10*GBSelfie.scale)/2);
        GBSelfie.offsetY = Math.floor((h-9*GBSelfie.scale)/2);
    },
    hideWebcam: function() {
        if(GBSelfie.video) {
            GBSelfie.video.parentNode.removeChild(GBSelfie.video);
            GBSelfie.video = null;
            GBSelfie.draft = null;
			GBSelfie.canvas.style.backgroundImage = "url(\"images/nowebcam.png\")";
        }
        GBSelfie.alertBox.className = GBSelfie.alertBox.className.replace(/alert-\w+/,"alert-danger");
        GBSelfie.alertBox.innerHTML = "<strong>Oops!</strong> Sorry, but we can't access your webcam!";
    }
};
navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

window.addEventListener("orientationchange",GBSelfie.orient);

window.addEventListener("load",GBSelfie.init);