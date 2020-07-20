var currentEyeData = {
    isPupilVisible: false,
    eyeWidth: 0,
    eyeHeight: 0,
    left : {
        x : null,
        y: null
    },
    right :  {
        x : null,
        y: null
    },
    facePosition:  {
        x : null,
        y: null
    }
};
var isLibLoaded = false;
const videoWidth = 320;
const videoHeight = 240;
var videoHz = 60;

(function(window) {
    'use strict';

    window.webgazer = window.webgazer || {};
    webgazer.tracker = webgazer.tracker || {};
    webgazer.util = webgazer.util || {};
    webgazer.params = webgazer.params || {};

    /**
     * Constructor of EyevidoClmtrackr,
     * A replica of Clmtrackr using Pico data
     * initialize EyevidoClmtrackr object
     * @constructor
     */
    var EyevidoClmtrackr = function() {
        var F = [ [1, 0, 0, 0, 1, 0],
            [0, 1, 0, 0, 0, 1],
            [0, 0, 1, 0, 1, 0],
            [0, 0, 0, 1, 0, 1],
            [0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1]];
        //Parameters Q and R may require some fine tuning
        var Q = [ [1/4,  0, 0, 0,  1/2,   0],
            [0, 1/4,  0, 0,    0, 1/2],
            [0, 0,   1/4, 0, 1/2,   0],
            [0, 0,   0,  1/4,  0, 1/2],
            [1/2, 0, 1/2, 0,    1,  0],
            [0, 1/2,  0,  1/2,  0,  1]];// * delta_t
        var delta_t = 1/10; // The amount of time between frames
        Q = numeric.mul(Q, delta_t);
        var H = [ [1, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 0]];
        var pixel_error = 6.5; //We will need to fine tune this value
        //This matrix represents the expected measurement error
        var R = numeric.mul(numeric.identity(4), pixel_error);

        var P_initial = numeric.mul(numeric.identity(6), 0.0001); //Initial covariance matrix
        var x_initial = [[200], [150], [250], [180], [0], [0]]; // Initial measurement matrix

        this.leftKalman = new self.webgazer.util.KalmanFilter(F, H, Q, R, P_initial, x_initial);
        this.rightKalman = new self.webgazer.util.KalmanFilter(F, H, Q, R, P_initial, x_initial);
    };

    webgazer.tracker.EyevidoClmtrackr = EyevidoClmtrackr;

    /**
     * Isolates the two patches that correspond to the user's eyes
     * @param  {Canvas} imageCanvas - canvas corresponding to the webcam stream
     * @param  {Number} width - of imageCanvas
     * @param  {Number} height - of imageCanvas
     * @return {Object} the two eye-patches, first left, then right eye
     */
    EyevidoClmtrackr.prototype.getEyePatches = function(imageCanvas, width, height) {

        var leftOriginX = (currentEyeData.left.x-currentEyeData.eyeWidth/2);
        var leftOriginY = (currentEyeData.left.y-currentEyeData.eyeHeight/2);
        var leftWidth = currentEyeData.eyeWidth;
        var leftHeight = currentEyeData.eyeHeight;
        var rightOriginX = (currentEyeData.right.x-currentEyeData.eyeWidth/2);
        var rightOriginY = (currentEyeData.right.y-currentEyeData.eyeHeight/2);
        var rightWidth = currentEyeData.eyeWidth;
        var rightHeight = currentEyeData.eyeHeight;

        //Apply Kalman Filtering
        var leftBox = [leftOriginX, leftOriginY, leftOriginX + leftWidth, leftOriginY + leftHeight];
        if (webgazer.params.smoothEyeBB){
            leftBox = this.leftKalman.update(leftBox);
        }
        leftOriginX = Math.round(leftBox[0]);
        leftOriginY = Math.round(leftBox[1]);
        leftWidth = Math.round(leftBox[2] - leftBox[0]);
        leftHeight = Math.round(leftBox[3] - leftBox[1]);

        //Apply Kalman Filtering
        var rightBox = [rightOriginX, rightOriginY, rightOriginX + rightWidth, rightOriginY + rightHeight];
        if (webgazer.params.smoothEyeBB){
            rightBox = this.rightKalman.update(rightBox);
        }
        rightOriginX = Math.round(rightBox[0]);
        rightOriginY = Math.round(rightBox[1]);
        rightWidth = Math.round(rightBox[2] - rightBox[0]);
        rightHeight = Math.round(rightBox[3] - rightBox[1]);

        if (leftWidth === 0 || rightWidth === 0){
            //console.log('an eye patch had zero width');
            return null;
        }

        if (leftHeight === 0 || rightHeight === 0){
            //console.log('an eye patch had zero height');
            return null;
        }

        var eyeObjs = {};
        // eyeObjs.positions = positions;

        var leftImageData = imageCanvas.getContext('2d').getImageData(leftOriginX, leftOriginY, leftWidth, leftHeight);
        eyeObjs.left = {
            patch: leftImageData,
            imagex: leftOriginX,
            imagey: leftOriginY,
            width: leftWidth,
            height: leftHeight
        };

        var rightImageData = imageCanvas.getContext('2d').getImageData(rightOriginX, rightOriginY, rightWidth, rightHeight);
        eyeObjs.right = {
            patch: rightImageData,
            imagex: rightOriginX,
            imagey: rightOriginY,
            width: rightWidth,
            height: rightHeight
        };

        return eyeObjs;
    };

    /**
     * Reset the tracker to default values
     */
    EyevidoClmtrackr.prototype.reset = function(){
    };

    /**
     * The Js_objectdetectGaze object name
     * @type {string}
     */
    EyevidoClmtrackr.prototype.name = 'eyevidoClmtrackr';

}(window));

