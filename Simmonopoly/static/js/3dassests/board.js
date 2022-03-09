import * as THREE from "three.js"

class BoardController {

    constructor(options) {
        this.containerEl = options.containerEl;
        this.assetsUrl = options.assetsUrl;

        this.board = new Board();
        this.players = [];
    }

    drawBoard(callback) {
        this.initEngine();
        this.initLights();
        this.initMaterials();

        this.initObjects(() => {
            this.onAnimationFrame();

            callback();
        });
    }

    drawPlayers(number, initPos) {
        let promiseList = [];
        return new Promise((resolve => {
            for (let i = 0; i < number; i++) {
                let player = new Player({
                    index: i,
                    modelUrl: `${this.assetsUrl}/players/${i}/model.json`,
                    scene: this.scene,
                    initTileId: initPos[i],
                    initPos: this.boardToWorld({
                        tileId: initPos[i],
                        type: BoardController.MODEL_PLAYER,
                        total: number,
                        index: i
                    }),
                });

                this.board.updateTileInfo(initPos[i], {
                    type: BoardController.MODEL_PLAYER,
                    action: "add",
                    playerIndex: i
                });
                this.players.push(player);
                promiseList.push(player.load());
            }

            Promise.all(promiseList).then(() => {
                resolve();
            })
        }))
    }

    movePlayer(index, newTileId) {
        let currTileId = this.players[index].getTileId();
        console.log("index and new tile id is: " + currTileId.toString() + " " + newTileId.toString());

        // Remove previous player position
        this.board.updateTileInfo(currTileId, {
            type: BoardController.MODEL_PLAYER,
            action: "remove",
            playerIndex: index
        });

        // Register new player position
        this.board.updateTileInfo(newTileId, {
            type: BoardController.MODEL_PLAYER,
            action: "add",
            playerIndex: index
        });

        // Animation: move the player
        return new Promise((resolve => {
            let playerMovementInterval = setInterval(() => {
                currTileId += 1;
                currTileId %= BoardController.TILE_MAX + 1;
                const tileInfo = this.board.getTileInfo(currTileId);
                const tilePlayerCount = tileInfo.players.reduce((a, b) => a + b, 0);

                this.players[index].advanceTo(currTileId, this.boardToWorld({
                    tileId: currTileId,
                    type: BoardController.MODEL_PLAYER,
                    total: tilePlayerCount + 1,
                    index: tilePlayerCount
                }));

                if (currTileId === newTileId) {
                    clearInterval(playerMovementInterval);
                    resolve();
                }
            }, 200);
        }));
    }

    addProperty(type, tileId) {
        let tileInfo = this.board.getTileInfo(tileId);
        const tilePropertyCount = tileInfo.propertyManager.getPropertyCount();

        if (type === PropertyManager.PROPERTY_HOUSE) {
            tileInfo.propertyManager.buildHouse(this.boardToWorld({
                tileId: tileId,
                type: BoardController.MODEL_PROPERTY,
                total: tilePropertyCount + 2
            }), tileId);
        } else if (type === PropertyManager.PROPERTY_HOTEL) {
            tileInfo.propertyManager.buildHotel(this.boardToWorld({
                tileId: tileId,
                type: BoardController.MODEL_PROPERTY,
                total: 2
            }), tileId);
        }
    }

    addLandMark(playerIndex, tileId) {
        let tileInfo = this.board.getTileInfo(tileId);
        this.board.updateTileInfo(tileId, {
            type: BoardController.MODEL_PROPERTY,
            options: {
                loadedHouseJson: this.houseModelJson,
                loadedHotelJson: this.hotelModelJson,
                scene: this.scene
            }
        });

        tileInfo.propertyManager.buyLand(this.boardToWorld({
            tileId: tileId,
            type: BoardController.MODEL_PROPERTY,
            total: 1
        }), tileId, playerIndex);
    }

    initEngine() {
        let viewWidth = this.containerEl.offsetWidth;
        let viewHeight = this.containerEl.offsetHeight;

        // instantiate the WebGL this.renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(viewWidth, viewHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        // create the this.scene
        this.scene = new THREE.Scene();

        // create this.c thisamera
        this.camera = new THREE.PerspectiveCamera(25, viewWidth / viewHeight, 1, 1000);
        this.camera.position.set(BoardController.SQUARE_SIZE * Board.SIZE / 2, 100, 160);
        this.cameraController = new THREE.OrbitControls(this.camera, this.containerEl);
        this.cameraController.center = new THREE.Vector3(BoardController.SQUARE_SIZE * Board.SIZE / 2, -6, BoardController.SQUARE_SIZE * Board.SIZE / 2);

        this.scene.add(this.camera);

        this.containerEl.appendChild(this.renderer.domElement);
    }

    initLights() {
        this.lights = {};

        // top light
        this.lights.topLight = new THREE.PointLight();
        this.lights.topLight.position.set(BoardController.SQUARE_SIZE * Board.SIZE / 2, 150, BoardController.SQUARE_SIZE * Board.SIZE / 2);
        this.lights.topLight.intensity = 0.4;

        // white's side light
        this.lights.whiteSideLight = new THREE.SpotLight();
        this.lights.whiteSideLight.position.set(BoardController.SQUARE_SIZE * Board.SIZE / 2, 100, BoardController.SQUARE_SIZE * Board.SIZE / 2 - 300);
        this.lights.whiteSideLight.intensity = 1;
        this.lights.whiteSideLight.shadow.camera.Fov = 55;

        // black's side light
        this.lights.blackSideLight = new THREE.SpotLight();
        this.lights.blackSideLight.position.set(BoardController.SQUARE_SIZE * Board.SIZE / 2, 100, BoardController.SQUARE_SIZE * Board.SIZE / 2 + 300);
        this.lights.blackSideLight.intensity = 1;
        this.lights.blackSideLight.shadow.camera.Fov = 55;

        // light that will follow the this.camera position
        this.lights.movingLight = new THREE.PointLight(0xf9edc9);
        this.lights.movingLight.position.set(0, 20, 0);
        this.lights.movingLight.intensity = 0.5;
        this.lights.movingLight.distance = 500;

        // add the this.lights in the this.scene
        this.scene.add(this.lights.topLight);
        this.scene.add(this.lights.whiteSideLight);
        this.scene.add(this.lights.blackSideLight);
        this.scene.add(this.lights.movingLight);
    }