function initEyevidoClmtrackrLoop() {
    if (isLibLoaded)
        return;

    /*
        (1) initialize the pico.js face detector
    */
    var update_memory = pico.instantiate_detection_memory(5); // we will use the detecions of the last 5 frames
    var facefinder_classify_region = function (r, c, s, pixels, ldim) {
        return -1.0;
    };

    var serverName = window.location.pathname.split("/")[1];
    var cascadeurl = new URL(serverName+'/js/webcam/data/facefinder', window.location.origin);
    fetch(cascadeurl).then(function (response) {
        response.arrayBuffer().then(function (buffer) {
            var bytes = new Int8Array(buffer);
            facefinder_classify_region = pico.unpack_cascade(bytes);
            console.log('* facefinder loaded');
        })
    });
    /*
        (2) initialize the lploc.js library with a pupil localizer
    */
    var do_puploc = function (r, c, s, nperturbs, pixels, nrows, ncols, ldim) {
        return [-1.0, -1.0];
    };
    //var puplocurl = '../puploc.bin';
    var puplocurl = new URL(serverName+'/js/webcam/data/puploc.bin', window.location.origin);
    fetch(puplocurl).then(function (response) {
        response.arrayBuffer().then(function (buffer) {
            var bytes = new Int8Array(buffer);
            do_puploc = lploc.unpack_localizer(bytes);
            console.log('* puploc loaded');
        })
    });

    /*
        (3) get the drawing context on the canvas and define a function to transform an RGBA image to grayscale
    */

    function rgba_to_grayscale(rgba, nrows, ncols) {
        var gray = new Uint8Array(nrows * ncols);
        for (var r = 0; r < nrows; ++r)
            for (var c = 0; c < ncols; ++c)
                // gray = 0.2*red + 0.7*green + 0.1*blue
                gray[r * ncols + c] = (2 * rgba[r * 4 * ncols + 4 * c + 0] + 7 * rgba[r * 4 * ncols + 4 * c + 1] + 1 * rgba[r * 4 * ncols + 4 * c + 2]) / 10;
        return gray;
    }

    // canvas to draw pupils on
    var faceCanvas = document.getElementById('webgazerFaceOverlay');
    var faceCtx = faceCanvas.getContext('2d');
    var width = videoWidth;
    var height = videoHeight;
    // video frame
    var ctx = document.getElementById('webgazerVideoCanvas').getContext('2d');

    var invisiblePupilCounter = 0;
    const invisiblePupilThreshold = 20;

    /*
        (4) this function is called each time a video frame becomes available
    */
    var picoDetection = function () {
        // render the video frame to the canvas element and extract RGBA pixel data
        var rgba = ctx.getImageData(0.2 * width, 0.2 * height, 0.6 * width, 0.6 * height).data;

        // prepare input to `run_cascade`
        image = {
            "pixels": rgba_to_grayscale(rgba, 0.6 * height, 0.6 * width),
            "nrows": 0.6 * height,
            "ncols": 0.6 * width,
            "ldim": 0.6 * width
        };
        params = {
            "shiftfactor": 0.1, // move the detection window by 10% of its size
            "minsize": 100,     // minimum size of a face
            "maxsize": 1000,    // maximum size of a face
            "scalefactor": 1.1  // for multiscale processing: resize the detection window by 10% when moving to the higher scale
        };
        // run the cascade over the frame and cluster the obtained detections
        // dets is an array that contains (r, c, s, q) quadruplets
        // (representing row, column, scale and detection score)
        dets = pico.run_cascade(image, facefinder_classify_region, params);
        dets = update_memory(dets);
        dets = pico.cluster_detections(dets, 0.2); // set IoU threshold to 0.2

        if(dets.length < 1) {
            invisiblePupilCounter++;
            if(invisiblePupilCounter > invisiblePupilThreshold)
                currentEyeData.isPupilVisible = false;
        }

        faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
        // draw detections
        for (i = 0; i < dets.length; ++i)
            // check the detection score
            // if it's above the threshold, draw it
            // (the constant 50.0 is empirical: other cascades might require a different one)
            if (dets[i][3] > 50.0) {
                var r, c, s;
                var rl, cl, rr, cr;
                //
                // find the eye pupils for each detected face
                // starting regions for localization are initialized based on the face bounding box
                // (parameters are set empirically)
                // first eye
                r = dets[i][0] - 0.075 * dets[i][2];
                c = dets[i][1] - 0.175 * dets[i][2];
                s = 0.35 * dets[i][2];
                [rl, cl] = do_puploc(r, c, s, 63, image)
                rl += 0.2 * height;
                cl += 0.2 * width;
                if (rl >= 0 && cl >= 0) {
                    faceCtx.beginPath();
                    faceCtx.arc(cl, rl, 2, 0, 2 * Math.PI, false);
                    faceCtx.lineWidth = 3;
                    faceCtx.strokeStyle = 'green';
                    faceCtx.stroke();
                }
                // second eye
                r = dets[i][0] - 0.075 * dets[i][2];
                c = dets[i][1] + 0.175 * dets[i][2];
                s = 0.35 * dets[i][2];
                [rr, cr] = do_puploc(r, c, s, 63, image)
                rr += 0.2 * height;
                cr += 0.2 * width;
                if (rr >= 0 && cr >= 0) {
                    faceCtx.beginPath();
                    faceCtx.arc(cr, rr, 2, 0, 2 * Math.PI, false);
                    faceCtx.lineWidth = 3;
                    faceCtx.strokeStyle = 'green';
                    faceCtx.stroke();
                }

                // TODO
                currentEyeData.isPupilVisible = true;
                currentEyeData.facePosition.x = dets[i][1];
                currentEyeData.facePosition.y = dets[i][0];
                currentEyeData.eyeWidth = (cr - cl) * 1 / 2;
                currentEyeData.eyeHeight = currentEyeData.eyeWidth * 1 / 2;

                currentEyeData.left.x = cl;
                currentEyeData.left.y = rl;
                currentEyeData.right.x = cr;
                currentEyeData.right.y = rr;

                invisiblePupilCounter = 0;
            }
    };

    /*
        (5) instantiate camera handling (see https://github.com/cbrandolino/camvas)
    */

    var picoDetectionLoop = function () {
        picoDetection();
        requestAnimationFrame(picoDetectionLoop);
    };
    picoDetectionLoop();

    /*
        (6) it seems that everything went well
    */
    isLibLoaded = true;
}