    initMaterials() {
        this.materials = {};

        // board material
        this.materials.boardMaterial = new THREE.MeshLambertMaterial({
            map: new THREE.TextureLoader().load(`${this.assetsUrl}/board_texture.jpg`)
        });

        // ground material
        this.materials.groundMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            map: new THREE.TextureLoader().load(`${this.assetsUrl}/ground.png`)
        });

        const defaultTileMaterial = new THREE.MeshLambertMaterial({
            map: new THREE.TextureLoader().load(`${this.assetsUrl}/tiles/-1.png`)
        });

        // tile material
        this.materials.tileMaterial = [];
        for (let row = 0; row < Board.SIZE; row++) {
            let rowMaterial = [];
            for (let col = 0; col < Board.SIZE; col++) {
                const tileModelIndex = Board.posToTileId(row, col);
                const tileMaterial = (tileModelIndex === -1) ? defaultTileMaterial : new THREE.MeshLambertMaterial({
                    map: new THREE.TextureLoader().load(`${this.assetsUrl}/tiles/${tileModelIndex}.png`)
                });
                rowMaterial.push(tileMaterial);
            }
            this.materials.tileMaterial.push(rowMaterial);
        }
    }

    initObjects(callback) {
        let loader = new THREE.JSONLoader();
        let totalObjectsToLoad = 3; // board
        let loadedObjects = 0;

        const checkLoading = () => {
            loadedObjects += 1;
            if (loadedObjects === totalObjectsToLoad && callback) {
                callback();
            }
        };

        // load board
        loader.load(`${this.assetsUrl}/board.js`, (geom) => {
            this.boardModel = new THREE.Mesh(geom, this.materials.boardMaterial);
            this.boardModel.position.y = -0.02;

            this.scene.add(this.boardModel);

            checkLoading();
        });

        // add ground
        this.groundModel = new THREE.Mesh(new THREE.PlaneGeometry(100, 100, 1, 1), this.materials.groundMaterial);
        this.groundModel.position.set(BoardController.SQUARE_SIZE * Board.SIZE / 2, -1.52, BoardController.SQUARE_SIZE * Board.SIZE / 2);
        this.groundModel.rotation.x = -90 * Math.PI / 180;
        this.scene.add(this.groundModel);

        for (let row = 0; row < Board.SIZE; row++) {
            for (let col = 0; col < Board.SIZE; col++) {
                let square = new THREE.Mesh(new THREE.PlaneGeometry(BoardController.SQUARE_SIZE, BoardController.SQUARE_SIZE, 1, 1), this.materials.tileMaterial[row][col]);

                square.position.x = col * BoardController.SQUARE_SIZE + BoardController.SQUARE_SIZE / 2;
                square.position.z = row * BoardController.SQUARE_SIZE + BoardController.SQUARE_SIZE / 2;
                square.position.y = -0.01;

                square.rotation.x = -90 * Math.PI / 180;

                this.scene.add(square);
            }
        }

        // pre-load house model
        let requestModelJson = (type) => {
            let request = new XMLHttpRequest();
            request.open("GET", `${this.assetsUrl}/${type}/model.json`, false);
            request.send(null);

            checkLoading();
            return JSON.parse(request.responseText);
        };

        this.houseModelJson = requestModelJson("house");
        this.hotelModelJson = requestModelJson("hotel");
    }

    onAnimationFrame() {
        requestAnimationFrame(() => this.onAnimationFrame());

        this.cameraController.update();

        // update moving light position
        this.lights.movingLight.position.x = this.camera.position.x;
        this.lights.movingLight.position.z = this.camera.position.z;

        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    boardToWorld(options) {
        const {tileId, type, total, index} = options;
        const pos = Board.tileIdToPos(tileId);
        let x = 0.5 + pos[1];
        let z = 0.5 + pos[0];

        const side = Board.tileIdToSide(tileId);

        if (type === BoardController.MODEL_PLAYER) {
            if (total === 1) {
                return [x * BoardController.SQUARE_SIZE, 0, z * BoardController.SQUARE_SIZE];
            } else {
                switch (side) {
                    case Board.SIDE_TOP:
                        z -= BoardController.MODEL_PLAYER_MARGIN;
                        x = (index % 2 === 0) ? x + BoardController.MODEL_PLAYER_OFFSET : x - BoardController.MODEL_PLAYER_OFFSET;
                        if (total > 2) z = (index < 2) ? z + BoardController.MODEL_PLAYER_OFFSET : z - BoardController.MODEL_PLAYER_OFFSET;
                        break;
                    case Board.SIDE_BOTTOM:
                        z += BoardController.MODEL_PLAYER_MARGIN;
                        x = (index % 2 === 0) ? x - BoardController.MODEL_PLAYER_OFFSET : x + BoardController.MODEL_PLAYER_OFFSET;
                        if (total > 2) z = (index < 2) ? z - BoardController.MODEL_PLAYER_OFFSET : z + BoardController.MODEL_PLAYER_OFFSET;
                        break;
                    case Board.SIDE_LEFT:
                        x -= BoardController.MODEL_PLAYER_MARGIN;
                        z = (index % 2 === 0) ? z - BoardController.MODEL_PLAYER_OFFSET : z + BoardController.MODEL_PLAYER_OFFSET;
                        if (total > 2) x = (index < 2) ? x + BoardController.MODEL_PLAYER_OFFSET : x - BoardController.MODEL_PLAYER_OFFSET;
                        break;
                    case Board.SIDE_RIGHT:
                        x += BoardController.MODEL_PLAYER_MARGIN;
                        z = (index % 2 === 0) ? z + BoardController.MODEL_PLAYER_OFFSET : z - BoardController.MODEL_PLAYER_OFFSET;
                        if (total > 2) x = (index < 2) ? x - BoardController.MODEL_PLAYER_OFFSET : x + BoardController.MODEL_PLAYER_OFFSET;
                        break;
                }
            }
        } else if (type === BoardController.MODEL_PROPERTY) {
            switch (side) {
                case Board.SIDE_TOP:
                    z += BoardController.MODEL_PROPERTY_TOP_MARGIN;
                    x += BoardController.MODEL_PROPERTY_LEFT_MARGIN;
                    x -= (total - 1) * BoardController.MODEL_PROPERTY_MARGIN + BoardController.MODEL_PROPERTY_LEFT_OFFSET * (total > 1);
                    break;
                case Board.SIDE_BOTTOM:
                    z -= BoardController.MODEL_PROPERTY_TOP_MARGIN;
                    x -= BoardController.MODEL_PROPERTY_LEFT_MARGIN;
                    x += (total - 1) * BoardController.MODEL_PROPERTY_MARGIN + BoardController.MODEL_PROPERTY_LEFT_OFFSET * (total > 1);
                    break;
                case Board.SIDE_LEFT:
                    x += BoardController.MODEL_PROPERTY_TOP_MARGIN;
                    z -= BoardController.MODEL_PROPERTY_LEFT_MARGIN;
                    z += (total - 1) * BoardController.MODEL_PROPERTY_MARGIN + BoardController.MODEL_PROPERTY_LEFT_OFFSET * (total > 1);
                    break;
                case Board.SIDE_RIGHT:
                    x -= BoardController.MODEL_PROPERTY_TOP_MARGIN;
                    z += BoardController.MODEL_PROPERTY_LEFT_MARGIN;
                    z -= (total - 1) * BoardController.MODEL_PROPERTY_MARGIN + BoardController.MODEL_PROPERTY_LEFT_OFFSET * (total > 1);
                    break;
            }
        }
        return [x * BoardController.SQUARE_SIZE, 0, z * BoardController.SQUARE_SIZE];
    }
}

class Board {

    constructor() {
        this.initBoard();
    }

    initBoard() {
        this.board = [];
        for (let row = 0; row < Board.SIZE; row++) {
            let boardRow = [];
            for (let col = 0; col < Board.SIZE; col++) {
                boardRow.push({
                    players: [false, false, false, false],
                    propertyManager: null
                })
            }
            this.board.push(boardRow);
        }
    }

    updateTileInfo(tileId, tileInfo) {
        const pos = Board.tileIdToPos(tileId);
        const {type, action, playerIndex, options} = tileInfo;
        switch (type) {
            case BoardController.MODEL_PLAYER:
                this.board[pos[0]][pos[1]].players[playerIndex] = (action === "add");
                break;
            case BoardController.MODEL_PROPERTY:
                this.board[pos[0]][pos[1]].propertyManager = new PropertyManager(options);
                break;
        }
    }

    getTileInfo(tileId) {
        const pos = Board.tileIdToPos(tileId);
        return this.board[pos[0]][pos[1]];
    }

    static tileIdToPos(tileId) {
        if (tileId < 10) {
            return [10, 10 - tileId];
        } else if (tileId < 20) {
            return [20 - tileId, 0];
        } else if (tileId < 30) {
            return [0, tileId - 20];
        } else {
            return [tileId - 30, 10];
        }
    }

    static posToTileId(row, col) {
        if (row === 0) {
            return 20 + col;
        } else if (row === 10) {
            return 10 - col;
        } else if (col === 0) {
            return 20 - row;
        } else if (col === 10) {
            return 30 + row;
        } else {
            return -1;
        }
    }

    static tileIdToSide(tileId) {
        if (tileId < 10) {
            return Board.SIDE_BOTTOM;
        } else if (tileId < 20) {
            return Board.SIDE_LEFT;
        } else if (tileId < 30) {
            return Board.SIDE_TOP;
        } else {
            return Board.SIDE_RIGHT;
        }
    }
}


THREE.OrbitControls = function (object, domElement) {
    this.object = object;
    this.domElement = (domElement !== undefined) ? domElement : document;

    // API

    this.enabled = true;

    this.center = new THREE.Vector3();

    this.userZoom = true;
    this.userZoomSpeed = 1.0;

    this.userRotate = true;
    this.userRotateSpeed = 1.0;

    this.userPan = true;
    this.userPanSpeed = 2.0;

    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

    this.minPolarAngle = 0; // radians
    this.maxPolarAngle = Math.PI; // radians

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.keys = {LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40};

    // internals

    let scope = this;

    let EPS = 0.000001;
    let PIXELS_PER_ROUND = 1800;

    let rotateStart = new THREE.Vector2();
    let rotateEnd = new THREE.Vector2();
    let rotateDelta = new THREE.Vector2();

    let zoomStart = new THREE.Vector2();
    let zoomEnd = new THREE.Vector2();
    let zoomDelta = new THREE.Vector2();

    let phiDelta = 0;
    let thetaDelta = 0;
    let scale = 1;

    let lastPosition = new THREE.Vector3();

    let STATE = {NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2};
    let state = STATE.NONE;

    // events

    let changeEvent = {type: 'change'};

    this.rotateLeft = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        thetaDelta -= angle;
    };

    this.rotateRight = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        thetaDelta += angle;
    };

    this.rotateUp = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        phiDelta -= angle;
    };

    this.rotateDown = angle => {
        if (angle === undefined) {
            angle = getAutoRotationAngle();
        }
        phiDelta += angle;
    };

    this.zoomIn = zoomScale => {
        if (zoomScale === undefined) {
            zoomScale = getZoomScale();
        }
        scale /= zoomScale;
    };

    this.zoomOut = zoomScale => {
        if (zoomScale === undefined) {
            zoomScale = getZoomScale();
        }
        scale *= zoomScale;
    };

    this.pan = distance => {
        distance.transformDirection(this.object.matrix);
        distance.multiplyScalar(scope.userPanSpeed);

        this.object.position.add(distance);
        this.center.add(distance);
    };

    this.update = () => {
        let position = this.object.position;
        let offset = position.clone().sub(this.center);

        // angle from z-axis around y-axis
        let theta = Math.atan2(offset.x, offset.z);

        // angle from y-axis
        let phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z), offset.y);

        if (this.autoRotate) {
            this.rotateLeft(getAutoRotationAngle());
        }

        theta += thetaDelta;
        phi += phiDelta;

        // restrict phi to be between desired limits
        phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

        // restrict phi to be betwee EPS and PI-EPS
        phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

        let radius = offset.length() * scale;

        // restrict radius to be between desired limits
        radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));

        offset.x = radius * Math.sin(phi) * Math.sin(theta);
        offset.y = radius * Math.cos(phi);
        offset.z = radius * Math.sin(phi) * Math.cos(theta);

        position.copy(this.center).add(offset);

        this.object.lookAt(this.center);

        thetaDelta = 0;
        phiDelta = 0;
        scale = 1;

        if (lastPosition.distanceTo(this.object.position) > 0) {
            this.dispatchEvent(changeEvent);
            lastPosition.copy(this.object.position);
        }
    };


    const getAutoRotationAngle = () => {
        return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
    };

    const getZoomScale = () => {
        return Math.pow(0.95, scope.userZoomSpeed);
    };

    const onMouseDown = event => {
        if (scope.enabled === false) return;
        if (scope.userRotate === false) return;

        // event.preventDefault();

        if (event.button === 0) {
            state = STATE.ROTATE;
            rotateStart.set(event.clientX, event.clientY);
        } else if (event.button === 1) {
            state = STATE.ZOOM;
            zoomStart.set(event.clientX, event.clientY);
        } else if (event.button === 2) {
            state = STATE.PAN;
        }

        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('mouseup', onMouseUp, false);
    };

    const onMouseMove = event => {
        if (scope.enabled === false) return;

        event.preventDefault();

        if (state === STATE.ROTATE) {
            rotateEnd.set(event.clientX, event.clientY);
            rotateDelta.subVectors(rotateEnd, rotateStart);

            scope.rotateLeft(2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed);
            scope.rotateUp(2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed);

            rotateStart.copy(rotateEnd);
        } else if (state === STATE.ZOOM) {
            zoomEnd.set(event.clientX, event.clientY);
            zoomDelta.subVectors(zoomEnd, zoomStart);

            if (zoomDelta.y > 0) {
                scope.zoomIn();
            } else {
                scope.zoomOut();
            }

            zoomStart.copy(zoomEnd);
        } else if (state === STATE.PAN) {
            let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;

            scope.pan(new THREE.Vector3(-movementX, movementY, 0));
        }
    };

    const onMouseUp = event => {
        if (scope.enabled === false) return;
        if (scope.userRotate === false) return;

        document.removeEventListener('mousemove', onMouseMove, false);
        document.removeEventListener('mouseup', onMouseUp, false);

        state = STATE.NONE;
    };

    const onMouseWheel = event => {
        if (scope.enabled === false) return;
        if (scope.userZoom === false) return;

        let delta = 0;

        if (event.wheelDelta) { // WebKit / Opera / Explorer 9
            delta = event.wheelDelta;
        } else if (event.detail) { // Firefox
            delta = -event.detail;
        }

        if (delta > 0) {
            scope.zoomOut();
        } else {
            scope.zoomIn();
        }
    };

    const onKeyDown = event => {
        if (scope.enabled === false) return;
        if (scope.userPan === false) return;

        switch (event.keyCode) {
            case scope.keys.UP:
                scope.pan(new THREE.Vector3(0, 1, 0));
                break;
            case scope.keys.BOTTOM:
                scope.pan(new THREE.Vector3(0, -1, 0));
                break;
            case scope.keys.LEFT:
                scope.pan(new THREE.Vector3(-1, 0, 0));
                break;
            case scope.keys.RIGHT:
                scope.pan(new THREE.Vector3(1, 0, 0));
                break;
        }
    };

    this.domElement.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    }, false);
    this.domElement.addEventListener('mousedown', onMouseDown, false);
    this.domElement.addEventListener('mousewheel', onMouseWheel, false);
    this.domElement.addEventListener('DOMMouseScroll', onMouseWheel, false); // firefox
    this.domElement.addEventListener('keydown', onKeyDown, false);

};

THREE.OrbitControls.prototype = Object.create(THREE.EventDispatcher.prototype);


Board.SIZE = 11;

Board.SIDE_TOP = 2;
Board.SIDE_LEFT = 1;
Board.SIDE_RIGHT = 3;
Board.SIDE_BOTTOM = 0;


BoardController.SQUARE_SIZE = 7.273;
BoardController.MODEL_PLAYER = 0;
BoardController.MODEL_PROPERTY = 1;
BoardController.MODEL_PLAYER_OFFSET = 0.2;
BoardController.MODEL_PLAYER_MARGIN = 0.1;
BoardController.MODEL_PROPERTY_TOP_MARGIN = 0.39;
BoardController.MODEL_PROPERTY_LEFT_MARGIN = 0.37;
BoardController.MODEL_PROPERTY_MARGIN = 0.24;
BoardController.MODEL_PROPERTY_LEFT_OFFSET = 0.05;
BoardController.TILE_MAX = 39;


